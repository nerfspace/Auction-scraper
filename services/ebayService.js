require('dotenv').config();

const EBAY_API_ENDPOINT = 'https://api.ebay.com/buy/browse/v1/item_summary/search';
const EBAY_SOLD_ENDPOINT = 'https://api.ebay.com/buy/browse/v1/item_summary/search';
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

async function getSoldPrice(query) {
    try {
        const token = await getAuthToken();
        
        if (!token) {
            return null;
        }

        // Search for SOLD items only
        const response = await fetch(`${EBAY_SOLD_ENDPOINT}?q=${encodeURIComponent(query)}&limit=5&filter=buyingOptions:{AUCTION},itemLocationCountry:US&sort=-soldDate`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        
        if (!data.itemSummaries || data.itemSummaries.length === 0) {
            return null;
        }

        // Calculate average price of sold items
        const prices = data.itemSummaries
            .filter(item => item.price && item.price.value)
            .map(item => parseFloat(item.price.value));

        if (prices.length === 0) return null;

        const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
        return parseFloat(avgPrice.toFixed(2));

    } catch (error) {
        console.error('Error getting sold price:', error);
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

        const response = await fetch(`${EBAY_API_ENDPOINT}?q=${encodeURIComponent(query)}&limit=20`, {
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

        // Get sold price for this item type
        const soldPrice = await getSoldPrice(query);

        return data.itemSummaries.map(item => ({
            title: item.title,
            price: parseFloat(item.price?.value) || 0,
            condition: item.condition || 'Unknown',
            itemUrl: item.itemWebUrl,
            itemId: item.itemId,
            bidCount: item.bidCount || 0,
            estimatedValue: soldPrice || (parseFloat(item.price?.value) * 1.2) || 0
        }));

    } catch (error) {
        console.error('eBay API Error:', error);
        return [];
    }
}

module.exports = { searchAuctions };
