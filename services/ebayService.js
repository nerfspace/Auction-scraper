// ebayService.js

const fetch = require('node-fetch');

const EBAY_API_ENDPOINT = 'https://api.ebay.com/buy/browse/v1/item_search';
const APP_ID = 'YOUR_APP_ID'; // Replace with your eBay App ID

async function searchAuctions(query) {
    const response = await fetch(`${EBAY_API_ENDPOINT}?q=${encodeURIComponent(query)}&limit=10`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${APP_ID}`
        }
    });
    
    if (!response.ok) {
        throw new Error('Error fetching auction data');
    }

    const data = await response.json();
    return data; // Returns auction data relevant to the search
}

async function getAuctionDetails(itemId) {
    const response = await fetch(`https://api.ebay.com/buy/browse/v1/item/${itemId}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${APP_ID}`
        }
    });
    
    if (!response.ok) {
        throw new Error('Error fetching auction details');
    }

    const data = await response.json();
    return data; // Returns detailed auction information
}

module.exports = { searchAuctions, getAuctionDetails };
