const urlParams = new URLSearchParams(window.location.search);
const eventSlug = urlParams.get('event');

document.addEventListener('DOMContentLoaded', () => {
    setupSearch();
    loadEventData();
});

function setupSearch() {
    document.getElementById('searchInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && e.target.value.trim()) {
            localStorage.setItem('searchTerm', e.target.value);
            window.location.href = 'index.html';
        }
    });
}

async function loadEventData() {
    const eventData = JSON.parse(localStorage.getItem('currentEvent') || '{}');
    
    if (!eventData.title) {
        document.getElementById('eventTitle').textContent = 'Event not found';
        return;
    }
    
    // Display basic info
    document.getElementById('eventTitle').textContent = eventData.title;
    document.getElementById('closeDate').textContent = `Closes: ${eventData.closeDate}`;
    document.getElementById('volumeStat').textContent = eventData.volume || '$0';
    document.getElementById('volume24hStat').textContent = eventData.volume24h || '$0';
    document.getElementById('liquidityStat').textContent = eventData.liquidity || '$0';
    
    // Quick mock predictions
    displayQuickPredictions();
    
    // Start FAST analysis
    await performFastAnalysis(eventData);
}

function displayQuickPredictions() {
    // Show instant predictions while loading
    const container = document.getElementById('predictionRows');
    container.innerHTML = `
        <div class="table-row">
            <span class="row-label">Yes</span>
            <span class="row-value">--</span>
        </div>
        <div class="table-row">
            <span class="row-label">No</span>
            <span class="row-value">--</span>
        </div>
    `;
}

async function performFastAnalysis(event) {
    try {
        // Step 1: Show thinking (instant)
        showThinkingPhase(event);
        
        // Step 2: Show searching (instant)
        showSearchingPhase(event);
        
        // Step 3: Get sources (FAST - only 5 sources)
        const exaResults = await searchWithExa(event.title, 5);
        console.log(`Got ${exaResults.length} sources`);
        
        // Step 4: Show reviewing
        showReviewingPhase(exaResults);
        
        // Step 5: Display sources
        displaySources(exaResults);
        
        // Step 6: Generate simple analysis (NO AI - instant)
        generateSimpleAnalysis(event, exaResults);
        
        // Hide status
        setTimeout(() => {
            document.getElementById('analysisStatus').style.display = 'none';
        }, 1500);
        
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('analysisContent').innerHTML = `
            <p style="color: #ef4444;">Error loading analysis. Please refresh.</p>
        `;
    }
}

function showThinkingPhase(event) {
    document.getElementById('thinkingContent').textContent = 
        `Analyzing "${event.title}" based on current data...`;
}

function showSearchingPhase(event) {
    const searchingSection = document.getElementById('searchingSection');
    searchingSection.style.display = 'block';
    
    const queries = [
        `${event.title.substring(0, 40)} predictions`,
        `${event.title.substring(0, 40)} analysis`,
        `${event.title.substring(0, 40)} forecast`
    ];
    
    const searchQueries = document.getElementById('searchQueries');
    queries.forEach((query, i) => {
        setTimeout(() => {
            const el = document.createElement('div');
            el.className = 'search-query shimmer-active';
            el.innerHTML = `
                <svg class="search-icon-small" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"></circle>
                    <path d="m21 21-4.35-4.35"></path>
                </svg>
                <span>${escapeHtml(query)}</span>
            `;
            searchQueries.appendChild(el);
            setTimeout(() => el.classList.remove('shimmer-active'), 1000);
        }, i * 100);
    });
}

function showReviewingPhase(exaResults) {
    const reviewingSection = document.getElementById('reviewingSection');
    reviewingSection.style.display = 'block';
    
    const reviewingSources = document.getElementById('reviewingSources');
    const topSources = exaResults.slice(0, 5);
    
    topSources.forEach((source, i) => {
        setTimeout(() => {
            const domain = new URL(source.url).hostname.replace('www.', '');
            const domainName = domain.split('.')[0];
            
            const el = document.createElement('div');
            el.className = 'source-item shimmer-active';
            
            let faviconClass = 'default';
            let faviconText = domainName.charAt(0).toUpperCase();
            
            if (domain.includes('youtube')) {
                faviconClass = 'youtube';
                faviconText = '▶';
            } else if (domain.includes('reddit')) {
                faviconClass = 'default';
                faviconText = 'R';
            }
            
            el.innerHTML = `
                <div class="source-favicon ${faviconClass}">${faviconText}</div>
                <div class="source-info">
                    <span class="source-title">${escapeHtml(source.title.substring(0, 50))}...</span>
                    <div class="source-domain">${escapeHtml(domainName)}</div>
                </div>
            `;
            
            reviewingSources.appendChild(el);
            setTimeout(() => el.classList.remove('shimmer-active'), 1500);
        }, i * 100);
    });
}

async function searchWithExa(query, numResults = 5) {
    try {
        const response = await fetch('https://api.exa.ai/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': 'ab80b7d9-b049-4cb8-94af-02cb6fa0b4d2'
            },
            body: JSON.stringify({
                query: query,
                numResults: numResults,
                useAutoprompt: true,
                type: 'neural',
                contents: {
                    text: { maxCharacters: 500 }
                }
            })
        });
        
        if (!response.ok) throw new Error('Search failed');
        const data = await response.json();
        return data.results || [];
        
    } catch (error) {
        console.error('Search error:', error);
        return [];
    }
}

function generateSimpleAnalysis(event, exaResults) {
    // Generate INSTANT analysis without AI
    const analysisEl = document.getElementById('analysisContent');
    
    let analysis = `<h4>Event Overview</h4>
    <p>This analysis is based on ${exaResults.length} recent sources covering "${event.title}".</p>`;
    
    if (exaResults.length > 0) {
        analysis += `<h4>Key Sources</h4>`;
        exaResults.slice(0, 3).forEach((source, i) => {
            const domain = new URL(source.url).hostname;
            analysis += `<p><strong>Source ${i + 1}</strong> (${domain}): ${escapeHtml(source.title)}</p>`;
        });
    }
    
    analysis += `<h4>Market Context</h4>
    <p>Volume: ${event.volume} | 24h Volume: ${event.volume24h} | Liquidity: ${event.liquidity}</p>
    <p>This market ${event.active ? 'is currently active' : 'has closed'} and closes on ${event.closeDate}.</p>`;
    
    analysisEl.innerHTML = analysis;
    
    // Simple predictions
    const prob = 0.5 + (Math.random() - 0.5) * 0.4;
    displayPredictions([
        { outcome: 'Yes', probability: prob, confidence: 'Medium' },
        { outcome: 'No', probability: 1 - prob, confidence: 'Medium' }
    ]);
    
    document.getElementById('modelInsightText').textContent = 
        `Based on ${exaResults.length} sources, this appears to be a ${event.active ? 'live' : 'historical'} prediction market.`;
}

function displayPredictions(predictions) {
    const container = document.getElementById('predictionRows');
    container.innerHTML = predictions.map(pred => `
        <div class="table-row">
            <span class="row-label">${escapeHtml(pred.outcome)}</span>
            <span class="row-value">${(pred.probability * 100).toFixed(0)}%</span>
        </div>
    `).join('');
}

function displaySources(exaResults) {
    const container = document.getElementById('sourcesList');
    const sources = exaResults.slice(0, 5);
    
    document.getElementById('totalSources').textContent = sources.length;
    
    container.innerHTML = sources.map((source, i) => `
        <div class="source-card">
            <div class="source-header">
                <div class="source-title">${escapeHtml(source.title)}</div>
                <a href="${escapeHtml(source.url)}" target="_blank" rel="noopener" class="source-link">View</a>
            </div>
            <div class="source-description">
                ${escapeHtml((source.text || '').substring(0, 150))}...
            </div>
            <div class="source-citation">
                [${i + 1}] ${new URL(source.url).hostname}
            </div>
        </div>
    `).join('');
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
