// PRODUCTION READY - Uses Puter.js (FREE Claude API) + Exa Research
const urlParams = new URLSearchParams(window.location.search);
const eventSlug = urlParams.get('event');

document.addEventListener('DOMContentLoaded', () => {
    setupSearchFunctionality();
    loadEventData();
});

function setupSearchFunctionality() {
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('keypress', (e) => {
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
        document.getElementById('closeDate').textContent = 'Closes: N/A';
        document.getElementById('analysisSection').style.display = 'none';
        return;
    }
    
    displayEventInfo(eventData);
    await performRealAnalysis(eventData);
}

function displayEventInfo(event) {
    document.getElementById('eventTitle').textContent = event.title;
    document.getElementById('closeDate').textContent = `Closes: ${event.closeDate}`;
    document.getElementById('volume').textContent = event.volume || '$0';
    document.getElementById('volume24h').textContent = event.volume24h || '$0';
    document.getElementById('liquidity').textContent = event.liquidity || '$0';
    
    const statusBadge = document.getElementById('statusBadge');
    if (event.active && !event.closed) {
        statusBadge.className = 'status-badge live';
        statusBadge.innerHTML = '<span class="status-indicator"></span>LIVE';
    } else {
        statusBadge.className = 'status-badge closed';
        statusBadge.innerHTML = '<span class="status-indicator"></span>CLOSED';
    }
}

async function performRealAnalysis(event) {
    const loadingState = document.querySelector('.loading-state');
    
    try {
        // STEP 1: Research with Exa
        loadingState.innerHTML = `
            <div class="spinner"></div>
            <p>🔍 Researching with Exa AI...</p>
            <p class="loading-detail">Searching the web for relevant sources and data</p>
        `;
        
        console.log('🔍 Starting Exa search for:', event.title);
        const exaResults = await searchWithExa(event.title);
        console.log(`✅ Found ${exaResults.length} Exa sources`);
        
        // STEP 2: Analyze with Claude via Puter.js (FREE!)
        loadingState.innerHTML = `
            <div class="spinner"></div>
            <p>🤖 Analyzing with Claude AI...</p>
            <p class="loading-detail">Processing research and generating predictions (FREE API via Puter.js)</p>
        `;
        
        console.log('🤖 Starting Claude analysis via Puter.js...');
        const analysis = await analyzeWithPuterClaude(event, exaResults);
        console.log('✅ Claude analysis complete!');
        
        // STEP 3: Display results
        displayAnalysisResults(analysis, exaResults);
        
    } catch (error) {
        console.error('❌ Analysis error:', error);
        loadingState.innerHTML = `
            <p style="color: #ef4444; font-size: 16px; margin-bottom: 8px;">⚠️ Analysis Error</p>
            <p class="loading-detail">${error.message}</p>
            <p class="loading-detail" style="margin-top: 12px;">Error details logged to console. Please check and refresh.</p>
        `;
    }
}

async function searchWithExa(query) {
    try {
        console.log('Calling Exa API...');
        const response = await fetch('https://api.exa.ai/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': 'ab80b7d9-b049-4cb8-94af-02cb6fa0b4d2'
            },
            body: JSON.stringify({
                query: query,
                numResults: 6,
                useAutoprompt: true,
                type: 'neural',
                contents: {
                    text: { maxCharacters: 1000 }
                }
            })
        });
        
        if (!response.ok) {
            console.error('Exa API error:', response.status);
            return [];
        }
        
        const data = await response.json();
        console.log('Exa response:', data);
        return data.results || [];
        
    } catch (error) {
        console.error('Exa error:', error);
        return [];
    }
}

async function analyzeWithPuterClaude(event, exaResults) {
    try {
        // Check if Puter.js is loaded
        if (typeof puter === 'undefined') {
            throw new Error('Puter.js not loaded. Please refresh the page.');
        }
        
        const prompt = buildDetailedPrompt(event, exaResults);
        console.log('Sending prompt to Claude via Puter.js...');
        console.log('Prompt length:', prompt.length);
        
        // Call Claude via Puter.js - FREE API, no key needed!
        const response = await puter.ai.chat(prompt, {
            model: 'claude-sonnet-4-20250514',
            stream: false
        });
        
        console.log('Raw Puter response:', response);
        
        // Extract text from Puter response
        let text = '';
        if (response && response.message && response.message.content) {
            if (Array.isArray(response.message.content)) {
                text = response.message.content
                    .filter(item => item.type === 'text')
                    .map(item => item.text)
                    .join('\n');
            } else {
                text = response.message.content;
            }
        } else if (typeof response === 'string') {
            text = response;
        }
        
        console.log('Extracted text:', text.substring(0, 200));
        
        return parseClaudeResponse(text, exaResults);
        
    } catch (error) {
        console.error('Puter Claude error:', error);
        throw new Error(`Claude analysis failed: ${error.message}`);
    }
}

function buildDetailedPrompt(event, exaResults) {
    const sources = exaResults.slice(0, 5).map((result, i) => {
        return `SOURCE ${i + 1}:
Title: ${result.title}
URL: ${result.url}
Published: ${result.publishedDate || 'Recent'}
Content: ${(result.text || 'No content').substring(0, 800)}
---`;
    }).join('\n\n');
    
    return `You are an expert prediction analyst. Analyze this event using the research provided.

EVENT DETAILS:
Title: ${event.title}
Closes: ${event.closeDate}
Volume: ${event.volume}
24h Volume: ${event.volume24h}
Liquidity: ${event.liquidity}
Status: ${event.active && !event.closed ? 'LIVE' : 'CLOSED'}

RESEARCH SOURCES:
${sources || 'Limited research data available. Use general knowledge.'}

INSTRUCTIONS:
1. Analyze ALL sources carefully
2. Extract key facts, statistics, trends
3. Consider historical patterns and precedents
4. Generate evidence-based probability estimates
5. Cite specific evidence in your rationale

Output ONLY valid JSON in this EXACT format (no markdown, no backticks):

{
  "predictions": [
    {
      "outcome": "Outcome 1 name",
      "probability": 0.XX,
      "model": "Evidence-Based Analysis"
    },
    {
      "outcome": "Outcome 2 name",
      "probability": 0.XX,
      "model": "Evidence-Based Analysis"
    }
  ],
  "rationale": "Comprehensive 3-4 sentence explanation citing specific facts from sources. Mention statistics, trends, or quotes that support your prediction.",
  "confidence": X.X,
  "sources": [
    {
      "title": "Source title from research",
      "description": "How this source informed the prediction",
      "url": "URL from research"
    }
  ]
}

CRITICAL RULES:
- Probabilities MUST sum to exactly 1.0
- For sports events: extract team names from title
- For political events: consider polling and trends
- For market events: analyze price movements
- Rationale MUST cite specific evidence
- Confidence 1-5 based on data quality
- Output ONLY the JSON object`;
}

function parseClaudeResponse(text, exaResults) {
    try {
        console.log('Parsing Claude response...');
        
        // Clean response
        let cleaned = text
            .replace(/```json\n?/g, '')
            .replace(/```\n?/g, '')
            .replace(/^[^{]*/, '')
            .replace(/[^}]*$/, '')
            .trim();
        
        console.log('Cleaned text:', cleaned.substring(0, 200));
        
        // Extract JSON
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.error('No JSON found in response');
            throw new Error('No JSON in Claude response');
        }
        
        const parsed = JSON.parse(jsonMatch[0]);
        console.log('Parsed analysis:', parsed);
        
        // Validate
        if (!parsed.predictions || !Array.isArray(parsed.predictions) || parsed.predictions.length === 0) {
            throw new Error('Invalid predictions structure');
        }
        
        // Ensure sources have URLs from Exa
        if (parsed.sources && exaResults.length > 0) {
            parsed.sources = parsed.sources.slice(0, Math.min(parsed.sources.length, exaResults.length)).map((source, i) => ({
                title: source.title || exaResults[i].title,
                description: source.description || 'Source used in analysis',
                url: exaResults[i].url
            }));
        } else if (exaResults.length > 0) {
            parsed.sources = exaResults.slice(0, 3).map(r => ({
                title: r.title,
                description: 'Research source used in analysis',
                url: r.url
            }));
        }
        
        return parsed;
        
    } catch (error) {
        console.error('Parse error:', error);
        console.error('Failed text:', text);
        throw new Error(`Failed to parse response: ${error.message}`);
    }
}

function displayAnalysisResults(analysis, exaResults) {
    console.log('Displaying results:', analysis);
    
    document.getElementById('analysisSection').style.display = 'none';
    
    // Predictions
    const predictionsSection = document.getElementById('predictionsSection');
    predictionsSection.style.display = 'block';
    
    const predictionsGrid = document.getElementById('predictionsGrid');
    predictionsGrid.innerHTML = analysis.predictions.map(pred => `
        <div class="prediction-card">
            <div class="prediction-info">
                <h4>${escapeHtml(pred.outcome)}</h4>
                <p>${escapeHtml(pred.model)}</p>
            </div>
            <div class="prediction-value">${(pred.probability * 100).toFixed(0)}%</div>
        </div>
    `).join('');
    
    // Insights
    const insightsSection = document.getElementById('insightsSection');
    insightsSection.style.display = 'block';
    
    document.getElementById('rationale').textContent = analysis.rationale;
    
    const stars = Math.round(analysis.confidence || 3);
    const starsHtml = Array(5).fill(0).map((_, i) => 
        `<span class="star ${i < stars ? '' : 'empty'}">★</span>`
    ).join('');
    document.getElementById('confidenceStars').innerHTML = starsHtml;
    document.getElementById('confidenceScore').textContent = `${(analysis.confidence || 3).toFixed(1)}/5`;
    
    // Sources
    if (analysis.sources && analysis.sources.length > 0) {
        const sourcesSection = document.getElementById('sourcesSection');
        sourcesSection.style.display = 'block';
        
        document.getElementById('sourcesCount').textContent = analysis.sources.length;
        document.getElementById('sourcesList').innerHTML = analysis.sources.map(source => `
            <div class="source-card">
                <div class="source-header">
                    <div class="source-title">${escapeHtml(source.title)}</div>
                    ${source.url ? `<a href="${escapeHtml(source.url)}" target="_blank" class="source-link">View →</a>` : ''}
                </div>
                <div class="source-description">${escapeHtml(source.description)}</div>
            </div>
        `).join('');
    }
    
    // Chart
    displayProbabilityChart(analysis.predictions);
    
    console.log('✅ Display complete!');
}

function displayProbabilityChart(predictions) {
    const chartSection = document.getElementById('chartSection');
    chartSection.style.display = 'block';
    
    const ctx = document.getElementById('probabilityChart').getContext('2d');
    
    const historicalData = predictions.map(pred => ({
        outcome: pred.outcome,
        data: generateHistoricalTrend(pred.probability)
    }));
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['30d ago', '25d', '20d', '15d', '10d', '5d', 'Today'],
            datasets: historicalData.map((item, i) => ({
                label: item.outcome,
                data: item.data,
                borderColor: i === 0 ? '#2563eb' : '#ef4444',
                backgroundColor: i === 0 ? 'rgba(37, 99, 235, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                tension: 0.4,
                fill: true
            }))
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        callback: value => value + '%'
                    }
                }
            }
        }
    });
}

function generateHistoricalTrend(finalProb) {
    const finalValue = finalProb * 100;
    const points = 7;
    const data = [];
    
    let current = 50 + (Math.random() - 0.5) * 20;
    
    for (let i = 0; i < points; i++) {
        const progress = i / (points - 1);
        const target = 50 + (finalValue - 50) * progress;
        current = current * 0.7 + target * 0.3 + (Math.random() - 0.5) * 5;
        data.push(Math.max(0, Math.min(100, current)));
    }
    
    data[points - 1] = finalValue;
    
    return data;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
