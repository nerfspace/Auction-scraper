require('dotenv').config();

const AUTH_TOKEN = process.env.EBAY_AUTH_TOKEN;

function searchAuctions(query) {
    const params = new URLSearchParams({
        'OPERATION-NAME': 'findItemsAdvanced',
        'SERVICE-VERSION': '1.13.0',
        'SECURITY-APPNAME': AUTH_TOKEN,
        'keywords': encodeURIComponent(query),
        'paginationInput.entriesPerPage': 100,
        'outputSelector(0)': 'SellerInfo',
        'outputSelector(1)': 'StoreInfo',
        'responseFormat': 'JSON'
    });

    return fetch(`https://svcs.sandbox.ebay.com/services/search/FindingService/v1?${params}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        const items = data.findItemsAdvancedResponse?.[0]?.searchResult?.[0]?.item || [];
        return items.map(item => ({
            title: item.title?.[0] || 'N/A',
            price: item.sellingStatus?.[0]?.currentPrice?.[0]?.__value__ || 0,
            bidCount: item.sellingStatus?.[0]?.bidCount?.[0] || 0,
            condition: item.condition?.[0]?.conditionDisplayName?.[0] || 'Unknown',
            endTime: item.listingInfo?.[0]?.endTime?.[0] || 'N/A'
        }));
    })
    .catch(error => {
        console.error('eBay API Error:', error);
        return [];
    });
}

module.exports = { searchAuctions };
