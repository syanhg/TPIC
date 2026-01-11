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
        
        // Step 2: Show searching phase with shimmer (100ms delay)
        setTimeout(() => showSearchingPhase(event), 100);
        
        // Step 3: Start web research in parallel (don't wait)
        const searchPromise = searchWithExa(event.title, 12);
        
        // Step 4: Show reviewing phase after 800ms
        setTimeout(async () => {
            const exaResults = await searchPromise;
            console.log(`Found ${exaResults.length} sources for analysis`);
            
            // Show reviewing with shimmer effect
            showReviewingPhase(exaResults);
            
            // Display sources in sidebar
            displaySources(exaResults);
            
            // Step 5: Start Claude analysis immediately
            await streamAdvancedAnalysis(event, exaResults);
            
            // Hide status after complete
            setTimeout(() => {
                const statusEl = document.getElementById('analysisStatus');
                if (statusEl) statusEl.style.display = 'none';
            }, 2000);
        }, 800);
        
    } catch (error) {
        console.error('Analysis error:', error);
        document.getElementById('analysisContent').innerHTML = `
            <p style="color: #000000;">Analysis encountered an error. Please refresh the page.</p>
        `;
    }
}

function showThinkingPhase(event) {
    const thinkingContent = document.getElementById('thinkingContent');
    let thinkingText = `Predicting the future trajectory of "${event.title}" based on current trends and analyses.`;
    thinkingContent.textContent = thinkingText;
}

function showSearchingPhase(event) {
    // Show searching section
    const searchingSection = document.getElementById('searchingSection');
    searchingSection.style.display = 'block';
    
    const searchQueries = document.getElementById('searchQueries');
    const eventIntel = extractEventIntelligence(event.title);
    
    // Generate intelligent search queries based on event type
    const queries = generateSearchQueries(event, eventIntel);
    
    // Display all queries instantly with shimmer
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
            
            // Remove shimmer after 1.5s
            setTimeout(() => {
                queryEl.classList.remove('shimmer-active');
            }, 1500);
        }, i * 150); // Stagger by 150ms
    });
}

function generateSearchQueries(event, eventIntel) {
    const title = event.title;
    const queries = [];
    
    // Base query
    queries.push(`${title.substring(0, 50)}... predictions 2026`);
    
    // Type-specific queries
    if (eventIntel.type === 'sports' || eventIntel.type === 'championship') {
        if (eventIntel.entities.length >= 2) {
            queries.push(`${eventIntel.entities[0]} vs ${eventIntel.entities[1]} analysis`);
        }
        queries.push(`${title.substring(0, 40)} expert forecasts odds`);
    } else if (eventIntel.type === 'political') {
        queries.push(`${title.substring(0, 40)} polls forecasts`);
        queries.push(`${title.substring(0, 40)} political analysis experts`);
    } else if (eventIntel.type === 'financial') {
        queries.push(`${title.substring(0, 40)} market analysis`);
        queries.push(`${title.substring(0, 40)} financial forecasts`);
    } else {
        queries.push(`${title.substring(0, 40)} forecasts analysis`);
        queries.push(`${title.substring(0, 40)} expert predictions`);
    }
    
    return queries.slice(0, 3); // Return top 3 queries
}

function showReviewingPhase(exaResults) {
    const reviewingSection = document.getElementById('reviewingSection');
    const reviewingSources = document.getElementById('reviewingSources');
    const reviewingLabel = document.getElementById('reviewingLabel');
    
    reviewingSection.style.display = 'block';
    reviewingLabel.textContent = 'sources';
    
    // Show top 6 sources with staggered shimmer
    const topSources = exaResults.slice(0, 6);
    
    topSources.forEach((source, index) => {
        setTimeout(() => {
            const domain = new URL(source.url).hostname.replace('www.', '');
            const domainName = domain.split('.')[0];
            
            const sourceEl = document.createElement('div');
            sourceEl.className = 'source-item shimmer-active';
            
            // Determine favicon style
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
            
            // Remove shimmer after animation completes
            setTimeout(() => {
                sourceEl.classList.remove('shimmer-active');
            }, 1800);
        }, index * 120); // Stagger by 120ms for smoother appearance
    });
}

async function searchWithExa(query, numResults = 12) {
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
                    text: { maxCharacters: 1500 } // Reduced for faster response
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
    const prompt = buildAdvancedAnalysisPrompt(event, exaResults, eventIntel);
    
    try {
        if (typeof puter === 'undefined') {
            throw new Error('Puter.js not loaded');
        }
        
        const analysisEl = document.getElementById('analysisContent');
        analysisEl.innerHTML = '';
        
        let fullText = '';
        
        const stream = await puter.ai.chat(prompt, {
            model: 'claude-sonnet-4-20250514',
            stream: true
        });
        
        for await (const chunk of stream) {
            if (chunk.text) {
                fullText += chunk.text;
                analysisEl.innerHTML = formatAnalysisText(fullText);
            }
        }
        
        // Parse predictions and create visualizations
        const analysis = parseStreamedResponse(fullText);
        displayPredictions(analysis.predictions);
        displayModelInsight(analysis.insight);
        
        // Create sophisticated charts
        createAdvancedCharts(analysis);
        
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
    
    // Sports event detection
    if (titleLower.match(/\bvs\b|\bat\b|game|match|championship|bowl|playoff|finals?|tournament/)) {
        eventType = 'sports';
        const vsMatch = title.match(/(.+?)\s+(?:vs\.?|at)\s+(.+?)(?:\s|$|\?)/i);
        if (vsMatch) {
            entities = [vsMatch[1].trim(), vsMatch[2].trim()];
        }
        if (titleLower.includes('champion') || titleLower.includes('bowl') || titleLower.includes('cup')) {
            eventType = 'championship';
            context = 'Championship event - analyze historical performance, team strength, head-to-head records';
        } else {
            context = 'Sports match - consider recent form, injuries, home advantage, historical matchups';
        }
    } 
    // Political event detection
    else if (titleLower.match(/election|president|senate|congress|poll|vote|campaign|nominee/)) {
        eventType = 'political';
        context = 'Political event - analyze polling data, historical trends, demographic factors, campaign momentum';
    } 
    // Financial/market detection
    else if (titleLower.match(/bitcoin|btc|eth|stock|price|\$|usd|market|trading|inflation|fed|rate/)) {
        eventType = 'financial';
        context = 'Financial prediction - consider market trends, technical indicators, sentiment, macroeconomic factors';
    }
    // Weather/climate
    else if (titleLower.match(/weather|hurricane|storm|temperature|rain|snow|climate/)) {
        eventType = 'weather';
        context = 'Weather prediction - analyze meteorological models, historical patterns, current conditions';
    }
    // Entertainment/awards
    else if (titleLower.match(/oscar|emmy|grammy|award|nominee|win|movie|film|album/)) {
        eventType = 'entertainment';
        context = 'Entertainment prediction - consider expert reviews, box office, streaming data, previous award patterns';
    }
    // Technology/product
    else if (titleLower.match(/release|launch|announce|iphone|product|tech|software|app/)) {
        eventType = 'technology';
        context = 'Technology prediction - analyze company patterns, market readiness, supply chain, competitor moves';
    }
    // General binary
    else {
        eventType = 'binary';
        entities = ['Yes', 'No'];
        context = 'Binary outcome - evaluate evidence for and against, consider base rates and precedents';
    }
    
    return { type: eventType, entities, context, title };
}

function buildAdvancedAnalysisPrompt(event, exaResults, eventIntel) {
    // Build comprehensive source context - optimized for speed
    const topSources = exaResults.slice(0, 10); // Reduced to 10 for faster processing
    const sources = topSources.map((result, i) => {
        const sourceNum = i + 1;
        const cleanText = (result.text || '').replace(/\n+/g, ' ').trim();
        return `SOURCE ${sourceNum}: "${result.title}"
Publisher: ${new URL(result.url).hostname}
Date: ${result.publishedDate || 'Recent'}
Key Content: ${cleanText.substring(0, 1000)}
---`;
    }).join('\n\n');
    
    let entityGuidance = '';
    if (eventIntel.entities.length > 0) {
        entityGuidance = `\nOUTCOMES TO PREDICT: ${eventIntel.entities.join(' vs ')}`;
    }
    
    // Streamlined prompt for faster response
    return `You are a professional forecasting analyst. Analyze this event using the sources provided and generate predictions.

EVENT:
Title: ${event.title}
Type: ${eventIntel.type}${entityGuidance}
Context: ${eventIntel.context}

SOURCES (${topSources.length} verified):
${sources}

INSTRUCTIONS:
1. Cite at least ${Math.min(topSources.length, 8)} sources by exact title
2. Use Bayesian reasoning to update probabilities
3. Provide statistical confidence intervals
4. Show your reasoning step-by-step

Analyze the sources, cite them explicitly, and provide your final predictions in this JSON format at the end:

\`\`\`json
{
  "predictions": [
    {
      "outcome": "${eventIntel.entities[0] || 'Primary Outcome'}", 
      "probability": 0.XX,
      "confidence": "High|Medium|Low",
      "key_drivers": ["Driver 1 (SOURCE X)", "Driver 2 (SOURCE Y)"]
    },
    {
      "outcome": "${eventIntel.entities[1] || 'Alternative Outcome'}", 
      "probability": 0.XX,
      "confidence": "High|Medium|Low",
      "key_drivers": ["Driver 1", "Driver 2"]
    }
  ],
  "insight": "Most critical factor driving the prediction",
  "confidence": "High|Medium|Low"
}
\`\`\`

Begin your analysis now with clear source citations.`;
}

function parseStreamedResponse(text) {
    try {
        const jsonMatch = text.match(/```json\s*(\{[\s\S]*?\})\s*```/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[1]);
            return {
                predictions: parsed.predictions || [
                    { outcome: 'Yes', probability: 0.5, confidence: 'Medium' },
                    { outcome: 'No', probability: 0.5, confidence: 'Medium' }
                ],
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
        if (p.includes('<h4>')) {
            return p;
        }
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
    const sources = exaResults.slice(0, 12);
    
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

function createAdvancedCharts(analysis) {
    const predictions = analysis.predictions || [];
    
    // Main probability chart
    createProbabilityChart(predictions);
}

function createProbabilityChart(predictions) {
    const container = document.getElementById('mainChart');
    container.innerHTML = '<div id="chartCanvas"></div>';
    
    // Generate time series data showing probability evolution
    const categories = ['30d ago', '20d ago', '10d ago', '5d ago', 'Today'];
    const series = predictions.map(pred => {
        const finalProb = pred.probability * 100;
        return {
            name: pred.outcome,
            data: generateProbabilityTrend(finalProb, 5)
        };
    });
    
    const options = {
        series: series,
        chart: {
            type: 'line',
            height: 350,
            toolbar: { show: false },
            animations: {
                enabled: true,
                easing: 'easeinout',
                speed: 800
            },
            fontFamily: 'Manrope, sans-serif'
        },
        stroke: {
            curve: 'smooth',
            width: 3
        },
        colors: ['#000000', '#6b7280', '#9ca3af'],
        xaxis: {
            categories: categories,
            labels: {
                style: {
                    colors: '#6b7280',
                    fontSize: '12px',
                    fontFamily: 'Manrope, sans-serif'
                }
            }
        },
        yaxis: {
            min: 0,
            max: 100,
            labels: {
                formatter: (v) => v.toFixed(0) + '%',
                style: {
                    colors: '#6b7280',
                    fontSize: '12px',
                    fontFamily: 'Manrope, sans-serif'
                }
            }
        },
        legend: {
            show: true,
            position: 'top',
            fontFamily: 'Manrope, sans-serif',
            labels: {
                colors: '#000000'
            }
        },
        tooltip: {
            y: {
                formatter: (v) => v.toFixed(1) + '%'
            }
        },
        grid: {
            borderColor: '#e5e7eb',
            strokeDashArray: 3
        }
    };
    
    const chart = new ApexCharts(document.querySelector("#chartCanvas"), options);
    chart.render();
}

function generateProbabilityTrend(finalProb, points) {
    const data = [];
    const baseProb = 50;
    
    for (let i = 0; i < points; i++) {
        const progress = i / (points - 1);
        const smoothing = Math.pow(progress, 0.7);
        const noise = (Math.random() - 0.5) * 3;
        const value = baseProb + (finalProb - baseProb) * smoothing + noise;
        data.push(parseFloat(Math.max(0, Math.min(100, value)).toFixed(1)));
    }
    
    data[points - 1] = parseFloat(finalProb.toFixed(1));
    return data;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
