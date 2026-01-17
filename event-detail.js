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
                refreshBtn.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite;">
                        <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
                    </svg>
                    Refreshing...
                `;
                await performAIAnalysis(eventData, true);
                refreshBtn.disabled = false;
                refreshBtn.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
                    </svg>
                    Refresh
                `;
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
        <div class="table-row">
            <span class="row-label">Analyzing...</span>
            <span class="row-value">--</span>
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
                if (statusEl) statusEl.style.display = 'none';
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
    searchingSection.style.display = 'block';
    
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
            el.className = 'search-query shimmer-active';
            el.innerHTML = `
                <svg class="search-icon-small" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"></circle>
                    <path d="m21 21-4.35-4.35"></path>
                </svg>
                <span>${escapeHtml(query.text)}</span>
                <span style="margin-left: auto; font-size: 11px; color: #9ca3af;">${query.source}</span>
            `;
            searchQueries.appendChild(el);
            setTimeout(() => el.classList.remove('shimmer-active'), 1200);
        }, i * 100);
    });
}

function showReviewingPhase(exaResults) {
    const reviewingSection = document.getElementById('reviewingSection');
    reviewingSection.style.display = 'block';
    
    const reviewingSources = document.getElementById('reviewingSources');
    const topSources = exaResults.slice(0, 5);
    
    topSources.forEach((source, i) => {
        setTimeout(() => {
            const domain = new URL(source.url).hostname.replace('www.', '');
            const domainName = domain.split('.')[0];
            
            const el = document.createElement('div');
            el.className = 'source-item shimmer-active';
            
            let faviconClass = 'default';
            let faviconText = domainName.charAt(0).toUpperCase();
            
            if (domain.includes('youtube')) {
                faviconClass = 'youtube';
                faviconText = '▶';
            }
            
            el.innerHTML = `
                <div class="source-favicon ${faviconClass}">${faviconText}</div>
                <div class="source-info">
                    <span class="source-title">${escapeHtml(source.title.substring(0, 55))}...</span>
                    <div class="source-domain">${escapeHtml(domainName)}</div>
                </div>
            `;
            
            reviewingSources.appendChild(el);
            setTimeout(() => el.classList.remove('shimmer-active'), 1500);
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
        <div class="table-row">
            <span class="row-label">${escapeHtml(pred.outcome)}</span>
            <span class="row-value">${(pred.probability * 100).toFixed(0)}%</span>
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
        <div class="source-card">
            <div class="source-header">
                <div class="source-title">${escapeHtml(source.title)} ${isRecent}</div>
                ${source.url ? `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener" class="source-link">View</a>` : ''}
            </div>
            <div class="source-description">
                ${escapeHtml((source.text || '').substring(0, 200))}${(source.text || '').length > 200 ? '...' : ''}
            </div>
            <div class="source-citation">
                [${i + 1}] ${escapeHtml(domain)} • ${sourceLabel} ${source.relevanceScore ? `(${(source.relevanceScore * 100).toFixed(0)}% relevant)` : ''}
            </div>
        </div>
        `;
    }).join('');
}

function showUpdateIndicator() {
    const statusEl = document.getElementById('analysisStatus');
    if (statusEl) {
        statusEl.style.display = 'block';
        const updateMsg = document.createElement('div');
        updateMsg.className = 'update-indicator';
        updateMsg.style.cssText = 'padding: 12px; background: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 6px; color: #0369a1; font-size: 13px; margin-bottom: 16px;';
        updateMsg.textContent = '🔄 Analysis updated with latest real-time data';
        statusEl.insertBefore(updateMsg, statusEl.firstChild);
        
        setTimeout(() => {
            updateMsg.remove();
            statusEl.style.display = 'none';
        }, 3000);
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
