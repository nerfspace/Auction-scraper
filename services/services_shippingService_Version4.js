require('dotenv').config();

const FULFILLMENT_ENDPOINT = 'https://api.ebay.com/sell/fulfillment/v1';
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

async function getShippingQuote(orderId) {
    try {
        const token = await getAuthToken();
        if (!token) return null;

        const response = await fetch(
            `${FULFILLMENT_ENDPOINT}/order/${orderId}/shipping_fulfillments`,
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
        console.log(`🚚 Shipping info for order ${orderId}:`, data);

        return {
            orderId: orderId,
            fulfillments: data.fulfillments || []
        };

    } catch (error) {
        console.error('Error fetching shipping:', error);
        return null;
    }
}

async function createShipment(orderId, shipmentData) {
    try {
        const token = await getAuthToken();
        if (!token) return null;

        const response = await fetch(
            `${FULFILLMENT_ENDPOINT}/order/${orderId}/shipping_fulfillment`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(shipmentData)
            }
        );

        if (!response.ok) {
            console.error('Shipment creation error:', response.status);
            return null;
        }

        const data = await response.json();
        console.log(`✅ Shipment created for order ${orderId}`);

        return { success: true, fulfillmentId: data.fulfillmentId };

    } catch (error) {
        console.error('Error creating shipment:', error);
        return null;
    }
}

module.exports = { getShippingQuote, createShipment };