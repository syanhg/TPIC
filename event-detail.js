const urlParams = new URLSearchParams(window.location.search);
const eventSlug = urlParams.get('event');
const MAX_ITERATIONS = 6; // Limit iterations for web performance

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
    
    // Initialize Agent Loop
    await runMiraiAgent(eventData);
}

// --- MIRAI AGENT CORE ---

async function runMiraiAgent(event) {
    const analysisEl = document.getElementById('analysisContent');
    const statusEl = document.getElementById('analysisStatus');
    const sourcesContainer = document.getElementById('sourcesList');
    
    analysisEl.innerHTML = '';
    sourcesContainer.innerHTML = '';
    
    // 1. Initialize MIRAI Context
    const eventIntel = extractEventIntelligence(event.title);
    let conversationHistory = buildMiraiSystemPrompt(event, eventIntel);
    let collectedSources = [];
    
    updateStatus('Agent initializing: Analyzing event structure...');

    try {
        if (typeof puter === 'undefined') throw new Error('Puter.js not loaded');

        // 2. The ReAct Loop (Think -> Act -> Observe)
        for (let i = 0; i < MAX_ITERATIONS; i++) {
            
            // Step 2a: THINK (Call LLM)
            updateStatus(`Iteration ${i+1}/${MAX_ITERATIONS}: Reasoning...`);
            
            const response = await puter.ai.chat(conversationHistory, {
                model: 'claude-3-5-sonnet',
                stream: false
            });
            
            const llmOutput = response.message.content;
            conversationHistory += `\n${llmOutput}`; // Append to history
            
            // Visualize Thought Process
            const thoughtMatch = llmOutput.match(/Thought:\s*(.*)/i);
            if (thoughtMatch) {
                appendLogToUI(`<strong>Thought ${i+1}:</strong> ${thoughtMatch[1]}`, 'thought');
            }

            // Step 2b: ACT (Parse Action)
            // Regex to find "Action: function_name(args)" or "Final Answer:"
            const actionMatch = llmOutput.match(/Action:\s*(.*)/i);
            
            if (actionMatch) {
                const actionString = actionMatch[1].trim();
                
                // TERMINATION CONDITION: Agent is ready to predict
                if (actionString.startsWith("Final Answer:") || actionString.includes("Final Answer")) {
                    updateStatus('Finalizing prediction model...');
                    const jsonStr = llmOutput.substring(llmOutput.indexOf('{'), llmOutput.lastIndexOf('}') + 1);
                    const analysis = parseFinalJson(jsonStr, eventIntel);
                    
                    renderFinalResults(analysis, collectedSources);
                    updateStatus('Analysis complete');
                    setTimeout(() => { if(statusEl) statusEl.style.display = 'none'; }, 2000);
                    return;
                }

                // Step 2c: EXECUTE (Run Tool)
                updateStatus(`Executing tool: ${actionString.substring(0, 40)}...`);
                appendLogToUI(`<strong>Action:</strong> ${actionString}`, 'action');
                
                const observation = await executeMiraiTool(actionString, collectedSources);
                
                // Step 2d: OBSERVE (Feed result back to Agent)
                const observationText = `\nObservation: ${observation}\n`;
                conversationHistory += observationText;
                
                // Update Sources UI if we found new ones
                if (collectedSources.length > 0) {
                    document.getElementById('sourcesCount').textContent = collectedSources.length;
                    displaySources(collectedSources);
                }
                
            } else {
                // If the model rambles without an action, force a nudge
                conversationHistory += `\nSystem Warning: You must output an 'Action:' or 'Final Answer:'.\n`;
            }
        }
        
        // Fallback if max iterations reached
        throw new Error("Agent exceeded maximum iterations without a final answer.");

    } catch (error) {
        console.error('Agent Error:', error);
        analysisEl.innerHTML += `<p style="color:red; margin-top:20px;">Agent Error: ${error.message}</p>`;
    }
}

// --- TOOL EXECUTION LAYER ---

async function executeMiraiTool(actionString, collectedSources) {
    try {
        // Tool 1: get_news_articles (Simulated via Exa)
        // Syntax: get_news_articles(keywords=["term1", "term2"])
        if (actionString.includes('get_news_articles') || actionString.includes('search_news')) {
            const match = actionString.match(/keywords=\[(.*?)\]/);
            const queryRaw = match ? match[1].replace(/['"]/g, '') : actionString; // Fallback
            
            const results = await searchWithExa(queryRaw, 3);
            
            if (results.length === 0) return "No news found for these keywords.";
            
            // Store unique sources
            results.forEach(r => {
                if (!collectedSources.find(s => s.url === r.url)) {
                    collectedSources.push(r);
                }
            });

            // Return summarized context to Agent
            return JSON.stringify(results.map(r => ({
                date: r.publishedDate || 'Recent',
                title: r.title,
                snippet: r.text ? r.text.substring(0, 300) + "..." : "No text"
            })));
        }

        // Tool 2: get_historical_precedents (Simulated via Exa with modified query)
        if (actionString.includes('get_historical_precedents')) {
            const match = actionString.match(/\(["'](.*?)["']\)/);
            const topic = match ? match[1] : "similar events";
            
            const results = await searchWithExa(`history of ${topic} outcome statistics`, 2);
            return `Historical Data found: ${JSON.stringify(results.map(r => r.title))}`;
        }

        return "Error: Function not found. Available functions: get_news_articles(keywords=[]), get_historical_precedents(topic_string).";

    } catch (e) {
        return `Tool Execution Error: ${e.message}`;
    }
}

// --- MIRAI SYSTEM PROMPT ---

function buildMiraiSystemPrompt(event, eventIntel) {
    const today = new Date().toISOString().split('T')[0];
    
    // Adapted from MIRAI Appendix K.1.2 (ReAct Agent)
    return `You are a Forecasting Agent using the MIRAI (Multi-Information FoRecasting Agent Interface) architecture.
    
    TASK: Forecast the outcome of the event: "${event.title}".
    CURRENT DATE: ${today}
    CONTEXT: ${eventIntel.context}
    
    You have access to the following Python-like tools:
    1. get_news_articles(keywords=["term1", "term2"]) 
       - Retrieves recent news, polls, and updates.
    2. get_historical_precedents(topic_string) 
       - Searches for similar past events to establish base rates.

    INSTRUCTIONS:
    1. Use an iterative 'Thought' -> 'Action' -> 'Observation' loop.
    2. Do NOT guess. Use tools to gather evidence first.
    3. Analyze 2-3 different angles (e.g., polls vs market sentiment).
    4. When confident, output "Final Answer:" followed immediately by a JSON object.

    FORMAT:
    Thought: [Your reasoning about what data is missing or what to analyze next]
    Action: [The function call, e.g., get_news_articles(keywords=["election polls"])]
    
    ... (Wait for Observation) ...

    Action: Final Answer: {
        "predictions": [
            {"outcome": "Outcome A", "probability": 0.XX, "confidence": "High/Medium/Low"},
            {"outcome": "Outcome B", "probability": 0.XX, "confidence": "High/Medium/Low"}
        ],
        "insight": "The single most critical factor found...",
        "rationale": "Full explanation of the forecast..."
    }
    
    Begin Iteration 1.`;
}

// --- EXA SEARCH INTEGRATION ---

async function searchWithExa(query, numResults = 3) {
    try {
        // Clean query of list formatting if present
        const cleanQuery = query.replace(/,/g, ' ').trim();
        
        const response = await fetch('https://api.exa.ai/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': 'ab80b7d9-b049-4cb8-94af-02cb6fa0b4d2'
            },
            body: JSON.stringify({
                query: cleanQuery,
                numResults: numResults,
                useAutoprompt: true,
                type: 'neural',
                contents: {
                    text: { maxCharacters: 1000 }
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

// --- UI & PARSING HELPERS ---

function appendLogToUI(htmlContent, type) {
    const analysisEl = document.getElementById('analysisContent');
    const div = document.createElement('div');
    div.className = `agent-log ${type}`;
    // Add styling for logs
    div.style.marginBottom = '12px';
    div.style.padding = '8px 12px';
    div.style.borderRadius = '6px';
    div.style.fontSize = '13px';
    
    if (type === 'thought') {
        div.style.background = '#f9fafb';
        div.style.borderLeft = '3px solid #6b7280';
        div.style.color = '#374151';
    } else if (type === 'action') {
        div.style.background = '#eff6ff';
        div.style.borderLeft = '3px solid #3b82f6';
        div.style.color = '#1e40af';
        div.style.fontFamily = 'monospace';
    }
    
    div.innerHTML = htmlContent;
    analysisEl.appendChild(div);
    
    // Auto scroll to bottom
    const rightCol = document.querySelector('.right-column');
    if (rightCol) rightCol.scrollTop = rightCol.scrollHeight;
}

function parseFinalJson(jsonString, eventIntel) {
    try {
        const parsed = JSON.parse(jsonString);
        return {
            predictions: parsed.predictions || [],
            insight: parsed.insight || "Analysis complete.",
            rationale: parsed.rationale || "No rationale provided."
        };
    } catch (e) {
        console.error("JSON Parse Error:", e);
        // Fallback structure
        return {
            predictions: [
                { outcome: "Yes", probability: 0.5 },
                { outcome: "No", probability: 0.5 }
            ],
            insight: "Error parsing agent output.",
            rationale: "The agent completed analysis but the output format was invalid."
        };
    }
}

function renderFinalResults(analysis, sources) {
    const analysisEl = document.getElementById('analysisContent');
    
    // 1. Clear logs and show final rationale
    analysisEl.innerHTML = `
        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <h4 style="margin-bottom: 10px; color: #000;">Final Analysis</h4>
            <p>${formatText(analysis.rationale)}</p>
        </div>
    `;

    // 2. Update Prediction Table
    const tableContainer = document.getElementById('predictionRows');
    tableContainer.innerHTML = analysis.predictions.map(pred => `
        <div class="table-row">
            <span class="row-label">${escapeHtml(pred.outcome)}</span>
            <span class="row-value">${(pred.probability * 100).toFixed(0)}%</span>
        </div>
    `).join('');

    // 3. Update Insight
    document.getElementById('modelInsightText').textContent = analysis.insight;

    // 4. Render Charts
    createProbabilityChart(analysis.predictions);
}

function formatText(text) {
    return text.replace(/\n/g, '<br>');
}

function extractEventIntelligence(title) {
    const titleLower = title.toLowerCase();
    let type = 'general';
    let context = 'General market prediction';
    
    if (titleLower.match(/vs|match|game|playoff/)) {
        type = 'sports';
        context = 'Sports analysis: Consider team form, injuries, and head-to-head records.';
    } else if (titleLower.match(/election|vote|poll|nominee/)) {
        type = 'politics';
        context = 'Political analysis: Consider polling data, historical trends, and demographics.';
    } else if (titleLower.match(/price|bitcoin|stock|market|fed/)) {
        type = 'finance';
        context = 'Financial analysis: Consider technical indicators, market sentiment, and macro data.';
    }
    
    return { type, context };
}

function updateStatus(message) {
    const el = document.getElementById('analysisStatus');
    if (el) {
        const textSpan = el.querySelector('span:last-child');
        if (textSpan) textSpan.textContent = message;
    }
}

function displaySources(sources) {
    const container = document.getElementById('sourcesList');
    container.innerHTML = sources.map((source, i) => `
        <div class="source-card">
            <div class="source-header">
                <div class="source-title">${escapeHtml(source.title)}</div>
                <a href="${escapeHtml(source.url)}" target="_blank" class="source-link">View</a>
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

// Charting Logic (Preserved from original)
function createProbabilityChart(predictions) {
    const container = document.getElementById('mainChart');
    container.innerHTML = '<div id="chartCanvas"></div>';
    
    const categories = ['Past', 'Current'];
    const series = predictions.map(pred => {
        const prob = pred.probability * 100;
        return {
            name: pred.outcome,
            // Simple trend generation for visualization
            data: [prob + (Math.random() * 10 - 5), prob] 
        };
    });
    
    const options = {
        series: series,
        chart: {
            type: 'line',
            height: 350,
            toolbar: { show: false },
            fontFamily: 'Manrope, sans-serif'
        },
        stroke: { curve: 'smooth', width: 3 },
        colors: ['#000000', '#6b7280', '#9ca3af'],
        xaxis: { categories: categories },
        yaxis: { min: 0, max: 100, labels: { formatter: v => v.toFixed(0) + '%' } }
    };
    
    new ApexCharts(document.querySelector("#chartCanvas"), options).render();
}
