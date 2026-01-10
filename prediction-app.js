// API Keys

// Global state
let currentMarket = null;
let conversationHistory = [];
let researchSources = [];

// Initialize
async function init() {
    // Get market ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const marketSlug = urlParams.get('market');
    
    if (!marketSlug) {
        window.location.href = 'index.html';
        return;
    }

    // Load market data
    await loadMarketData(marketSlug);
    
    // Start AI research
    await generatePrediction();
    
    // Setup chat
    setupChat();
}

async function loadMarketData(slug) {
    try {
        const response = await fetch(`/api/events?slug=${slug}`);
        const data = await response.json();
        
        if (Array.isArray(data) && data.length > 0) {
            currentMarket = data[0];
            renderMarketInfo();
        } else {
            throw new Error('Market not found');
        }
    } catch (error) {
        console.error('Error loading market:', error);
        document.getElementById('marketInfo').innerHTML = `
            <div class="loading-state">
                <p style="color: #ef4444;">Failed to load market data. Redirecting...</p>
            </div>
        `;
        setTimeout(() => window.location.href = 'index.html', 2000);
    }
}

function renderMarketInfo() {
    const markets = currentMarket.markets || [];
    const mainMarket = markets[0] || {};
    
    let outcomes = [];
    let prices = [];
    
    try {
        if (typeof mainMarket.outcomes === 'string') {
            outcomes = JSON.parse(mainMarket.outcomes);
        } else if (Array.isArray(mainMarket.outcomes)) {
            outcomes = mainMarket.outcomes;
        }
        
        if (typeof mainMarket.outcomePrices === 'string') {
            prices = JSON.parse(mainMarket.outcomePrices);
        } else if (Array.isArray(mainMarket.outcomePrices)) {
            prices = mainMarket.outcomePrices;
        }
    } catch (e) {
        console.error('Error parsing outcomes:', e);
    }
    
    if (outcomes.length === 0) {
        outcomes = ['Yes', 'No'];
        prices = ['0.50', '0.50'];
    }
    
    const volume = formatCurrency(currentMarket.volume || 0);
    const volume24hr = formatCurrency(currentMarket.volume24hr || 0);
    const liquidity = formatCurrency(currentMarket.liquidity || 0);
    
    document.getElementById('marketInfo').innerHTML = `
        <h1 class="market-title">${escapeHtml(currentMarket.title)}</h1>
        
        <div class="market-stats-grid">
            <div class="stat-item">
                <div class="stat-label">Volume</div>
                <div class="stat-value">${volume}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">24h Vol</div>
                <div class="stat-value">${volume24hr}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Liquidity</div>
                <div class="stat-value">${liquidity}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Markets</div>
                <div class="stat-value">${markets.length}</div>
            </div>
        </div>
        
        <div class="market-outcomes">
            ${outcomes.map((outcome, i) => `
                <div class="outcome-item">
                    <span class="outcome-label">${escapeHtml(outcome)}</span>
                    <span class="outcome-price">${(parseFloat(prices[i] || 0) * 100).toFixed(1)}%</span>
                </div>
            `).join('')}
        </div>
    `;
}

async function generatePrediction() {
    try {
        // Step 1: Search for relevant sources using Exa
        const sources = await searchRelevantSources(currentMarket.title);
        researchSources = sources;
        
        // Step 2: Generate prediction using Claude with sources
        const prediction = await generateClaudePrediction(currentMarket, sources);
        
        // Step 3: Render results
        renderPrediction(prediction);
        renderSources(sources);
        
    } catch (error) {
        console.error('Error generating prediction:', error);
        document.getElementById('predictionCard').innerHTML = `
            <div class="loading-state">
                <p style="color: #ef4444;">Failed to generate prediction. Please try again.</p>
            </div>
        `;
    }
}

async function searchRelevantSources(marketTitle) {
    try {
        document.getElementById('sourcesList').innerHTML = `
            <div class="loading-state">
                <div class="spinner-small"></div>
                <p>Searching relevant sources...</p>
            </div>
        `;
        
        const response = await fetch('https://api.exa.ai/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': EXA_API_KEY
            },
            body: JSON.stringify({
                query: marketTitle,
                numResults: 10,
                type: 'auto',
                contents: {
                    text: true
                },
                useAutoprompt: true
            })
        });
        
        if (!response.ok) {
            console.error(`Exa API error: ${response.status}`);
            return [];
        }
        
        const data = await response.json();
        return data.results || [];
        
    } catch (error) {
        console.error('Error searching sources:', error);
        return [];
    }
}

async function generateClaudePrediction(market, sources) {
    try {
        // Prepare context from sources
        const sourceContext = sources.slice(0, 5).map((source, i) => {
            const text = source.text || '';
            return `Source ${i + 1} (${source.title}): ${text.substring(0, 500)}...`;
        }).join('\n\n');
        
        const prompt = `You are an expert prediction analyst. Analyze the following prediction market and provide a detailed, well-reasoned prediction.

Market Question: ${market.title}

Current Market Prices:
${formatMarketPrices(market)}

Research Sources:
${sourceContext}

Please provide:
1. A detailed rationale explaining your prediction (2-3 paragraphs)
2. Your predicted probabilities for each outcome
3. Key factors influencing your prediction
4. Level of confidence in your prediction

Format your response as JSON:
{
  "rationale": "detailed explanation",
  "predictions": [
    {"outcome": "outcome name", "probability": 0.XX}
  ],
  "confidence": "high/medium/low"
}`;

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': CLAUDE_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 2000,
                messages: [{
                    role: 'user',
                    content: prompt
                }]
            })
        });
        
        if (!response.ok) {
            console.error(`Claude API error: ${response.status}`);
            throw new Error(`Claude API error: ${response.status}`);
        }
        
        const data = await response.json();
        const content = data.content[0].text;
        
        // Try to parse JSON, if it fails, extract text
        try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        } catch (e) {
            console.log('Could not parse JSON, using raw response');
        }
        
        return {
            rationale: content,
            predictions: [],
            confidence: 'medium'
        };
        
    } catch (error) {
        console.error('Error generating prediction:', error);
        throw error;
    }
}

function formatMarketPrices(market) {
    const markets = market.markets || [];
    const mainMarket = markets[0] || {};
    
    let outcomes = [];
    let prices = [];
    
    try {
        if (typeof mainMarket.outcomes === 'string') {
            outcomes = JSON.parse(mainMarket.outcomes);
        } else if (Array.isArray(mainMarket.outcomes)) {
            outcomes = mainMarket.outcomes;
        }
        
        if (typeof mainMarket.outcomePrices === 'string') {
            prices = JSON.parse(mainMarket.outcomePrices);
        } else if (Array.isArray(mainMarket.outcomePrices)) {
            prices = mainMarket.outcomePrices;
        }
    } catch (e) {
        return 'Yes: 50%, No: 50%';
    }
    
    return outcomes.map((outcome, i) => 
        `${outcome}: ${(parseFloat(prices[i] || 0) * 100).toFixed(1)}%`
    ).join(', ');
}

function renderPrediction(prediction) {
    const predictionCard = document.getElementById('predictionCard');
    
    const predictionsHTML = prediction.predictions && prediction.predictions.length > 0
        ? `
        <div class="prediction-results">
            <h3>AI Model Predictions</h3>
            ${prediction.predictions.map(p => `
                <div class="prediction-item">
                    <span class="prediction-outcome">${escapeHtml(p.outcome)}</span>
                    <span class="prediction-probability">${(p.probability * 100).toFixed(1)}%</span>
                </div>
            `).join('')}
        </div>
        `
        : '';
    
    predictionCard.innerHTML = `
        <div class="prediction-header">
            <h2>Model Insights</h2>
            <span class="model-badge">Claude Sonnet 4</span>
        </div>
        <div class="prediction-rationale">${escapeHtml(prediction.rationale)}</div>
        ${predictionsHTML}
    `;
}

function renderSources(sources) {
    const sourcesList = document.getElementById('sourcesList');
    
    if (sources.length === 0) {
        sourcesList.innerHTML = '<p style="color: #6b7280; text-align: center;">No sources found</p>';
        return;
    }
    
    sourcesList.innerHTML = sources.map(source => `
        <div class="source-item" onclick="window.open('${source.url}', '_blank')">
            <div class="source-title">${escapeHtml(source.title)}</div>
            <div class="source-description">
                ${escapeHtml((source.text || '').substring(0, 150))}...
            </div>
            <a href="${source.url}" class="source-url" onclick="event.stopPropagation()">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/>
                </svg>
                ${new URL(source.url).hostname}
            </a>
        </div>
    `).join('');
}

function setupChat() {
    const floatingInput = document.getElementById('chatInputFloating');
    const floatingButton = document.getElementById('sendButtonFloating');
    const sideInput = document.getElementById('chatInputSide');
    const sideButton = document.getElementById('sendButtonSide');
    const chatPanel = document.getElementById('chatPanel');
    const closeChat = document.getElementById('closeChat');
    const floatingChatInput = document.getElementById('floatingChatInput');
    
    // Auto-resize textareas
    [floatingInput, sideInput].forEach(input => {
        input.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 120) + 'px';
        });
    });
    
    // Floating input functionality
    floatingInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            openChatPanel(floatingInput.value);
        }
    });
    
    floatingButton.addEventListener('click', () => {
        openChatPanel(floatingInput.value);
    });
    
    // Side input functionality
    sideInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    sideButton.addEventListener('click', sendMessage);
    
    // Close chat panel
    closeChat.addEventListener('click', () => {
        chatPanel.className = 'chat-panel-hidden';
        floatingChatInput.classList.remove('hidden');
    });
    
    function openChatPanel(initialMessage) {
        if (!initialMessage.trim()) return;
        
        // Show chat panel
        chatPanel.className = 'chat-panel-visible';
        floatingChatInput.classList.add('hidden');
        
        // Clear floating input
        floatingInput.value = '';
        floatingInput.style.height = 'auto';
        
        // Send initial message
        addMessageToChat('user', initialMessage);
        generateAndDisplayResponse(initialMessage);
    }
    
    async function sendMessage() {
        const input = document.getElementById('chatInputSide');
        const message = input.value.trim();
        
        if (!message) return;
        
        // Clear input
        input.value = '';
        input.style.height = 'auto';
        
        // Add user message
        addMessageToChat('user', message);
        
        // Disable input while processing
        const sendButton = document.getElementById('sendButtonSide');
        input.disabled = true;
        sendButton.disabled = true;
        
        try {
            await generateAndDisplayResponse(message);
        } catch (error) {
            console.error('Error generating response:', error);
            addMessageToChat('assistant', 'Sorry, I encountered an error. Please try again.');
        } finally {
            input.disabled = false;
            sendButton.disabled = false;
            input.focus();
        }
    }
    
    async function generateAndDisplayResponse(userMessage) {
        // Show typing indicator
        const typingId = 'typing-' + Date.now();
        const messagesContainer = document.getElementById('chatMessages');
        const typingDiv = document.createElement('div');
        typingDiv.id = typingId;
        typingDiv.className = 'message assistant';
        typingDiv.innerHTML = `
            <div class="message-bubble">
                <div class="typing-indicator">
                    <span></span><span></span><span></span>
                </div>
            </div>
        `;
        messagesContainer.appendChild(typingDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        try {
            const response = await generateChatResponse(userMessage);
            document.getElementById(typingId)?.remove();
            addMessageToChat('assistant', response);
        } catch (error) {
            document.getElementById(typingId)?.remove();
            throw error;
        }
    }
}

async function sendMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    
    if (!message) return;
    
    // This function is now handled in setupChat
}

async function generateChatResponse(userMessage) {
    // Build conversation context
    const contextMessages = [
        {
            role: 'user',
            content: `You are an expert analyst discussing this prediction market: "${currentMarket.title}". 

Research sources available:
${researchSources.slice(0, 3).map(s => `- ${s.title}: ${s.url}`).join('\n')}

Answer the user's questions with detailed, accurate information. Be conversational but precise.`
        },
        ...conversationHistory,
        {
            role: 'user',
            content: userMessage
        }
    ];
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': CLAUDE_API_KEY,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1000,
            messages: contextMessages
        })
    });
    
    if (!response.ok) {
        throw new Error(`Claude API error: ${response.status}`);
    }
    
    const data = await response.json();
    const assistantMessage = data.content[0].text;
    
    // Update conversation history
    conversationHistory.push(
        { role: 'user', content: userMessage },
        { role: 'assistant', content: assistantMessage }
    );
    
    // Keep only last 10 messages to avoid token limits
    if (conversationHistory.length > 20) {
        conversationHistory = conversationHistory.slice(-20);
    }
    
    return assistantMessage;
}

function addMessageToChat(role, content) {
    const messagesContainer = document.getElementById('chatMessages');
    const timestamp = new Date().toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit' 
    });
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    messageDiv.innerHTML = `
        <div class="message-bubble">${escapeHtml(content)}</div>
        <div class="message-timestamp">${timestamp}</div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function formatCurrency(value) {
    const num = parseFloat(value);
    if (num >= 1000000) {
        return '$' + (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return '$' + (num / 1000).toFixed(1) + 'K';
    } else {
        return '$' + num.toFixed(0);
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize on page load
init();
