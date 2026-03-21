require('dotenv').config();

const EBAY_API_ENDPOINT = 'https://api.sandbox.ebay.com/buy/browse/v1/item_search';
const APP_ID = process.env.EBAY_APP_ID;

function searchAuctions(query) {
    return fetch(`${EBAY_API_ENDPOINT}?q=${encodeURIComponent(query)}&limit=10`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${APP_ID}`,
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Error fetching auction data');
        }
        return response.json();
    })
    .then(data => data.itemSummaries || [])
    .catch(error => {
        console.error('eBay API Error:', error);
        return [];
    });
}

function getAuctionDetails(itemId) {
    return fetch(`https://api.ebay.com/buy/browse/v1/item/${itemId}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${APP_ID}`,
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Error fetching auction details');
        }
        return response.json();
    })
    .catch(error => {
        console.error('eBay API Error:', error);
        return null;
    });
}

module.exports = { searchAuctions, getAuctionDetails };
