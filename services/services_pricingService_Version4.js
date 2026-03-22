require('dotenv').config();

const PRICING_ENDPOINT = 'https://api.ebay.com/sell/pricing/v1';
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
        cachedToken = data.access_token;
        tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000;
        
        return cachedToken;
    } catch (error) {
        console.error('Error getting auth token:', error);
        return null;
    }
}

async function getItemPricing(itemId) {
    try {
        const token = await getAuthToken();
        if (!token) return null;

        const response = await fetch(
            `${PRICING_ENDPOINT}/get_item_pricing?item_id=${itemId}`,
            {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!response.ok) return null;

        const data = await response.json();
        
        console.log(`💰 Pricing recommendation for item ${itemId}:`, data.pricingResponse);

        return {
            itemId: itemId,
            recommendedPrice: data.pricingResponse?.[0]?.recommendedSalePrice || 0,
            minimumPrice: data.pricingResponse?.[0]?.minimumAdvertisedPrice || 0,
            maximumPrice: data.pricingResponse?.[0]?.maximumPrice || 0,
            competitionPrice: data.pricingResponse?.[0]?.competitionPrice || 0
        };

    } catch (error) {
        console.error('Error fetching pricing:', error);
        return null;
    }
}

async function getBulkPricing(requests) {
    try {
        const token = await getAuthToken();
        if (!token) return null;

        const response = await fetch(
            `${PRICING_ENDPOINT}/get_item_pricing`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ requests })
            }
        );

        if (!response.ok) return null;

        const data = await response.json();
        return data.pricingResponse || [];

    } catch (error) {
        console.error('Error fetching bulk pricing:', error);
        return null;
    }
}

module.exports = { getItemPricing, getBulkPricing };