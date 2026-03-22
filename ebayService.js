require('dotenv').config();

const EBAY_BROWSE_ENDPOINT = 'https://api.ebay.com/buy/browse/v1/item_summary/search';
const EBAY_SEARCH_ENDPOINT = 'https://api.ebay.com/buy/marketplace_insight/v1/item_summary/search';
const CLIENT_ID = process.env.EBAY_CLIENT_ID;
const CLIENT_SECRET = process.env.EBAY_CLIENT_SECRET;

let cachedToken = null;
let tokenExpiry = null;

async function getAuthToken() {
    if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
        return cachedToken;
    }

    try {
        const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
        
        const response = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${credentials}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope'
        });

        const data = await response.json();
        
        if (!data.access_token) {
            console.error('Failed to get eBay token:', data);
            return null;
        }

        cachedToken = data.access_token;
        tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000;
        
        return cachedToken;
    } catch (error) {
        console.error('Error getting eBay auth token:', error);
        return null;
    }
}

async function getAverageSoldPrice(itemTitle) {
    try {
        const token = await getAuthToken();
        if (!token) return null;

        const response = await fetch(`${EBAY_BROWSE_ENDPOINT}?q=${encodeURIComponent(itemTitle)}&limit=10`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) return null;

        const data = await response.json();
        if (!data.itemSummaries || data.itemSummaries.length === 0) return null;

        const prices = data.itemSummaries
            .filter(item => item.price && item.price.value)
            .map(item => parseFloat(item.price.value))
            .slice(0, 5);

        if (prices.length === 0) return null;

        prices.sort((a, b) => a - b);
        const median = prices[Math.floor(prices.length / 2)];
        
        return parseFloat((median * 1.2).toFixed(2));

    } catch (error) {
        console.error('Error getting average sold price:', error);
        return null;
    }
}

async function searchAuctions(query) {
    try {
        const token = await getAuthToken();
        
        if (!token) {
            console.error('No valid eBay token');
            return [];
        }

        // Search for auctions
        console.log(`\n🔍 Searching eBay for: "${query}"`);
        
        const response = await fetch(
            `${EBAY_BROWSE_ENDPOINT}?q=${encodeURIComponent(query)}&limit=20&filter=buyingOptions:{AUCTION}`,
            {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!response.ok) {
            console.error('eBay API Error:', response.status, response.statusText);
            return [];
        }

        const data = await response.json();
        
        if (!data.itemSummaries || data.itemSummaries.length === 0) {
            console.log('No items found for query:', query);
            return [];
        }

        console.log(`📦 Found ${data.itemSummaries.length} auction items`);

        // For each item, get sold price
        const promises = data.itemSummaries.map(async (item) => {
            const itemSoldPrice = await getAverageSoldPrice(item.title);
            return { item, itemSoldPrice };
        });
        
        const itemsWithPrices = await Promise.all(promises);

        return itemsWithPrices.map(({ item, itemSoldPrice }) => {
            // ✅ CRITICAL FIX: Extract the current bid price correctly
            // For auction items, try to get the current bid in this order:
            let currentBid = 0;

            // Method 1: If price exists and is not 0, use it
            if (item.price?.value && parseFloat(item.price.value) > 0) {
                currentBid = parseFloat(item.price.value);
                console.log(`💰 Got price from item.price.value: $${currentBid}`);
            }
            // Method 2: Try currentBidPrice (some auction listings use this)
            else if (item.currentBidPrice?.value) {
                currentBid = parseFloat(item.currentBidPrice.value);
                console.log(`💰 Got price from item.currentBidPrice.value: $${currentBid}`);
            }
            // Method 3: Check for pricingSummary.currentBidPrice
            else if (item.pricingSummary?.currentBidPrice?.value) {
                currentBid = parseFloat(item.pricingSummary.currentBidPrice.value);
                console.log(`💰 Got price from pricingSummary: $${currentBid}`);
            }
            // Method 4: Fallback - if this is an auction with bids, estimate bid at 20% of estimated value
            else if (item.bidCount && item.bidCount > 0) {
                // If we have bid count but no price, the item likely started at low price
                // Use 15% of estimated value as a reasonable estimate
                const soldPrice = itemSoldPrice || (parseFloat(item.price?.value || 0) * 1.2) || 50;
                currentBid = parseFloat((soldPrice * 0.15).toFixed(2));
                console.log(`⚠️  No price found but ${item.bidCount} bids exist. Estimated at $${currentBid}`);
            }
            else {
                console.warn(`❌ Unable to extract price for: "${item.title}"`);
                currentBid = 0;
            }

            // Calculate time remaining
            let timeRemaining = 'Unknown';
            if (item.itemEndDate) {
                const endTime = new Date(item.itemEndDate);
                const now = new Date();
                const diff = endTime - now;
                
                if (diff > 0) {
                    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    
                    if (days > 0) {
                        timeRemaining = `${days}d ${hours}h`;
                    } else {
                        timeRemaining = `${hours}h`;
                    }
                } else {
                    timeRemaining = 'Ended';
                }
            }

            const result = {
                title: item.title,
                price: currentBid,  // ✅ CORRECTED PRICE
                condition: item.condition || 'Unknown',
                itemUrl: item.itemWebUrl,
                itemId: item.itemId,
                bidCount: item.bidCount || 0,
                estimatedValue: itemSoldPrice || (currentBid * 1.5) || 0,
                timeRemaining: timeRemaining,
                itemEndDate: item.itemEndDate,
                soldLink: `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(item.title)}&LH_ItemCondition=3000&LH_Sold=1&LH_Complete=1&sort=asc&rt=nc`
            };

            console.log(`✅ Item: "${result.title.substring(0, 40)}..." | Bid: $${result.price} | Est Value: $${result.estimatedValue}`);
            
            return result;

        });

    } catch (error) {
        console.error('eBay API Error:', error);
        return [];
    }
}

module.exports = { searchAuctions };
