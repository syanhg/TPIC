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
    
    // Start comprehensive analysis
    await performAdvancedAnalysis(eventData);
}

async function performAdvancedAnalysis(event) {
    try {
        // Step 1: Show thinking phase (instant)
        showThinkingPhase(event);
        
        // Step 2: Show searching phase immediately
        setTimeout(() => showSearchingPhase(event), 100);
        
        // Step 3: Start web research
        setTimeout(async () => {
            const exaResults = await searchWithExa(event.title, 10);
            console.log(`Found ${exaResults.length} sources for analysis`);
            
            // Show reviewing with shimmer effect
            showReviewingPhase(exaResults);
            
            // Display sources in sidebar
            displaySources(exaResults);
            
            // Step 4: Start Claude analysis
            await streamAdvancedAnalysis(event, exaResults);
            
            // Hide status after complete
            setTimeout(() => {
                const statusEl = document.getElementById('analysisStatus');
                if (statusEl) statusEl.style.display = 'none';
            }, 2000);
        }, 600);
        
    } catch (error) {
        console.error('Analysis error:', error);
        document.getElementById('analysisContent').innerHTML = `
            <p style="color: #ef4444;">Analysis encountered an error: ${error.message}</p>
            <p style="color: #6b7280; font-size: 12px; margin-top: 8px;">Please refresh the page to try again.</p>
        `;
    }
}

function showThinkingPhase(event) {
    const thinkingContent = document.getElementById('thinkingContent');
    let thinkingText = `Predicting the future trajectory of "${event.title}" based on current trends and analyses.`;
    thinkingContent.textContent = thinkingText;
}

function showSearchingPhase(event) {
    const searchingSection = document.getElementById('searchingSection');
    searchingSection.style.display = 'block';
    
    const searchQueries = document.getElementById('searchQueries');
    const eventIntel = extractEventIntelligence(event.title);
    
    const queries = generateSearchQueries(event, eventIntel);
    
    // Display all queries with stagger
    queries.forEach((query, i) => {
        setTimeout(() => {
            const queryEl = document.createElement('div');
            queryEl.className = 'search-query shimmer-active';
            queryEl.innerHTML = `
                <svg class="search-icon-small" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"></circle>
                    <path d="m21 21-4.35-4.35"></path>
                </svg>
                <span>${escapeHtml(query)}</span>
            `;
            searchQueries.appendChild(queryEl);
            
            setTimeout(() => queryEl.classList.remove('shimmer-active'), 1500);
        }, i * 150);
    });
}

function generateSearchQueries(event, eventIntel) {
    const title = event.title;
    const queries = [];
    
    queries.push(`${title.substring(0, 50)} predictions 2026`);
    
    if (eventIntel.type === 'sports' || eventIntel.type === 'championship') {
        if (eventIntel.entities.length >= 2) {
            queries.push(`${eventIntel.entities[0]} vs ${eventIntel.entities[1]} analysis`);
        }
        queries.push(`${title.substring(0, 40)} expert forecasts`);
    } else if (eventIntel.type === 'political') {
        queries.push(`${title.substring(0, 40)} polls forecasts`);
        queries.push(`${title.substring(0, 40)} expert analysis`);
    } else if (eventIntel.type === 'financial') {
        queries.push(`${title.substring(0, 40)} market analysis`);
        queries.push(`${title.substring(0, 40)} price forecasts`);
    } else {
        queries.push(`${title.substring(0, 40)} analysis`);
        queries.push(`${title.substring(0, 40)} expert predictions`);
    }
    
    return queries.slice(0, 3);
}

function showReviewingPhase(exaResults) {
    const reviewingSection = document.getElementById('reviewingSection');
    const reviewingSources = document.getElementById('reviewingSources');
    
    reviewingSection.style.display = 'block';
    
    const topSources = exaResults.slice(0, 6);
    
    topSources.forEach((source, index) => {
        setTimeout(() => {
            const domain = new URL(source.url).hostname.replace('www.', '');
            const domainName = domain.split('.')[0];
            
            const sourceEl = document.createElement('div');
            sourceEl.className = 'source-item shimmer-active';
            
            let faviconClass = 'default';
            let faviconText = domainName.charAt(0).toUpperCase();
            
            if (domain.includes('youtube')) {
                faviconClass = 'youtube';
                faviconText = '▶';
            } else if (domain.includes('gizmodo')) {
                faviconClass = 'gizmodo';
                faviconText = 'G';
            } else if (domain.includes('thestreet')) {
                faviconClass = 'thestreet';
                faviconText = '₿';
            } else if (domain.includes('trading')) {
                faviconClass = 'tradingkey';
                faviconText = '⚡';
            }
            
            sourceEl.innerHTML = `
                <div class="source-favicon ${faviconClass}">${faviconText}</div>
                <div class="source-info">
                    <span class="source-title">${escapeHtml(source.title.substring(0, 60))}${source.title.length > 60 ? '...' : ''}</span>
                    <div class="source-domain">${escapeHtml(domainName)}</div>
                </div>
            `;
            
            reviewingSources.appendChild(sourceEl);
            setTimeout(() => sourceEl.classList.remove('shimmer-active'), 1800);
        }, index * 120);
    });
}

async function searchWithExa(query, numResults = 10) {
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
                    text: { maxCharacters: 1200 }
                }
            })
        });
        
        if (!response.ok) throw new Error('Exa API error');
        const data = await response.json();
        return data.results || [];
        
    } catch (error) {
        console.error('Exa error:', error);
        return [];
    }
}

async function streamAdvancedAnalysis(event, exaResults) {
    const eventIntel = extractEventIntelligence(event.title);
    const prompt = buildAnalysisPrompt(event, exaResults, eventIntel);
    
    try {
        const analysisEl = document.getElementById('analysisContent');
        analysisEl.innerHTML = '';
        
        let fullText = '';
        
        // Use puter.ai.chat with streaming based on documentation
        const response = await puter.ai.chat(prompt, {
            model: 'claude-sonnet-4-20250514',
            stream: true
        });
        
        // Stream the response
        for await (const chunk of response) {
            if (chunk?.text) {
                fullText += chunk.text;
                analysisEl.innerHTML = formatAnalysisText(fullText);
            }
        }
        
        // Parse and display results
        const analysis = parseStreamedResponse(fullText);
        displayPredictions(analysis.predictions);
        displayModelInsight(analysis.insight);
        
    } catch (error) {
        console.error('Claude error:', error);
        throw error;
    }
}

function extractEventIntelligence(title) {
    const titleLower = title.toLowerCase();
    let eventType = 'general';
    let entities = [];
    let context = '';
    
    if (titleLower.match(/\bvs\b|\bat\b|game|match|championship|bowl|playoff|finals?|tournament/)) {
        eventType = 'sports';
        const vsMatch = title.match(/(.+?)\s+(?:vs\.?|at)\s+(.+?)(?:\s|$|\?)/i);
        if (vsMatch) {
            entities = [vsMatch[1].trim(), vsMatch[2].trim()];
        }
        context = 'Sports event - analyze recent form, injuries, historical matchups';
    } else if (titleLower.match(/election|president|senate|congress|poll|vote|campaign/)) {
        eventType = 'political';
        context = 'Political event - analyze polling data, historical trends, demographics';
    } else if (titleLower.match(/bitcoin|btc|eth|stock|price|\$|market|trading/)) {
        eventType = 'financial';
        context = 'Financial prediction - consider market trends, technical indicators';
    } else {
        eventType = 'binary';
        entities = ['Yes', 'No'];
        context = 'Binary outcome - evaluate evidence for and against';
    }
    
    return { type: eventType, entities, context, title };
}

function buildAnalysisPrompt(event, exaResults, eventIntel) {
    const topSources = exaResults.slice(0, 8);
    const sources = topSources.map((result, i) => {
        const cleanText = (result.text || '').replace(/\n+/g, ' ').trim();
        return `SOURCE ${i + 1}: "${result.title}"
Publisher: ${new URL(result.url).hostname}
Content: ${cleanText.substring(0, 800)}
---`;
    }).join('\n\n');
    
    let entityGuidance = '';
    if (eventIntel.entities.length > 0) {
        entityGuidance = `\nOUTCOMES: ${eventIntel.entities.join(' vs ')}`;
    }
    
    return `You are a forecasting analyst. Analyze this event and provide predictions.

EVENT: ${event.title}
Type: ${eventIntel.type}${entityGuidance}

SOURCES (${topSources.length}):
${sources}

INSTRUCTIONS:
1. Cite at least ${Math.min(topSources.length, 6)} sources by title
2. Show Bayesian reasoning 
3. Provide confidence intervals
4. Be concise but thorough

Format your final predictions as JSON:

\`\`\`json
{
  "predictions": [
    {
      "outcome": "${eventIntel.entities[0] || 'Primary'}", 
      "probability": 0.XX,
      "confidence": "High|Medium|Low"
    },
    {
      "outcome": "${eventIntel.entities[1] || 'Alternative'}", 
      "probability": 0.XX,
      "confidence": "High|Medium|Low"
    }
  ],
  "insight": "Most critical factor",
  "confidence": "High|Medium|Low"
}
\`\`\`

Begin analysis:`;
}

function parseStreamedResponse(text) {
    try {
        const jsonMatch = text.match(/```json\s*(\{[\s\S]*?\})\s*```/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[1]);
            return {
                predictions: parsed.predictions || [],
                insight: parsed.insight || 'Analysis complete',
                confidence: parsed.confidence || 'Medium'
            };
        }
    } catch (error) {
        console.error('Parse error:', error);
    }
    
    return {
        predictions: [
            { outcome: 'Yes', probability: 0.5, confidence: 'Medium' },
            { outcome: 'No', probability: 0.5, confidence: 'Medium' }
        ],
        insight: 'See detailed analysis above',
        confidence: 'Medium'
    };
}

function formatAnalysisText(text) {
    let displayText = text.replace(/```json[\s\S]*?```/g, '').trim();
    displayText = displayText.replace(/\*\*(.*?)\*\*/g, '<h4>$1</h4>');
    
    const paragraphs = displayText.split('\n\n').filter(p => p.trim());
    
    return paragraphs.map(p => {
        if (p.includes('<h4>')) return p;
        return `<p>${p.replace(/\n/g, '<br>')}</p>`;
    }).join('');
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

function displayModelInsight(insight) {
    document.getElementById('modelInsightText').textContent = insight;
}

function displaySources(exaResults) {
    const container = document.getElementById('sourcesList');
    const sources = exaResults.slice(0, 10);
    
    document.getElementById('totalSources').textContent = sources.length;
    
    container.innerHTML = sources.map((source, i) => `
        <div class="source-card">
            <div class="source-header">
                <div class="source-title">${escapeHtml(source.title)}</div>
                <a href="${escapeHtml(source.url)}" target="_blank" rel="noopener" class="source-link">View</a>
            </div>
            <div class="source-description">
                ${escapeHtml((source.text || '').substring(0, 180))}...
            </div>
            <div class="source-citation">
                [${i + 1}] ${new URL(source.url).hostname} • ${source.publishedDate || 'Recent'}
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
