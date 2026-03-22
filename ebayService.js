require('dotenv').config();

const EBAY_BROWSE_ENDPOINT = 'https://api.ebay.com/buy/browse/v1/item_summary/search';
const EBAY_SHOPPING_ENDPOINT = 'https://open.api.ebay.com/shopping';
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

async function getCurrentBidFromShopping(itemId) {
    try {
        // Try to get current bid using the Shopping API
        const response = await fetch(
            `${EBAY_SHOPPING_ENDPOINT}?callname=GetSingleItem&responseencoding=JSON&appid=${CLIENT_ID}&itemid=${itemId}&IncludeSelector=Details`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!response.ok) return null;

        const data = await response.json();
        
        if (data.Item?.CurrentPrice?.Value) {
            const currentBid = parseFloat(data.Item.CurrentPrice.Value);
            console.log(`✅ Shopping API found current bid: $${currentBid} for item ${itemId}`);
            return currentBid;
        }

        if (data.Item?.ConvertedCurrentPrice?.Value) {
            const currentBid = parseFloat(data.Item.ConvertedCurrentPrice.Value);
            console.log(`✅ Shopping API found converted price: $${currentBid} for item ${itemId}`);
            return currentBid;
        }

        return null;

    } catch (error) {
        console.warn(`⚠️ Shopping API error for item ${itemId}:`, error.message);
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

        console.log(`📦 Found ${data.itemSummaries.length} auction items. Fetching detailed bid data...`);

        // For each item, get sold price AND current bid
        const promises = data.itemSummaries.map(async (item) => {
            const itemSoldPrice = await getAverageSoldPrice(item.title);
            // ✅ NEW: Get the actual current bid from Shopping API
            const currentBid = await getCurrentBidFromShopping(item.itemId);
            return { item, itemSoldPrice, currentBid };
        });
        
        const itemsWithPrices = await Promise.all(promises);

        return itemsWithPrices.map(({ item, itemSoldPrice, currentBid }) => {
            // ✅ Use current bid if available, otherwise use Browse API price
            let finalPrice = 0;

            if (currentBid && currentBid > 0) {
                // Shopping API gave us the real current bid
                finalPrice = currentBid;
                console.log(`💰 Using Shopping API current bid: $${finalPrice}`);
            } else if (item.price?.value && parseFloat(item.price.value) > 0) {
                // Fallback to Browse API price
                finalPrice = parseFloat(item.price.value);
                console.log(`📊 Browse API price: $${finalPrice}`);
            } else {
                // Last resort: estimate from bid count
                finalPrice = 0;
                console.log(`❌ No price data for: ${item.title.substring(0, 40)}...`);
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

            return {
                title: item.title,
                price: finalPrice,  // ✅ NOW USING CURRENT BID FROM SHOPPING API
                condition: item.condition || 'Unknown',
                itemUrl: item.itemWebUrl,
                itemId: item.itemId,
                bidCount: item.bidCount || 0,
                estimatedValue: itemSoldPrice || (finalPrice * 1.5) || 0,
                timeRemaining: timeRemaining,
                itemEndDate: item.itemEndDate,
                soldLink: `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(item.title)}&LH_ItemCondition=3000&LH_Sold=1&LH_Complete=1&sort=asc&rt=nc`
            };
        });

    } catch (error) {
        console.error('eBay API Error:', error);
        return [];
    }
}

module.exports = { searchAuctions };
