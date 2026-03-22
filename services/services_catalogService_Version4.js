require('dotenv').config();

const CATALOG_ENDPOINT = 'https://api.ebay.com/commerce/catalog/v1';
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

async function searchProducts(query) {
    try {
        const token = await getAuthToken();
        if (!token) return null;

        const response = await fetch(
            `${CATALOG_ENDPOINT}/product_summary/search?q=${encodeURIComponent(query)}`,
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
        console.log(`🔍 Catalog search for "${query}":`, data.productSummaries?.length || 0, 'products found');

        return {
            query: query,
            productCount: data.productSummaries?.length || 0,
            products: data.productSummaries || []
        };

    } catch (error) {
        console.error('Error searching products:', error);
        return null;
    }
}

async function getProductDetails(productId) {
    try {
        const token = await getAuthToken();
        if (!token) return null;

        const response = await fetch(
            `${CATALOG_ENDPOINT}/product/${productId}`,
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
        
        return {
            productId: productId,
            title: data.title,
            description: data.description,
            category: data.category,
            manufacturer: data.manufacturer,
            mpn: data.mpn,
            ean: data.ean,
            upc: data.upc,
            images: data.images || []
        };

    } catch (error) {
        console.error('Error fetching product details:', error);
        return null;
    }
}

module.exports = { searchProducts, getProductDetails };