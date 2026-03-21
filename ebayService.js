const axios = require('axios');
require('dotenv').config();

const ebayService = {
    search: async (query) => {
        const appId = process.env.EBAY_APP_ID;
        const findingApiUrl = `https://svcs.ebay.com/services/search/FindingService/v1`;

        const params = {
            'OPERATION-NAME': 'findItemsAdvanced',
            'SERVICE-VERSION': '1.13.0',
            'SECURITY-APPNAME': appId,
            'keywords': query,
            'paginationInput.entriesPerPage': 10,
            'outputSelector': 'searchResult.item(title, sellingStatus.currentPrice, sellingStatus.bidCount, sellingStatus.timeLeft)'
        };

        try {
            const response = await axios.get(findingApiUrl, { params });
            const items = response.data.findItemsAdvancedResponse[0].searchResult[0].item || [];

            return items.map(item => ({
                title: item.title[0],
                currentBid: item.sellingStatus[0].currentPrice[0].__value__,
                estimatedValue: item.sellingStatus[0].estimatedValue ? item.sellingStatus[0].estimatedValue[0].__value__ : null,
                bidCount: item.sellingStatus[0].bidCount[0],
                timeRemaining: item.sellingStatus[0].timeLeft[0]
            }));
        } catch (error) {
            console.error('Error fetching data from eBay API:', error);
            throw new Error('Unable to fetch eBay data');
        }
    }
};

module.exports = ebayService;