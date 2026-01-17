<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Event Analysis - AndoRead</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    colors: {
                        border: "hsl(214.3 31.8% 91.4%)",
                        input: "hsl(214.3 31.8% 91.4%)",
                        ring: "hsl(222.2 84% 4.9%)",
                        background: "hsl(0 0% 100%)",
                        foreground: "hsl(222.2 84% 4.9%)",
                        primary: {
                            DEFAULT: "hsl(222.2 47.4% 11.2%)",
                            foreground: "hsl(210 40% 98%)",
                        },
                        secondary: {
                            DEFAULT: "hsl(210 40% 96.1%)",
                            foreground: "hsl(222.2 47.4% 11.2%)",
                        },
                        muted: {
                            DEFAULT: "hsl(210 40% 96.1%)",
                            foreground: "hsl(215.4 16.3% 46.9%)",
                        },
                        accent: {
                            DEFAULT: "hsl(210 40% 96.1%)",
                            foreground: "hsl(222.2 47.4% 11.2%)",
                        },
                        card: {
                            DEFAULT: "hsl(0 0% 100%)",
                            foreground: "hsl(222.2 84% 4.9%)",
                        },
                    },
                },
            },
        }
    </script>
    <script src="https://js.puter.com/v2/"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        body {
            background: #ffffff;
            color: #1a1a1a;
        }
        code {
            font-family: 'SF Mono', 'Monaco', 'Cascadia Code', 'Roboto Mono', monospace;
            font-size: 0.875rem;
        }
    </style>
</head>
<body>
    <!-- Header - AndoRead Style (aligned with index) -->
    <header class="sticky top-0 z-50 w-full bg-white border-b border-gray-200/50">
        <div class="container mx-auto px-6 lg:px-8">
            <div class="flex h-16 items-center justify-between">
                <!-- Logo - Aligned with content -->
                <a href="index.html" class="text-2xl font-medium text-gray-900 tracking-tight" style="font-family: 'Inter', sans-serif; font-weight: 500;">
                    AndoRead
                </a>
                
                <!-- Search Bar - Top Right -->
                <div class="relative w-full max-w-sm">
                    <svg class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input type="text" id="searchInput" placeholder="Search Markets" 
                        class="h-10 w-full rounded-lg border border-gray-200 bg-gray-50/50 pl-10 pr-4 text-sm text-gray-600 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300 transition-all" 
                        style="font-family: 'Inter', sans-serif;" />
                </div>
            </div>
        </div>
    </header>

    <!-- Main Content - Aligned with header -->
    <div class="container mx-auto px-6 lg:px-8 py-8 max-w-7xl">
        <!-- Back Navigation -->
        <div class="mb-6">
            <a href="index.html" class="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors">
                <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                Back
            </a>
        </div>

        <!-- Event Header - Minimal -->
        <div class="mb-8">
            <div class="flex items-start justify-between gap-4 mb-3">
                <h1 id="eventTitle" class="text-2xl font-semibold text-gray-900 leading-tight" style="font-family: 'Inter', sans-serif;">Loading...</h1>
                <button id="refreshBtn" class="inline-flex h-8 items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                    <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh
                </button>
            </div>
            <div class="flex items-center gap-4 text-xs text-gray-500">
                <span id="closeDate">Closes: Loading...</span>
                <span>•</span>
                <span id="lastUpdate"></span>
            </div>
        </div>

        <!-- Stats Bar - Minimal -->
        <div class="mb-8 flex items-center gap-6 pb-6 border-b border-gray-200">
            <div>
                <div class="text-xs text-gray-500 mb-0.5">Volume</div>
                <div class="text-sm font-semibold text-gray-900" id="volumeStat">$0</div>
            </div>
            <div>
                <div class="text-xs text-gray-500 mb-0.5">24h Vol</div>
                <div class="text-sm font-semibold text-gray-900" id="volume24hStat">$0</div>
            </div>
            <div>
                <div class="text-xs text-gray-500 mb-0.5">Liquidity</div>
                <div class="text-sm font-semibold text-gray-900" id="liquidityStat">$0</div>
            </div>
            <div class="ml-auto flex items-center gap-3">
                <div id="predictionRows" class="flex items-center gap-2"></div>
            </div>
        </div>

        <!-- Analysis Status - Minimal Perplexity Style -->
        <div id="analysisStatus" class="mb-8 space-y-4">
            <div class="space-y-2">
                <div class="flex items-center gap-2">
                    <div class="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                    <span class="text-sm font-medium text-gray-900">Thinking</span>
                </div>
                <div id="thinkingContent" class="pl-5 text-sm text-gray-600"></div>
            </div>
            
            <div class="searching-section hidden space-y-2" id="searchingSection">
                <div class="text-sm font-medium text-gray-700">Searching</div>
                <div id="searchQueries" class="space-y-1.5 pl-5"></div>
            </div>
            
            <div class="reviewing-section hidden space-y-2" id="reviewingSection">
                <div class="text-sm font-medium text-blue-600">Reviewing <span id="reviewingLabel">sources</span></div>
                <div id="reviewingSources" class="space-y-1.5 pl-5"></div>
            </div>
        </div>

        <!-- Analysis Content - Cursor Style -->
        <div class="mb-8">
            <div id="analysisContent" class="prose prose-sm max-w-none text-sm text-gray-700 leading-relaxed" style="font-family: 'Inter', sans-serif;">
                <p class="text-gray-500">Analyzing event with statistical models...</p>
            </div>
            
            
            <!-- Statistical Metrics - Minimal -->
            <div id="statisticalMetrics" class="mt-6 hidden space-y-3 rounded-md border border-gray-200 bg-gray-50/50 p-4">
                <div class="text-xs font-medium text-gray-500 mb-2">Statistical Analysis</div>
                <div id="metricsContent" class="space-y-2 text-xs text-gray-600"></div>
            </div>
            
            <!-- Key Insight - Minimal -->
            <div id="insightContainer" class="mt-6 hidden rounded-md border-l border-blue-500/30 bg-blue-50/30 pl-4 py-3">
                <div class="text-xs font-medium text-gray-500 mb-1">Key Insight</div>
                <p id="modelInsightText" class="text-sm text-gray-700 leading-relaxed"></p>
            </div>
        </div>


        <!-- Sources - Minimal Grid -->
        <div class="rounded-lg border border-gray-200 bg-white">
            <div class="flex items-center justify-between border-b border-gray-200 px-4 py-3">
                <h3 class="text-sm font-medium text-gray-900">Sources</h3>
                <span class="text-xs text-gray-500" id="totalSources">0</span>
            </div>
            <div id="sourcesList" class="p-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3"></div>
        </div>
    </div>

    <script src="event-detail.js"></script>
</body>
</html>
