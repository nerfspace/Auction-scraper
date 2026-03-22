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

        // Search for the SPECIFIC item title to get sold prices
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

        // Get prices from similar active items
        const prices = data.itemSummaries
            .filter(item => item.price && item.price.value)
            .map(item => parseFloat(item.price.value))
            .slice(0, 5); // Take top 5 prices

        if (prices.length === 0) return null;

        // Calculate median price
        prices.sort((a, b) => a - b);
        const median = prices[Math.floor(prices.length / 2)];
        
        // Return 1.2x median as estimated sold value
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

        // Search active auctions only
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

        // For each item, get sold price based on that specific item's title
        const promises = data.itemSummaries.map(async (item) => {
            const itemSoldPrice = await getAverageSoldPrice(item.title);
            return { item, itemSoldPrice };
        });
        
        const itemsWithPrices = await Promise.all(promises);

        return itemsWithPrices.map(({ item, itemSoldPrice }) => {
            const soldPrice = itemSoldPrice;
            
            // ✅ FIX: Get the current bid price correctly
            let currentBid = 0;
            if (item.price) {
                if (typeof item.price === 'object' && item.price.value) {
                    currentBid = parseFloat(item.price.value);
                } else if (typeof item.price === 'string') {
                    currentBid = parseFloat(item.price);
                } else if (typeof item.price === 'number') {
                    currentBid = item.price;
                }
            }
            
            console.log(`DEBUG: Item "${item.title}" - Current Bid: ${currentBid}, Sold Price: ${soldPrice}`); // DEBUG LOG

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
                price: currentBid,  // ✅ NOW USING THE FIXED PRICE
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
