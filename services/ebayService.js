require('dotenv').config();

const EBAY_API_ENDPOINT = 'https://api.ebay.com/buy/browse/v1/item_summary/search';
const CLIENT_ID = process.env.EBAY_CLIENT_ID;
const CLIENT_SECRET = process.env.EBAY_CLIENT_SECRET;

let cachedToken = null;
let tokenExpiry = null;

async function getAuthToken() {
    // Return cached token if still valid
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
        tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // Refresh 1 min before expiry
        
        return cachedToken;
    } catch (error) {
        console.error('Error getting eBay auth token:', error);
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

        return data.itemSummaries.map(item => ({
            title: item.title,
            price: item.price?.value || 0,
            condition: item.condition || 'Unknown',
            itemUrl: item.itemWebUrl,
            itemId: item.itemId,
            bidCount: item.bidCount || 0,
            estimatedValue: item.price?.value || 0
        }));

    } catch (error) {
        console.error('eBay API Error:', error);
        return [];
    }
}

module.exports = { searchAuctions };
