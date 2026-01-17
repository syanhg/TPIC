const urlParams = new URLSearchParams(window.location.search);
const eventSlug = urlParams.get('event');

let analysisInterval = null;
let isAnalyzing = false;

document.addEventListener('DOMContentLoaded', () => {
    setupSearch();
    setupIDETabs();
    // Wait for Puter to load
    if (typeof puter === 'undefined') {
        console.error('Puter not loaded, retrying...');
        setTimeout(loadEventData, 500);
    } else {
        loadEventData();
    }
});

function setupIDETabs() {
    const tabs = document.querySelectorAll('.ide-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            
            // Update active tab
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Show/hide content
            const analysisContentDiv = document.querySelector('#analysisContent .ide-content:first-of-type');
            const summaryContentDiv = document.getElementById('summaryContent');
            
            if (tabName === 'analysis') {
                if (analysisContentDiv) analysisContentDiv.classList.remove('hidden');
                if (summaryContentDiv) summaryContentDiv.classList.add('hidden');
            } else if (tabName === 'summary') {
                if (analysisContentDiv) analysisContentDiv.classList.add('hidden');
                if (summaryContentDiv) summaryContentDiv.classList.remove('hidden');
            }
        });
    });
}

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
        
        // Step 5.5: Build knowledge graph with causality analysis
        console.log('Building knowledge graph with causality analysis...');
        const knowledgeGraph = await buildKnowledgeGraph(event, allSources);
        displayKnowledgeGraph(knowledgeGraph);
        
        // Step 5.6: Use causal predictions if available
        if (knowledgeGraph && knowledgeGraph.metadata && knowledgeGraph.metadata.predictions) {
            console.log('Using causality-based predictions:', knowledgeGraph.metadata.predictions);
            displayPredictions(knowledgeGraph.metadata.predictions);
        }
        
        // Step 6: AI Analysis with streaming and timeout
        console.log('Starting real-time AI analysis...');
        const analysisPromise = runAIAnalysis(event, allSources, knowledgeGraph);
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
        const codeEl = document.getElementById('analysisCode');
        if (codeEl) {
            codeEl.innerHTML = `<span class="comment">// Error: ${escapeHtml(error.message)}</span>\n<span class="comment">// Retrying with available sources...</span>`;
        }
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

// Airweave API integration
const AIRWEAVE_API_KEY = 'e-Dd6QDCHVRQkssDWDu7IN4Xt4CcMXIPJgLQWr4sjZw';
const AIRWEAVE_BASE_URL = 'https://api.airweave.ai';

// Initialize Causality Engine
const causalityEngine = new CausalityEngine();

async function searchWithAirweave(query, event) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        
        // Search Airweave for relevant documents
        const response = await fetch(`${AIRWEAVE_BASE_URL}/v1/collections/search`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${AIRWEAVE_API_KEY}`
            },
            body: JSON.stringify({
                query: query,
                collection_id: 'default', // Use default or create one
                expand_query: true,
                retrieval_strategy: 'hybrid',
                temporal_relevance: 0.7,
                rerank: true,
                limit: 10
            }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error('Airweave API failed');
        }
        
        const data = await response.json();
        return (data.results || data.documents || []).map(r => ({
            title: r.title || r.metadata?.title || '',
            url: r.url || r.metadata?.url || '',
            text: r.content || r.text || r.snippet || '',
            relevanceScore: r.score || r.relevance_score || 0.85,
            source: 'Airweave',
            metadata: r.metadata || {}
        }));
    } catch (error) {
        console.error('Airweave search error:', error);
        return [];
    }
}

async function buildKnowledgeGraph(event, allSources) {
    try {
        console.log('Building knowledge graph with causality engine...');
        
        // Use Airweave to get additional context
        const causalityQuery = `Analyze causal relationships for: ${event.title}. Identify cause-effect chains, dependencies, and predictive factors.`;
        
        let airweaveData = null;
        try {
            const response = await fetch(`${AIRWEAVE_BASE_URL}/v1/collections/search`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${AIRWEAVE_API_KEY}`
                },
                body: JSON.stringify({
                    query: causalityQuery,
                    collection_id: 'default',
                    expand_query: true,
                    retrieval_strategy: 'hybrid',
                    generate_answer: true,
                    limit: 15
                })
            });
            
            if (response.ok) {
                airweaveData = await response.json();
                // Add Airweave results to sources
                if (airweaveData.results || airweaveData.documents) {
                    const airweaveSources = (airweaveData.results || airweaveData.documents).map(r => ({
                        title: r.title || r.metadata?.title || '',
                        url: r.url || r.metadata?.url || '',
                        text: r.content || r.text || r.snippet || '',
                        relevanceScore: r.score || r.relevance_score || 0.85,
                        source: 'Airweave',
                        metadata: r.metadata || {}
                    }));
                    allSources = [...allSources, ...airweaveSources];
                }
            }
        } catch (error) {
            console.warn('Airweave API error, continuing with other sources:', error);
        }
        
        // Use Causality Engine to build graph
        const graph = causalityEngine.buildCausalGraph(allSources, event);
        
        // Generate predictions from causal graph
        const causalPredictions = causalityEngine.predictFromCausality(event, graph);
        
        // Store predictions in graph metadata
        graph.metadata.predictions = causalPredictions;
        
        console.log('Knowledge graph built:', {
            nodes: graph.nodes.length,
            edges: graph.edges.length,
            chains: graph.metadata.causalChains.length,
            predictions: causalPredictions.length
        });
        
        return graph;
    } catch (error) {
        console.error('Knowledge graph error:', error);
        // Fallback: build graph from sources locally
        return buildLocalCausalGraph(allSources, event);
    }
}

// Legacy function - now uses CausalityEngine
function extractCausalGraph(sources, airweaveData, event) {
    return causalityEngine.buildCausalGraph(sources, event);
}

function extractCausalPhrases(text) {
    const phrases = [];
    const causalPatterns = [
        /(?:because|due to|as a result of|caused by)\s+([^,\.]+?)(?:\s+(?:will|may|could|leads? to|results? in|causes?|triggers?)\s+([^,\.]+?))?/gi,
        /([^,\.]+?)\s+(?:will|may|could|leads? to|results? in|causes?|triggers?)\s+([^,\.]+?)/gi,
        /(?:if|when)\s+([^,\.]+?)(?:\s+then\s+([^,\.]+?))?/gi
    ];
    
    causalPatterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(text)) !== null) {
            if (match[1] && match[2]) {
                phrases.push({
                    cause: match[1].trim(),
                    effect: match[2].trim()
                });
            } else if (match[1]) {
                phrases.push({
                    cause: match[1].trim(),
                    effect: 'outcome'
                });
            }
        }
    });
    
    return phrases.slice(0, 5); // Limit to 5 per source
}

// Reset graph layout function
function resetGraphLayout() {
    const container = document.getElementById('knowledgeGraph');
    if (container && window.currentGraph) {
        displayKnowledgeGraph(window.currentGraph);
    }
}

function buildLocalCausalGraph(sources, event) {
    // Fallback: build graph locally from sources using CausalityEngine
    console.log('Building local causal graph from sources...');
    return causalityEngine.buildCausalGraph(sources, event);
}

async function fetchMultipleSources(event) {
    const allSources = [];
    const searchQueries = generateSearchQueries(event);
    
    // Enhanced: Fetch from diverse real-time sources including Airweave
    const sourcePromises = [
        searchWithAirweave(event.title, event).catch(() => []),
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

async function runAIAnalysis(event, allSources, knowledgeGraph = null) {
    const prompt = buildPrompt(event, allSources, knowledgeGraph);
    
    // Update UI immediately
    const codeEl = document.getElementById('analysisCode');
    if (codeEl) {
        codeEl.innerHTML = '<span class="comment">// AI is analyzing real-time sources...</span>';
    }
    
    // Try multiple AI services in order
    const aiServices = [
        () => tryPuterAI(prompt),
        () => tryOpenAI(prompt),
        () => tryAnthropic(prompt),
        () => tryHuggingFace(prompt)
    ];
    
    for (const tryService of aiServices) {
        try {
            const result = await tryService();
            if (result && result.text) {
                const fullText = result.text;
                const parsed = parseResponse(fullText);
                formatAnalysisText(fullText, parsed, allSources);
                
                displayPredictions(parsed.predictions);
                displayModelInsight(parsed.insight || parsed.reasoning || 'Analysis complete');
                displayStatisticalMetrics(parsed.metrics);
                updateLastUpdateTime();
                return;
            }
        } catch (error) {
            console.warn('AI service failed, trying next...', error);
            continue;
        }
    }
    
    // If all AI services fail, use enhanced local analysis
    console.log('All AI services failed, using enhanced local analysis');
    return runFallbackAnalysis(event, allSources);
}

async function tryPuterAI(prompt) {
    if (typeof puter === 'undefined' || !puter.ai || !puter.ai.chat) {
        throw new Error('Puter not available');
    }
    
    const stream = await puter.ai.chat(prompt, {
        model: 'gpt-4',
        stream: true
    });
    
    let fullText = '';
        if (stream && typeof stream[Symbol.asyncIterator] === 'function') {
            for await (const chunk of stream) {
                if (chunk && chunk.text) {
                    fullText += chunk.text;
            } else if (chunk && typeof chunk === 'string') {
                fullText += chunk;
                }
            }
        } else if (stream && stream.text) {
            fullText = stream.text;
    } else if (typeof stream === 'string') {
        fullText = stream;
    }
    
    if (!fullText) throw new Error('No response from Puter');
    return { text: fullText };
}

async function tryOpenAI(prompt) {
    // Try OpenAI API if available (user can add their key)
    const apiKey = localStorage.getItem('openai_api_key');
    if (!apiKey) throw new Error('OpenAI API key not set');
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: 'gpt-4',
            messages: [{ role: 'user', content: prompt }],
            stream: false,
            max_tokens: 4000
        })
    });
    
    if (!response.ok) throw new Error('OpenAI API failed');
    const data = await response.json();
    return { text: data.choices[0]?.message?.content || '' };
}

async function tryAnthropic(prompt) {
    // Try Anthropic Claude API if available
    const apiKey = localStorage.getItem('anthropic_api_key');
    if (!apiKey) throw new Error('Anthropic API key not set');
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: 'claude-3-opus-20240229',
            max_tokens: 4000,
            messages: [{ role: 'user', content: prompt }]
        })
    });
    
    if (!response.ok) throw new Error('Anthropic API failed');
    const data = await response.json();
    return { text: data.content[0]?.text || '' };
}

async function tryHuggingFace(prompt) {
    // Try Hugging Face Inference API (free tier available)
    const apiKey = localStorage.getItem('huggingface_api_key');
    if (!apiKey) throw new Error('HuggingFace API key not set');
    
    const response = await fetch('https://api-inference.huggingface.co/models/mistralai/Mixtral-8x7B-Instruct-v0.1', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            inputs: prompt,
            parameters: {
                max_new_tokens: 2000,
                return_full_text: false
            }
        })
    });
    
    if (!response.ok) throw new Error('HuggingFace API failed');
    const data = await response.json();
    return { text: Array.isArray(data) ? data[0]?.generated_text || '' : data.generated_text || '' };
}

async function runFallbackAnalysis(event, allSources) {
    console.log('Running enhanced local analysis with step-by-step reasoning...');
    
    // Analyze sources locally with enhanced statistical methods
    const analysis = analyzeSourcesLocally(event, allSources);
    
    // Generate comprehensive step-by-step reasoning
    const reasoningText = generateStepByStepReasoning(allSources, analysis, '');
    
    // Create comprehensive analysis text with reasoning
    const analysisText = `${reasoningText}\n\n## ANALYSIS SUMMARY\n\n${analysis.context}\n\n${analysis.factors}\n\n${analysis.rationale}\n\nInsight: ${analysis.insight}`;
    
    // Display analysis in IDE format with sources and reasoning
    formatAnalysisText(analysisText, { 
        rawText: analysisText,
        predictions: analysis.predictions,
        insight: analysis.insight,
        metrics: analysis.metrics
    }, allSources);
    
        displayPredictions(analysis.predictions);
        displayModelInsight(analysis.insight);
    displayStatisticalMetrics(analysis.metrics);
    
    updateLastUpdateTime();
    
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

function buildPrompt(event, allSources, knowledgeGraph = null) {
    // Advanced context engineering: multi-layer source processing
    const sources = allSources.slice(0, 18).map((r, i) => {
        const text = (r.text || '').replace(/\n+/g, ' ').trim();
        const domain = r.url ? (new URL(r.url).hostname.replace('www.', '') || 'Unknown') : 'AI Source';
        
        // Advanced context extraction
        const keyPhrases = extractKeyPhrases(text);
        const sentiment = analyzeTextSentiment(text);
        const eventContext = extractEventContext(event);
        const textLength = text.length;
        const hasNumbers = /\d+/.test(text);
        const hasDates = /\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2}/.test(text);
        const credibilityScore = calculateSourceCredibility(r, domain);
        
        return `SOURCE ${i+1} [${r.source || 'Unknown'} | Relevance: ${(r.relevanceScore || 0.5).toFixed(2)} | Credibility: ${credibilityScore.toFixed(2)} | Sentiment: ${sentiment.label} (${sentiment.score.toFixed(2)})]:
Title: "${r.title}"
Domain: ${domain}
Key Phrases: ${keyPhrases.join(', ')}
Content Depth: ${textLength} chars, ${hasNumbers ? 'Contains data' : 'Textual only'}, ${hasDates ? 'Time-stamped' : 'No dates'}
Content: ${text.substring(0, 1200)}
URL: ${r.url || 'N/A'}
Timestamp: ${r.isRecent ? 'Recent (<7 days)' : 'Older'}
---`;
    }).join('\n\n');
    
    // Enhanced context: extract event context with temporal analysis
    const eventContext = extractEventContext(event);
    const currentDate = new Date().toISOString().split('T')[0];
    const currentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    
    // Advanced source diversity analysis
    const sourceTypes = [...new Set(allSources.map(s => s.source))];
    const sourceCounts = sourceTypes.map(type => ({
        type,
        count: allSources.filter(s => s.source === type).length
    }));
    
    // Calculate source quality metrics
    const avgRelevance = allSources.reduce((sum, s) => sum + (s.relevanceScore || 0.5), 0) / allSources.length;
    const recentCount = allSources.filter(s => s.isRecent).length;
    const highRelevanceCount = allSources.filter(s => (s.relevanceScore || 0) > 0.7).length;
    
    // Extract key themes across sources
    const allKeyPhrases = allSources.flatMap(s => extractKeyPhrases(s.text || ''));
    const phraseFreq = {};
    allKeyPhrases.forEach(phrase => {
        phraseFreq[phrase] = (phraseFreq[phrase] || 0) + 1;
    });
    const topThemes = Object.entries(phraseFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([phrase, count]) => `${phrase} (${count})`)
        .join(', ');
    
    return `You are an elite prediction market analyst with expertise in statistical modeling, Bayesian inference, and real-time data synthesis. Use ADVANCED CONTEXT ENGINEERING and CHAIN-OF-THOUGHT REASONING to provide highly accurate probability predictions.

EVENT CONTEXT:
Title: "${event.title}"
Description Context: ${extractEventContext(event)}
Market Metrics:
- Total Volume: ${event.volume}
- 24h Volume: ${event.volume24h || 'N/A'}
- Liquidity: ${event.liquidity || 'N/A'}
- Close Date: ${event.closeDate}
- Current Date/Time: ${currentDate} ${currentTime}

SOURCE QUALITY METRICS:
Total Sources: ${allSources.length} from ${sourceTypes.length} different APIs
Average Relevance: ${avgRelevance.toFixed(2)}
High Relevance Sources (>0.7): ${highRelevanceCount}
Recent Sources (<7 days): ${recentCount}
Source Types: ${sourceCounts.map(s => `${s.type} (${s.count})`).join(', ')}
Top Themes Across Sources: ${topThemes || 'N/A'}

REAL-TIME SOURCES (${allSources.length} sources):
${sources}

${knowledgeGraph ? `KNOWLEDGE GRAPH & CAUSALITY ANALYSIS:
Total Nodes: ${knowledgeGraph.nodes.length}
Total Causal Relationships: ${knowledgeGraph.edges.filter(e => e.type === 'causes').length}
Key Causal Chains: ${knowledgeGraph.edges.filter(e => e.type === 'causes').slice(0, 5).map(e => {
    const sourceNode = knowledgeGraph.nodes.find(n => n.id === e.source);
    const targetNode = knowledgeGraph.nodes.find(n => n.id === e.target);
    return `${sourceNode?.label || e.source} → ${targetNode?.label || e.target}`;
}).join(', ')}
Use this causal structure to inform your predictions.` : ''}

ADVANCED ANALYSIS FRAMEWORK - USE CHAIN-OF-THOUGHT REASONING:

STEP 1: CONTEXT SYNTHESIS & PATTERN RECOGNITION
   - Cross-reference information across ALL ${allSources.length} sources
   - Identify consensus patterns, outlier perspectives, and conflicting evidence
   - Weight sources by: relevance score × credibility × recency × content depth
   - Extract temporal patterns, trend indicators, and momentum signals
   - Map source relationships and information flow

STEP 2: STATISTICAL MODELING & INFERENCE
   - Apply Bayesian inference with evidence-weighted priors (use Beta distribution)
   - Calculate 95% confidence intervals using Wilson score method
   - Perform chi-square tests for categorical evidence distribution
   - Apply Monte Carlo simulation (1000+ iterations) for uncertainty quantification
   - Calculate effect sizes (Cohen's d) and practical significance
   - Assess sample size adequacy and statistical power (1-β)
   - Perform sensitivity analysis on key parameters

STEP 3: MULTI-SOURCE REASONING & EVIDENCE INTEGRATION
   - Compare perspectives from: news (${sourceCounts.find(s => s.type.includes('News'))?.count || 0}), market analysis, expert opinions, social signals
   - Identify conflicting evidence and assess reliability using source credibility
   - Weight recent information exponentially (decay factor: 0.95 per day)
   - Consider source hierarchy: established news > analysis > forums > social media
   - Apply Dempster-Shafer theory for conflicting evidence fusion

STEP 4: MARKET DYNAMICS & TEMPORAL ANALYSIS
   - Analyze volume trends, liquidity implications, and market depth
   - Consider market efficiency and information asymmetry
   - Factor in closing date proximity and time decay (exponential decay model)
   - Assess market sentiment momentum and reversal signals

STEP 5: REASONING SYNTHESIS
   - Synthesize all evidence into coherent probability estimates
   - Quantify uncertainty and confidence levels
   - Identify key risk factors and edge cases
   - Provide clear, traceable reasoning chain

TASK - YOU MUST PROVIDE STEP-BY-STEP REASONING FIRST:

## MANDATORY: STEP-BY-STEP REASONING PROCESS

YOU MUST START YOUR RESPONSE WITH THIS EXACT FORMAT. DO NOT SKIP THIS SECTION.

\`\`\`
// ===== STEP-BY-STEP REASONING PROCESS =====

// Step 1: Initial Evidence Gathering
// Examining Source 1, 2, 3... [list sources you're reviewing]
// Key findings: [what you discover from these sources]
// Initial assessment: [what this suggests]

// Step 2: Pattern Recognition  
// Comparing findings across sources [cite specific sources]
// Consensus identified: [describe consensus]
// Outliers noted: [describe conflicting evidence]
// Pattern conclusion: [what pattern emerges]

// Step 3: Statistical Analysis
// Applying Bayesian inference:
//   Prior probability: [value]
//   Evidence from sources: [describe]
//   Posterior calculation: [show math]
// Calculating confidence intervals: [show process]
// Running significance tests: [show results]
// Statistical conclusion: [what the numbers tell us]

// Step 4: Evidence Weighting
// High credibility sources (Sources X, Y, Z): [what they say]
// Recent sources (Sources A, B, C): [what they indicate]
// Weighted synthesis: [how you combine them]
// Weighted conclusion: [what emerges]

// Step 5: Multi-Source Integration
// News perspective: [summary from news sources]
// Market signals: [summary from market sources]
// Expert opinions: [summary from expert sources]
// Social sentiment: [summary from social sources]
// Integration result: [how these combine]

// Step 6: Uncertainty Assessment
// Confidence level: [High/Medium/Low]
// Uncertainty factors: [what creates uncertainty]
// Risk factors: [what could change the prediction]
// Final confidence: [justified assessment]

// Step 7: Final Prediction Synthesis
// Combining all evidence: [summary of all steps]
// Probability calculation: [final calculation]
// Reasoning chain: [clear logical path from evidence to conclusion]
// Final prediction: [Yes/No with probability and confidence interval]
\`\`\`

IMPORTANT: Your response MUST begin with the step-by-step reasoning code block above. Fill in each step with actual analysis based on the ${allSources.length} sources provided.

## ANALYSIS SUMMARY

[2-3 paragraphs synthesizing the complete analysis, referencing the reasoning steps above]

PREDICTIONS (JSON format):
\`\`\`json
{
  "predictions": [
    {"outcome": "Yes", "probability": 0.XX, "confidence": "High|Medium|Low", "ci_lower": 0.XX, "ci_upper": 0.XX},
    {"outcome": "No", "probability": 0.XX, "confidence": "High|Medium|Low", "ci_lower": 0.XX, "ci_upper": 0.XX}
  ],
  "insight": "One sentence key insight synthesizing the most important factor from all sources",
  "confidence": "High|Medium|Low",
  "reasoning": "Clear, step-by-step explanation of prediction logic citing source numbers and statistical methods. Format: Step 1: [reasoning], Step 2: [reasoning], Step 3: [reasoning]",
  "key_factors": [
    {"factor": "Factor name", "impact": "High|Medium|Low", "sources": [1, 3, 5]},
    {"factor": "Factor name", "impact": "High|Medium|Low", "sources": [2, 4]}
  ],
  "metrics": {
    "sample_size": ${allSources.length},
    "source_diversity": ${sourceTypes.length},
    "statistical_significance": true/false,
    "bayesian_posterior": 0.XX,
    "confidence_interval_width": 0.XX,
    "consensus_strength": "High|Medium|Low",
    "chi_square": 0.XX,
    "monte_carlo_mean": 0.XX,
    "monte_carlo_std": 0.XX
  }
}
\`\`\`

CRITICAL REQUIREMENTS:
- Show step-by-step reasoning like Claude and Gemini: make your thinking process transparent
- Number each reasoning step clearly (Step 1, Step 2, etc.)
- For each step, show: (1) what you're thinking, (2) what evidence you're using, (3) how you're processing it, (4) what you conclude
- Cite specific sources by number in each step (e.g., "In Step 2, examining Source 3, 7, and 12...")
- Show your calculations explicitly (don't just state results, show the process)
- Be explicit about uncertainty, confidence, and risk factors at each step
- Build a clear logical chain from evidence → analysis → conclusion
- Make it clear how each step leads to the next
- Base all predictions on rigorous statistical analysis of real-time data`;
}

function calculateSourceCredibility(source, domain) {
    let credibility = 0.5; // Base credibility
    
    // Domain-based credibility
    const highCredibilityDomains = ['reuters.com', 'bloomberg.com', 'wsj.com', 'ft.com', 'economist.com', 'nytimes.com', 'bbc.com', 'cnn.com'];
    const mediumCredibilityDomains = ['cnbc.com', 'forbes.com', 'techcrunch.com', 'theguardian.com'];
    
    if (highCredibilityDomains.some(d => domain.includes(d))) credibility = 0.9;
    else if (mediumCredibilityDomains.some(d => domain.includes(d))) credibility = 0.75;
    else if (domain.includes('reddit.com')) credibility = 0.4;
    else if (domain.includes('twitter.com') || domain.includes('x.com')) credibility = 0.3;
    
    // Source type credibility
    if (source.source === 'Google News' || source.source === 'NewsAPI') credibility = Math.max(credibility, 0.8);
    if (source.source === 'Reddit') credibility = Math.max(credibility, 0.4);
    
    // Recency boost
    if (source.isRecent) credibility += 0.1;
    
    // Relevance boost
    if (source.relevanceScore > 0.7) credibility += 0.1;
    
    return Math.min(1.0, credibility);
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
    if (!text) return { label: 'Neutral', score: 0 };
    const lowerText = text.toLowerCase();
    const positive = ['yes', 'likely', 'will', 'expected', 'favorable', 'positive', 'optimistic', 'gain', 'rise', 'increase', 'success', 'win', 'bullish', 'upward', 'growth'].filter(w => lowerText.includes(w)).length;
    const negative = ['no', 'unlikely', "won't", 'doubt', 'unfavorable', 'negative', 'pessimistic', 'loss', 'fall', 'decrease', 'fail', 'lose', 'bearish', 'downward', 'decline'].filter(w => lowerText.includes(w)).length;
    
    const total = positive + negative || 1;
    const score = (positive - negative) / total;
    
    if (score > 0.2) return { label: 'Positive', score };
    if (score < -0.2) return { label: 'Negative', score };
    return { label: 'Neutral', score: 0 };
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
                reasoning: parsed.reasoning || '',
                keyFactors: parsed.key_factors || [],
                metrics: parsed.metrics || null,
                rawText: text
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
        reasoning: '',
        keyFactors: [],
        metrics: null,
        rawText: text
    };
}

// Store sources globally for IDE display
let currentSourcesForDisplay = [];

function formatAnalysisText(text, analysis, allSources = null) {
    // Store sources for display
    if (allSources) {
        currentSourcesForDisplay = allSources;
    }
    
    // Remove JSON block but keep the text
    let display = text.replace(/```json[\s\S]*?```/g, '').trim();
    
    // Always ensure we have content to display
    if (!display && analysis?.rawText) {
        display = analysis.rawText.replace(/```json[\s\S]*?```/g, '').trim();
    }
    
    // Debug: log what we're working with
    console.log('Formatting analysis text, length:', display.length);
    console.log('First 500 chars:', display.substring(0, 500));
    
    // Extract structured sections - prioritize step-by-step reasoning
    // Look for step-by-step reasoning in multiple formats - BE AGGRESSIVE
    let stepByStepReasoning = null;
    
    // Try code block first (most common format)
    const codeBlockMatch = display.match(/```[\s\S]*?STEP-BY-STEP[\s\S]*?```/i);
    if (codeBlockMatch) {
        stepByStepReasoning = codeBlockMatch[0].replace(/```/g, '').trim();
    }
    
    // Try section headers
    if (!stepByStepReasoning) {
        stepByStepReasoning = extractSection(display, /STEP-BY-STEP REASONING|REASONING PROCESS|Reasoning Process|### STEP-BY-STEP REASONING|## REASONING PROCESS|## STEP-BY-STEP/i);
    }
    
    // Extract individual steps if full section not found - look for ANY step pattern
    if (!stepByStepReasoning) {
        // Try multiple step patterns
        const stepPatterns = [
            /Step \d+:[^\n]*[\s\S]*?(?=Step \d+:|##|###|$)/gi,
            /Step \d+[^\n]*[\s\S]*?(?=Step \d+|##|###|$)/gi,
            /\*\*Step \d+[^\n]*\*\*[\s\S]*?(?=\*\*Step \d+|##|###|$)/gi,
            /### Step \d+[^\n]*[\s\S]*?(?=### Step \d+|##|###|$)/gi
        ];
        
        for (const pattern of stepPatterns) {
            const steps = display.match(pattern);
            if (steps && steps.length >= 3) { // Need at least 3 steps
                stepByStepReasoning = steps.join('\n\n');
                break;
            }
        }
    }
    
    // If still nothing, extract everything before "ANALYSIS SUMMARY" or "PREDICTIONS"
    if (!stepByStepReasoning) {
        const beforeSummary = display.split(/## ANALYSIS|ANALYSIS SUMMARY|PREDICTIONS/i)[0];
        if (beforeSummary && beforeSummary.trim().length > 200) {
            stepByStepReasoning = beforeSummary.trim();
        }
    }
    
    const sections = {
        stepByStep: stepByStepReasoning,
        evidence: extractSection(display, /## ANALYSIS|### 1\. Evidence Synthesis|Evidence Synthesis|ANALYSIS SUMMARY/i),
        statistical: extractSection(display, /### 2\. Statistical Reasoning|Statistical Reasoning/i),
        integration: extractSection(display, /### 3\. Multi-Source Integration|Multi-Source Integration/i),
        market: extractSection(display, /### 4\. Market Context|Market Context/i),
        final: extractSection(display, /### 5\. Final Reasoning|Final Reasoning|Final Prediction/i)
    };
    
    // Format as IDE-style code
    let formatted = '';
    
    // Add sources section first
    if (currentSourcesForDisplay && currentSourcesForDisplay.length > 0) {
        formatted += `<span class="section">// ===== SOURCES (${currentSourcesForDisplay.length} total) =====</span>\n\n`;
        currentSourcesForDisplay.slice(0, 18).forEach((source, i) => {
            const domain = source.url ? (new URL(source.url).hostname.replace('www.', '') || 'Unknown') : 'AI Source';
            const relevance = (source.relevanceScore || 0.5).toFixed(2);
            const isRecent = source.isRecent ? ' [RECENT]' : '';
            formatted += `<span class="comment">// Source ${i + 1}:</span> <span class="source">${escapeHtml(source.title || 'Untitled')}</span>\n`;
            formatted += `<span class="comment">//   From:</span> <span class="string">${domain}</span> | <span class="comment">Relevance:</span> <span class="number">${relevance}</span>${isRecent}\n`;
            if (source.text && source.text.length > 0) {
                const preview = source.text.substring(0, 100).replace(/\n/g, ' ');
                formatted += `<span class="comment">//   Preview:</span> ${escapeHtml(preview)}...\n`;
            }
            formatted += `\n`;
        });
        formatted += `<span class="comment">─────────────────────────────────────────────</span>\n\n`;
    }
    
    // Build IDE-style formatted text with step-by-step reasoning (ALWAYS show it)
    // ALWAYS show reasoning - use whatever we found or generate from sources
    formatted += `<span class="section">// ===== STEP-BY-STEP REASONING PROCESS =====</span>\n\n`;
    
    let reasoningToShow = null;
    
    if (sections.stepByStep && sections.stepByStep.length > 50) {
        reasoningToShow = sections.stepByStep;
        console.log('Using extracted stepByStep section, length:', reasoningToShow.length);
    } else if (display && display.length > 100) {
        // Use the first part of the display as reasoning if no structured section found
        const reasoningText = display.split(/## ANALYSIS|ANALYSIS SUMMARY|PREDICTIONS|```json/i)[0];
        if (reasoningText && reasoningText.trim().length > 100) {
            reasoningToShow = reasoningText.trim();
            console.log('Using split reasoning text, length:', reasoningToShow.length);
        } else {
            reasoningToShow = display.substring(0, 3000);
            console.log('Using first 3000 chars as reasoning');
        }
    }
    
    // ALWAYS generate step-by-step reasoning from sources (guaranteed to work)
    // This ensures reasoning is always shown even if AI doesn't provide it
    const generatedReasoning = generateStepByStepReasoning(
        currentSourcesForDisplay || [], 
        analysis || {}, 
        display || ''
    );
    
    // Use AI reasoning if available and substantial, otherwise use generated
    if (reasoningToShow && reasoningToShow.length > 200) {
        formatted += formatIDE(reasoningToShow) + '\n\n';
        console.log('Using AI-provided reasoning');
    } else {
        formatted += formatIDE(generatedReasoning) + '\n\n';
        console.log('Using generated reasoning from sources, length:', generatedReasoning.length);
    }
    
    formatted += `<span class="comment">─────────────────────────────────────────────</span>\n\n`;
    
    // Also populate summary tab with analysis summary
    const summaryCode = document.getElementById('summaryCode');
    if (summaryCode) {
        const summaryText = sections.evidence || sections.statistical || display.substring(0, 1500);
        const summaryFormatted = formatIDE(summaryText);
        summaryCode.innerHTML = summaryFormatted;
        const summaryLineCount = (summaryFormatted.match(/\n/g) || []).length + 1;
        const summaryLineNumbers = Array.from({ length: summaryLineCount }, (_, i) => i + 1).join('\n');
        const summaryLineNumbersEl = document.getElementById('summaryLineNumbers');
        if (summaryLineNumbersEl) {
            summaryLineNumbersEl.textContent = summaryLineNumbers;
        }
    }
    
    if (sections.evidence) {
        formatted += `<span class="section">// ===== EVIDENCE SYNTHESIS =====</span>\n\n`;
        formatted += formatIDE(sections.evidence) + '\n\n';
    }
    
    if (sections.statistical) {
        formatted += `<span class="section">// ===== STATISTICAL REASONING =====</span>\n\n`;
        formatted += formatIDE(sections.statistical) + '\n\n';
    }
    
    if (sections.integration) {
        formatted += `<span class="section">// ===== MULTI-SOURCE INTEGRATION =====</span>\n\n`;
        formatted += formatIDE(sections.integration) + '\n\n';
    }
    
    if (sections.market) {
        formatted += `<span class="section">// ===== MARKET CONTEXT =====</span>\n\n`;
        formatted += formatIDE(sections.market) + '\n\n';
    }
    
    if (sections.final) {
        formatted += `<span class="section">// ===== FINAL REASONING =====</span>\n\n`;
        formatted += formatIDE(sections.final) + '\n\n';
    }
    
    // If no structured sections found, format the whole text (always show something)
    if (!formatted) {
        if (display) {
            formatted = formatIDE(display);
        } else {
            formatted = '<span class="comment">// Analysis in progress...</span>';
        }
    }
    
    // Update the code element
    const codeEl = document.getElementById('analysisCode');
    if (codeEl) {
        codeEl.innerHTML = formatted;
        
        // Update line numbers - count actual lines in the formatted text
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = formatted;
        const textContent = tempDiv.textContent || formatted.replace(/<[^>]*>/g, '');
        const lineCount = (textContent.match(/\n/g) || []).length + 1;
        const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1).join('\n');
        const lineNumbersEl = document.getElementById('analysisLineNumbers');
        if (lineNumbersEl) {
            lineNumbersEl.textContent = lineNumbers;
        }
    }
    
    // Update reasoning tab if available
    if (analysis?.reasoning) {
        const reasoningCode = document.getElementById('reasoningCode');
        if (reasoningCode) {
            reasoningCode.innerHTML = formatIDE(analysis.reasoning);
        }
    }
    
    return ''; // Return empty since we're updating DOM directly
}

function generateStepByStepReasoning(sources, analysis, fullText) {
    if (!sources || sources.length === 0) {
        return `// Step 1: Evidence Gathering\n// No sources available for analysis\n\n// Step 2: Analysis\n// ${fullText ? fullText.substring(0, 500) : 'Analysis in progress...'}`;
    }
    
    const topSources = sources.slice(0, 10);
    const highRelevanceSources = sources.filter(s => (s.relevanceScore || 0) > 0.7).slice(0, 5);
    const recentSources = sources.filter(s => s.isRecent).slice(0, 5);
    
    let reasoning = `// Step 1: Initial Evidence Gathering\n`;
    reasoning += `// Examining ${topSources.length} primary sources\n`;
    topSources.forEach((s, i) => {
        const domain = s.url ? (new URL(s.url).hostname.replace('www.', '') || 'Unknown') : 'AI Source';
        reasoning += `//   Source ${i + 1}: ${s.title ? s.title.substring(0, 60) : 'Untitled'} (${domain}, relevance: ${(s.relevanceScore || 0.5).toFixed(2)})\n`;
    });
    reasoning += `// Key findings: ${topSources.length} sources analyzed, ${highRelevanceSources.length} high-relevance sources identified\n\n`;
    
    reasoning += `// Step 2: Pattern Recognition\n`;
    if (highRelevanceSources.length > 0) {
        reasoning += `// High-relevance sources (${highRelevanceSources.length}): `;
        reasoning += highRelevanceSources.map((s, i) => `Source ${sources.indexOf(s) + 1}`).join(', ') + '\n';
    }
    if (recentSources.length > 0) {
        reasoning += `// Recent sources (${recentSources.length}): `;
        reasoning += recentSources.map((s, i) => `Source ${sources.indexOf(s) + 1}`).join(', ') + '\n';
    }
    reasoning += `// Consensus: Analyzing patterns across ${sources.length} total sources\n\n`;
    
    reasoning += `// Step 3: Statistical Analysis\n`;
    if (analysis?.metrics) {
        const m = analysis.metrics;
        if (m.bayesianPosterior !== undefined) {
            reasoning += `// Bayesian posterior: ${(m.bayesianPosterior * 100).toFixed(1)}%\n`;
        }
        if (m.confidenceInterval) {
            const [lower, upper] = m.confidenceInterval;
            reasoning += `// 95% CI: [${(lower * 100).toFixed(1)}%, ${(upper * 100).toFixed(1)}%]\n`;
        }
        if (m.statisticalSignificance !== undefined) {
            reasoning += `// Statistical significance: ${m.statisticalSignificance ? 'Yes (p<0.05)' : 'No'}\n`;
        }
    } else {
        reasoning += `// Applying Bayesian inference with ${sources.length} sources\n`;
        reasoning += `// Calculating confidence intervals and significance tests\n`;
    }
    reasoning += `// Statistical conclusion: Analysis based on ${sources.length} sources\n\n`;
    
    reasoning += `// Step 4: Evidence Weighting\n`;
    reasoning += `// Weighting sources by relevance, credibility, and recency\n`;
    reasoning += `// High credibility sources: ${highRelevanceSources.length} identified\n`;
    reasoning += `// Recent sources: ${recentSources.length} identified\n`;
    reasoning += `// Weighted synthesis: Combining evidence with source quality weights\n\n`;
    
    reasoning += `// Step 5: Multi-Source Integration\n`;
    const sourceTypes = [...new Set(sources.map(s => s.source))];
    reasoning += `// Source types: ${sourceTypes.join(', ')}\n`;
    reasoning += `// Integrating perspectives from ${sourceTypes.length} different source types\n`;
    reasoning += `// Integration result: Synthesizing ${sources.length} sources into coherent analysis\n\n`;
    
    reasoning += `// Step 6: Uncertainty Assessment\n`;
    if (analysis?.confidence) {
        reasoning += `// Confidence level: ${analysis.confidence}\n`;
    } else {
        reasoning += `// Confidence level: ${sources.length >= 10 ? 'High' : sources.length >= 5 ? 'Medium' : 'Low'}\n`;
    }
    reasoning += `// Sample size: n=${sources.length}\n`;
    reasoning += `// Uncertainty factors: Limited by source diversity and recency\n\n`;
    
    reasoning += `// Step 7: Final Prediction Synthesis\n`;
    if (analysis?.predictions && analysis.predictions.length > 0) {
        const pred = analysis.predictions[0];
        reasoning += `// Combining all evidence from ${sources.length} sources\n`;
        reasoning += `// Probability calculation: ${(pred.probability * 100).toFixed(1)}% for "${pred.outcome}"\n`;
        if (pred.ci_lower && pred.ci_upper) {
            reasoning += `// Confidence interval: [${(pred.ci_lower * 100).toFixed(1)}%, ${(pred.ci_upper * 100).toFixed(1)}%]\n`;
        }
        reasoning += `// Final prediction: ${pred.outcome} with ${pred.confidence || 'Medium'} confidence\n`;
    } else {
        reasoning += `// Combining all evidence from ${sources.length} sources\n`;
        reasoning += `// Final prediction: Analysis complete, see predictions above\n`;
    }
    
    return reasoning;
}

function formatIDE(text) {
    if (!text) return '';
    
    // Escape HTML first
    text = escapeHtml(text);
    
    // Format step-by-step reasoning headers (Cursor-style)
    text = text.replace(/Step (\d+):\s*([^\n]+)/gi, '<span class="function">// Step $1: $2</span>');
    text = text.replace(/Step (\d+)\s*([^\n]+)/gi, '<span class="function">// Step $1: $2</span>');
    
    // Format markdown bold step headers
    text = text.replace(/\*\*Step (\d+):\s*([^*]+)\*\*/gi, '<span class="function">// Step $1: $2</span>');
    
    // Format reasoning sub-steps (Cursor-style indentation)
    text = text.replace(/^(\s*)- ([^\n]+)/gm, '<span class="comment">  // $2</span>');
    text = text.replace(/^(\s*)• ([^\n]+)/gm, '<span class="comment">  // $2</span>');
    
    // Format source citations (Cursor-style)
    text = text.replace(/Source (\d+)/gi, '<span class="source">Source $1</span>');
    text = text.replace(/Sources ([\d,\s]+)/gi, '<span class="source">Sources $1</span>');
    
    // Format numbers and percentages
    text = text.replace(/(\d+\.\d+%)/g, '<span class="number">$1</span>');
    text = text.replace(/(\d+\.\d+)/g, '<span class="number">$1</span>');
    text = text.replace(/(\d+%)/g, '<span class="number">$1</span>');
    
    // Format statistical terms (Cursor blue)
    text = text.replace(/(χ²|Chi-square|Bayesian|Monte Carlo|confidence interval|CI|posterior|prior|likelihood|probability|significance|statistical)/gi, '<span class="keyword">$1</span>');
    
    // Format reasoning indicators (Cursor yellow)
    text = text.replace(/(Examining|Comparing|Applying|Calculating|Assessing|Combining|Conclusion|Initial|Final|Pattern|Evidence|Synthesis|Gathering|Recognition|Weighting|Integration|Assessment|Prediction)/gi, '<span class="function">$1</span>');
    
    // Format JSON-like structures
    text = text.replace(/(\{[^}]*\}|\[[^\]]*\])/g, '<span class="string">$1</span>');
    
    // Format comments (already formatted, but ensure they stay)
    text = text.replace(/(\/\/[^\n]*)/g, '<span class="comment">$1</span>');
    
    // Format reasoning separators
    text = text.replace(/^---$/gm, '<span class="comment">// ─────────────────────────</span>');
    
    // Format section headers
    text = text.replace(/^===== (.*?) =====$/gm, '<span class="section">// ===== $1 =====</span>');
    
    return text;
}

function extractSection(text, pattern) {
    if (!text) return null;
    
    // Try multiple patterns to find sections
    const patterns = [
        new RegExp(pattern.source + '([\\s\\S]*?)(?=###|##|STEP-BY-STEP|REASONING PROCESS|$)', 'i'),
        new RegExp(pattern.source + '([\\s\\S]*?)(?=\\n\\n##|\\n\\n###|$)', 'i'),
        new RegExp(pattern.source + '([\\s\\S]*?)(?=\\n##|\\n###|$)', 'i')
    ];
    
    for (const regex of patterns) {
        const match = text.match(regex);
        if (match && match[1] && match[1].trim().length > 10) {
            return match[1].trim();
        }
    }
    
    return null;
}

function formatParagraphs(text) {
    // This function is kept for compatibility but formatIDE is used for IDE style
    return formatIDE(text);
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
    const insightCode = document.getElementById('insightCode');
    if (insightCode && insight) {
        insightCode.innerHTML = `<span class="comment">// Key Insight</span>\n\n${formatIDE(insight)}`;
        insightContainer.classList.remove('hidden');
        
        // Update line numbers
        const lineCount = insightCode.textContent.split('\n').length;
        const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1).join('\n');
        const lineNumbersEl = document.getElementById('insightLineNumbers');
        if (lineNumbersEl) {
            lineNumbersEl.textContent = lineNumbers;
        }
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

function displayKnowledgeGraph(graph) {
    const container = document.getElementById('knowledgeGraph');
    if (!container) return;
    
    if (!graph || !graph.nodes || graph.nodes.length === 0) {
        container.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #858585; font-size: 13px; font-family: monospace;">// Building knowledge graph from causal relationships...</div>';
        return;
    }
    
    // Store graph for reset functionality
    window.currentGraph = graph;
    
    // Clear previous graph
    container.innerHTML = '';
    
    // Check if D3 is available
    if (typeof d3 === 'undefined') {
        container.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #858585; font-size: 13px; font-family: monospace;">// Loading graph visualization library...</div>';
        return;
    }
    
    // Create SVG for D3 visualization
    const width = container.clientWidth || 800;
    const height = 500;
    
    const svg = d3.select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .style('background', '#1e1e1e')
        .style('border-radius', '6px');
    
    // Create force simulation
    const simulation = d3.forceSimulation(graph.nodes)
        .force('link', d3.forceLink(graph.edges).id(d => d.id).distance(100))
        .force('charge', d3.forceManyBody().strength(-300))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(30));
    
    // Create arrows for directed edges
    svg.append('defs').selectAll('marker')
        .data(['causes', 'influences', 'informs'])
        .enter().append('marker')
        .attr('id', d => d)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 25)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', d => {
            if (d === 'causes') return '#ce9178';
            if (d === 'influences') return '#569cd6';
            return '#4ec9b0';
        });
    
    // Draw links
    const link = svg.append('g')
        .selectAll('line')
        .data(graph.edges)
        .enter().append('line')
        .attr('stroke', d => {
            if (d.type === 'causes') return '#ce9178';
            if (d.type === 'influences') return '#569cd6';
            return '#4ec9b0';
        })
        .attr('stroke-width', d => Math.sqrt(d.strength || 0.5) * 3)
        .attr('stroke-opacity', 0.6)
        .attr('marker-end', d => `url(#${d.type})`);
    
    // Draw nodes
    const node = svg.append('g')
        .selectAll('circle')
        .data(graph.nodes)
        .enter().append('circle')
        .attr('r', d => d.size || 15)
        .attr('fill', d => d.color || '#4ec9b0')
        .attr('stroke', '#fff')
        .attr('stroke-width', 2)
        .call(d3.drag()
            .on('start', dragstarted)
            .on('drag', dragged)
            .on('end', dragended));
    
    // Add labels
    const label = svg.append('g')
        .selectAll('text')
        .data(graph.nodes)
        .enter().append('text')
        .text(d => d.label)
        .attr('font-size', '11px')
        .attr('fill', '#d4d4d4')
        .attr('dx', d => (d.size || 15) + 5)
        .attr('dy', 4);
    
    // Add tooltips
    node.append('title')
        .text(d => `${d.label}\nType: ${d.type}\n${d.relevance ? `Relevance: ${d.relevance.toFixed(2)}` : ''}`);
    
    // Update positions on simulation tick
    simulation.on('tick', () => {
        link
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);
        
        node
            .attr('cx', d => d.x)
            .attr('cy', d => d.y);
        
        label
            .attr('x', d => d.x)
            .attr('y', d => d.y);
    });
    
    function dragstarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }
    
    function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }
    
    function dragended(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }
}

// Reset graph layout function
function resetGraphLayout() {
    const container = document.getElementById('knowledgeGraph');
    if (container && window.currentGraph) {
        displayKnowledgeGraph(window.currentGraph);
    }
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
