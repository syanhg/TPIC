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
    
    document.getElementById('eventTitle').textContent = eventData.title;
    document.getElementById('closeDate').textContent = `Closes: ${eventData.closeDate}`;
    
    // Start the analysis pipeline
    await performDeepAnalysis(eventData);
}

async function performDeepAnalysis(event) {
    try {
        // STEP 1: Get REAL research data from Exa
        updateStatus('analysisStatus', '🔍 Searching web sources with Exa AI...');
        console.log('🔍 Starting Exa research...');
        
        const exaResults = await searchWithExa(event.title);
        console.log(`✅ Found ${exaResults.length} sources`);
        
        // Display sources immediately
        displaySources(exaResults);
        
        // STEP 2: Stream analysis from Claude via Puter.js
        updateStatus('analysisStatus', '🤖 Analyzing with Claude AI (streaming)...');
        console.log('🤖 Starting Claude streaming analysis...');
        
        await streamClaudeAnalysis(event, exaResults);
        
    } catch (error) {
        console.error('❌ Analysis error:', error);
        document.getElementById('rationaleText').innerHTML = `
            <span style="color: #ef4444;">Analysis failed: ${error.message}</span><br>
            <span style="color: #6b7280; font-size: 13px;">Please check console for details.</span>
        `;
    }
}

async function searchWithExa(query) {
    try {
        const response = await fetch('https://api.exa.ai/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': 'ab80b7d9-b049-4cb8-94af-02cb6fa0b4d2'
            },
            body: JSON.stringify({
                query: query,
                numResults: 8,
                useAutoprompt: true,
                type: 'neural',
                contents: {
                    text: { maxCharacters: 1500 }
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

async function streamClaudeAnalysis(event, exaResults) {
    const prompt = buildAnalysisPrompt(event, exaResults);
    
    try {
        // Check Puter.js availability
        if (typeof puter === 'undefined') {
            throw new Error('Puter.js not loaded');
        }
        
        const rationaleEl = document.getElementById('rationaleText');
        rationaleEl.innerHTML = '<span class="streaming-cursor"></span>';
        
        let fullText = '';
        
        // Stream from Claude via Puter.js
        const stream = await puter.ai.chat(prompt, {
            model: 'claude-sonnet-4-20250514',
            stream: true
        });
        
        // Process stream
        for await (const chunk of stream) {
            if (chunk.text) {
                fullText += chunk.text;
                rationaleEl.innerHTML = fullText + '<span class="streaming-cursor"></span>';
            }
        }
        
        // Remove cursor when done
        rationaleEl.innerHTML = fullText;
        
        // Parse and display predictions
        const analysis = parseStreamedResponse(fullText, exaResults);
        displayPredictions(analysis.predictions);
        displayModelInsight(analysis.insight);
        
        updateStatus('analysisStatus', 'Analysis complete');
        setTimeout(() => {
            document.getElementById('analysisStatus').style.display = 'none';
        }, 2000);
        
    } catch (error) {
        console.error('Claude streaming error:', error);
        throw error;
    }
}

function buildAnalysisPrompt(event, exaResults) {
    const sources = exaResults.slice(0, 6).map((result, i) => {
        return `[${i + 1}] ${result.title}
URL: ${result.url}
Published: ${result.publishedDate || 'Recent'}
Content: ${(result.text || 'No content').substring(0, 800)}
---`;
    }).join('\n\n');
    
    return `You are an expert forecasting analyst using rigorous statistical methods. Analyze this prediction market event.

EVENT: ${event.title}
CLOSES: ${event.closeDate}
MARKET DATA:
- Volume: ${event.volume}
- 24h Volume: ${event.volume24h}
- Liquidity: ${event.liquidity}

RESEARCH SOURCES:
${sources || 'Limited sources available'}

ANALYSIS REQUIREMENTS:
Apply STRICT statistical rigor:
1. Base rate analysis - what percentage of similar events historically occurred?
2. Reference class forecasting - identify analogous historical cases
3. Multi-factor weighting - assess each evidence source by quality and recency
4. Bayesian updating - adjust priors based on new evidence
5. Confidence intervals - quantify uncertainty

Output format (text first, then JSON at end):

First, write a comprehensive analysis explaining your reasoning. Cite specific evidence like this:
- "According to [Source Name], [specific fact or quote]" 
- "Data from [Source] shows that [statistic]"
- "[Source] reports that [finding]"

Be specific with citations - mention the source name and the actual data point.

Then at the very end, output this JSON:

{
  "predictions": [
    {"outcome": "Outcome 1", "probability": 0.XX},
    {"outcome": "Outcome 2", "probability": 0.XX}
  ],
  "insight": "One sentence key insight",
  "confidence": "High/Medium/Low"
}

CRITICAL: 
- Cite SPECIFIC sources by name
- Use ACTUAL data from sources
- Probabilities must sum to 1.0
- For sports: extract team names from title
- Be precise with citations`;
}

function parseStreamedResponse(text, exaResults) {
    try {
        // Extract JSON from end of response
        const jsonMatch = text.match(/\{[\s\S]*"predictions"[\s\S]*\}/);
        
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return {
                predictions: parsed.predictions || [
                    { outcome: 'Yes', probability: 0.5 },
                    { outcome: 'No', probability: 0.5 }
                ],
                insight: parsed.insight || 'Analysis complete',
                confidence: parsed.confidence || 'Medium'
            };
        }
        
        // Fallback
        return {
            predictions: [
                { outcome: 'Yes', probability: 0.5 },
                { outcome: 'No', probability: 0.5 }
            ],
            insight: 'See detailed analysis above',
            confidence: 'Medium'
        };
        
    } catch (error) {
        console.error('Parse error:', error);
        return {
            predictions: [
                { outcome: 'Yes', probability: 0.5 },
                { outcome: 'No', probability: 0.5 }
            ],
            insight: 'Analysis generated',
            confidence: 'Medium'
        };
    }
}

function displayPredictions(predictions) {
    const container = document.getElementById('predictionsContainer');
    container.innerHTML = predictions.map(pred => `
        <div class="prediction-item">
            <span class="prediction-name">${escapeHtml(pred.outcome)}</span>
            <span class="prediction-percent">${(pred.probability * 100).toFixed(0)}%</span>
        </div>
    `).join('');
}

function displayModelInsight(insight) {
    document.getElementById('modelInsight').textContent = insight;
}

function displaySources(exaResults) {
    const container = document.getElementById('sourcesList');
    const sources = exaResults.slice(0, 10);
    
    document.getElementById('sourcesCount').textContent = sources.length;
    
    container.innerHTML = sources.map((source, i) => `
        <div class="source-item">
            <div class="source-header">
                <div class="source-title">${escapeHtml(source.title)}</div>
                <a href="${escapeHtml(source.url)}" target="_blank" class="source-link">Show More</a>
            </div>
            <div class="source-description">
                ${escapeHtml((source.text || 'No content available').substring(0, 200))}...
            </div>
            <div class="source-citation">
                [${i + 1}] ${escapeHtml(source.url)} • ${source.publishedDate || 'Recent'}
            </div>
        </div>
    `).join('');
}

function updateStatus(elementId, message) {
    const el = document.getElementById(elementId);
    if (el) {
        const dot = el.querySelector('.status-dot');
        const text = el.querySelector('span:last-child');
        if (text) text.textContent = message;
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
