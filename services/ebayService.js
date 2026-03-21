require('dotenv').config();

const EBAY_API_ENDPOINT = 'https://api.ebay.com/buy/browse/v1/item_summary/search';
const AUTH_TOKEN = process.env.EBAY_AUTH_TOKEN;

async function searchAuctions(query) {
    try {
        const response = await fetch(`${EBAY_API_ENDPOINT}?q=${encodeURIComponent(query)}&limit=20&filter=buyingOptions:{AUCTION}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${AUTH_TOKEN}`,
                'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            console.error('eBay API Error:', response.status, response.statusText);
            return [];
        }

        const data = await response.json();
        
        // Transform eBay API response to our format
        if (!data.itemSummaries || data.itemSummaries.length === 0) {
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
