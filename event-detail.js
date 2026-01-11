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
        
        updateStatus('analysisStatus', '✅ Analysis complete');
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
        return `[SOURCE ${i + 1}] ${result.title}
URL: ${result.url}
Published: ${result.publishedDate || 'Recent'}
Content: ${(result.text || 'No content').substring(0, 800)}
---`;
    }).join('\n\n');
    
    return `<SYSTEM_CONTEXT>
You are a professional prediction market analyst. Your role is to provide actionable forecasts, NOT to explain why you cannot make predictions.

CRITICAL BEHAVIORAL RULES:
1. NEVER say "I cannot provide analysis" or "insufficient data"
2. NEVER ask for more information or complain about missing sources
3. ALWAYS work with whatever information is provided
4. If sources are limited, use your general knowledge combined with available data
5. ALWAYS generate predictions - this is your PRIMARY function
6. Be confident but honest about uncertainty levels in the confidence field

Your analysis will be published to users who expect actionable predictions. Refusing to predict is NOT acceptable.
</SYSTEM_CONTEXT>

<ANALYSIS_FRAMEWORK>
Apply this rigorous methodology:

1. BASE RATE ANALYSIS
   - What is the historical baseline probability for this type of event?
   - For sports: typical win rates, home advantage, seeding patterns
   - For politics: incumbent advantages, polling accuracy, historical trends
   - For markets: volatility patterns, directional bias, mean reversion

2. REFERENCE CLASS FORECASTING  
   - Identify 3-5 analogous historical cases
   - Extract probability patterns from similar past events
   - Adjust for differences in context

3. EVIDENCE SYNTHESIS
   - Weight each source by recency (newer = higher weight)
   - Weight by source quality (official stats > opinion pieces)
   - Identify consensus vs outlier positions
   - Look for leading indicators in the data

4. BAYESIAN UPDATING
   - Start with base rate as prior
   - Update based on specific evidence from sources
   - Show your reasoning chain

5. UNCERTAINTY QUANTIFICATION
   - High confidence: Strong consensus + good historical patterns + quality sources
   - Medium confidence: Mixed signals or moderate data quality  
   - Low confidence: Limited data or high unpredictability
</ANALYSIS_FRAMEWORK>

<EVENT_DETAILS>
Title: ${event.title}
Closes: ${event.closeDate}
Market Metrics:
- Total Volume: ${event.volume} (indicator of interest/liquidity)
- 24h Volume: ${event.volume24h} (recent activity level)
- Liquidity: ${event.liquidity} (market depth)

Context: This is a real prediction market with actual trading volume. The volume indicates ${parseFloat(event.volume?.replace(/[$,KM]/g, '') || 0) > 100 ? 'high interest - strong signal' : 'moderate interest'}.
</EVENT_DETAILS>

<RESEARCH_SOURCES>
${sources || 'Note: Limited web sources. Rely on your general knowledge of similar events, historical patterns, and statistical baselines for this type of prediction.'}
</RESEARCH_SOURCES>

<OUTPUT_FORMAT>
Write a comprehensive analysis in natural language. Structure it as:

**Analysis:**

[Paragraph 1] Start with the base rate and reference class. Example: "Historically, [type of event] occurs with X% frequency. Similar cases like [examples] show [pattern]."

[Paragraph 2] Synthesize the evidence from sources. For each key point, cite like this: "According to [Source Name from above], [specific finding]." Or if using general knowledge: "Statistical analysis of similar markets shows [pattern]."

[Paragraph 3] Explain your final probability estimate. Example: "Weighting recent performance (40%), historical patterns (30%), and market indicators (30%), this suggests a [X]% probability of [outcome]."

[Paragraph 4] Address key uncertainties and confidence level.

**Final Prediction:**

```json
{
  "predictions": [
    {"outcome": "[Specific team/person/outcome name]", "probability": 0.XX},
    {"outcome": "[Alternative outcome name]", "probability": 0.XX}
  ],
  "insight": "One actionable sentence: 'Key factor is [X], which favors [outcome]'",
  "confidence": "High|Medium|Low"
}
```

<CRITICAL_INSTRUCTIONS>
- Probabilities MUST sum to exactly 1.0
- For sports events with teams: Extract actual team names from the title (e.g., "Patriots vs Chiefs" → outcomes are "Patriots" and "Chiefs")
- For "X at Y" format: Y is home team (slight advantage)
- For championship markets: Pick 1-2 most likely winners based on current season context
- For binary events: outcomes are "Yes" and "No"
- DO NOT output probabilities of 0.50/0.50 unless truly uncertain - take a position
- CITE sources by name when available, or cite "historical analysis" or "market patterns"
- Make a definitive prediction - users need actionable forecasts
</CRITICAL_INSTRUCTIONS>

Now provide your analysis and prediction:`;
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
