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

    // Event delegation for profit buttons
    document.addEventListener('click', function(event) {
        if (event.target.matches('.profit-btn')) {
            searchByProfit(parseInt(event.target.getAttribute('data-profit')));
        } else if (event.target.matches('.time-btn')) {
            filterByTime(event.target.getAttribute('data-time'));
        }
    });

    // Bid filter sliders
    document.getElementById('maxBidSlider')?.addEventListener('input', function() {
        document.getElementById('maxBidValue').textContent = '$' + this.value;
        maxBidFilter = parseInt(this.value);
    });
    
    document.getElementById('minBidSlider')?.addEventListener('input', function() {
        document.getElementById('minBidValue').textContent = '$' + this.value;
        minBidFilter = parseInt(this.value);
    });
    
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
    const diffHours = diffMs / (1000 * 60 **

