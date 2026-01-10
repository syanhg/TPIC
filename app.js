const API_BASE = '/api';
let allEvents = [];
let filteredEvents = [];
let currentTagId = null;

async function init() {
    await loadTags();
    await loadMarkets();
    setupEventListeners();
}

async function loadTags() {
    try {
        const response = await fetch(`${API_BASE}/tags?limit=100`);
        const tags = await response.json();
        const topicFilter = document.getElementById('topicFilter');
        
        if (Array.isArray(tags)) {
            tags.forEach(tag => {
                const option = document.createElement('option');
                option.value = tag.id;
                option.textContent = tag.label;
                topicFilter.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading tags:', error);
    }
}

async function loadMarkets() {
    const loading = document.getElementById('loading');
    const error = document.getElementById('error');
    const container = document.getElementById('marketsContainer');
    
    loading.style.display = 'block';
    error.style.display = 'none';
    error.textContent = '';
    container.innerHTML = '';
    
    try {
        const isLive = document.getElementById('statusToggle').checked;
        const tagId = document.getElementById('topicFilter').value || currentTagId;
        
        // Build query based on filters
        let url = `${API_BASE}/events?limit=100`;
        
        // Apply status filter
        if (isLive) {
            url += `&active=true&closed=false`;
        } else {
            url += `&closed=true`;
        }
        
        // Apply tag filter
        if (tagId) {
            url += `&tag_id=${tagId}`;
        }
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        allEvents = Array.isArray(data) ? data : [];
        
        if (allEvents.length === 0) {
            error.textContent = 'No markets found. Try different filters.';
            error.style.display = 'block';
            loading.style.display = 'none';
            return;
        }
        
        filteredEvents = [...allEvents];
        applyFilters();
        renderMarkets();
        
    } catch (err) {
        console.error('Fetch error:', err);
        error.textContent = `Unable to load markets. ${err.message}`;
        error.style.display = 'block';
    } finally {
        loading.style.display = 'none';
    }
}

function applyFilters() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    
    filteredEvents = allEvents.filter(event => {
        const matchesSearch = !searchTerm || 
            event.title?.toLowerCase().includes(searchTerm) ||
            event.description?.toLowerCase().includes(searchTerm) ||
            event.slug?.toLowerCase().includes(searchTerm);
        
        return matchesSearch;
    });
    
    const sortBy = document.getElementById('sortBy').value;
    const orderBy = document.getElementById('orderBy').value;
    
    filteredEvents.sort((a, b) => {
        let aVal, bVal;
        
        switch(sortBy) {
            case 'volume24hr':
                aVal = parseFloat(a.volume24hr || 0);
                bVal = parseFloat(b.volume24hr || 0);
                break;
            case 'volume':
                aVal = parseFloat(a.volume || 0);
                bVal = parseFloat(b.volume || 0);
                break;
            case 'liquidity':
                aVal = parseFloat(a.liquidity || 0);
                bVal = parseFloat(b.liquidity || 0);
                break;
            case 'new':
                aVal = new Date(a.createdAt || a.startDate || 0).getTime();
                bVal = new Date(b.createdAt || b.startDate || 0).getTime();
                break;
            default:
                return 0;
        }
        
        return orderBy === 'desc' ? bVal - aVal : aVal - bVal;
    });
}

function renderMarkets() {
    const container = document.getElementById('marketsContainer');
    const error = document.getElementById('error');
    container.innerHTML = '';
    error.style.display = 'none';
    
    if (filteredEvents.length === 0) {
        error.textContent = 'No markets match your search criteria';
        error.style.display = 'block';
        return;
    }
    
    filteredEvents.forEach(event => {
        const card = createMarketCard(event);
        container.appendChild(card);
    });
}

function createMarketCard(event) {
    const card = document.createElement('div');
    card.className = 'market-card';
    
    const markets = event.markets || [];
    const mainMarket = markets[0] || {};
    
    let outcomes = [];
    let prices = [];
    
    try {
        if (typeof mainMarket.outcomes === 'string') {
            outcomes = JSON.parse(mainMarket.outcomes);
        } else if (Array.isArray(mainMarket.outcomes)) {
            outcomes = mainMarket.outcomes;
        }
        
        if (typeof mainMarket.outcomePrices === 'string') {
            prices = JSON.parse(mainMarket.outcomePrices);
        } else if (Array.isArray(mainMarket.outcomePrices)) {
            prices = mainMarket.outcomePrices;
        }
    } catch (e) {
        console.error('Error parsing outcomes:', e);
    }
    
    if (outcomes.length === 0) {
        outcomes = ['Yes', 'No'];
        prices = ['0.50', '0.50'];
    }
    
    const predictions = outcomes.slice(0, 2).map((outcome, i) => ({
        outcome,
        price: parseFloat(prices[i] || 0)
    })).sort((a, b) => b.price - a.price);
    
    const imageUrl = event.image || mainMarket.image || '';
    const isLive = event.active && !event.closed;
    const endDate = new Date(event.endDate || mainMarket.endDate);
    const closeText = isLive ? 
        `Closes ${formatDate(endDate)}` : 
        `Closed ${formatDate(endDate)}`;
    
    // Extract and format all available data
    const volume = formatCurrency(event.volume || 0);
    const volume24hr = formatCurrency(event.volume24hr || 0);
    const liquidity = formatCurrency(event.liquidity || 0);
    const numMarkets = markets.length || 1;
    
    card.innerHTML = `
        <img src="${imageUrl}" class="market-image" alt="${escapeHtml(event.title)}" 
             onerror="this.style.background='linear-gradient(135deg, #667eea 0%, #764ba2 100%)'; this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22%3E%3C/svg%3E'">
        <div class="market-content">
            <h3 class="market-title">${escapeHtml(event.title)}</h3>
            
            <div class="market-stats">
                <div class="stat-item">
                    <div class="stat-label">Volume</div>
                    <div class="stat-value">${volume}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">24h Vol</div>
                    <div class="stat-value">${volume24hr}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">Liquidity</div>
                    <div class="stat-value">${liquidity}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">Markets</div>
                    <div class="stat-value">${numMarkets}</div>
                </div>
            </div>
            
            <div class="predictions-label">Top predictions:</div>
            <div class="predictions">
                ${predictions.map(p => `
                    <div class="prediction-item">
                        <div class="prediction-info">
                            <div class="outcome-label">${escapeHtml(p.outcome)}</div>
                            <div class="model-name">Market Price</div>
                        </div>
                        <div class="percentage">${(p.price * 100).toFixed(0)}%</div>
                    </div>
                `).join('')}
            </div>
            
            <div class="market-footer">
                <span class="status-badge ${isLive ? 'live' : 'closed'}">
                    <span class="status-indicator"></span>
                    ${isLive ? 'LIVE' : 'CLOSED'}
                </span>
                <span class="close-date">${closeText}</span>
            </div>
        </div>
    `;
    
    card.addEventListener('click', () => {
        window.location.href = `prediction.html?market=${event.slug}`;
    });
    
    return card;
}

function formatCurrency(value) {
    const num = parseFloat(value);
    if (num >= 1000000) {
        return '$' + (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return '$' + (num / 1000).toFixed(1) + 'K';
    } else {
        return '$' + num.toFixed(0);
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(date) {
    const now = new Date();
    const diff = date - now;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (diff < 0) {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    
    if (days === 0) {
        return 'today';
    } else if (days === 1) {
        return 'tomorrow';
    } else if (days < 30) {
        return `in ${days} days`;
    } else {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
}

function setupEventListeners() {
    const searchInput = document.getElementById('searchInput');
    const searchDropdown = document.getElementById('searchDropdown');
    
    // Search dropdown functionality
    searchInput.addEventListener('focus', () => {
        searchDropdown.classList.add('active');
    });
    
    searchInput.addEventListener('click', (e) => {
        e.stopPropagation();
        searchDropdown.classList.add('active');
    });
    
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !searchDropdown.contains(e.target)) {
            searchDropdown.classList.remove('active');
        }
    });
    
    // Browse option clicks
    document.querySelectorAll('.browse-option').forEach(option => {
        option.addEventListener('click', (e) => {
            e.stopPropagation();
            const sortValue = option.dataset.sort;
            
            if (sortValue === 'new') {
                document.getElementById('sortBy').value = 'new';
                document.getElementById('orderBy').value = 'desc';
            } else if (sortValue === 'competitive') {
                document.getElementById('sortBy').value = 'liquidity';
                document.getElementById('orderBy').value = 'desc';
            } else {
                document.getElementById('sortBy').value = sortValue;
                document.getElementById('orderBy').value = 'desc';
            }
            
            searchDropdown.classList.remove('active');
            applyFilters();
            renderMarkets();
        });
    });
    
    // Nav bar category clicks
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Remove active class from all items
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            
            // Add active class to clicked item
            item.classList.add('active');
            
            const tagId = item.dataset.tag;
            const category = item.dataset.category;
            
            if (category === 'all') {
                currentTagId = null;
                document.getElementById('topicFilter').value = '';
            } else if (tagId) {
                currentTagId = tagId;
                document.getElementById('topicFilter').value = tagId;
            }
            
            loadMarkets();
        });
    });
    
    // Search input
    searchInput.addEventListener('input', () => {
        applyFilters();
        renderMarkets();
    });
    
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            searchDropdown.classList.remove('active');
            applyFilters();
            renderMarkets();
        }
    });
    
    // Topic filter
    document.getElementById('topicFilter').addEventListener('change', (e) => {
        currentTagId = e.target.value;
        
        // Update nav bar active state
        document.querySelectorAll('.nav-item').forEach(item => {
            if (currentTagId && item.dataset.tag === currentTagId) {
                item.classList.add('active');
                document.querySelectorAll('.nav-item').forEach(i => {
                    if (i !== item) i.classList.remove('active');
                });
            } else if (!currentTagId && item.dataset.category === 'all') {
                item.classList.add('active');
                document.querySelectorAll('.nav-item').forEach(i => {
                    if (i !== item) i.classList.remove('active');
                });
            }
        });
        
        loadMarkets();
    });
    
    // Status toggle
    document.getElementById('statusToggle').addEventListener('change', () => {
        loadMarkets();
    });
    
    // Sort controls
    document.getElementById('sortBy').addEventListener('change', () => {
        applyFilters();
        renderMarkets();
    });
    
    document.getElementById('orderBy').addEventListener('change', () => {
        applyFilters();
        renderMarkets();
    });
}

init();
