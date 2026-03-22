require('dotenv').config();

const EBAY_API_ENDPOINT = 'https://api.ebay.com/buy/browse/v1/item_summary/search';
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

        const response = await fetch(`${EBAY_API_ENDPOINT}?q=${encodeURIComponent(itemTitle)}&limit=10`, {
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

function extractCurrentBid(item) {
    // eBay API can return price in different places depending on listing type
    // Try multiple approaches to extract the current bid
    
    let currentBid = 0;

    // Approach 1: item.price.value (standard format)
    if (item.price?.value) {
        currentBid = parseFloat(item.price.value);
        console.log(`✅ Extracted price from item.price.value: ${currentBid}`);
        return currentBid;
    }

    // Approach 2: item.currentBidPrice (auction format)
    if (item.currentBidPrice?.value) {
        currentBid = parseFloat(item.currentBidPrice.value);
        console.log(`✅ Extracted price from item.currentBidPrice.value: ${currentBid}`);
        return currentBid;
    }

    // Approach 3: item.bidCount exists, try to get from pricingSummary
    if (item.pricingSummary?.currentBidPrice?.value) {
        currentBid = parseFloat(item.pricingSummary.currentBidPrice.value);
        console.log(`✅ Extracted price from item.pricingSummary.currentBidPrice.value: ${currentBid}`);
        return currentBid;
    }

    // Approach 4: Check for auctionPrice
    if (item.auctionPrice) {
        currentBid = parseFloat(item.auctionPrice);
        console.log(`✅ Extracted price from item.auctionPrice: ${currentBid}`);
        return currentBid;
    }

    console.warn(`⚠️ WARNING: Could not extract current bid for "${item.title}". Price defaulting to 0. Item structure:`, {
        hasPrice: !!item.price,
        hasCurrentBidPrice: !!item.currentBidPrice,
        hasPricingSummary: !!item.pricingSummary,
        hasAuctionPrice: !!item.auctionPrice,
        priceValue: item.price?.value,
        currentBidPriceValue: item.currentBidPrice?.value
    });

    return currentBid;
}

async function searchAuctions(query) {
    try {
        const token = await getAuthToken();
        
        if (!token) {
            console.error('No valid eBay token');
            return [];
        }

        const response = await fetch(`${EBAY_API_ENDPOINT}?q=${encodeURIComponent(query)}&limit=20&filter=buyingOptions:{AUCTION}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            console.error('eBay API Error:', response.status, response.statusText);
            return [];
        }

        const data = await response.json();
        
        if (!data.itemSummaries || data.itemSummaries.length === 0) {
            console.log('No items found for query:', query);
            return [];
        }

        console.log(`\n🔍 DEBUG: Raw eBay API returned ${data.itemSummaries.length} items`);
        console.log('First raw item structure:', JSON.stringify(data.itemSummaries[0], null, 2));

        const promises = data.itemSummaries.map(async (item) => {
            const itemSoldPrice = await getAverageSoldPrice(item.title);
            return { item, itemSoldPrice };
        });
        
        const itemsWithPrices = await Promise.all(promises);

        return itemsWithPrices.map(({ item, itemSoldPrice }) => {
            const soldPrice = itemSoldPrice;
            
            // ✅ USE THE NEW EXTRACTION FUNCTION
            const currentBid = extractCurrentBid(item);

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
                price: currentBid,  // ✅ NOW USING EXTRACTED PRICE
                condition: item.condition || 'Unknown',
                itemUrl: item.itemWebUrl,
                itemId: item.itemId,
                bidCount: item.bidCount || 0,
                estimatedValue: soldPrice || (currentBid * 1.2) || 0,
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
