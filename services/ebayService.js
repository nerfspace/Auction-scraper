require('dotenv').config();

function searchAuctions(query) {
    // Mock eBay data for testing - mimics real API response
    const mockAuctions = [
        {
            title: `Apple iPhone 12 ${query}`,
            price: 450,
            condition: 'Used',
            estimatedValue: 650,
            bidCount: 5
        },
        {
            title: `Apple iPhone 13 ${query}`,
            price: 520,
            condition: 'Like New',
            estimatedValue: 850,
            bidCount: 12
        },
        {
            title: `Apple iPhone 11 ${query}`,
            price: 380,
            condition: 'Good',
            estimatedValue: 550,
            bidCount: 3
        },
        {
            title: `Apple iPhone SE ${query}`,
            price: 290,
            condition: 'Used',
            estimatedValue: 420,
            bidCount: 8
        },
        {
            title: `Apple iPhone X ${query}`,
            price: 400,
            condition: 'Fair',
            estimatedValue: 500,
            bidCount: 2
        }
    ];

    return Promise.resolve(mockAuctions);
}

module.exports = { searchAuctions };
