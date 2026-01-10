// Get event data from URL parameters
const urlParams = new URLSearchParams(window.location.search);
const eventSlug = urlParams.get('event');

// Initialize page
document.addEventListener('DOMContentLoaded', async () => {
    setupSearchFunctionality();
    await loadEventData();
});

function setupSearchFunctionality() {
    const searchInput = document.getElementById('searchInput');
    
    // Navigate back to index when searching from detail page
    searchInput.addEventListener('input', (e) => {
        if (e.target.value.trim()) {
            // Store search term and navigate back
            localStorage.setItem('searchTerm', e.target.value);
            window.location.href = 'index.html';
        }
    });
    
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && e.target.value.trim()) {
            localStorage.setItem('searchTerm', e.target.value);
            window.location.href = 'index.html';
        }
    });
}

async function loadEventData() {
    // Get event from localStorage (passed from main page)
    const eventData = JSON.parse(localStorage.getItem('currentEvent') || '{}');
    
    if (!eventData.title) {
        document.getElementById('eventTitle').textContent = 'Event not found';
        return;
    }
    
    // Display basic event info
    displayEventInfo(eventData);
    
    // Start AI analysis
    await performAIAnalysis(eventData);
}

function displayEventInfo(event) {
    document.getElementById('eventTitle').textContent = event.title;
    document.getElementById('closeDate').textContent = `Closes: ${event.closeDate}`;
    document.getElementById('volume').textContent = event.volume || '$0';
    document.getElementById('volume24h').textContent = event.volume24h || '$0';
    document.getElementById('liquidity').textContent = event.liquidity || '$0';
    
    // Update status badge
    const statusBadge = document.getElementById('statusBadge');
    if (event.active && !event.closed) {
        statusBadge.className = 'status-badge live';
        statusBadge.innerHTML = '<span class="status-indicator"></span>LIVE';
    } else {
        statusBadge.className = 'status-badge closed';
        statusBadge.innerHTML = '<span class="status-indicator"></span>CLOSED';
    }
}

async function performAIAnalysis(event) {
    try {
        // Step 1: Research with Exa
        const researchData = await conductExaResearch(event.title);
        
        // Step 2: Analyze with Claude using MIRAI methodology
        const analysis = await analyzeWithClaude(event, researchData);
        
        // Step 3: Display results
        displayAnalysisResults(analysis);
        
    } catch (error) {
        console.error('Analysis error:', error);
        document.querySelector('.loading-state').innerHTML = `
            <p style="color: #ef4444;">Error performing analysis</p>
            <p class="loading-detail">${error.message}</p>
        `;
    }
}

async function conductExaResearch(query) {
    try {
        const response = await fetch('https://api.exa.ai/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': 'ab80b7d9-b049-4cb8-94af-02cb6fa0b4d2'
            },
            body: JSON.stringify({
                query: query,
                numResults: 10,
                useAutoprompt: true,
                contents: {
                    text: true
                }
            })
        });
        
        if (!response.ok) {
            console.error('Exa API error:', response.status);
            return [];
        }
        
        const data = await response.json();
        return data.results || [];
    } catch (error) {
        console.error('Exa research error:', error);
        return [];
    }
}

async function analyzeWithClaude(event, researchData) {
    const prompt = buildMIRAIPrompt(event, researchData);
    
    try {
        // Use the Claude API through the artifact's built-in API access
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 1000,
                messages: [{
                    role: 'user',
                    content: prompt
                }]
            })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Claude API error:', response.status, errorText);
            throw new Error(`Claude API request failed: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Handle the response structure properly
        if (data.content && Array.isArray(data.content)) {
            const textContent = data.content
                .filter(item => item.type === 'text')
                .map(item => item.text)
                .join('\n');
            
            return parseClaudeResponse(textContent);
        }
        
        throw new Error('Unexpected response format from Claude');
        
    } catch (error) {
        console.error('Claude analysis error:', error);
        // Return default analysis on error
        return {
            predictions: [
                { outcome: 'Yes', probability: 0.50, model: 'Baseline' },
                { outcome: 'No', probability: 0.50, model: 'Baseline' }
            ],
            rationale: 'Unable to complete AI analysis. Please check console for details.',
            confidence: 2.5,
            keyFactors: ['Limited data available'],
            sources: []
        };
    }
}

function buildMIRAIPrompt(event, researchData) {
    const sources = researchData.slice(0, 5).map((source, i) => 
        `[${i+1}] ${source.title}\n${source.text?.substring(0, 300) || 'No content'}`
    ).join('\n\n');
    
    return `You are an expert forecasting agent. Analyze this prediction market event and provide predictions.

EVENT: ${event.title}
CLOSES: ${event.closeDate}

RESEARCH SOURCES:
${sources || 'No external sources available'}

Provide your analysis in this exact JSON format (respond with ONLY valid JSON, no markdown, no backticks):

{
  "predictions": [
    {"outcome": "Yes", "probability": 0.65, "model": "Statistical Analysis"},
    {"outcome": "No", "probability": 0.35, "model": "Statistical Analysis"}
  ],
  "rationale": "Brief explanation of prediction based on available data and patterns",
  "confidence": 3.5,
  "keyFactors": ["Factor 1", "Factor 2", "Factor 3"],
  "sources": [
    {"title": "Source 1", "description": "How it informed prediction", "url": "https://example.com"}
  ]
}

Keep the response concise and ensure all probabilities sum to 1.0. Respond ONLY with the JSON object.`;
}

function parseClaudeResponse(text) {
    try {
        // Remove any markdown code blocks
        let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        
        // Try to find JSON object
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.error('No JSON found in response:', text);
            throw new Error('No JSON found in response');
        }
        
        const parsed = JSON.parse(jsonMatch[0]);
        
        // Validate structure
        if (!parsed.predictions || !Array.isArray(parsed.predictions)) {
            throw new Error('Invalid response structure');
        }
        
        return parsed;
    } catch (error) {
        console.error('Parse error:', error, 'Raw text:', text);
        // Return default structure
        return {
            predictions: [
                { outcome: 'Yes', probability: 0.50, model: 'Default' },
                { outcome: 'No', probability: 0.50, model: 'Default' }
            ],
            rationale: 'Unable to parse AI analysis. Using baseline predictions.',
            confidence: 2.5,
            keyFactors: ['Analysis parsing error'],
            sources: []
        };
    }
}

function displayAnalysisResults(analysis) {
    // Hide loading
    document.getElementById('analysisSection').style.display = 'none';
    
    // Show and populate predictions
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
    
    // Show and populate insights
    const insightsSection = document.getElementById('insightsSection');
    insightsSection.style.display = 'block';
    
    document.getElementById('rationale').textContent = analysis.rationale;
    
    // Display confidence rating
    const stars = Math.round(analysis.confidence);
    const starsHtml = Array(5).fill(0).map((_, i) => 
        `<span class="star ${i < stars ? '' : 'empty'}">★</span>`
    ).join('');
    document.getElementById('confidenceStars').innerHTML = starsHtml;
    document.getElementById('confidenceScore').textContent = `${analysis.confidence.toFixed(1)}/5`;
    
    // Show and populate sources
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
    
    // Show and create probability chart
    displayProbabilityChart(analysis.predictions);
}

function displayProbabilityChart(predictions) {
    const chartSection = document.getElementById('chartSection');
    chartSection.style.display = 'block';
    
    const ctx = document.getElementById('probabilityChart').getContext('2d');
    
    // Create simulated historical data
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
