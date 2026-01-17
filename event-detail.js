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
        // Auto-resize textarea
        const autoResize = () => {
            questionInput.style.height = 'auto';
            questionInput.style.height = `${Math.min(questionInput.scrollHeight, 120)}px`;
        };
        
        questionInput.addEventListener('input', autoResize);
        
        const sendQuestion = async () => {
            const question = questionInput.value.trim();
            if (!question) return;
            
            // Add user message
            addMessageToConversation('user', question);
            questionInput.value = '';
            questionInput.style.height = 'auto';
            sendBtn.disabled = true;
            
            // Get AI response
            await getAIResponse(question);
            
            sendBtn.disabled = false;
        };
        
        sendBtn.addEventListener('click', sendQuestion);
        questionInput.addEventListener('keydown', (e) => {
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
        <div class="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1">
            <span class="text-xs text-gray-500">Analyzing...</span>
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
        
        // Step 4: Show reviewing (async for favicons)
        await showReviewingPhase(allSources);
        
        // Step 5: Display sources (async for favicons)
        await displaySources(allSources);
        
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

// Cache for source favicons
const faviconCache = new Map();

// Fast favicon fetcher
async function getFavicon(url) {
    if (!url) return null;
    
    try {
        const domain = new URL(url).hostname.replace('www.', '');
        const cacheKey = domain;
        
        if (faviconCache.has(cacheKey)) {
            return faviconCache.get(cacheKey);
        }
        
        // Try multiple favicon sources in parallel
        const faviconPromises = [
            `https://www.google.com/s2/favicons?domain=${domain}&sz=32`,
            `https://${domain}/favicon.ico`,
            `https://${domain}/favicon.png`
        ].map(faviconUrl => 
            fetch(faviconUrl, { method: 'HEAD', mode: 'no-cors' })
                .then(() => faviconUrl)
                .catch(() => null)
        );
        
        // Use first available favicon
        const results = await Promise.allSettled(faviconPromises);
        const favicon = results.find(r => r.status === 'fulfilled' && r.value)?.value || 
                       `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
        
        faviconCache.set(cacheKey, favicon);
        return favicon;
    } catch (error) {
        const domain = url.includes('://') ? new URL(url).hostname.replace('www.', '') : url;
        return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    }
}

async function fetchMultipleSources(event) {
    const allSources = [];
    const searchQueries = generateSearchQueries(event);
    
    // Enhanced: Fetch from diverse real-time sources in parallel with fast timeouts
    const sourcePromises = [
        searchWithExa(searchQueries.exa, 6).catch(() => []),
        searchWithNewsAPI(event.title).catch(() => []),
        searchWithTavily(event.title).catch(() => []),
        searchWithSerper(event.title).catch(() => []),
        searchWithDuckDuckGo(event.title).catch(() => []),
        searchWithReddit(event.title).catch(() => [])
    ];
    
    // Fast parallel fetching - get results as they come
    const allResults = await Promise.allSettled(
        sourcePromises.map(p => Promise.race([
            p,
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2500))
        ]).catch(() => []))
    );
    
    allResults.forEach((result) => {
        if (result.status === 'fulfilled' && Array.isArray(result.value)) {
            allSources.push(...result.value);
        }
    });
    
    // Fast deduplication with URL normalization
    const uniqueSources = deduplicateSources(allSources);
    
    // Enhanced scoring with multiple factors
    return uniqueSources
        .map(source => {
            // Calculate enhanced relevance score
            let score = source.relevanceScore || 0.5;
            if (source.isRecent) score *= 1.3;
            if (source.source === 'Exa AI' || source.source === 'Tavily AI') score *= 1.2;
            if (source.text && source.text.length > 300) score *= 1.15;
            if (source.url && (source.url.includes('news') || source.url.includes('reuters') || source.url.includes('bloomberg'))) score *= 1.1;
            return { ...source, relevanceScore: Math.min(1, score) };
        })
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, 18); // More sources for better reasoning
}

function generateSearchQueries(event) {
    const title = event.title;
    const keywords = extractKeywords(title);
    const currentYear = new Date().getFullYear();
    
    // Enhanced query generation with more specific contexts
    return {
        exa: `${title} predictions analysis forecast ${currentYear} ${currentYear + 1} market trends`,
        news: `${keywords.join(' ')} latest news updates ${currentYear} breaking`,
        tavily: `${title} market analysis expert opinion forecast`,
        serper: `${title} real-time updates breaking news ${currentYear}`,
        reddit: `${title} discussion analysis predictions`,
        duckduckgo: `${title} ${currentYear} forecast prediction`
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
        { text: `${event.title.substring(0, 50)} predictions 2026` },
        { text: `${event.title.substring(0, 50)} latest news` },
        { text: `${event.title.substring(0, 50)} market analysis` }
    ];
    
    queries.forEach((query, i) => {
        setTimeout(() => {
            const el = document.createElement('div');
            el.className = 'flex items-center gap-2 px-3 py-2 rounded-full bg-gray-100 border border-gray-200';
            el.style.fontFamily = "'Inter', sans-serif";
            el.innerHTML = `
                <svg class="h-3.5 w-3.5 shrink-0 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span class="text-sm text-gray-700">${escapeHtml(query.text)}</span>
            `;
            searchQueries.appendChild(el);
        }, i * 150);
    });
}

async function showReviewingPhase(exaResults) {
    const reviewingSection = document.getElementById('reviewingSection');
    reviewingSection.classList.remove('hidden');
    
    const reviewingSources = document.getElementById('reviewingSources');
    const topSources = exaResults.slice(0, 5);
    
    // Fetch favicons in parallel
    const sourcesWithFavicons = await Promise.all(
        topSources.map(async (source) => {
            const favicon = await getFavicon(source.url);
            return { ...source, favicon };
        })
    );
    
    sourcesWithFavicons.forEach((source, i) => {
        setTimeout(() => {
            const domain = source.url ? new URL(source.url).hostname.replace('www.', '') : 'unknown';
            const title = source.title || domain;
            const domainName = domain.split('.')[0];
            
            const el = document.createElement('div');
            el.className = 'flex items-start gap-2.5 p-2.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors';
            el.style.fontFamily = "'Inter', sans-serif";
            
            el.innerHTML = `
                ${source.favicon ? 
                    `<img src="${source.favicon}" alt="${domain}" class="h-6 w-6 shrink-0 rounded" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />` : 
                    ''
                }
                <div class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600 text-[10px] font-medium" ${source.favicon ? 'style="display:none;"' : ''}>
                    ${domainName.charAt(0).toUpperCase()}
                </div>
                <div class="flex-1 min-w-0">
                    <div class="text-xs font-medium text-gray-900 mb-0.5 line-clamp-1">${escapeHtml(title)}</div>
                    <div class="text-[10px] text-gray-500">${escapeHtml(domain)}</div>
                </div>
            `;
            
            reviewingSources.appendChild(el);
        }, i * 50); // Faster animation
    });
}

async function searchWithExa(query, numResults = 5) {
    try {
        // Add timeout for speed
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout
        
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
                    text: { maxCharacters: 500 } // Reduced for speed
                }
            }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
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
        if (error.name === 'AbortError') {
            console.warn('Exa search timeout');
        } else {
            console.error('Exa search error:', error);
        }
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
        // Using Google News RSS with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout
        
        const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
        const proxyUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;
        
        const response = await fetch(proxyUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) throw new Error('Google News RSS failed');
        
        const data = await response.json();
        if (!data.items || !Array.isArray(data.items)) {
            throw new Error('Invalid RSS response');
        }
        
        return data.items.slice(0, 4).map(item => ({ // Reduced for speed
            title: item.title || '',
            url: item.link || '',
            text: item.description || item.content || '',
            relevanceScore: 0.7,
            source: 'Google News',
            isRecent: true
        }));
        
    } catch (error) {
        if (error.name === 'AbortError') {
            console.warn('Google News timeout');
        } else {
            console.error('Google News error:', error);
        }
        return [];
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
        // Tavily Search API - real-time web search with timeout
        const apiKey = 'YOUR_TAVILY_KEY';
        
        if (!apiKey || apiKey === 'YOUR_TAVILY_KEY') {
            return searchWithDuckDuckGo(query);
        }
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        
        const response = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api_key': apiKey
            },
            body: JSON.stringify({
                query: query,
                search_depth: 'basic', // Changed to basic for speed
                max_results: 3, // Reduced for speed
                include_answer: false
            }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
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
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);
        
        const response = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`, {
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
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
            data.RelatedTopics.slice(0, 4).forEach(topic => {
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
        if (error.name !== 'AbortError') {
            console.error('DuckDuckGo error:', error);
        }
        return [];
    }
}

async function searchWithReddit(query) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);
        
        // Reddit search via JSON API (free, no auth needed for read)
        const searchUrl = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&limit=5&sort=relevance`;
        
        const response = await fetch(searchUrl, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'AndoRead/1.0'
            }
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) throw new Error('Reddit search failed');
        const data = await response.json();
        
        if (!data.data || !data.data.children) return [];
        
        return data.data.children.slice(0, 4).map(post => ({
            title: post.data.title || '',
            url: `https://reddit.com${post.data.permalink}`,
            text: post.data.selftext || post.data.title || '',
            relevanceScore: 0.7,
            source: 'Reddit',
            isRecent: (Date.now() / 1000 - post.data.created_utc) < 2592000 // Last 30 days
        }));
        
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('Reddit error:', error);
        }
        return [];
    }
}

async function searchWithSerper(query) {
    try {
        // Serper.dev - Google Search API with timeout
        const apiKey = 'YOUR_SERPER_KEY';
        
        if (!apiKey || apiKey === 'YOUR_SERPER_KEY') {
            return searchWithDuckDuckGo(query);
        }
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        
        const response = await fetch('https://google.serper.dev/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-KEY': apiKey
            },
            body: JSON.stringify({
                q: query,
                num: 3, // Reduced for speed
                gl: 'us',
                hl: 'en'
            }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
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
    console.log('Running fallback analysis with statistical methods...');
    const analysisEl = document.getElementById('analysisContent');
    
    // Analyze sources locally with enhanced statistical methods
    const analysis = analyzeSourcesLocally(event, allSources);
    
    // Display analysis in minimal format
    analysisEl.innerHTML = `
        <p class="mb-3">${analysis.context}</p>
        <p class="mb-3">${analysis.factors}</p>
        <p class="text-gray-600">${analysis.rationale}</p>
    `;
    
    displayPredictions(analysis.predictions);
    displayModelInsight(analysis.insight);
    displayStatisticalMetrics(analysis.metrics);
    
    return analysis;
}

function analyzeSourcesLocally(event, allSources) {
    // Enhanced statistical analysis with multiple methods
    
    // 1. Sentiment Analysis with Weighted Scoring
    const sentimentScores = allSources.map(s => {
        const text = (s.text || '').toLowerCase();
        const relevance = s.relevanceScore || 0.5;
        let score = 0;
        
        const positiveTerms = ['yes', 'likely', 'will', 'expected', 'favorable', 'positive', 'optimistic', 'bullish', 'gain', 'rise', 'increase'];
        const negativeTerms = ['no', 'unlikely', "won't", 'doubt', 'unfavorable', 'negative', 'pessimistic', 'bearish', 'loss', 'fall', 'decrease'];
        
        positiveTerms.forEach(term => {
            if (text.includes(term)) score += 1 * relevance;
        });
        negativeTerms.forEach(term => {
            if (text.includes(term)) score -= 1 * relevance;
        });
        
        return { score, relevance };
    });
    
    const totalSentiment = sentimentScores.reduce((sum, s) => sum + s.score, 0);
    const weightedAvg = sentimentScores.reduce((sum, s) => sum + (s.score * s.relevance), 0) / 
                       sentimentScores.reduce((sum, s) => sum + s.relevance, 1);
    
    // 2. Bayesian Inference
    const priorYes = 0.5; // Prior probability
    const evidenceYes = sentimentScores.filter(s => s.score > 0).length;
    const evidenceNo = sentimentScores.filter(s => s.score < 0).length;
    const totalEvidence = evidenceYes + evidenceNo || 1;
    
    const likelihoodYes = evidenceYes / totalEvidence;
    const likelihoodNo = evidenceNo / totalEvidence;
    
    // Bayesian update: P(Yes|Evidence) = P(Evidence|Yes) * P(Yes) / P(Evidence)
    const posteriorYes = (likelihoodYes * priorYes) / ((likelihoodYes * priorYes) + (likelihoodNo * (1 - priorYes)));
    const posteriorNo = 1 - posteriorYes;
    
    // 3. Confidence Intervals (95% CI using normal approximation)
    const n = allSources.length;
    const p = posteriorYes;
    const z = 1.96; // 95% confidence
    const marginError = z * Math.sqrt((p * (1 - p)) / n);
    const ciLower = Math.max(0, p - marginError);
    const ciUpper = Math.min(1, p + marginError);
    
    // 4. Statistical Significance Test (Chi-square)
    const expectedYes = totalEvidence * 0.5;
    const expectedNo = totalEvidence * 0.5;
    const chiSquare = ((evidenceYes - expectedYes) ** 2 / expectedYes) + 
                     ((evidenceNo - expectedNo) ** 2 / expectedNo);
    const isSignificant = chiSquare > 3.84; // p < 0.05 threshold
    
    // 5. Monte Carlo Simulation (1000 iterations)
    const monteCarloResults = [];
    for (let i = 0; i < 1000; i++) {
        let simYes = 0;
        sentimentScores.forEach(s => {
            const rand = Math.random();
            const prob = 0.5 + (s.score * 0.1); // Convert score to probability
            if (rand < prob) simYes++;
        });
        monteCarloResults.push(simYes / sentimentScores.length);
    }
    const monteCarloMean = monteCarloResults.reduce((a, b) => a + b, 0) / monteCarloResults.length;
    const monteCarloStd = Math.sqrt(
        monteCarloResults.reduce((sum, x) => sum + (x - monteCarloMean) ** 2, 0) / monteCarloResults.length
    );
    
    // 6. Final Probability (weighted combination of methods)
    const bayesianWeight = 0.4;
    const monteCarloWeight = 0.3;
    const sentimentWeight = 0.3;
    
    const normalizedSentiment = (weightedAvg + 1) / 2; // Normalize to [0, 1]
    const finalYes = (posteriorYes * bayesianWeight) + 
                    (monteCarloMean * monteCarloWeight) + 
                    (normalizedSentiment * sentimentWeight);
    const finalNo = 1 - finalYes;
    
    // 7. Confidence Level based on statistical measures
    let confidence = 'Low';
    if (n >= 8 && isSignificant && (ciUpper - ciLower) < 0.3) {
        confidence = 'High';
    } else if (n >= 4 && (ciUpper - ciLower) < 0.4) {
        confidence = 'Medium';
    }
    
    // Generate statistical metrics
    const metrics = {
        bayesianPosterior: posteriorYes,
        confidenceInterval: [ciLower, ciUpper],
        statisticalSignificance: isSignificant,
        monteCarloMean: monteCarloMean,
        monteCarloStd: monteCarloStd,
        sampleSize: n,
        chiSquare: chiSquare
    };
    
    return {
        predictions: [
            { outcome: 'Yes', probability: finalYes, confidence },
            { outcome: 'No', probability: finalNo, confidence }
        ],
        metrics: metrics,
        context: `Statistical analysis of ${n} sources using Bayesian inference, Monte Carlo simulation, and confidence intervals.`,
        factors: `Weighted sentiment: ${weightedAvg > 0 ? 'positive' : weightedAvg < 0 ? 'negative' : 'neutral'} (${weightedAvg.toFixed(2)}). Market volume: ${event.volume}. Statistical significance: ${isSignificant ? 'Yes' : 'No'} (χ²=${chiSquare.toFixed(2)}).`,
        rationale: `Bayesian posterior probability: ${(posteriorYes * 100).toFixed(1)}%. 95% CI: [${(ciLower * 100).toFixed(1)}%, ${(ciUpper * 100).toFixed(1)}%]. Monte Carlo mean: ${(monteCarloMean * 100).toFixed(1)}% ± ${(monteCarloStd * 100).toFixed(1)}%.`,
        insight: `Combined statistical analysis indicates ${finalYes > 0.6 ? 'strong' : finalYes > 0.4 ? 'moderate' : 'weak'} evidence for "Yes" outcome with ${confidence.toLowerCase()} confidence.`
    };
}

function buildPrompt(event, allSources) {
    // Enhanced context engineering: better source processing and context extraction
    const sources = allSources.slice(0, 18).map((r, i) => {
        const text = (r.text || '').replace(/\n+/g, ' ').trim();
        const domain = r.url ? (new URL(r.url).hostname.replace('www.', '') || 'Unknown') : 'AI Source';
        
        // Extract key information from text
        const keyPhrases = extractKeyPhrases(text);
        const sentiment = analyzeTextSentiment(text);
        
        return `SOURCE ${i+1} [${r.source || 'Unknown'} | Relevance: ${(r.relevanceScore || 0.5).toFixed(2)} | ${sentiment}]:
Title: "${r.title}"
Domain: ${domain}
Key Phrases: ${keyPhrases.join(', ')}
Content: ${text.substring(0, 1000)}
URL: ${r.url || 'N/A'}
---`;
    }).join('\n\n');
    
    // Enhanced context: extract event context
    const eventContext = extractEventContext(event);
    const currentDate = new Date().toISOString().split('T')[0];
    const currentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    
    // Source diversity analysis
    const sourceTypes = [...new Set(allSources.map(s => s.source))];
    const sourceCounts = sourceTypes.map(type => ({
        type,
        count: allSources.filter(s => s.source === type).length
    }));
    
    return `You are an elite prediction market analyst with expertise in statistical modeling, Bayesian inference, and real-time data synthesis. Your task is to provide highly accurate probability predictions using MULTIPLE DIVERSE REAL-TIME SOURCES.

EVENT CONTEXT:
Title: "${event.title}"
${eventContext}
Market Metrics:
- Total Volume: ${event.volume}
- 24h Volume: ${event.volume24h || 'N/A'}
- Liquidity: ${event.liquidity || 'N/A'}
- Close Date: ${event.closeDate}
- Current Date/Time: ${currentDate} ${currentTime}

SOURCE DIVERSITY ANALYSIS:
Total Sources: ${allSources.length}
Source Types: ${sourceCounts.map(s => `${s.type} (${s.count})`).join(', ')}
Recent Sources: ${allSources.filter(s => s.isRecent).length}
High Relevance Sources: ${allSources.filter(s => (s.relevanceScore || 0) > 0.7).length}

REAL-TIME SOURCES (${allSources.length} sources from ${sourceTypes.length} different APIs):
${sources}

ENHANCED ANALYSIS FRAMEWORK:

1. CONTEXT SYNTHESIS:
   - Cross-reference information across ALL ${allSources.length} sources
   - Identify consensus patterns and outlier perspectives
   - Weight sources by: relevance score, recency, domain authority, content depth
   - Extract temporal patterns and trend indicators

2. STATISTICAL MODELING:
   - Apply Bayesian inference with evidence-weighted priors
   - Calculate 95% confidence intervals using normal approximation
   - Perform chi-square tests for categorical evidence
   - Apply Monte Carlo simulation (1000+ iterations) for uncertainty
   - Calculate effect sizes and practical significance
   - Consider sample size adequacy and statistical power

3. MULTI-SOURCE REASONING:
   - Compare perspectives from news, market analysis, expert opinions, and social signals
   - Identify conflicting evidence and assess reliability
   - Weight recent information more heavily
   - Consider source credibility (news sites > forums > social media)

4. MARKET DYNAMICS:
   - Analyze volume trends and liquidity implications
   - Consider market efficiency and information asymmetry
   - Factor in closing date proximity and time decay

TASK:
Provide a comprehensive analysis in this format:

ANALYSIS (2-3 paragraphs):
- Synthesize evidence from all ${allSources.length} sources
- Identify key factors with quantified impact
- Discuss consensus vs. divergence in sources
- Apply statistical methods and cite specific sources by number
- Provide Bayesian posterior probabilities with confidence intervals
- Report significance testing results

PREDICTIONS (JSON format):
\`\`\`json
{
  "predictions": [
    {"outcome": "Yes", "probability": 0.XX, "confidence": "High|Medium|Low", "ci_lower": 0.XX, "ci_upper": 0.XX},
    {"outcome": "No", "probability": 0.XX, "confidence": "High|Medium|Low", "ci_lower": 0.XX, "ci_upper": 0.XX}
  ],
  "insight": "One sentence key insight synthesizing the most important factor from all sources",
  "confidence": "High|Medium|Low",
  "reasoning": "Brief explanation of prediction logic citing source numbers and statistical methods",
  "metrics": {
    "sample_size": ${allSources.length},
    "source_diversity": ${sourceTypes.length},
    "statistical_significance": true/false,
    "bayesian_posterior": 0.XX,
    "confidence_interval_width": 0.XX,
    "consensus_strength": "High|Medium|Low"
  }
}
\`\`\`

Be rigorous, cite specific sources by number (e.g., "Source 3 indicates..."), and base all predictions on statistical analysis of the real-time data.`;
}

function extractKeyPhrases(text) {
    if (!text || text.length < 50) return [];
    
    const words = text.toLowerCase().split(/\s+/);
    const importantWords = words.filter(w => 
        w.length > 4 && 
        !['that', 'this', 'with', 'from', 'their', 'there', 'would', 'could', 'should'].includes(w)
    );
    
    const wordFreq = {};
    importantWords.forEach(w => {
        wordFreq[w] = (wordFreq[w] || 0) + 1;
    });
    
    return Object.entries(wordFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([word]) => word);
}

function analyzeTextSentiment(text) {
    if (!text) return 'Neutral';
    const lowerText = text.toLowerCase();
    const positive = ['yes', 'likely', 'will', 'expected', 'favorable', 'positive', 'optimistic', 'gain', 'rise', 'increase', 'success', 'win'].filter(w => lowerText.includes(w)).length;
    const negative = ['no', 'unlikely', "won't", 'doubt', 'unfavorable', 'negative', 'pessimistic', 'loss', 'fall', 'decrease', 'fail', 'lose'].filter(w => lowerText.includes(w)).length;
    
    if (positive > negative) return 'Positive';
    if (negative > positive) return 'Negative';
    return 'Neutral';
}

function extractEventContext(event) {
    const context = [];
    if (event.volume && parseFloat(event.volume.replace(/[^0-9.]/g, '')) > 100000) {
        context.push('- High market interest (volume > $100K)');
    }
    if (event.closeDate) {
        const closeDate = new Date(event.closeDate);
        const daysUntilClose = Math.ceil((closeDate - new Date()) / (1000 * 60 * 60 * 24));
        if (daysUntilClose < 30) {
            context.push(`- Closing soon (${daysUntilClose} days)`);
        }
    }
    return context.join('\n') || '- Standard market conditions';
}

function parseResponse(text) {
    try {
        const jsonMatch = text.match(/```json\s*(\{[\s\S]*?\})\s*```/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[1]);
            return {
                predictions: parsed.predictions || [],
                insight: parsed.insight || 'Analysis complete',
                confidence: parsed.confidence || 'Medium',
                metrics: parsed.metrics || null
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
        confidence: 'Medium',
        metrics: null
    };
}

function formatAnalysisText(text) {
    let display = text.replace(/```json[\s\S]*?```/g, '').trim();
    display = display.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>');
    
    const paragraphs = display.split('\n\n').filter(p => p.trim());
    return paragraphs.map(p => {
        return `<p class="mb-3 text-sm text-gray-700 leading-relaxed">${p.replace(/\n/g, '<br>')}</p>`;
    }).join('');
}

function displayPredictions(predictions) {
    const container = document.getElementById('predictionRows');
    container.innerHTML = predictions.map(pred => `
        <div class="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1">
            <span class="text-xs font-medium text-gray-700">${escapeHtml(pred.outcome)}</span>
            <span class="text-xs font-semibold text-gray-900">${(pred.probability * 100).toFixed(0)}%</span>
            ${pred.ci_lower && pred.ci_upper ? `<span class="text-[10px] text-gray-500">[${(pred.ci_lower * 100).toFixed(0)}-${(pred.ci_upper * 100).toFixed(0)}%]</span>` : ''}
        </div>
    `).join('');
}

function displayModelInsight(insight) {
    const insightContainer = document.getElementById('insightContainer');
    const insightText = document.getElementById('modelInsightText');
    if (insightText && insight) {
        insightText.textContent = insight;
        insightContainer.classList.remove('hidden');
    }
}

function displayStatisticalMetrics(metrics) {
    if (!metrics) return;
    
    const metricsContainer = document.getElementById('statisticalMetrics');
    const metricsContent = document.getElementById('metricsContent');
    
    if (!metricsContainer || !metricsContent) return;
    
    metricsContainer.classList.remove('hidden');
    
    const items = [];
    
    if (metrics.bayesianPosterior !== undefined) {
        items.push(`Bayesian Posterior: ${(metrics.bayesianPosterior * 100).toFixed(1)}%`);
    }
    
    if (metrics.confidenceInterval) {
        const [lower, upper] = metrics.confidenceInterval;
        items.push(`95% CI: [${(lower * 100).toFixed(1)}%, ${(upper * 100).toFixed(1)}%]`);
    }
    
    if (metrics.statisticalSignificance !== undefined) {
        items.push(`Significance: ${metrics.statisticalSignificance ? 'Yes (p<0.05)' : 'No (p≥0.05)'}`);
    }
    
    if (metrics.monteCarloMean !== undefined) {
        items.push(`Monte Carlo: ${(metrics.monteCarloMean * 100).toFixed(1)}% ± ${(metrics.monteCarloStd * 100).toFixed(1)}%`);
    }
    
    if (metrics.sampleSize !== undefined) {
        items.push(`Sample Size: n=${metrics.sampleSize}`);
    }
    
    metricsContent.innerHTML = items.map(item => 
        `<div class="text-xs text-gray-600">${item}</div>`
    ).join('');
}

async function displaySources(allSources) {
    const container = document.getElementById('sourcesList');
    const sources = allSources.slice(0, 10);
    
    document.getElementById('totalSources').textContent = sources.length;
    
    // Fetch favicons in parallel for speed
    const sourcesWithFavicons = await Promise.all(
        sources.map(async (source) => {
            const favicon = await getFavicon(source.url);
            return { ...source, favicon };
        })
    );
    
    container.innerHTML = sourcesWithFavicons.map((source, i) => {
        const domain = source.url ? (new URL(source.url).hostname.replace('www.', '') || 'Unknown') : 'AI Source';
        const domainName = domain.split('.')[0];
        
        return `
        <a href="${source.url || '#'}" target="_blank" rel="noopener" class="group flex items-start gap-2.5 rounded-md border border-gray-200 bg-white p-2.5 transition-colors hover:bg-gray-50">
            ${source.favicon ? 
                `<img src="${source.favicon}" alt="${domain}" class="h-5 w-5 shrink-0 rounded" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />` : 
                ''
            }
            <div class="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-gray-100 text-gray-600 text-[10px] font-medium" ${source.favicon ? 'style="display:none;"' : ''}>
                ${domainName.charAt(0).toUpperCase()}
            </div>
            <div class="min-w-0 flex-1">
                <div class="mb-0.5 line-clamp-1 text-xs font-medium text-gray-900 group-hover:text-gray-700">
                    ${escapeHtml(source.title)}
                </div>
                <div class="text-[10px] text-gray-500">${escapeHtml(domain)}</div>
            </div>
        </a>
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
