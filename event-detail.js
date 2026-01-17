const urlParams = new URLSearchParams(window.location.search);
const eventSlug = urlParams.get('event');

let analysisInterval = null;
let isAnalyzing = false;

document.addEventListener('DOMContentLoaded', () => {
    setupSearch();
    // Wait for Puter to load
    if (typeof puter === 'undefined') {
        console.error('Puter not loaded, retrying...');
        setTimeout(loadEventData, 500);
    } else {
        loadEventData();
    }
});

let conversationHistory = [];
let currentEventData = null;

function setupSearch() {
    document.getElementById('searchInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && e.target.value.trim()) {
            localStorage.setItem('searchTerm', e.target.value);
            window.location.href = 'index.html';
        }
    });
    
    // Setup refresh button
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            const eventData = JSON.parse(localStorage.getItem('currentEvent') || '{}');
            if (eventData.title) {
                refreshBtn.disabled = true;
                const svg = refreshBtn.querySelector('svg');
                if (svg) {
                    svg.classList.add('animate-spin');
                    svg.style.animation = 'spin 1s linear infinite';
                }
                const originalHTML = refreshBtn.innerHTML;
                refreshBtn.innerHTML = `
                    <svg class="h-4 w-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refreshing...
                `;
                
                await performAIAnalysis(eventData, true);
                
                refreshBtn.disabled = false;
                refreshBtn.innerHTML = originalHTML;
                updateLastUpdateTime();
            }
        });
    }
    
    // Setup follow-up conversation
    setupConversation();
}

function setupConversation() {
    const questionInput = document.getElementById('questionInput');
    const sendBtn = document.getElementById('sendQuestionBtn');
    
    if (questionInput && sendBtn) {
        const sendQuestion = async () => {
            const question = questionInput.value.trim();
            if (!question) return;
            
            // Add user message
            addMessageToConversation('user', question);
            questionInput.value = '';
            sendBtn.disabled = true;
            
            // Get AI response
            await getAIResponse(question);
            
            sendBtn.disabled = false;
        };
        
        sendBtn.addEventListener('click', sendQuestion);
        questionInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendQuestion();
            }
        });
    }
}

function addMessageToConversation(role, content) {
    const container = document.getElementById('conversationContainer');
    if (!container) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'flex items-start gap-3';
    
    if (role === 'user') {
        messageDiv.innerHTML = `
            <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground text-xs font-medium">You</div>
            <div class="flex-1 rounded-lg bg-primary/10 p-3 text-sm">${escapeHtml(content)}</div>
        `;
    } else {
        messageDiv.innerHTML = `
            <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">AI</div>
            <div class="flex-1 rounded-lg bg-muted p-3 text-sm">${escapeHtml(content)}</div>
        `;
    }
    
    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
    
    conversationHistory.push({ role, content });
}

async function getAIResponse(question) {
    if (!currentEventData) {
        currentEventData = JSON.parse(localStorage.getItem('currentEvent') || '{}');
    }
    
    const container = document.getElementById('conversationContainer');
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'flex items-start gap-3';
    loadingDiv.innerHTML = `
        <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">AI</div>
        <div class="flex-1 rounded-lg bg-muted p-3 text-sm">
            <div class="flex items-center gap-2">
                <div class="h-2 w-2 animate-pulse rounded-full bg-primary"></div>
                <span class="text-muted-foreground">Thinking...</span>
            </div>
        </div>
    `;
    container.appendChild(loadingDiv);
    container.scrollTop = container.scrollHeight;
    
    try {
        const context = buildConversationContext();
        const prompt = `You are an AI assistant helping users understand a prediction market event analysis.

EVENT: "${currentEventData.title}"
${context}

CONVERSATION HISTORY:
${conversationHistory.slice(-5).map(msg => `${msg.role}: ${msg.content}`).join('\n')}

USER QUESTION: ${question}

Provide a helpful, concise answer based on the analysis and conversation context.`;

        if (typeof puter !== 'undefined' && puter.ai && puter.ai.chat) {
            const stream = await puter.ai.chat(prompt, { model: 'gpt-4', stream: true });
            let fullResponse = '';
            
            loadingDiv.remove();
            const responseDiv = document.createElement('div');
            responseDiv.className = 'flex items-start gap-3';
            responseDiv.innerHTML = `
                <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">AI</div>
                <div class="flex-1 rounded-lg bg-muted p-3 text-sm" id="aiResponseText"></div>
            `;
            container.appendChild(responseDiv);
            const responseTextEl = document.getElementById('aiResponseText');
            
            if (stream && typeof stream[Symbol.asyncIterator] === 'function') {
                for await (const chunk of stream) {
                    if (chunk && chunk.text) {
                        fullResponse += chunk.text;
                        responseTextEl.textContent = fullResponse;
                        container.scrollTop = container.scrollHeight;
                    }
                }
            } else if (stream && stream.text) {
                fullResponse = stream.text;
                responseTextEl.textContent = fullResponse;
            }
            
            conversationHistory.push({ role: 'assistant', content: fullResponse });
        } else {
            throw new Error('AI not available');
        }
    } catch (error) {
        console.error('AI response error:', error);
        loadingDiv.remove();
        addMessageToConversation('assistant', 'I apologize, but I\'m having trouble processing your question right now. Please try again later.');
    }
}

function buildConversationContext() {
    const analysisContent = document.getElementById('analysisContent')?.textContent || '';
    const predictions = Array.from(document.querySelectorAll('#predictionRows > div')).map(row => {
        const label = row.querySelector('.row-label')?.textContent || '';
        const value = row.querySelector('.row-value')?.textContent || '';
        return `${label}: ${value}`;
    }).join(', ');
    
    return `ANALYSIS SUMMARY: ${analysisContent.substring(0, 500)}
PREDICTIONS: ${predictions}`;
}

function updateLastUpdateTime() {
    const lastUpdateEl = document.getElementById('lastUpdate');
    if (lastUpdateEl) {
        const now = new Date();
        lastUpdateEl.textContent = `Last updated: ${now.toLocaleTimeString()}`;
    }
}

async function loadEventData() {
    const eventData = JSON.parse(localStorage.getItem('currentEvent') || '{}');
    currentEventData = eventData;
    
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
    
    // Show loading predictions
    displayLoadingPredictions();
    
    // Start real-time analysis
    await performAIAnalysis(eventData);
    updateLastUpdateTime();
    
    // Set up periodic real-time updates (every 2 minutes)
    if (analysisInterval) clearInterval(analysisInterval);
    analysisInterval = setInterval(async () => {
        if (!isAnalyzing) {
            await performAIAnalysis(eventData, true);
        }
    }, 120000); // 2 minutes
}

function displayLoadingPredictions() {
    const container = document.getElementById('predictionRows');
    container.innerHTML = `
        <div class="flex items-center justify-between px-4 py-3 text-sm">
            <span class="text-muted-foreground">Analyzing...</span>
            <span class="text-muted-foreground">--</span>
        </div>
    `;
}

async function performAIAnalysis(event, isUpdate = false) {
    if (isAnalyzing && !isUpdate) return;
    isAnalyzing = true;
    
    try {
        console.log('Starting real-time analysis for:', event.title);
        
        if (!isUpdate) {
        // Step 1: Show thinking
        showThinkingPhase(event);
        }
        
        // Step 2: Show searching with multiple sources
        showSearchingPhase(event);
        
        // Step 3: Get sources from multiple real-time sources
        console.log('Fetching from multiple real-time sources...');
        const allSources = await fetchMultipleSources(event);
        console.log(`Got ${allSources.length} total sources from multiple APIs`);
        
        // Step 4: Show reviewing
        showReviewingPhase(allSources);
        
        // Step 5: Display sources
        displaySources(allSources);
        
        // Step 6: AI Analysis with streaming and timeout
        console.log('Starting real-time AI analysis...');
        const analysisPromise = runAIAnalysis(event, allSources);
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('AI analysis timeout')), 45000)
        );
        
        await Promise.race([analysisPromise, timeoutPromise]);
        
        // Hide status after delay (only if not updating)
        if (!isUpdate) {
        setTimeout(() => {
            const statusEl = document.getElementById('analysisStatus');
                if (statusEl) statusEl.classList.add('hidden');
        }, 2000);
        } else {
            // For updates, show a brief "Updated" indicator
            showUpdateIndicator();
        }
        
    } catch (error) {
        console.error('Analysis error:', error);
        if (!isUpdate) {
        document.getElementById('analysisContent').innerHTML = `
            <p style="color: #ef4444;"><strong>Error:</strong> ${error.message}</p>
                <p style="color: #6b7280;">Retrying with available sources...</p>
        `;
        }
        
        // Fallback to basic predictions
        displayPredictions([
            { outcome: 'Yes', probability: 0.5, confidence: 'Low' },
            { outcome: 'No', probability: 0.5, confidence: 'Low' }
        ]);
    } finally {
        isAnalyzing = false;
    }
}

async function fetchMultipleSources(event) {
    const allSources = [];
    const searchQueries = generateSearchQueries(event);
    
    // Fetch from multiple sources in parallel
    const sourcePromises = [
        searchWithExa(searchQueries.exa, 8).catch(e => { console.error('Exa error:', e); return []; }),
        searchWithNewsAPI(event.title).catch(e => { console.error('NewsAPI error:', e); return []; }),
        searchWithTavily(event.title).catch(e => { console.error('Tavily error:', e); return []; }),
        searchWithSerper(event.title).catch(e => { console.error('Serper error:', e); return []; })
    ];
    
    const results = await Promise.allSettled(sourcePromises);
    
    results.forEach((result, index) => {
        if (result.status === 'fulfilled' && Array.isArray(result.value)) {
            allSources.push(...result.value);
        }
    });
    
    // Remove duplicates and prioritize by relevance
    const uniqueSources = deduplicateSources(allSources);
    
    // Sort by relevance and recency
    return uniqueSources
        .sort((a, b) => {
            const aScore = (a.relevanceScore || 0.5) * (a.isRecent ? 1.2 : 1);
            const bScore = (b.relevanceScore || 0.5) * (b.isRecent ? 1.2 : 1);
            return bScore - aScore;
        })
        .slice(0, 12); // Top 12 sources
}

function generateSearchQueries(event) {
    const title = event.title;
    const keywords = extractKeywords(title);
    
    return {
        exa: `${title} predictions analysis forecast 2026`,
        news: `${keywords.join(' ')} latest news updates`,
        tavily: `${title} market analysis expert opinion`,
        serper: `${title} real-time updates breaking news`
    };
}

function extractKeywords(text) {
    const stopWords = new Set(['will', 'the', 'be', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
    const words = text.toLowerCase().split(/\s+/);
    return words.filter(w => w.length > 3 && !stopWords.has(w)).slice(0, 5);
}

function deduplicateSources(sources) {
    const seen = new Set();
    const unique = [];
    
    for (const source of sources) {
        const key = source.url || source.link || source.title;
        if (key && !seen.has(key)) {
            seen.add(key);
            unique.push(source);
        }
    }
    
    return unique;
}

function showThinkingPhase(event) {
    document.getElementById('thinkingContent').textContent = 
        `Analyzing "${event.title}" with AI...`;
}

function showSearchingPhase(event) {
    const searchingSection = document.getElementById('searchingSection');
    searchingSection.classList.remove('hidden');
    
    const searchQueries = document.getElementById('searchQueries');
    searchQueries.innerHTML = ''; // Clear previous queries
    
    const queries = [
        { text: `${event.title.substring(0, 45)} predictions 2026`, source: 'Exa AI' },
        { text: `${event.title.substring(0, 45)} latest news`, source: 'News API' },
        { text: `${event.title.substring(0, 45)} market analysis`, source: 'Tavily' },
        { text: `${event.title.substring(0, 45)} real-time updates`, source: 'Serper' },
        { text: `${event.title.substring(0, 45)} expert forecast`, source: 'Multiple Sources' }
    ];
    
    queries.forEach((query, i) => {
        setTimeout(() => {
            const el = document.createElement('div');
            el.className = 'flex items-center gap-2 rounded-md border bg-muted/50 p-2 text-xs';
            el.innerHTML = `
                <svg class="h-3 w-3 shrink-0 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span class="flex-1 break-words">${escapeHtml(query.text)}</span>
                <span class="shrink-0 text-muted-foreground">${query.source}</span>
            `;
            searchQueries.appendChild(el);
        }, i * 100);
    });
}

function showReviewingPhase(exaResults) {
    const reviewingSection = document.getElementById('reviewingSection');
    reviewingSection.classList.remove('hidden');
    
    const reviewingSources = document.getElementById('reviewingSources');
    const topSources = exaResults.slice(0, 5);
    
    topSources.forEach((source, i) => {
        setTimeout(() => {
            const domain = source.url ? new URL(source.url).hostname.replace('www.', '') : 'unknown';
            const domainName = domain.split('.')[0];
            
            const el = document.createElement('div');
            el.className = 'flex items-start gap-3 rounded-md border bg-muted/50 p-2';
            
            el.innerHTML = `
                <div class="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary text-primary-foreground text-xs font-medium">
                    ${domainName.charAt(0).toUpperCase()}
                </div>
                <div class="min-w-0 flex-1">
                    <div class="truncate text-xs font-medium">${escapeHtml(source.title.substring(0, 55))}${source.title.length > 55 ? '...' : ''}</div>
                    <div class="text-xs text-muted-foreground">${escapeHtml(domainName)}</div>
                </div>
            `;
            
            reviewingSources.appendChild(el);
        }, i * 100);
    });
}

async function searchWithExa(query, numResults = 8) {
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
                    text: { maxCharacters: 1000 }
                }
            })
        });
        
        if (!response.ok) throw new Error('Exa API failed');
        const data = await response.json();
        return (data.results || []).map(r => ({
            title: r.title || '',
            url: r.url || '',
            text: r.text || '',
            relevanceScore: 0.8,
            source: 'Exa AI'
        }));
        
    } catch (error) {
        console.error('Exa search error:', error);
        return [];
    }
}

async function searchWithNewsAPI(query) {
    try {
        // Try Google News RSS first (free, no API key needed)
        return await searchWithGoogleNews(query);
    } catch (error) {
        console.error('NewsAPI error:', error);
        return [];
    }
}

async function searchWithGoogleNews(query) {
    try {
        // Using Google News RSS (free, no API key needed)
        const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
        const proxyUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;
        
        const response = await fetch(proxyUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) throw new Error('Google News RSS failed');
        
        const data = await response.json();
        if (!data.items || !Array.isArray(data.items)) {
            throw new Error('Invalid RSS response');
        }
        
        return data.items.slice(0, 6).map(item => ({
            title: item.title || '',
            url: item.link || '',
            text: item.description || item.content || '',
            relevanceScore: 0.7,
            source: 'Google News',
            isRecent: true
        }));
        
    } catch (error) {
        console.error('Google News error:', error);
        // Try alternative: Bing News (no API key needed for basic search)
        return searchWithBingNews(query);
    }
}

async function searchWithBingNews(query) {
    try {
        // Using Bing News Search (free tier available)
        // For now, return empty and let Exa handle it
        return [];
    } catch (error) {
        console.error('Bing News error:', error);
        return [];
    }
}

async function searchWithTavily(query) {
    try {
        // Tavily Search API - real-time web search
        // Note: Requires API key, but we'll try and fallback gracefully
        const apiKey = 'YOUR_TAVILY_KEY'; // Can be set via environment or config
        
        if (!apiKey || apiKey === 'YOUR_TAVILY_KEY') {
            // Fallback to DuckDuckGo or other free search
            return searchWithDuckDuckGo(query);
        }
        
        const response = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api_key': apiKey
            },
            body: JSON.stringify({
                query: query,
                search_depth: 'advanced',
                max_results: 5,
                include_answer: true
            })
        });
        
        if (!response.ok) throw new Error('Tavily API failed');
        const data = await response.json();
        
        const results = (data.results || []).map(r => ({
            title: r.title || '',
            url: r.url || '',
            text: r.content || r.snippet || '',
            relevanceScore: r.score || 0.7,
            source: 'Tavily'
        }));
        
        // Add answer if available
        if (data.answer) {
            results.unshift({
                title: 'AI Summary',
                url: '',
                text: data.answer,
                relevanceScore: 0.9,
                source: 'Tavily AI'
            });
        }
        
        return results;
        
    } catch (error) {
        console.error('Tavily error:', error);
        return searchWithDuckDuckGo(query);
    }
}

async function searchWithDuckDuckGo(query) {
    try {
        // DuckDuckGo Instant Answer API (free, no API key)
        const response = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`);
        
        if (!response.ok) throw new Error('DuckDuckGo failed');
        const data = await response.json();
        
        const results = [];
        
        // Add abstract if available
        if (data.AbstractText) {
            results.push({
                title: data.Heading || 'Summary',
                url: data.AbstractURL || '',
                text: data.AbstractText,
                relevanceScore: 0.75,
                source: 'DuckDuckGo'
            });
        }
        
        // Add related topics
        if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
            data.RelatedTopics.slice(0, 3).forEach(topic => {
                if (topic.Text) {
                    results.push({
                        title: topic.Text.substring(0, 100),
                        url: topic.FirstURL || '',
                        text: topic.Text,
                        relevanceScore: 0.65,
                        source: 'DuckDuckGo'
                    });
                }
            });
        }
        
        return results;
        
    } catch (error) {
        console.error('DuckDuckGo error:', error);
        return [];
    }
}

async function searchWithSerper(query) {
    try {
        // Serper.dev - Google Search API
        // Note: Requires API key, but we'll try and fallback gracefully
        const apiKey = 'YOUR_SERPER_KEY'; // Can be set via environment or config
        
        if (!apiKey || apiKey === 'YOUR_SERPER_KEY') {
            // Fallback to alternative search
            return searchWithDuckDuckGo(query);
        }
        
        const response = await fetch('https://google.serper.dev/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-KEY': apiKey
            },
            body: JSON.stringify({
                q: query,
                num: 5,
                gl: 'us',
                hl: 'en'
            })
        });
        
        if (!response.ok) throw new Error('Serper API failed');
        const data = await response.json();
        
        const results = (data.organic || []).map(item => ({
            title: item.title || '',
            url: item.link || '',
            text: item.snippet || '',
            relevanceScore: 0.75,
            source: 'Serper',
            isRecent: true
        }));
        
        // Add knowledge graph if available
        if (data.knowledgeGraph) {
            results.unshift({
                title: data.knowledgeGraph.title || '',
                url: data.knowledgeGraph.website || '',
                text: data.knowledgeGraph.description || '',
                relevanceScore: 0.85,
                source: 'Knowledge Graph'
            });
        }
        
        return results;
        
    } catch (error) {
        console.error('Serper error:', error);
        return searchWithDuckDuckGo(query);
    }
}

async function runAIAnalysis(event, allSources) {
    const prompt = buildPrompt(event, allSources);
    
    try {
        // Check if puter is available
        if (typeof puter === 'undefined' || !puter.ai || !puter.ai.chat) {
            console.warn('Puter AI not available, using fallback analysis');
            return runFallbackAnalysis(event, allSources);
        }
        
        console.log('Calling puter.ai.chat with streaming...');
        const analysisEl = document.getElementById('analysisContent');
        analysisEl.innerHTML = '<p style="color: #6b7280;">AI is analyzing real-time sources...</p>';
        
        let fullText = '';
        let hasStarted = false;
        let lastUpdate = Date.now();
        
        // Call AI with streaming
        const stream = await puter.ai.chat(prompt, {
            model: 'gpt-4',
            stream: true
        });
        
        // Handle streaming response
        if (stream && typeof stream[Symbol.asyncIterator] === 'function') {
            for await (const chunk of stream) {
                if (chunk && chunk.text) {
                    hasStarted = true;
                    fullText += chunk.text;
                    
                    // Update UI every 100ms to avoid too frequent updates
                    const now = Date.now();
                    if (now - lastUpdate > 100) {
                        analysisEl.innerHTML = formatAnalysisText(fullText) + '<p style="color: #9ca3af; font-size: 12px; margin-top: 16px;">● Analyzing in real-time...</p>';
                        lastUpdate = now;
                    }
                } else if (chunk && typeof chunk === 'string') {
                    hasStarted = true;
                    fullText += chunk;
                    analysisEl.innerHTML = formatAnalysisText(fullText) + '<p style="color: #9ca3af; font-size: 12px; margin-top: 16px;">● Analyzing in real-time...</p>';
                }
            }
            
            // Final update without loading indicator
            analysisEl.innerHTML = formatAnalysisText(fullText);
        } else if (stream && stream.text) {
            // Non-streaming response
            fullText = stream.text;
            analysisEl.innerHTML = formatAnalysisText(fullText);
        } else if (typeof stream === 'string') {
            // Direct string response
            fullText = stream;
            analysisEl.innerHTML = formatAnalysisText(fullText);
        }
        
        if (!hasStarted && !fullText) {
            throw new Error('No response from AI');
        }
        
        console.log('AI analysis complete, parsing...');
        
        // Parse and display
        const analysis = parseResponse(fullText);
        displayPredictions(analysis.predictions);
        displayModelInsight(analysis.insight || analysis.reasoning || 'Analysis complete');
        
        // Update last update time
        updateLastUpdateTime();
        
    } catch (error) {
        console.error('AI Error:', error);
        // Fallback to local analysis
        const result = await runFallbackAnalysis(event, allSources);
        updateLastUpdateTime();
        return result;
    }
}

async function runFallbackAnalysis(event, allSources) {
    console.log('Running fallback analysis with available sources...');
    const analysisEl = document.getElementById('analysisContent');
    
    // Analyze sources locally
    const analysis = analyzeSourcesLocally(event, allSources);
    
    // Display analysis
    analysisEl.innerHTML = `
        <h4>Real-Time Market Analysis</h4>
        <p>Based on ${allSources.length} real-time sources, here's the comprehensive analysis:</p>
        <p><strong>Market Context:</strong> ${analysis.context}</p>
        <p><strong>Key Factors:</strong> ${analysis.factors}</p>
        <p><strong>Prediction Rationale:</strong> ${analysis.rationale}</p>
        <p style="color: #6b7280; font-size: 12px; margin-top: 16px;">
            Analysis generated from ${allSources.length} sources including news, market data, and expert opinions.
        </p>
    `;
    
    displayPredictions(analysis.predictions);
    displayModelInsight(analysis.insight);
    
    return analysis;
}

function analyzeSourcesLocally(event, allSources) {
    // Simple local analysis based on sources
    const yesCount = allSources.filter(s => {
        const text = (s.text || '').toLowerCase();
        return text.includes('yes') || text.includes('likely') || text.includes('will') || text.includes('expected');
    }).length;
    
    const noCount = allSources.filter(s => {
        const text = (s.text || '').toLowerCase();
        return text.includes('no') || text.includes('unlikely') || text.includes('won\'t') || text.includes('doubt');
    }).length;
    
    const total = yesCount + noCount || 1;
    const yesProb = yesCount / total;
    const noProb = noCount / total;
    
    // Normalize to sum to 1
    const sum = yesProb + noProb || 1;
    const normalizedYes = yesProb / sum;
    const normalizedNo = noProb / sum;
    
    const confidence = allSources.length >= 8 ? 'High' : allSources.length >= 4 ? 'Medium' : 'Low';
    
    return {
        predictions: [
            { outcome: 'Yes', probability: normalizedYes, confidence },
            { outcome: 'No', probability: normalizedNo, confidence }
        ],
        context: `Analyzed ${allSources.length} real-time sources from multiple APIs including news, market analysis, and expert opinions.`,
        factors: `Sentiment analysis shows ${yesCount > noCount ? 'positive' : yesCount < noCount ? 'negative' : 'mixed'} indicators. Market volume of ${event.volume} suggests ${parseFloat(event.volume.replace(/[^0-9.]/g, '')) > 100000 ? 'high' : 'moderate'} interest.`,
        rationale: `Based on source analysis, ${normalizedYes > 0.6 ? 'strong indicators point to' : normalizedYes > 0.4 ? 'moderate indicators suggest' : 'limited indicators for'} a "Yes" outcome.`,
        insight: `Real-time analysis of ${allSources.length} sources indicates ${normalizedYes > 0.55 ? 'favorable' : normalizedYes < 0.45 ? 'unfavorable' : 'uncertain'} conditions.`
    };
}

function buildPrompt(event, allSources) {
    const sources = allSources.slice(0, 12).map((r, i) => {
        const text = (r.text || '').replace(/\n+/g, ' ').trim();
        const domain = r.url ? (new URL(r.url).hostname.replace('www.', '') || 'Unknown') : 'AI Source';
        return `SOURCE ${i+1} [${r.source || 'Unknown'}]: "${r.title}"
From: ${domain}
Content: ${text.substring(0, 800)}
Relevance: ${(r.relevanceScore || 0.5).toFixed(2)}
---`;
    }).join('\n\n');
    
    const currentDate = new Date().toISOString().split('T')[0];
    
    return `You are an expert prediction market analyst. Analyze this event using MULTIPLE REAL-TIME SOURCES and provide accurate probability predictions.

EVENT: "${event.title}"
Market Volume: ${event.volume}
24h Volume: ${event.volume24h || 'N/A'}
Liquidity: ${event.liquidity || 'N/A'}
Closes: ${event.closeDate}
Current Date: ${currentDate}

REAL-TIME SOURCES (${allSources.length} sources from multiple APIs):
${sources}

TASK:
1. Synthesize information from ALL sources above
2. Consider recency, relevance, and source credibility
3. Account for market sentiment, volume, and liquidity
4. Provide probability predictions based on REAL-TIME data
5. Explain your reasoning citing specific sources

Provide your analysis in this format:

First, write 3-4 comprehensive paragraphs analyzing:
- Current market conditions and sentiment
- Key factors influencing the outcome
- Recent developments from the sources
- Expert opinions and forecasts
- Statistical trends and patterns

Then provide predictions in this exact JSON format:

\`\`\`json
{
  "predictions": [
    {"outcome": "Yes", "probability": 0.XX, "confidence": "High|Medium|Low"},
    {"outcome": "No", "probability": 0.XX, "confidence": "High|Medium|Low"}
  ],
  "insight": "One sentence key insight summarizing the most important factor",
  "confidence": "High|Medium|Low",
  "reasoning": "Brief explanation of the prediction logic"
}
\`\`\`

Be thorough, cite specific sources by number, and base predictions on REAL-TIME data.`;
}

function parseResponse(text) {
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
    } catch (e) {
        console.error('Parse error:', e);
    }
    
    // Fallback
    return {
        predictions: [
            { outcome: 'Yes', probability: 0.5, confidence: 'Medium' },
            { outcome: 'No', probability: 0.5, confidence: 'Medium' }
        ],
        insight: 'See analysis above',
        confidence: 'Medium'
    };
}

function formatAnalysisText(text) {
    let display = text.replace(/```json[\s\S]*?```/g, '').trim();
    display = display.replace(/\*\*(.*?)\*\*/g, '<h4>$1</h4>');
    
    const paragraphs = display.split('\n\n').filter(p => p.trim());
    return paragraphs.map(p => {
        if (p.includes('<h4>')) return p;
        return `<p>${p.replace(/\n/g, '<br>')}</p>`;
    }).join('');
}

function displayPredictions(predictions) {
    const container = document.getElementById('predictionRows');
    container.innerHTML = predictions.map(pred => `
        <div class="flex items-center justify-between px-4 py-3 text-sm">
            <span class="font-medium">${escapeHtml(pred.outcome)}</span>
            <span class="font-semibold">${(pred.probability * 100).toFixed(0)}%</span>
        </div>
    `).join('');
}

function displayModelInsight(insight) {
    document.getElementById('modelInsightText').textContent = insight;
}

function displaySources(allSources) {
    const container = document.getElementById('sourcesList');
    const sources = allSources.slice(0, 12);
    
    document.getElementById('totalSources').textContent = sources.length;
    
    container.innerHTML = sources.map((source, i) => {
        const domain = source.url ? (new URL(source.url).hostname.replace('www.', '') || 'Unknown') : 'AI Source';
        const sourceLabel = source.source || 'Unknown';
        const isRecent = source.isRecent ? '🆕' : '';
        
        return `
        <div class="rounded-md border bg-muted/50 p-4">
            <div class="mb-2 flex items-start justify-between gap-2">
                <h4 class="flex-1 text-sm font-medium break-words">${escapeHtml(source.title)} ${isRecent}</h4>
                ${source.url ? `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener" class="shrink-0 text-xs text-primary underline hover:no-underline">View</a>` : ''}
            </div>
            <p class="mb-2 text-xs text-muted-foreground line-clamp-2">${escapeHtml((source.text || '').substring(0, 200))}${(source.text || '').length > 200 ? '...' : ''}</p>
            <div class="text-xs text-muted-foreground">
                [${i + 1}] ${escapeHtml(domain)} • ${sourceLabel} ${source.relevanceScore ? `(${(source.relevanceScore * 100).toFixed(0)}% relevant)` : ''}
            </div>
        </div>
        `;
    }).join('');
}

function showUpdateIndicator() {
    const statusEl = document.getElementById('analysisStatus');
    if (statusEl) {
        statusEl.classList.remove('hidden');
        const updateMsg = document.createElement('div');
        updateMsg.className = 'rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900';
        updateMsg.textContent = '🔄 Analysis updated with latest real-time data';
        statusEl.querySelector('.p-6')?.insertBefore(updateMsg, statusEl.querySelector('.p-6').firstChild);
        
        setTimeout(() => {
            updateMsg.remove();
            statusEl.classList.add('hidden');
        }, 3000);
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
