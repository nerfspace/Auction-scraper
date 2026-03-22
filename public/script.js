let currentMinProfit = 5;
let maxBidFilter = 500;
let minBidFilter = 0;
let allDeals = [];
let currentTimeFilter = 'all';

document.addEventListener('DOMContentLoaded', function() {
    const slider = document.getElementById('profitSlider');
    if (slider) {
        slider.addEventListener('input', function() {
            document.getElementById('profitValue').textContent = '$' + this.value;
            currentMinProfit = parseInt(this.value);
        });
    }

    // Button handlers
    document.getElementById('btn-search-auctions')?.addEventListener('click', searchAuctions);
    document.getElementById('btn-scan-category')?.addEventListener('click', scanCategory);
    document.getElementById('btn-apply-profit-threshold')?.addEventListener('click', applyProfitThreshold);
    
    // Search input Enter key
    document.getElementById('searchInput')?.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') searchAuctions();
    });

    // Event delegation for profit buttons and time buttons
    document.addEventListener('click', function(event) {
        if (event.target.matches('.profit-btn')) {
            searchByProfit(parseInt(event.target.getAttribute('data-profit')));
        } else if (event.target.matches('.time-btn')) {
            filterByTime(event.target.getAttribute('data-time'));
        }
    });

    // Bid filter sliders - NOW WORKING ✓
    const maxBidSlider = document.getElementById('maxBidSlider');
    const minBidSlider = document.getElementById('minBidSlider');
    
    if (maxBidSlider) {
        maxBidSlider.addEventListener('input', function() {
            const value = parseInt(this.value);
            const minValue = parseInt(minBidSlider?.value || 0);
            
            // Prevent max from going below min
            if (value < minValue) {
                this.value = minValue;
                return;
            }
            
            document.getElementById('maxBidValue').textContent = '$' + value;
            maxBidFilter = value;
        });
    }
    
    if (minBidSlider) {
        minBidSlider.addEventListener('input', function() {
            const value = parseInt(this.value);
            const maxValue = parseInt(maxBidSlider?.value || 500);
            
            // Prevent min from going above max
            if (value > maxValue) {
                this.value = maxValue;
                return;
            }
            
            document.getElementById('minBidValue').textContent = '$' + value;
            minBidFilter = value;
        });
    }
    
    document.getElementById('btn-apply-bid-filter')?.addEventListener('click', applyBidFilter);
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
    
    if (!category) {
        showError('Please select a category first');
        return;
    }
    
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

function filterByTime(timeFilter) {
    currentTimeFilter = timeFilter;
    const query = document.getElementById('searchInput').value.trim();
    if (!query) {
        showError('Please enter a search term first');
        return;
    }
    performSearch(query);
}

function applyBidFilter() {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) {
        showError('Please enter a search term first');
        return;
    }
    performSearch(query);
}

function isWithinTimeFrame(itemEndDate) {
    if (!itemEndDate) return true;
    const endTime = new Date(itemEndDate);
    const now = new Date();
    const diffMs = endTime - now;
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffMins = diffMs / (1000 * 60);
    const diffDays = diffHours / 24;
    
    switch(currentTimeFilter) {
        case 'next5mins': return diffMins <= 5 && diffMins > 0;
        case 'nextHour': return diffHours <= 1 && diffHours > 0;
        case 'today': return diffDays <= 1 && diffDays > 0;
        case 'thisWeek': return diffDays <= 7 && diffDays > 0;
        case 'all': return diffDays > 0;
        default: return true;
    }
}

async function performSearch(query) {
    showSpinner(true);
    hideAllResults();

    try {
        const response = await fetch(`/opportunities?query=${encodeURIComponent(query)}`);
        const data = await response.json();
        showSpinner(false);

        if (!data.success) {
            showError(data.error || 'Failed to fetch auctions');
            return;
        }

        if (data.opportunities_found === 0) {
            showNoResults();
            return;
        }

        allDeals = data.data;
        const filteredDeals = allDeals.filter(deal => 
            deal.profit >= currentMinProfit && 
            isWithinTimeFrame(deal.itemEndDate) &&
            deal.price >= minBidFilter &&
            deal.price <= maxBidFilter
        );

        if (filteredDeals.length === 0) {
            showNoResults();
            return;
        }

        displayStats(data.total_scanned, filteredDeals.length, filteredDeals);
        displayResults(filteredDeals);

    } catch (error) {
        showSpinner(false);
        console.error('Search error:', error);
        showError('Error: ' + error.message);
    }
}

function displayStats(scanned, deals, data) {
    const bestProfit = data.length > 0 ? Math.max(...data.map(d => d.profit)) : 0;
    document.getElementById('scannedCount').textContent = scanned;
    document.getElementById('dealsCount').textContent = deals;
    document.getElementById('bestProfit').textContent = '$' + bestProfit.toFixed(2);
    document.getElementById('stats').classList.remove('hidden');
}

function displayResults(deals) {
    const tbody = document.getElementById('resultsTable');
    tbody.innerHTML = '';

    deals.forEach(deal => {
        const itemUrl = deal.itemUrl || '#';
        const title = deal.title || 'Unknown Item';
        
        const row = document.createElement('tr');
        row.style.cursor = 'pointer';
        row.style.transition = 'background 0.2s';
        row.innerHTML = `
            <td><a href="${itemUrl}" target="_blank" rel="noopener noreferrer" style="color: #667eea; text-decoration: none; font-weight: 500;" onclick="event.stopPropagation()">${title}</a></td>
            <td>$${(deal.price || 0).toFixed(2)}</td>
            <td>${deal.timeRemaining}</td>
            <td>$${(deal.estimatedValue || 0).toFixed(2)}</td>
            <td style="color: green; font-weight: bold;">$${(deal.profit || 0).toFixed(2)}</td>
            <td>${(deal.roi || 0).toFixed(1)}%</td>
            <td>${deal.bidCount || 0}</td>
        `;
        row.addEventListener('click', () => showComparison(deal));
        tbody.appendChild(row);
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

function showComparison(deal) {
    document.getElementById('compCurrentTitle').textContent = deal.title;
    document.getElementById('compCurrentPrice').textContent = '$' + (deal.price || 0).toFixed(2);
    document.getElementById('compCurrentCondition').textContent = deal.condition || 'Unknown';
    
    const currentLink = document.getElementById('compCurrentLink');
    currentLink.href = deal.itemUrl || '#';
    currentLink.textContent = 'View on eBay →';

    document.getElementById('compSoldPrice').textContent = '$' + (deal.estimatedValue || 0).toFixed(2);
    document.getElementById('compProfit').textContent = '$' + (deal.profit || 0).toFixed(2);
    document.getElementById('compROI').textContent = (deal.roi || 0).toFixed(1) + '%';
    document.getElementById('compFees').textContent = '$' + (deal.fees || 0).toFixed(2);

    // Add sold listing link if available
    const comparisonContent = document.querySelector('.comparison-card:last-child .comparison-content');
    let soldLinkElement = document.getElementById('compSoldLink');
    
    if (deal.soldLink) {
        if (!soldLinkElement) {
            // Create the element if it doesn't exist
            soldLinkElement = document.createElement('p');
            soldLinkElement.id = 'compSoldLink';
            comparisonContent.appendChild(soldLinkElement);
        }
        soldLinkElement.innerHTML = `<strong>View Sold Listings:</strong> <a href="${deal.soldLink}" target="_blank" rel="noopener noreferrer" style="color: #667eea; text-decoration: none; font-weight: 600;">See Similar Sold Items →</a>`;
    } else if (soldLinkElement) {
        // Remove if no soldLink available
        soldLinkElement.remove();
    }

    document.getElementById('comparison').classList.remove('hidden');
    document.getElementById('comparison').scrollIntoView({ behavior: 'smooth' });
}
