async function searchAuctions() {
    const query = document.getElementById('searchInput').value.trim();
    
    if (!query) {
        showError('Please enter a search term');
        return;
    }

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

        displayStats(data.total_scanned, data.opportunities_found, data.data);
        displayResults(data.data);

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
}
function scanCategory() {
    const category = document.getElementById('categorySelect').value;
    
    if (!category) {
        showError('Please select a category');
        return;
    }

    // Use the selected category as the search query
    document.getElementById('searchInput').value = category;
    searchAuctions();
}
