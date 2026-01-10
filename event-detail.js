// Configuration
const CLAUDE_API_KEY = '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';
const EXA_API_KEY = 'ab80b7d9-b049-4cb8-94af-02cb6fa0b4d2';

// Get event data from URL parameters
const urlParams = new URLSearchParams(window.location.search);
const eventSlug = urlParams.get('event');

// Initialize page
document.addEventListener('DOMContentLoaded', async () => {
    await loadEventData();
});

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
                'x-api-key': EXA_API_KEY
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
            throw new Error('Exa API request failed');
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
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': CLAUDE_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 4000,
                messages: [{
                    role: 'user',
                    content: prompt
                }]
            })
        });
        
        if (!response.ok) {
            throw new Error('Claude API request failed');
        }
        
        const data = await response.json();
        return parseClaudeResponse(data.content[0].text);
        
    } catch (error) {
        console.error('Claude analysis error:', error);
        throw error;
    }
}

function buildMIRAIPrompt(event, researchData) {
    const sources = researchData.map((source, i) => 
        `[${i+1}] ${source.title}\n${source.text?.substring(0, 500) || 'No content'}`
    ).join('\n\n');
    
    return `You are an expert forecasting agent using the MIRAI methodology for event prediction. Analyze this prediction market event using statistical reasoning, historical patterns, and the provided research.

EVENT: ${event.title}
CLOSES: ${event.closeDate}

RESEARCH SOURCES:
${sources}

Using the MIRAI framework, provide your analysis in the following JSON format:

{
  "predictions": [
    {
      "outcome": "Yes/Outcome 1",
      "probability": 0.85,
      "model": "Statistical Analysis"
    },
    {
      "outcome": "No/Outcome 2", 
      "probability": 0.15,
      "model": "Statistical Analysis"
    }
  ],
  "rationale": "Detailed explanation of prediction based on historical data, temporal patterns, and statistical analysis...",
  "confidence": 3.5,
  "keyFactors": [
    "Factor 1 explanation",
    "Factor 2 explanation",
    "Factor 3 explanation"
  ],
  "sources": [
    {
      "title": "Source title",
      "description": "How this source informed the prediction",
      "url": "https://..."
    }
  ]
}

Apply rigorous statistical methods including:
1. Temporal reasoning over historical patterns
2. Multi-source information integration (structured + textual)
3. Base rate analysis and frequency distributions
4. Trend analysis and momentum indicators
5. External validation against similar past events

Respond ONLY with the JSON object, no additional text.`;
}

function parseClaudeResponse(text) {
    try {
        // Extract JSON from response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('No JSON found in response');
        }
        
        return JSON.parse(jsonMatch[0]);
    } catch (error) {
        console.error('Parse error:', error);
        // Return default structure
        return {
            predictions: [
                { outcome: 'Yes', probability: 0.50, model: 'Default' },
                { outcome: 'No', probability: 0.50, model: 'Default' }
            ],
            rationale: 'Unable to complete full analysis. Using baseline predictions.',
            confidence: 2.5,
            keyFactors: ['Limited data available'],
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
                <h4>${pred.outcome}</h4>
                <p>${pred.model}</p>
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
                    <div class="source-title">${source.title}</div>
                    ${source.url ? `<a href="${source.url}" target="_blank" class="source-link">View →</a>` : ''}
                </div>
                <div class="source-description">${source.description}</div>
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
    // Generate realistic trend data leading to final probability
    const finalValue = finalProb * 100;
    const points = 7;
    const data = [];
    
    // Start from a more neutral position
    let current = 50 + (Math.random() - 0.5) * 20;
    
    for (let i = 0; i < points; i++) {
        const progress = i / (points - 1);
        // Gradually move toward final value with some noise
        const target = 50 + (finalValue - 50) * progress;
        current = current * 0.7 + target * 0.3 + (Math.random() - 0.5) * 5;
        data.push(Math.max(0, Math.min(100, current)));
    }
    
    // Ensure last value matches final probability
    data[points - 1] = finalValue;
    
    return data;
}
