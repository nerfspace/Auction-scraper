let currentMinProfit = 5;
let allDeals = [];

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
    const category = document.getElementById('categorySelect').value;
    
    if (!category) {
        showError('Please select a category');
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

        // Store all deals
        allDeals = data.data;

        // Filter by current minimum profit
        const filteredDeals = allDeals.filter(deal => deal.profit >= currentMinProfit);

        if (filteredDeals.length === 0) {
            showNoResults();
            return;
        }

        displayStats(data.total_scanned, filteredDeals.length, filteredDeals);
        displayResults(filteredDeals);

    } catch (error) {
        showSpinner(false);
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
        
        const row = `<tr>
            <td><a href="${itemUrl}" target="_blank" rel="noopener noreferrer" style="color: #667eea; text-decoration: none; font-weight: 500; cursor: pointer;">${title}</a></td>
            <td>$${(deal.price || 0).toFixed(2)}</td>
            <td>$${(deal.estimatedValue || 0).toFixed(2)}</td>
            <td style="color: green; font-weight: bold;">$${(deal.profit || 0).toFixed(2)}</td>
            <td>${(deal.roi || 0).toFixed(1)}%</td>
            <td>${deal.condition || 'Unknown'}</td>
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
function showComparison(deal) {
    // Populate current auction info
    document.getElementById('compCurrentTitle').textContent = deal.title;
    document.getElementById('compCurrentPrice').textContent = '$' + (deal.price || 0).toFixed(2);
    document.getElementById('compCurrentCondition').textContent = deal.condition || 'Unknown';
    
    // Set the eBay link
    const currentLink = document.getElementById('compCurrentLink');
    currentLink.href = deal.itemUrl || '#';
    currentLink.textContent = 'View on eBay →';

    // Populate sold item info
    document.getElementById('compSoldPrice').textContent = '$' + (deal.estimatedValue || 0).toFixed(2);
    document.getElementById('compProfit').textContent = '$' + (deal.profit || 0).toFixed(2);
    document.getElementById('compROI').textContent = (deal.roi || 0).toFixed(1) + '%';
    document.getElementById('compFees').textContent = '$' + (deal.fees || 0).toFixed(2);

    // Show the comparison section
    document.getElementById('comparison').classList.remove('hidden');
    
    // Scroll to comparison
    document.getElementById('comparison').scrollIntoView({ behavior: 'smooth' });
}

// Update displayResults to add click handlers
function displayResults(deals) {
    const tbody = document.getElementById('resultsTable');
    tbody.innerHTML = '';

    deals.forEach(deal => {
        const itemUrl = deal.itemUrl || '#';
        const title = deal.title || 'Unknown Item';
        
        const row = `<tr onclick="showComparison(${JSON.stringify(deal).replace(/"/g, '&quot;')})" style="cursor: pointer; transition: background 0.2s;">
            <td><a href="${itemUrl}" target="_blank" rel="noopener noreferrer" style="color: #667eea; text-decoration: none; font-weight: 500; cursor: pointer;" onclick="event.stopPropagation()">${title}</a></td>
            <td>$${(deal.price || 0).toFixed(2)}</td>
            <td>$${(deal.estimatedValue || 0).toFixed(2)}</td>
            <td style="color: green; font-weight: bold;">$${(deal.profit || 0).toFixed(2)}</td>
            <td>${(deal.roi || 0).toFixed(1)}%</td>
            <td>${deal.condition || 'Unknown'}</td>
            <td>${deal.bidCount || 0}</td>
        </tr>`;
        tbody.innerHTML += row;
    });

    document.getElementById('results').classList.remove('hidden');
}
}
