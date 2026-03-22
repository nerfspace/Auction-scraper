require('dotenv').config();

const EBAY_BROWSE_ENDPOINT = 'https://api.ebay.com/buy/browse/v1/item_summary/search';
const EBAY_SHOPPING_ENDPOINT = 'https://open.api.ebay.com/shopping';
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
        
        if (!data.access_token) {
            console.error('Failed to get eBay token:', data);
            return null;
        }

        cachedToken = data.access_token;
        tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000;
        
        return cachedToken;
    } catch (error) {
        console.error('Error getting eBay auth token:', error);
        return null;
    }
}

async function getCurrentBidFromShopping(itemId) {
    try {
        const response = await fetch(
            `${EBAY_SHOPPING_ENDPOINT}?callname=GetSingleItem&responseencoding=JSON&appid=${CLIENT_ID}&itemid=${itemId}&IncludeSelector=Details`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!response.ok) return null;

        const data = await response.json();
        
        if (data.Item?.CurrentPrice?.Value) {
            const currentBid = parseFloat(data.Item.CurrentPrice.Value);
            return currentBid;
        }

        if (data.Item?.ConvertedCurrentPrice?.Value) {
            const currentBid = parseFloat(data.Item.ConvertedCurrentPrice.Value);
            return currentBid;
        }

        return null;

    } catch (error) {
        console.warn(`⚠️ Shopping API error for item ${itemId}:`, error.message);
        return null;
    }
}

async function getAverageSoldPrice(itemTitle) {
    try {
        const token = await getAuthToken();
        if (!token) return null;

        const response = await fetch(`${EBAY_BROWSE_ENDPOINT}?q=${encodeURIComponent(itemTitle)}&limit=10`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) return null;

        const data = await response.json();
        if (!data.itemSummaries || data.itemSummaries.length === 0) return null;

        const prices = data.itemSummaries
            .filter(item => item.price && item.price.value)
            .map(item => parseFloat(item.price.value))
            .slice(0, 5);

        if (prices.length === 0) return null;

        prices.sort((a, b) => a - b);
        const median = prices[Math.floor(prices.length / 2)];
        
        return parseFloat((median * 1.2).toFixed(2));

    } catch (error) {
        console.error('Error getting average sold price:', error);
        return null;
    }
}

async function searchAuctionsWithPagination(query, maxItems = 500, concurrency = 5) {
    try {
        const token = await getAuthToken();
        
        if (!token) {
            console.error('No valid eBay token');
            return [];
        }

        console.log(`\n🔍 Searching eBay for: "${query}" (max ${maxItems} items)`);
        
        let allItems = [];
        let offset = 0;
        let totalFound = 0;
        const limit = 200; // Max per page (eBay allows up to 200)
        let hasMore = true;

        // Calculate how many pages we need
        const pagesNeeded = Math.ceil(maxItems / limit);
        console.log(`📄 Will fetch up to ${pagesNeeded} pages (${limit} items per page)`);

        while (hasMore && allItems.length < maxItems) {
            try {
                const response = await fetch(
                    `${EBAY_BROWSE_ENDPOINT}?q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}&filter=buyingOptions:{AUCTION}`,
                    {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
                            'Content-Type': 'application/json'
                        }
                    }
                );

                if (!response.ok) {
                    console.error('eBay API Error:', response.status, response.statusText);
                    hasMore = false;
                    break;
                }

                const data = await response.json();
                
                if (!data.itemSummaries || data.itemSummaries.length === 0) {
                    console.log('No more items found');
                    hasMore = false;
                    break;
                }

                allItems = allItems.concat(data.itemSummaries);
                totalFound = data.total || allItems.length;
                offset += limit;

                console.log(`📦 Fetched ${allItems.length}/${totalFound} items (page ${Math.ceil(allItems.length / limit)})`);

                // Check if we've reached the limit or there are no more items
                if (allItems.length >= maxItems || data.itemSummaries.length < limit) {
                    hasMore = false;
                }

                // Rate limiting: small delay between requests
                await new Promise(resolve => setTimeout(resolve, 100));

            } catch (pageError) {
                console.error('Error fetching page:', pageError);
                hasMore = false;
            }
        }

        // Trim to maxItems
        allItems = allItems.slice(0, maxItems);
        console.log(`\n✅ Total items to process: ${allItems.length}`);

        // Process items with concurrency control
        return await processBidsWithConcurrency(allItems, concurrency);

    } catch (error) {
        console.error('eBay API Error:', error);
        return [];
    }
}

async function processBidsWithConcurrency(items, concurrency = 5) {
    const results = [];
    
    // Process items in batches to avoid rate limiting
    for (let i = 0; i < items.length; i += concurrency) {
        const batch = items.slice(i, i + concurrency);
        const batchPromises = batch.map(async (item) => {
            const itemSoldPrice = await getAverageSoldPrice(item.title);
            const currentBid = await getCurrentBidFromShopping(item.itemId);
            return { item, itemSoldPrice, currentBid };
        });
        
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        // Log progress
        console.log(`⏳ Processed ${Math.min(i + concurrency, items.length)}/${items.length} items for pricing...`);
    }

    // Convert to final format
    return results.map(({ item, itemSoldPrice, currentBid }) => {
        let finalPrice = 0;

        if (currentBid && currentBid > 0) {
            finalPrice = currentBid;
        } else if (item.price?.value && parseFloat(item.price.value) > 0) {
            finalPrice = parseFloat(item.price.value);
        } else {
            finalPrice = 0;
        }

        // Calculate time remaining
        let timeRemaining = 'Unknown';
        if (item.itemEndDate) {
            const endTime = new Date(item.itemEndDate);
            const now = new Date();
            const diff = endTime - now;
            
            if (diff > 0) {
                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                
                if (days > 0) {
                    timeRemaining = `${days}d ${hours}h`;
                } else {
                    timeRemaining = `${hours}h`;
                }
            } else {
                timeRemaining = 'Ended';
            }
        }

        return {
            title: item.title,
            price: finalPrice,
            condition: item.condition || 'Unknown',
            itemUrl: item.itemWebUrl,
            itemId: item.itemId,
            bidCount: item.bidCount || 0,
            estimatedValue: itemSoldPrice || (finalPrice * 1.5) || 0,
            timeRemaining: timeRemaining,
            itemEndDate: item.itemEndDate,
            soldLink: `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(item.title)}&LH_ItemCondition=3000&LH_Sold=1&LH_Complete=1&sort=asc&rt=nc`
        };
    });
}

// Keep old function for backwards compatibility, but limit to 20
async function searchAuctions(query) {
    return searchAuctionsWithPagination(query, 500, 5);
}

module.exports = { searchAuctions, searchAuctionsWithPagination };
