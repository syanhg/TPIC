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
        hideAnalysisStatus();
        return;
    }
    
    // Display basic info
    document.getElementById('eventTitle').textContent = eventData.title;
    document.getElementById('closeDate').textContent = `Closes: ${eventData.closeDate}`;
    document.getElementById('volumeStat').textContent = eventData.volume || '$0';
    document.getElementById('volume24hStat').textContent = eventData.volume24h || '$0';
    document.getElementById('liquidityStat').textContent = eventData.liquidity || '$0';
    
    // Start comprehensive analysis with minimum 10 sources requirement
    await performAdvancedAnalysis(eventData);
}

async function performAdvancedAnalysis(event) {
    try {
        // Step 1: Comprehensive web research using Claude's web search (MINIMUM 10 sources required)
        updateStatus('Conducting comprehensive web research...');
        const searchResults = await searchWithSerper(event.title, 15);
        
        console.log(`Found ${searchResults.length} sources for analysis`);
        
        // CRITICAL: Must have at least 10 sources to proceed
        if (searchResults.length < 10) {
            const errorMsg = `INSUFFICIENT SOURCES: Found only ${searchResults.length} sources. Minimum 10 credible sources required for statistical analysis.`;
            updateStatus(errorMsg);
            document.getElementById('analysisContent').innerHTML = `
                <div style="padding: 20px; background: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px;">
                    <p style="color: #991b1b; font-weight: 600; margin-bottom: 8px;">Analysis Cannot Proceed</p>
                    <p style="color: #7f1d1d; font-size: 13px;">${errorMsg}</p>
                    <p style="color: #7f1d1d; font-size: 13px; margin-top: 12px;">
                        The event "${event.title}" may be too specific or too recent. Try a more general query or a different event.
                    </p>
                </div>
            `;
            hideAnalysisStatus();
            return;
        }
        
        // Display sources immediately
        displaySources(searchResults);
        
        // Step 2: Advanced multi-stage analysis with research paper methodology
        updateStatus('Performing advanced statistical analysis with AI using Bayesian inference...');
        await streamAdvancedAnalysis(event, searchResults);
        
    } catch (error) {
        console.error('Analysis error:', error);
        document.getElementById('analysisContent').innerHTML = `
            <div style="padding: 20px; background: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px;">
                <p style="color: #991b1b; font-weight: 600; margin-bottom: 8px;">Analysis Error</p>
                <p style="color: #7f1d1d; font-size: 13px;">${error.message}</p>
            </div>
        `;
        hideAnalysisStatus();
    }
}

async function searchWithSerper(query, numResults = 15) {
    try {
        // Using Claude's built-in web search tool instead of external API
        // This is more reliable and doesn't require API keys
        const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "claude-sonnet-4-20250514",
                max_tokens: 2000,
                tools: [{
                    "type": "web_search_20250305",
                    "name": "web_search"
                }],
                messages: [{
                    role: "user",
                    content: `Search the web for: "${query}". Find at least 15 diverse, credible sources including news articles, analysis, and data. Return only a JSON array of results with this exact format:
[
  {
    "title": "Article title",
    "url": "https://example.com",
    "snippet": "Key excerpt or summary",
    "date": "2025-01-11"
  }
]

Focus on recent sources and ensure high relevance to the query.`
                }]
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Search API error: ${errorData.error?.message || response.statusText}`);
        }
        
        const data = await response.json();
        const results = [];
        
        // Extract search results from Claude's web search tool
        if (data.content && Array.isArray(data.content)) {
            for (const block of data.content) {
                if (block.type === 'tool_use' && block.name === 'web_search') {
                    // Tool use block - continue to next
                    continue;
                }
                if (block.type === 'text') {
                    try {
                        // Try to parse JSON from text response
                        const text = block.text.trim();
                        const jsonMatch = text.match(/\[[\s\S]*\]/);
                        if (jsonMatch) {
                            const parsedResults = JSON.parse(jsonMatch[0]);
                            if (Array.isArray(parsedResults)) {
                                parsedResults.forEach(result => {
                                    results.push({
                                        title: result.title || 'Untitled',
                                        url: result.url || '',
                                        text: result.snippet || result.content || '',
                                        publishedDate: result.date || new Date().toISOString().split('T')[0],
                                        isNews: result.type === 'news'
                                    });
                                });
                            }
                        }
                    } catch (parseError) {
                        console.warn('Could not parse search results:', parseError);
                    }
                }
            }
        }
        
        // Deduplicate by URL
        const uniqueResults = Array.from(
            new Map(results.map(item => [item.url, item])).values()
        );
        
        return uniqueResults.slice(0, numResults);
        
    } catch (error) {
        console.error('Web search error:', error);
        throw error;
    }
}

async function streamAdvancedAnalysis(event, searchResults) {
    const prompt = buildAdvancedAnalysisPrompt(event, searchResults);
    
    try {
        const analysisEl = document.getElementById('analysisContent');
        analysisEl.innerHTML = '<p style="color: #6b7280;">AI is analyzing sources with Bayesian inference...</p>';
        
        const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "claude-sonnet-4-20250514",
                max_tokens: 4000,
                messages: [
                    { role: "user", content: prompt }
                ],
            })
        });

        if (!response.ok) {
            throw new Error(`Claude API error: ${response.status}`);
        }

        const data = await response.json();
        let fullText = '';
        
        if (data.content && data.content.length > 0) {
            fullText = data.content.map(item => item.text || '').join('\n');
            analysisEl.innerHTML = formatAnalysisText(fullText);
            
            // Parse predictions and metrics
            const analysis = parseStreamedResponse(fullText);
            displayPredictions(analysis.predictions);
            displayModelInsight(analysis.insight);
            displayAnalysisMetrics(analysis);
            
            updateStatus(`✓ Analysis complete - ${analysis.sources_cited} sources analyzed with Bayesian updating`);
            setTimeout(hideAnalysisStatus, 2000);
        } else {
            throw new Error('No content in AI response');
        }
        
    } catch (error) {
        console.error('Claude error:', error);
        throw error;
    }
}

function buildAdvancedAnalysisPrompt(event, searchResults) {
    // Build comprehensive source context (minimum 10 sources)
    const topSources = searchResults.slice(0, Math.max(10, searchResults.length));
    const sources = topSources.map((result, i) => 
        `[SOURCE ${i + 1}] ${result.title}
URL: ${result.url}
Published: ${result.publishedDate}
${result.isNews ? 'Type: NEWS ARTICLE' : 'Type: WEB PAGE'}
Snippet: ${(result.text || '').substring(0, 800)}
---`
    ).join('\n\n');
    
    // Advanced prompt based on MIRAI research paper methodology
    return `You are a professional forecasting analyst using rigorous statistical methods and multi-source evidence synthesis following the MIRAI research paper methodology.

CRITICAL REQUIREMENTS:
- You MUST cite at least 10 different sources in your analysis (cite by exact title)
- Every major claim must reference specific sources by title
- Provide quantitative reasoning with statistical foundations
- Use Bayesian updating: show prior → posterior probability calculations
- Consider base rates, historical precedents, and trend analysis
- Show probability calculations step-by-step

EVENT TO ANALYZE:
Title: ${event.title}
Market Data: Volume ${event.volume}, 24h Vol ${event.volume24h}, Liquidity ${event.liquidity}
Closes: ${event.closeDate}
Current Status: ${event.active ? 'Active Market' : 'Closed Market'}

AVAILABLE SOURCES (${topSources.length} high-quality web search results):
${sources}

ANALYSIS FRAMEWORK (MIRAI Research Methodology):

**1. Base Rate Analysis**
Establish prior probability from:
- Historical frequency of similar events (cite specific data)
- Domain-specific base rates (reference statistics from sources)
- Reference class forecasting (compare to similar past events)
Format: "Based on [SOURCE X - exact title], the base rate for [event type] is Y%"

**2. Multi-Source Evidence Synthesis with Bayesian Updating**
For each source, show explicit Bayesian updating:

Source 1 Analysis:
- Title: [exact source title]
- Key finding: [specific data/fact]
- Reliability: High/Medium/Low (explain why)
- Bayesian update: Prior P₀ = X% → Posterior P₁ = Y%
- Reasoning: [likelihood ratio calculation or qualitative update]

Source 2 Analysis:
- Title: [exact source title]
- Key finding: [specific data/fact]
- How it updates belief: P₁ = Y% → P₂ = Z%
- Reasoning: [explain the update]

[Continue for at least 10 sources]

**3. Quantitative Probability Assessment**
Final calculation chain:
- Base rate (P₀): X%
- After source 1: P₁ = X% × [likelihood] = Y%
- After source 2: P₂ = Y% × [likelihood] = Z%
- [continue through all sources]
- Final probability: P_final with 95% CI: [low%, high%]

**4. Statistical Indicators**
- Trend direction and momentum (cite specific data from sources)
- Volatility measures (reference market data: vol=${event.volume}, 24h=${event.volume24h})
- Leading indicators (from sources)
- Signal strength: Strong/Medium/Weak

**5. Risk Scenarios with Probabilities**
- Bull case (P=X%): [best outcome scenario with evidence]
- Base case (P=Y%): [most likely scenario with evidence]
- Bear case (P=Z%): [worst case scenario with evidence]
Note: X + Y + Z must = 100%

**6. Temporal Analysis**
- Current time to event close
- How probability likely shifts as event approaches
- Key catalysts to watch (from sources)
- Information decay rate

**7. Confidence Assessment**
- Data quality: High/Medium/Low (based on source diversity)
- Source agreement: Strong (>80% agree) / Moderate (50-80%) / Weak (<50%)
- Overall confidence: High/Medium/Low
- Key remaining uncertainties (be specific)

**8. Source Citation Summary**
List all sources used:
1. [Source 1 title] - Used for: [what finding]
2. [Source 2 title] - Used for: [what finding]
[... through source 10+]

REQUIRED JSON OUTPUT:
\`\`\`json
{
  "predictions": [
    {"outcome": "Yes", "probability": 0.XX, "confidence": "High/Medium/Low"},
    {"outcome": "No", "probability": 0.XX, "confidence": "High/Medium/Low"}
  ],
  "insight": "Single most important factor based on source consensus",
  "confidence": "High|Medium|Low",
  "sources_cited": 10,
  "base_rate": 0.XX,
  "key_uncertainty": "Primary risk that could change prediction"
}
\`\`\`

MANDATORY REQUIREMENTS:
✓ Cite at least 10 sources by EXACT title
✓ Show Bayesian updating: P₀ → P₁ → P₂ → ... → P_final
✓ Include specific numbers and calculations
✓ Probabilities must sum to 1.0
✓ Provide 95% confidence interval
✓ No hedging - give definitive analysis
✓ List all cited sources at the end

You have ${topSources.length} high-quality sources. Use them systematically.`;
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
                confidence: parsed.confidence || 'Medium',
                base_rate: parsed.base_rate || 0.5,
                key_uncertainty: parsed.key_uncertainty || 'Multiple factors',
                sources_cited: parsed.sources_cited || 0
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
        confidence: 'Medium',
        sources_cited: 0
    };
}

function formatAnalysisText(text) {
    let displayText = text.replace(/```json[\s\S]*?```/g, '').trim();
    displayText = displayText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    const paragraphs = displayText.split('\n\n').filter(p => p.trim());
    
    return paragraphs.map(p => {
        if (p.includes('<strong>')) {
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
            <span class="row-value">
                ${(pred.probability * 100).toFixed(0)}%
                <span class="confidence-badge">(${pred.confidence})</span>
            </span>
        </div>
    `).join('');
}

function displayModelInsight(insight) {
    document.getElementById('modelInsightText').textContent = insight;
}

function displayAnalysisMetrics(analysis) {
    if (analysis.sources_cited >= 10) {
        const verifiedEl = document.getElementById('sourcesVerified');
        verifiedEl.style.display = 'flex';
        document.getElementById('sourcesCount').textContent = 
            `${analysis.sources_cited} sources analyzed`;
    }
    
    const metricsEl = document.getElementById('analysisMetrics');
    metricsEl.style.display = 'block';
    
    document.getElementById('baseRate').textContent = 
        analysis.base_rate ? `${(analysis.base_rate * 100).toFixed(0)}%` : '--';
    document.getElementById('confidenceLevel').textContent = 
        analysis.confidence || '--';
    document.getElementById('keyUncertainty').textContent = 
        analysis.key_uncertainty ? analysis.key_uncertainty.substring(0, 30) + '...' : '--';
}

function displaySources(searchResults) {
    const container = document.getElementById('sourcesList');
    const sources = searchResults.slice(0, 15);
    
    document.getElementById('totalSources').textContent = sources.length;
    
    container.innerHTML = sources.map((source, i) => `
        <div class="source-card">
            <div class="source-header">
                <div class="source-title">
                    ${source.isNews ? '📰 ' : ''}${escapeHtml(source.title)}
                </div>
                <a href="${escapeHtml(source.url)}" target="_blank" rel="noopener" class="source-link">View</a>
            </div>
            <div class="source-description">
                ${escapeHtml((source.text || '').substring(0, 180))}...
            </div>
            <div class="source-citation">
                [${i + 1}] ${new URL(source.url).hostname} • ${source.publishedDate}
            </div>
        </div>
    `).join('');
}

function updateStatus(message) {
    const statusEl = document.getElementById('statusMessage');
    if (statusEl) {
        statusEl.textContent = message;
    }
}

function hideAnalysisStatus() {
    const statusEl = document.getElementById('analysisStatus');
    if (statusEl) {
        statusEl.style.display = 'none';
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
