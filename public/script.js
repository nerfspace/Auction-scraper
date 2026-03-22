let currentMinProfit = 5;
let allDeals = [];
let currentTimeFilter = 'all';
// Update slider display
document.addEventListener('DOMContentLoaded', function() {
    const slider = document.getElementById('profitSlider');
    if (slider) {
        slider.addEventListener('input', function() {
            document.getElementById('profitValue').textContent = '$' + this.value;
            currentMinProfit = parseInt(this.value);
        });
    }
});

async function searchAuctions() {
    const query = document.getElementById('searchInput').value.trim();
    
    if (!query) {
        showError('Please enter a search term');
        return;
    }

    await performSearch(query);
}

function scanCategory() {
    const categorySelect = document.getElementById('categorySelect');
    const category = categorySelect.value.trim();
    
    console.log('Category selected:', category);
    
    if (!category) {
        showError('Please select a category first');
        categorySelect.focus();
        return;
    }

    console.log('Starting scan for:', category);
    document.getElementById('searchInput').value = category;
    performSearch(category);
}

function searchByProfit(profitTarget) {
    currentMinProfit = profitTarget;
    document.getElementById('profitSlider').value = profitTarget;
    document.getElementById('profitValue').textContent = '$' + profitTarget;
    
    const query = document.getElementById('searchInput').value.trim();
    
    if (!query) {
        showError('Please enter a search term first');
        return;
    }

    performSearch(query);
}

function applyProfitThreshold() {
    const query = document.getElementById('searchInput').value.trim();
    
    if (!query) {
        showError('Please enter a search term first');
        return;
    }

    performSearch(query);
}

function filterByTime(timeFrame) {
    currentTimeFilter = timeFrame;

    const query = document.getElementById('searchInput').value.trim();

    if (!query) {
        showError('Please enter a search term first');
        return;
    }

    performSearch(query);
}

function isWithinTimeFrame(endDate) {
    if (!endDate) return currentTimeFilter === 'all';

    const now = new Date();
    const end = new Date(endDate);
    const diffMs = end - now;
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = diffHours / 24;

    switch (currentTimeFilter) {
        case 'nextHour':
            return diffHours > 0 && diffHours <= 1;
        case 'today':
            return diffHours > 0 && diffDays <= 1;
        case 'thisWeek':
            return diffHours > 0 && diffDays <= 7;
        case 'all':
            return diffHours > 0;
        default:
            return diffHours > 0;
    }
}

async function performSearch(query) {
    showSpinner(true);
    hideAllResults();

    try {
        console.log('Searching for:', query);
        const response = await fetch(`/opportunities?query=${encodeURIComponent(query)}`);
        const data = await response.json();
        console.log('API response:', data);
        showSpinner(false);

        if (!data.success) {
            showError(data.error || 'Failed to fetch auctions');
            return;
        }

        if (data.opportunities_found === 0) {
            showNoResults();
            return;
        }

        // Store all deals
        allDeals = data.data;

        // Filter by current minimum profit AND time frame
        const filteredDeals = allDeals.filter(deal =>
            deal.profit >= currentMinProfit && isWithinTimeFrame(deal.itemEndDate)
        );

        if (filteredDeals.length === 0) {
            showNoResults();
            return;
        }

        displayStats(data.total_scanned, filteredDeals.length, filteredDeals);
        displayResults(filteredDeals);
    } catch (error) {
        console.error('Search error:', error);
        showSpinner(false);
        showError('An error occurred. Please try again.');
    }
}

function displayStats(scanned, deals, dealData) {
    document.getElementById('scannedCount').textContent = scanned;
    document.getElementById('dealsCount').textContent = deals;

    const bestProfit = dealData.reduce((max, deal) => Math.max(max, deal.profit || 0), 0);
    document.getElementById('bestProfit').textContent = '$' + bestProfit.toFixed(2);

    document.getElementById('stats').classList.remove('hidden');
}

function displayResults(deals) {
    const tbody = document.getElementById('resultsTable');
    tbody.innerHTML = '';

    deals.forEach(deal => {
        const itemUrl = deal.itemUrl || '#';
        const title = deal.title || 'Unknown Item';

        const row = `<tr onclick="showComparison(${JSON.stringify(deal).replace(/"/g, '&quot;')})" style="cursor: pointer; transition: background 0.2s;">
            <td><a href="${itemUrl}" target="_blank" rel="noopener noreferrer" style="color: #667eea; text-decoration: none; font-weight: 500; cursor: pointer;" onclick="event.stopPropagation()">${title}</a></td>
            <td>$${(deal.price || 0).toFixed(2)}</td>
            <td>${deal.timeRemaining || 'Unknown'}</td>
            <td>$${(deal.estimatedValue || 0).toFixed(2)}</td>
            <td style="color: green; font-weight: bold;">$${(deal.profit || 0).toFixed(2)}</td>
            <td>${(deal.roi || 0).toFixed(1)}%</td>
            <td>${deal.bidCount || 0}</td>
        </tr>`;
        tbody.innerHTML += row;
    });

    document.getElementById('results').classList.remove('hidden');
}

function showSpinner(show) {
    document.getElementById('loadingSpinner').classList.toggle('hidden', !show);
}

function hideAllResults() {
    document.getElementById('results').classList.add('hidden');
    document.getElementById('stats').classList.add('hidden');
    document.getElementById('error').classList.add('hidden');
    document.getElementById('noResults').classList.add('hidden');
    document.getElementById('comparison').classList.add('hidden');
}

function showError(message) {
    document.getElementById('error').textContent = message;
    document.getElementById('error').classList.remove('hidden');
}

function showNoResults() {
    document.getElementById('noResults').classList.remove('hidden');
}

function handleEnter(event) {
    if (event.key === 'Enter') {
        searchAuctions();
    }
}

function showComparison(deal) {
    // Populate current auction info
    document.getElementById('compCurrentTitle').textContent = deal.title;
    document.getElementById('compCurrentPrice').textContent = '$' + (deal.price || 0).toFixed(2);
    document.getElementById('compCurrentCondition').textContent = deal.condition || 'Unknown';
    
    // Set the eBay link for current auction
    const currentLink = document.getElementById('compCurrentLink');
    currentLink.href = deal.itemUrl || '#';
    currentLink.textContent = 'View on eBay →';

    // Populate sold item info
    document.getElementById('compSoldPrice').textContent = '$' + (deal.estimatedValue || 0).toFixed(2);
    document.getElementById('compProfit').textContent = '$' + (deal.profit || 0).toFixed(2);
    document.getElementById('compROI').textContent = (deal.roi || 0).toFixed(1) + '%';
    document.getElementById('compFees').textContent = '$' + (deal.fees || 0).toFixed(2);

    // Add sold listing link if available
    const soldLinkContainer = document.getElementById('compSoldLink');
    if (deal.soldLink) {
        if (!soldLinkContainer) {
            const newP = document.createElement('p');
            newP.id = 'compSoldLink';
            newP.innerHTML = `<strong>Last Sold:</strong> <a href="${deal.soldLink}" target="_blank" style="color: #667eea; text-decoration: none; font-weight: 600;">View Sold Listing →</a>`;
            document.querySelector('.comparison-card:last-child .comparison-content').appendChild(newP);
        } else {
            soldLinkContainer.innerHTML = `<strong>Last Sold:</strong> <a href="${deal.soldLink}" target="_blank" style="color: #667eea; text-decoration: none; font-weight: 600;">View Sold Listing →</a>`;
        }
    }

    // Show the comparison section
    document.getElementById('comparison').classList.remove('hidden');
    
    // Scroll to comparison
    document.getElementById('comparison').scrollIntoView({ behavior: 'smooth' });
}
