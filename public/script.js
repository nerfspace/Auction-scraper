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
        const row = `<tr>
            <td>${deal.title}</td>
            <td>$${deal.price.toFixed(2)}</td>
            <td>$${deal.estimatedValue.toFixed(2)}</td>
            <td style="color: green; font-weight: bold;">$${deal.profit.toFixed(2)}</td>
            <td>${deal.roi.toFixed(1)}%</td>
            <td>${deal.condition}</td>
            <td>${deal.bidCount}</td>
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
}
