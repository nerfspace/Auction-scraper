require('dotenv').config();

const ANALYTICS_ENDPOINT = 'https://api.ebay.com/sell/analytics/v1';
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

async function getTrendingKeywords(keyword, categoryId = null) {
    try {
        const token = await getAuthToken();
        if (!token) return null;

        let url = `${ANALYTICS_ENDPOINT}/keyword_trends?q=${encodeURIComponent(keyword)}`;
        if (categoryId) {
            url += `&category_id=${categoryId}`;
        }

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            console.error('Analytics API error:', response.status);
            return null;
        }

        const data = await response.json();
        
        console.log(`📊 Keyword trends for "${keyword}":`, data.keyword_trends);

        return {
            keyword: keyword,
            trends: data.keyword_trends || [],
            searchVolume: data.keyword_trends?.[0]?.search_count || 0,
            averagePrice: data.keyword_trends?.[0]?.average_price || 0,
            trend: data.keyword_trends?.[0]?.trend || 'FLAT'
        };

    } catch (error) {
        console.error('Error fetching keyword trends:', error);
        return null;
    }
}

async function getListingMetrics() {
    try {
        const token = await getAuthToken();
        if (!token) return null;

        const response = await fetch(`${ANALYTICS_ENDPOINT}/traffic_report`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) return null;

        const data = await response.json();
        return data;

    } catch (error) {
        console.error('Error fetching listing metrics:', error);
        return null;
    }
}

module.exports = { getTrendingKeywords, getListingMetrics };