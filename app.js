const API_BASE = 'https://gamma-api.polymarket.com';
let allEvents = [];
let filteredEvents = [];
let availableTags = new Set();

// Initialize the app
async function init() {
    await loadTags();
    await loadMarkets();
    setupEventListeners();
}

// Load available tags
async function loadTags() {
    try {
        const response = await fetch(`${API_BASE}/tags?limit=100`);
        const tags = await response.json();
        const topicFilter = document.getElementById('topicFilter');
        
        tags.forEach(tag => {
            const option = document.createElement('option');
            option.value = tag.id;
            option.textContent = tag.label;
            topicFilter.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading tags:', error);
    }
}

// Load markets from API
async function loadMarkets() {
    const loading = document.getElementById('loading');
    const error = document.getElementById('error');
    const container = document.getElementById('marketsContainer');
    
    loading.style.display = 'block';
    error.style.display = 'none';
    container.innerHTML = '';
    
    try {
        const isLive = document.getElementById('statusToggle').checked;
        const tagId = document.getElementById('topicFilter').value;
        
        let url = `${API_BASE}/events?limit=50&active=true&closed=${!isLive}`;
        if (tagId) {
            url += `&tag_id=${tagId}`;
        }
        
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch markets');
        
        allEvents = await response.json();
        filteredEvents = [...allEvents];
        
        applyFilters();
        renderMarkets();
        
    } catch (err) {
        error.textContent = `Error loading markets: ${err.message}`;
        error.style.display = 'block';
        console.error('Error:', err);
    } finally {
        loading.style.display = 'none';
    }
}

// Apply search and filters
function applyFilters() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    
    filteredEvents = allEvents.filter(event => {
        const matchesSearch = !searchTerm || 
            event.title?.toLowerCase().includes(searchTerm) ||
            event.description?.toLowerCase().includes(searchTerm) ||
            event.slug?.toLowerCase().includes(searchTerm);
        
        return matchesSearch;
    });
    
    // Apply sorting
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
            case 'startDate':
                aVal = new Date(a.startDate || 0).getTime();
                bVal = new Date(b.startDate || 0).getTime();
                break;
            default:
                return 0;
        }
        
        return orderBy === 'desc' ? bVal - aVal : aVal - bVal;
    });
}

// Render markets to the page
function renderMarkets() {
    const container = document.getElementById('marketsContainer');
    container.innerHTML = '';
    
    if (filteredEvents.length === 0) {
        container.innerHTML = '<div class="error">No markets found</div>';
        return;
    }
    
    filteredEvents.forEach(event => {
        const card = createMarketCard(event);
        container.appendChild(card);
    });
}

// Create a market card
function createMarketCard(event) {
    const card = document.createElement('div');
    card.className = 'market-card';
    
    const markets = event.markets || [];
    const mainMarket = markets[0] || {};
    
    // Parse outcomes and prices
    let outcomes = [];
    let prices = [];
    try {
        outcomes = JSON.parse(mainMarket.outcomes || '[]');
        prices = JSON.parse(mainMarket.outcomePrices || '[]');
    } catch (e) {
        outcomes = ['Yes', 'No'];
        prices = ['0.50', '0.50'];
    }
    
    // Get top 2 predictions
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
    
    card.innerHTML = `
        <img src="${imageUrl}" class="market-image" alt="${event.title}" 
             onerror="this.style.background='linear-gradient(135deg, #667eea 0%, #764ba2 100%)'; this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22%3E%3C/svg%3E'">
        <div class="market-content">
            <h3 class="market-title">${event.title}</h3>
            <div class="predictions-label">Top predictions for:</div>
            <div class="predictions">
                ${predictions.map(p => `
                    <div class="prediction-item">
                        <div class="prediction-info">
                            <div class="outcome-label">${p.outcome}</div>
                            <div class="model-name">Gemini 2.5 Pro</div>
                        </div>
                        <div class="percentage">${(p.price * 100).toFixed(0)}%</div>
                    </div>
                `).join('')}
            </div>
            <div class="market-footer">
                <span class="status-badge ${isLive ? 'live' : 'closed'}">
                    ${isLive ? '● LIVE' : 'CLOSED'}
                </span>
                <span class="close-date">${closeText}</span>
            </div>
        </div>
    `;
    
    card.addEventListener('click', () => {
        window.open(`https://polymarket.com/event/${event.slug}`, '_blank');
    });
    
    return card;
}

// Format date
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

// Setup event listeners
function setupEventListeners() {
    document.getElementById('searchInput').addEventListener('input', () => {
        applyFilters();
        renderMarkets();
    });
    
    document.getElementById('searchBtn').addEventListener('click', () => {
        applyFilters();
        renderMarkets();
    });
    
    document.getElementById('topicFilter').addEventListener('change', loadMarkets);
    document.getElementById('statusToggle').addEventListener('change', loadMarkets);
    
    document.getElementById('sortBy').addEventListener('change', () => {
        applyFilters();
        renderMarkets();
    });
    
    document.getElementById('orderBy').addEventListener('change', () => {
        applyFilters();
        renderMarkets();
    });
    
    // Search on Enter key
    document.getElementById('searchInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            applyFilters();
            renderMarkets();
        }
    });
}

// Start the app
init();
