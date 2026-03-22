require('dotenv').config();

const INVENTORY_ENDPOINT = 'https://api.ebay.com/sell/inventory/v1';
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

async function getInventoryItem(sku) {
    try {
        const token = await getAuthToken();
        if (!token) return null;

        const response = await fetch(
            `${INVENTORY_ENDPOINT}/inventory/${sku}`,
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
        console.log(`📦 Inventory for SKU ${sku}:`, data);

        return {
            sku: sku,
            quantity: data.availability?.quantity || 0,
            condition: data.condition,
            price: data.price?.value || 0,
            title: data.title,
            description: data.description
        };

    } catch (error) {
        console.error('Error fetching inventory:', error);
        return null;
    }
}

async function createInventoryItem(sku, itemData) {
    try {
        const token = await getAuthToken();
        if (!token) return null;

        const response = await fetch(
            `${INVENTORY_ENDPOINT}/inventory/${sku}`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(itemData)
            }
        );

        if (!response.ok) {
            console.error('Inventory creation error:', response.status);
            return null;
        }

        console.log(`✅ Inventory item created for SKU ${sku}`);
        return { success: true, sku: sku };

    } catch (error) {
        console.error('Error creating inventory item:', error);
        return null;
    }
}

async function updateInventoryQuantity(sku, quantity) {
    try {
        const token = await getAuthToken();
        if (!token) return null;

        const response = await fetch(
            `${INVENTORY_ENDPOINT}/inventory/${sku}`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    availability: { quantity: quantity }
                })
            }
        );

        if (!response.ok) return null;

        console.log(`✅ Inventory quantity updated for ${sku}: ${quantity}`);
        return { success: true, sku: sku, quantity: quantity };

    } catch (error) {
        console.error('Error updating inventory:', error);
        return null;
    }
}

module.exports = { getInventoryItem, createInventoryItem, updateInventoryQuantity };