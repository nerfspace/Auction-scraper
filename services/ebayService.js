require('dotenv').config();

const CLIENT_ID = process.env.EBAY_CLIENT_ID;
const CLIENT_SECRET = process.env.EBAY_CLIENT_SECRET;
let accessToken = null;
let tokenExpiry = null;

async function getAccessToken() {
    // Return cached token if still valid
    if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
        return accessToken;
    }

    try {
        const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
        
        const response = await fetch('https://api.sandbox.ebay.com/identity/v1/oauth2/token', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${credentials}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope'
        });

        if (!response.ok) {
            throw new Error(`OAuth failed: ${response.status}`);
        }

        const data = await response.json();
        accessToken = data.access_token;
        tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // Refresh 1 min before expiry
        
        console.log('✅ Got new eBay access token');
        return accessToken;
    } catch (error) {
        console.error('❌ Error getting access token:', error);
        throw error;
    }
}

function searchAuctions(query) {
    return getAccessToken()
        .then(token => {
            return fetch(`https://api.sandbox.ebay.com/buy/browse/v1/item_search?q=${encodeURIComponent(query)}&limit=10`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
                    'Content-Type': 'application/json'
                }
            });
        })
        .then(response => response.json())
        .then(data => {
            const items = data.itemSummaries || [];
            return items.map(item => ({
                title: item.title,
                price: item.price?.value || 0,
                currency: item.price?.currency || 'USD',
                condition: item.condition || 'Unknown',
                itemId: item.itemId,
                estimatedValue: (item.price?.value || 0) * 1.8 // Estimate 80% higher
            }));
        })
        .catch(error => {
            console.error('eBay API Error:', error);
            return [];
        });
}

module.exports = { searchAuctions };
