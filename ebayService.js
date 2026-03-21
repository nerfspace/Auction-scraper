require('dotenv').config();

const EBAY_API_ENDPOINT = 'https://api.ebay.com';
const AUTH_TOKEN = process.env.EBAY_AUTH_TOKEN;

function searchAuctions(query) {
    return fetch(`${EBAY_API_ENDPOINT}?q=${encodeURIComponent(query)}&limit=10`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${AUTH_TOKEN}`,
            'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        if (!response.ok) {
            console.error('eBay API Error:', response.status, response.statusText);
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
    return fetch(`https://api.ebay.com`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${AUTH_TOKEN}`,
            'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
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
