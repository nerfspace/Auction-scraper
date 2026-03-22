require('dotenv').config();

const LISTING_ENDPOINT = 'https://api.ebay.com/sell/listing/v1';
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

async function createFixedPriceListing(listingData) {
    try {
        const token = await getAuthToken();
        if (!token) return null;

        const response = await fetch(
            `${LISTING_ENDPOINT}/item`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(listingData)
            }
        );

        if (!response.ok) {
            console.error('Listing creation error:', response.status, await response.text());
            return null;
        }

        const data = await response.json();
        console.log(`✅ Listing created:`, data.itemId);

        return {
            success: true,
            itemId: data.itemId,
            sku: data.sku,
            listingStatus: data.listingStatus
        };

    } catch (error) {
        console.error('Error creating listing:', error);
        return null;
    }
}

async function updateListing(itemId, updateData) {
    try {
        const token = await getAuthToken();
        if (!token) return null;

        const response = await fetch(
            `${LISTING_ENDPOINT}/item/${itemId}`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updateData)
            }
        );

        if (!response.ok) return null;

        const data = await response.json();
        console.log(`✅ Listing ${itemId} updated`);

        return { success: true, itemId: data.itemId };

    } catch (error) {
        console.error('Error updating listing:', error);
        return null;
    }
}

async function deleteListing(itemId) {
    try {
        const token = await getAuthToken();
        if (!token) return null;

        const response = await fetch(
            `${LISTING_ENDPOINT}/item/${itemId}`,
            {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!response.ok) return null;

        console.log(`✅ Listing ${itemId} deleted`);
        return { success: true };

    } catch (error) {
        console.error('Error deleting listing:', error);
        return null;
    }
}

module.exports = { createFixedPriceListing, updateListing, deleteListing };