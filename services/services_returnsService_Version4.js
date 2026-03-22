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

async function getReturnRequests() {
    try {
        const token = await getAuthToken();
        if (!token) return null;

        const response = await fetch(
            `${FULFILLMENT_ENDPOINT}/return`,
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
        console.log(`🔄 Active return requests:`, data.pageTotal || 0);

        return {
            totalReturns: data.pageTotal || 0,
            returns: data.returns || []
        };

    } catch (error) {
        console.error('Error fetching returns:', error);
        return null;
    }
}

async function approveReturn(returnId, approvalData) {
    try {
        const token = await getAuthToken();
        if (!token) return null;

        const response = await fetch(
            `${FULFILLMENT_ENDPOINT}/return/${returnId}/approve`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(approvalData)
            }
        );

        if (!response.ok) return null;

        console.log(`✅ Return ${returnId} approved`);
        return { success: true, returnId: returnId };

    } catch (error) {
        console.error('Error approving return:', error);
        return null;
    }
}

async function processRefund(returnId, refundData) {
    try {
        const token = await getAuthToken();
        if (!token) return null;

        const response = await fetch(
            `${FULFILLMENT_ENDPOINT}/return/${returnId}/refund`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(refundData)
            }
        );

        if (!response.ok) return null;

        console.log(`✅ Refund processed for return ${returnId}`);
        return { success: true, returnId: returnId };

    } catch (error) {
        console.error('Error processing refund:', error);
        return null;
    }
}

module.exports = { getReturnRequests, approveReturn, processRefund };