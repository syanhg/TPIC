/**
 * Advanced Causality Inference Engine with Neo4j-style Knowledge Graph
 * Uses advanced NLP to extract entities, relationships, and patterns
 */

class CausalityEngine {
    constructor() {
        this.graph = null;
        this.entityIndex = new Map(); // For entity deduplication
        this.relationshipTypes = [
            'CAUSES', 'INFLUENCES', 'AFFECTS', 'PRECEDES', 'CORRELATES_WITH',
            'HAS', 'CONTAINS', 'RELATES_TO', 'DEPENDS_ON', 'TRIGGERS',
            'PREVENTS', 'ENABLES', 'IMPLIES', 'PREDICTS', 'ASSOCIATED_WITH',
            'INFORMS', 'SUPPORTS', 'CONTRADICTS', 'REINFORCES', 'MODERATES'
        ];
    }

    /**
     * Build rich Neo4j-style knowledge graph from sources
     */
    buildCausalGraph(sources, event) {
        const nodes = new Map();
        const edges = [];
        this.entityIndex.clear();
        
        // Central event node
        const eventId = event.id || 'event';
        nodes.set(eventId, {
            id: eventId,
            label: event.title,
            type: 'Event',
            size: 30,
            color: '#4ec9b0',
            properties: {
                volume: event.volume || 0,
                liquidity: event.liquidity || 0,
                closeDate: event.closeDate,
                title: event.title
            }
        });

        // Process each source with advanced NLP
        sources.forEach((source, idx) => {
            const sourceId = `source_${idx}`;
            nodes.set(sourceId, {
                id: sourceId,
                label: source.title?.substring(0, 50) || `Source ${idx + 1}`,
                type: 'Source',
                size: 15,
                color: '#569cd6',
                properties: {
                    url: source.url,
                    relevance: source.relevanceScore || 0.5,
                    text: source.text || '',
                    sourceType: source.source || 'Unknown'
                }
            });

            // Connect source to event
            edges.push({
                source: sourceId,
                target: eventId,
                relationship: 'INFORMS',
                strength: source.relevanceScore || 0.5,
                weight: this.calculateEdgeWeight(source, 'INFORMS'),
                properties: {
                    relevance: source.relevanceScore || 0.5
                }
            });

            // Advanced NLP extraction
            const extractedData = this.extractEntitiesAndRelationships(source.text || '', source, idx);
            
            // Add entities
            extractedData.entities.forEach(entity => {
                const entityId = this.getOrCreateEntity(entity, nodes, idx);
                if (entityId) {
                    // Connect entity to source
                    edges.push({
                        source: sourceId,
                        target: entityId,
                        relationship: 'CONTAINS',
                        strength: entity.confidence || 0.6,
                        weight: entity.confidence || 0.6,
                        properties: {
                            extractionMethod: entity.method || 'NLP'
                        }
                    });
                }
            });

            // Add relationships
            extractedData.relationships.forEach(rel => {
                const sourceEntityId = this.getOrCreateEntity(rel.source, nodes, idx);
                const targetEntityId = this.getOrCreateEntity(rel.target, nodes, idx);
                
                if (sourceEntityId && targetEntityId) {
                    edges.push({
                        source: sourceEntityId,
                        target: targetEntityId,
                        relationship: rel.type,
                        strength: rel.confidence,
                        weight: rel.confidence,
                        properties: {
                            temporal: rel.temporal,
                            context: rel.context,
                            extractionMethod: 'NLP',
                            sourceIdx: idx
                        }
                    });
                }
            });

            // Connect key entities to event
            extractedData.entities
                .filter(e => e.importance > 0.7)
                .forEach(entity => {
                    const entityId = this.getEntityId(entity);
                    if (entityId && nodes.has(entityId)) {
                        edges.push({
                            source: entityId,
                            target: eventId,
                            relationship: 'INFLUENCES',
                            strength: entity.importance,
                            weight: entity.importance,
                            properties: {
                                importance: entity.importance
                            }
                        });
                    }
                });
        });

        // Pattern recognition and graph enrichment
        this.enrichGraph(nodes, edges, eventId);

        const nodesArray = Array.from(nodes.values());
        
        this.graph = {
            nodes: nodesArray,
            edges: edges,
            metadata: {
                totalSources: sources.length,
                totalRelations: edges.length,
                entityCount: nodesArray.filter(n => n.type !== 'Source' && n.type !== 'Event').length,
                relationshipTypes: [...new Set(edges.map(e => e.relationship))],
                causalChains: this.findCausalChains(nodesArray, edges, eventId)
            }
        };

        return this.graph;
    }

    /**
     * Advanced NLP: Extract entities and relationships from text
     */
    extractEntitiesAndRelationships(text, source, sourceIdx) {
        if (!text || text.length < 20) {
            return { entities: [], relationships: [] };
        }

        const entities = [];
        const relationships = [];
        const sentences = this.splitIntoSentences(text);

        sentences.forEach((sentence, sIdx) => {
            // Extract named entities (people, organizations, locations, concepts)
            const namedEntities = this.extractNamedEntities(sentence);
            entities.push(...namedEntities);

            // Extract relationships with multiple types
            const rels = this.extractRelationships(sentence, sourceIdx, sIdx);
            relationships.push(...rels);

            // Extract temporal relationships
            const temporalRels = this.extractTemporalRelationships(sentence, sourceIdx);
            relationships.push(...temporalRels);

            // Extract quantitative relationships
            const quantRels = this.extractQuantitativeRelationships(sentence, sourceIdx);
            relationships.push(...quantRels);
        });

        // Deduplicate and merge entities
        const mergedEntities = this.mergeEntities(entities);
        
        return {
            entities: mergedEntities,
            relationships: this.deduplicateRelationships(relationships)
        };
    }

    /**
     * Split text into sentences
     */
    splitIntoSentences(text) {
        return text
            .replace(/([.!?])\s+/g, '$1|SPLIT|')
            .split('|SPLIT|')
            .map(s => s.trim())
            .filter(s => s.length > 10);
    }

    /**
     * Extract named entities using pattern matching
     */
    extractNamedEntities(sentence) {
        const entities = [];
        const text = sentence;

        // Person names (capitalized words, titles)
        const personPatterns = [
            /\b(?:President|CEO|Dr\.|Mr\.|Ms\.|Mrs\.|Senator|Governor|Mayor)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g,
            /\b([A-Z][a-z]+\s+[A-Z][a-z]+)\s+(?:said|announced|stated|reported)/g,
            /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\s+(?:will|may|could|should)/g
        ];

        personPatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                entities.push({
                    text: match[1] || match[0],
                    type: 'Person',
                    confidence: 0.8,
                    importance: 0.7,
                    method: 'pattern'
                });
            }
        });

        // Organizations
        const orgPatterns = [
            /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:Inc\.|Corp\.|LLC|Ltd\.|Company)/g,
            /\b([A-Z][A-Z]+)\s+(?:announced|reported|said)/g,
            /\b(?:the|The)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:government|administration|committee|board)/g
        ];

        orgPatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                entities.push({
                    text: match[1] || match[0],
                    type: 'Organization',
                    confidence: 0.75,
                    importance: 0.6,
                    method: 'pattern'
                });
            }
        });

        // Concepts and topics (noun phrases)
        const conceptPatterns = [
            /\b(?:the|a|an)\s+([a-z]+(?:\s+[a-z]+){0,3})\s+(?:of|in|for|that|which)/g,
            /\b([A-Z][a-z]+(?:\s+[a-z]+){1,3})\s+(?:policy|strategy|plan|program|initiative)/g,
            /\b(?:increased|decreased|rising|falling)\s+([a-z]+(?:\s+[a-z]+){0,2})/g
        ];

        conceptPatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                const concept = match[1];
                if (concept.length > 3 && !this.isStopWord(concept)) {
                    entities.push({
                        text: concept,
                        type: 'Concept',
                        confidence: 0.6,
                        importance: 0.5,
                        method: 'pattern'
                    });
                }
            }
        });

        // Numbers and statistics
        const numberPattern = /\b(\d+(?:\.\d+)?)\s*(?:percent|%|billion|million|thousand|points?)/gi;
        let match;
        while ((match = numberPattern.exec(text)) !== null) {
            entities.push({
                text: match[0],
                type: 'Statistic',
                confidence: 0.9,
                importance: 0.4,
                method: 'pattern',
                value: parseFloat(match[1])
            });
        }

        return entities;
    }

    /**
     * Extract relationships with multiple types
     */
    extractRelationships(sentence, sourceIdx, sIdx) {
        const relationships = [];
        const text = sentence.toLowerCase();

        // CAUSES relationships
        const causePatterns = [
            {
                regex: /([^,\.;]+?)\s+(?:causes?|leads?\s+to|results?\s+in|triggers?|brings?\s+about)\s+([^,\.;]+?)/gi,
                type: 'CAUSES',
                confidence: 0.85
            },
            {
                regex: /(?:because|due\s+to|as\s+a\s+result\s+of|caused\s+by)\s+([^,\.;]+?)(?:\s+(?:will|may|could|leads?\s+to)\s+([^,\.;]+?))?/gi,
                type: 'CAUSES',
                confidence: 0.8
            }
        ];

        causePatterns.forEach(({ regex, type, confidence }) => {
            let match;
            while ((match = regex.exec(sentence)) !== null) {
                const source = this.cleanEntity(match[1]);
                const target = match[2] ? this.cleanEntity(match[2]) : this.inferEffect(source, sentence);
                
                if (source && target && source.length > 3 && target.length > 3) {
                    relationships.push({
                        source: { text: source, type: 'Concept' },
                        target: { text: target, type: 'Concept' },
                        type: type,
                        confidence: confidence,
                        temporal: this.extractTemporalInfo(match[0], sentence),
                        context: sentence.substring(0, 100)
                    });
                }
            }
        });

        // INFLUENCES relationships
        const influencePatterns = [
            {
                regex: /([^,\.;]+?)\s+(?:influences?|affects?|impacts?|shapes?)\s+([^,\.;]+?)/gi,
                type: 'INFLUENCES',
                confidence: 0.75
            },
            {
                regex: /([^,\.;]+?)\s+(?:plays?\s+a\s+role\s+in|contributes?\s+to|affects?)\s+([^,\.;]+?)/gi,
                type: 'INFLUENCES',
                confidence: 0.7
            }
        ];

        influencePatterns.forEach(({ regex, type, confidence }) => {
            let match;
            while ((match = regex.exec(sentence)) !== null) {
                relationships.push({
                    source: { text: this.cleanEntity(match[1]), type: 'Concept' },
                    target: { text: this.cleanEntity(match[2]), type: 'Concept' },
                    type: type,
                    confidence: confidence,
                    temporal: this.extractTemporalInfo(match[0], sentence),
                    context: sentence.substring(0, 100)
                });
            }
        });

        // PRECEDES relationships (temporal)
        const precedesPattern = /([^,\.;]+?)\s+(?:before|prior\s+to|precedes?|earlier\s+than)\s+([^,\.;]+?)/gi;
        let match;
        while ((match = precedesPattern.exec(sentence)) !== null) {
            relationships.push({
                source: { text: this.cleanEntity(match[1]), type: 'Event' },
                target: { text: this.cleanEntity(match[2]), type: 'Event' },
                type: 'PRECEDES',
                confidence: 0.8,
                temporal: 'past',
                context: sentence.substring(0, 100)
            });
        }

        // CORRELATES_WITH relationships
        const correlatePattern = /([^,\.;]+?)\s+(?:correlates?\s+with|is\s+associated\s+with|linked\s+to|related\s+to)\s+([^,\.;]+?)/gi;
        match = null;
        while ((match = correlatePattern.exec(sentence)) !== null) {
            relationships.push({
                source: { text: this.cleanEntity(match[1]), type: 'Concept' },
                target: { text: this.cleanEntity(match[2]), type: 'Concept' },
                type: 'CORRELATES_WITH',
                confidence: 0.6,
                temporal: 'unknown',
                context: sentence.substring(0, 100)
            });
        }

        // DEPENDS_ON relationships
        const dependsPattern = /([^,\.;]+?)\s+(?:depends?\s+on|relies?\s+on|requires?)\s+([^,\.;]+?)/gi;
        match = null;
        while ((match = dependsPattern.exec(sentence)) !== null) {
            relationships.push({
                source: { text: this.cleanEntity(match[1]), type: 'Concept' },
                target: { text: this.cleanEntity(match[2]), type: 'Concept' },
                type: 'DEPENDS_ON',
                confidence: 0.75,
                temporal: 'unknown',
                context: sentence.substring(0, 100)
            });
        }

        // PREVENTS relationships
        const preventsPattern = /([^,\.;]+?)\s+(?:prevents?|blocks?|stops?|hinders?|reduces?)\s+([^,\.;]+?)/gi;
        match = null;
        while ((match = preventsPattern.exec(sentence)) !== null) {
            relationships.push({
                source: { text: this.cleanEntity(match[1]), type: 'Concept' },
                target: { text: this.cleanEntity(match[2]), type: 'Concept' },
                type: 'PREVENTS',
                confidence: 0.7,
                temporal: this.extractTemporalInfo(match[0], sentence),
                context: sentence.substring(0, 100)
            });
        }

        // PREDICTS relationships
        const predictsPattern = /([^,\.;]+?)\s+(?:predicts?|forecasts?|suggests?|indicates?)\s+([^,\.;]+?)/gi;
        match = null;
        while ((match = predictsPattern.exec(sentence)) !== null) {
            relationships.push({
                source: { text: this.cleanEntity(match[1]), type: 'Concept' },
                target: { text: this.cleanEntity(match[2]), type: 'Outcome' },
                type: 'PREDICTS',
                confidence: 0.7,
                temporal: 'future',
                context: sentence.substring(0, 100)
            });
        }

        return relationships;
    }

    /**
     * Extract temporal relationships
     */
    extractTemporalRelationships(sentence, sourceIdx) {
        const relationships = [];
        const text = sentence.toLowerCase();

        // Temporal sequence patterns
        const temporalPatterns = [
            {
                regex: /(?:after|following|subsequent\s+to)\s+([^,\.;]+?)(?:\s+comes?\s+([^,\.;]+?))?/gi,
                type: 'PRECEDES',
                confidence: 0.8
            },
            {
                regex: /([^,\.;]+?)\s+(?:then|next|afterwards?)\s+([^,\.;]+?)/gi,
                type: 'PRECEDES',
                confidence: 0.75
            }
        ];

        temporalPatterns.forEach(({ regex, type, confidence }) => {
            let match;
            while ((match = regex.exec(sentence)) !== null) {
                relationships.push({
                    source: { text: this.cleanEntity(match[1]), type: 'Event' },
                    target: { text: this.cleanEntity(match[2] || 'subsequent event'), type: 'Event' },
                    type: type,
                    confidence: confidence,
                    temporal: 'temporal',
                    context: sentence.substring(0, 100)
                });
            }
        });

        return relationships;
    }

    /**
     * Extract quantitative relationships
     */
    extractQuantitativeRelationships(sentence, sourceIdx) {
        const relationships = [];
        
        // Percentage changes
        const percentPattern = /([^,\.;]+?)\s+(?:increased?|decreased?|rose|fell|grew|dropped)\s+(?:by\s+)?(\d+(?:\.\d+)?)\s*%/gi;
        let match;
        while ((match = percentPattern.exec(sentence)) !== null) {
            const entity = this.cleanEntity(match[1]);
            const change = parseFloat(match[2]);
            
            relationships.push({
                source: { text: entity, type: 'Concept' },
                target: { text: `${change > 0 ? 'increase' : 'decrease'} of ${Math.abs(change)}%`, type: 'Statistic' },
                type: 'AFFECTS',
                confidence: 0.9,
                temporal: 'past',
                context: sentence.substring(0, 100),
                properties: { change: change }
            });
        }

        return relationships;
    }

    /**
     * Get or create entity node
     */
    getOrCreateEntity(entity, nodes, sourceIdx) {
        if (!entity || !entity.text) return null;

        const normalized = this.normalizeEntity(entity.text);
        const entityId = this.getEntityId(entity);

        if (!nodes.has(entityId)) {
            nodes.set(entityId, {
                id: entityId,
                label: entity.text.substring(0, 50),
                type: entity.type || 'Concept',
                size: 10 + ((entity.importance || 0.5) * 15),
                color: this.getColorForType(entity.type || 'Concept'),
                properties: {
                    confidence: entity.confidence || 0.6,
                    importance: entity.importance || 0.5,
                    normalized: normalized,
                    value: entity.value
                }
            });
            this.entityIndex.set(normalized, entityId);
        } else {
            // Update existing entity with higher confidence if applicable
            const existing = nodes.get(entityId);
            if (entity.confidence > existing.properties.confidence) {
                existing.properties.confidence = entity.confidence;
            }
            if (entity.importance > existing.properties.importance) {
                existing.properties.importance = entity.importance;
            }
        }

        return entityId;
    }

    /**
     * Get entity ID from entity object
     */
    getEntityId(entity) {
        if (typeof entity === 'string') {
            return `entity_${this.normalizeEntity(entity)}`;
        }
        const normalized = this.normalizeEntity(entity.text);
        return `entity_${normalized}`;
    }

    /**
     * Normalize entity text for deduplication
     */
    normalizeEntity(text) {
        return text.toLowerCase()
            .replace(/[^\w\s]/g, '')
            .replace(/\s+/g, '_')
            .substring(0, 50);
    }

    /**
     * Merge duplicate entities
     */
    mergeEntities(entities) {
        const merged = new Map();
        
        entities.forEach(entity => {
            const key = this.normalizeEntity(entity.text);
            if (!merged.has(key)) {
                merged.set(key, entity);
            } else {
                const existing = merged.get(key);
                existing.confidence = Math.max(existing.confidence, entity.confidence);
                existing.importance = Math.max(existing.importance, entity.importance);
            }
        });

        return Array.from(merged.values());
    }

    /**
     * Deduplicate relationships
     */
    deduplicateRelationships(relationships) {
        const seen = new Set();
        return relationships.filter(rel => {
            const sourceId = this.getEntityId(rel.source);
            const targetId = this.getEntityId(rel.target);
            const key = `${sourceId}|${rel.type}|${targetId}`;
            
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    /**
     * Enrich graph with pattern recognition
     */
    enrichGraph(nodes, edges, eventId) {
        // Find transitive relationships (A -> B -> C implies A -> C)
        const transitiveEdges = this.findTransitiveRelationships(nodes, edges);
        transitiveEdges.forEach(edge => {
            if (!this.edgeExists(edges, edge.source, edge.target, edge.relationship)) {
                edges.push(edge);
            }
        });

        // Find common patterns (triangles, chains)
        this.identifyPatterns(nodes, edges);
    }

    /**
     * Find transitive relationships
     */
    findTransitiveRelationships(nodes, edges) {
        const transitive = [];
        const nodeIds = Array.from(nodes.keys());

        nodeIds.forEach(sourceId => {
            nodeIds.forEach(intermediateId => {
                if (sourceId === intermediateId) return;
                
                nodeIds.forEach(targetId => {
                    if (intermediateId === targetId || sourceId === targetId) return;

                    // Check for A -> B -> C
                    const edge1 = edges.find(e => 
                        e.source === sourceId && e.target === intermediateId && 
                        (e.relationship === 'CAUSES' || e.relationship === 'INFLUENCES')
                    );
                    const edge2 = edges.find(e => 
                        e.source === intermediateId && e.target === targetId && 
                        (e.relationship === 'CAUSES' || e.relationship === 'INFLUENCES')
                    );

                    if (edge1 && edge2) {
                        transitive.push({
                            source: sourceId,
                            target: targetId,
                            relationship: 'INFLUENCES',
                            strength: (edge1.strength + edge2.strength) / 2 * 0.8, // Weakened
                            weight: (edge1.weight + edge2.weight) / 2 * 0.8,
                            properties: {
                                transitive: true,
                                path: [sourceId, intermediateId, targetId]
                            }
                        });
                    }
                });
            });
        });

        return transitive;
    }

    /**
     * Check if edge exists
     */
    edgeExists(edges, source, target, relationship) {
        return edges.some(e => 
            e.source === source && 
            e.target === target && 
            e.relationship === relationship
        );
    }

    /**
     * Identify patterns in the graph
     */
    identifyPatterns(nodes, edges) {
        // This could identify common causal patterns, feedback loops, etc.
        // For now, we'll use this for future pattern recognition
    }

    /**
     * Clean and normalize entity text
     */
    cleanEntity(text) {
        if (!text) return '';
        return text.trim()
            .replace(/^(the|a|an)\s+/i, '')
            .replace(/\s+/g, ' ')
            .substring(0, 100);
    }

    /**
     * Infer effect from context if not explicitly stated
     */
    inferEffect(cause, text) {
        const afterCause = text.substring(text.indexOf(cause) + cause.length);
        const outcomePatterns = [
            /(?:will|may|could|leads? to|results? in)\s+([^,\.;]+?)/i,
            /(?:outcome|result|consequence|impact)\s+([^,\.;]+?)/i
        ];

        for (const pattern of outcomePatterns) {
            const match = afterCause.match(pattern);
            if (match && match[1]) {
                return this.cleanEntity(match[1]);
            }
        }

        return 'outcome';
    }

    /**
     * Extract temporal information
     */
    extractTemporalInfo(match, text) {
        const temporalWords = {
            past: ['was', 'were', 'had', 'occurred', 'happened', 'previous'],
            present: ['is', 'are', 'current', 'now', 'ongoing'],
            future: ['will', 'may', 'could', 'might', 'expected', 'forecast', 'predicted']
        };

        const lowerText = (match + ' ' + text.substring(0, 200)).toLowerCase();
        
        for (const [tense, words] of Object.entries(temporalWords)) {
            if (words.some(word => lowerText.includes(word))) {
                return tense;
            }
        }

        return 'unknown';
    }

    /**
     * Check if word is a stop word
     */
    isStopWord(word) {
        const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
        return stopWords.includes(word.toLowerCase());
    }

    /**
     * Get color for entity type
     */
    getColorForType(type) {
        const colors = {
            'Person': '#ce9178',
            'Organization': '#569cd6',
            'Concept': '#b5cea8',
            'Event': '#4ec9b0',
            'Statistic': '#dcdcaa',
            'Outcome': '#c586c0'
        };
        return colors[type] || '#858585';
    }

    /**
     * Calculate edge weight
     */
    calculateEdgeWeight(source, type) {
        let weight = source.relevanceScore || 0.5;
        if (source.isRecent) weight *= 1.2;
        if (source.source === 'Airweave' || source.source === 'Exa AI') weight *= 1.15;
        return Math.min(1, weight);
    }

    /**
     * Find causal chains leading to the event
     */
    findCausalChains(nodes, edges, eventId) {
        if (!nodes || !Array.isArray(nodes)) {
            console.warn('findCausalChains: nodes is not an array', typeof nodes);
            return [];
        }
        
        const chains = [];
        const causeNodes = nodes.filter(n => n && (n.type === 'Concept' || n.type === 'Factor'));
        
        if (causeNodes.length === 0) {
            console.log('No factor nodes found for causal chain analysis');
            return [];
        }
        
        causeNodes.forEach(cause => {
            try {
                const path = this.findPathToEvent(cause.id, eventId, edges, []);
                if (path.length > 1) {
                    chains.push({
                        start: cause.id,
                        end: eventId,
                        path: path,
                        length: path.length,
                        strength: this.calculatePathStrength(path, edges)
                    });
                }
            } catch (error) {
                console.warn('Error finding path for cause:', cause.id, error);
            }
        });

        return chains.sort((a, b) => b.strength - a.strength).slice(0, 10);
    }

    /**
     * Find path from node to event using DFS
     */
    findPathToEvent(nodeId, eventId, edges, visited) {
        if (!nodeId || !eventId) return [];
        if (nodeId === eventId) return [nodeId];
        if (visited.includes(nodeId)) return [];

        visited.push(nodeId);
        if (!edges || !Array.isArray(edges)) return [];
        
        const outgoing = edges.filter(e => e && e.source === nodeId && 
            (e.relationship === 'CAUSES' || e.relationship === 'INFLUENCES' || 
             e.relationship === 'AFFECTS' || e.relationship === 'PREDICTS'));

        for (const edge of outgoing) {
            if (!edge || !edge.target) continue;
            const path = this.findPathToEvent(edge.target, eventId, edges, [...visited]);
            if (path.length > 0) {
                return [nodeId, ...path];
            }
        }

        return [];
    }

    /**
     * Calculate strength of a causal path
     */
    calculatePathStrength(path, edges) {
        if (!path || path.length < 2 || !edges || !Array.isArray(edges)) return 0;

        let strength = 1;
        for (let i = 0; i < path.length - 1; i++) {
            const edge = edges.find(e => e && e.source === path[i] && e.target === path[i + 1]);
            if (edge) {
                strength *= edge.strength || 0.5;
            } else {
                strength *= 0.3;
            }
        }

        strength *= Math.pow(0.9, path.length - 2);
        return strength;
    }

    /**
     * Predict future outcomes using causal inference
     */
    predictFromCausality(event, graph) {
        if (!graph || !graph.nodes || !Array.isArray(graph.nodes) || graph.nodes.length === 0) {
            console.log('Insufficient graph data for prediction, using fallback');
            return this.generateFallbackPrediction(event);
        }

        this.graph = graph;
        const predictions = [];
        const chains = graph.metadata?.causalChains || [];
        
        if (chains.length === 0) {
            console.log('No causal chains found, using fallback prediction');
            return this.generateFallbackPrediction(event);
        }
        
        chains.forEach(chain => {
            try {
                const chainStrength = chain.strength || 0.5;
                const pathNodes = (chain.path || []).map(id => 
                    graph.nodes.find(n => n && n.id === id)
                ).filter(Boolean);

                if (pathNodes.length === 0) return;

                const positiveSignals = pathNodes.filter(n => 
                    this.isPositiveSignal(n, graph)
                ).length;
                const negativeSignals = pathNodes.filter(n => 
                    this.isNegativeSignal(n, graph)
                ).length;

                const baseProb = 0.5;
                const signalDiff = (positiveSignals - negativeSignals) / Math.max(pathNodes.length, 1);
                const probability = Math.max(0.1, Math.min(0.9, baseProb + (signalDiff * chainStrength)));

                predictions.push({
                    outcome: this.inferOutcome(pathNodes, graph),
                    probability,
                    confidence: chainStrength,
                    causalChain: chain,
                    reasoning: this.generateReasoning(chain, pathNodes, graph)
                });
            } catch (error) {
                console.warn('Error processing causal chain:', error);
            }
        });

        if (predictions.length > 0) {
            return this.aggregatePredictions(predictions);
        }

        return this.generateFallbackPrediction(event);
    }

    /**
     * Check if node represents positive signal
     */
    isPositiveSignal(node, graph) {
        if (!node || !node.label) return false;
        const text = (node.label || '').toLowerCase();
        const positiveWords = ['increase', 'rise', 'growth', 'success', 'positive', 'gain', 'improve', 'boost'];
        return positiveWords.some(word => text.includes(word));
    }

    /**
     * Check if node represents negative signal
     */
    isNegativeSignal(node, graph) {
        if (!node || !node.label) return false;
        const text = (node.label || '').toLowerCase();
        const negativeWords = ['decrease', 'fall', 'decline', 'failure', 'negative', 'loss', 'worsen', 'drop'];
        return negativeWords.some(word => text.includes(word));
    }

    /**
     * Infer outcome from causal chain
     */
    inferOutcome(pathNodes, graph) {
        if (!pathNodes || pathNodes.length === 0) return 'Yes';
        
        const lastNode = pathNodes[pathNodes.length - 1];
        if (lastNode && lastNode.type === 'Outcome' && lastNode.label) {
            return lastNode.label;
        }

        if (graph && graph.edges && Array.isArray(graph.edges) && graph.nodes && Array.isArray(graph.nodes)) {
            const outcomeEdges = graph.edges.filter(e => 
                e && e.source && e.target &&
                pathNodes.some(n => n && n.id === e.source) && 
                graph.nodes.find(n => n && n.id === e.target)?.type === 'Outcome'
            );

            if (outcomeEdges.length > 0) {
                const outcomeNode = graph.nodes.find(n => 
                    n && n.id === outcomeEdges[0].target
                );
                return outcomeNode?.label || 'Yes';
            }
        }

        return 'Yes';
    }

    /**
     * Generate reasoning for prediction
     */
    generateReasoning(chain, pathNodes, graph) {
        if (!pathNodes || pathNodes.length === 0) {
            return 'No causal path identified';
        }
        
        const steps = pathNodes.map((node, idx) => {
            if (!node || !node.label) return '';
            if (idx === 0) {
                return `Factor: ${node.label}`;
            } else if (idx === pathNodes.length - 1) {
                return `→ Outcome: ${node.label}`;
            } else {
                return `→ ${node.label}`;
            }
        }).filter(s => s.length > 0).join(' ');

        const strength = chain && chain.strength ? (chain.strength * 100).toFixed(1) : '50.0';
        return `Causal chain: ${steps}. Strength: ${strength}%`;
    }

    /**
     * Aggregate multiple predictions
     */
    aggregatePredictions(predictions) {
        if (!predictions || !Array.isArray(predictions) || predictions.length === 0) {
            return this.generateFallbackPrediction({});
        }
        
        const grouped = {};
        predictions.forEach(pred => {
            if (!pred || !pred.outcome) return;
            const key = pred.outcome;
            if (!grouped[key]) {
                grouped[key] = [];
            }
            grouped[key].push(pred);
        });

        if (Object.keys(grouped).length === 0) {
            return this.generateFallbackPrediction({});
        }

        const aggregated = Object.entries(grouped).map(([outcome, preds]) => {
            if (!preds || preds.length === 0) return null;
            
            const totalWeight = preds.reduce((sum, p) => sum + (p.confidence || 0.5), 0);
            if (totalWeight === 0) return null;
            
            const weightedProb = preds.reduce((sum, p) => 
                sum + ((p.probability || 0.5) * (p.confidence || 0.5)), 0
            ) / totalWeight;

            const avgConfidence = preds.reduce((sum, p) => sum + (p.confidence || 0.5), 0) / preds.length;
            const reasoning = preds.map(p => p.reasoning || '').filter(r => r).join('; ');

            return {
                outcome,
                probability: Math.max(0.1, Math.min(0.9, weightedProb)),
                confidence: avgConfidence > 0.7 ? 'High' : avgConfidence > 0.5 ? 'Medium' : 'Low',
                reasoning: reasoning || 'Based on causal analysis',
                causalChains: preds.length
            };
        }).filter(p => p !== null);

        if (aggregated.length === 0) {
            return this.generateFallbackPrediction({});
        }

        return aggregated
            .sort((a, b) => (b.probability || 0) - (a.probability || 0))
            .slice(0, 2)
            .map(pred => ({
                outcome: pred.outcome,
                probability: pred.probability,
                confidence: pred.confidence,
                ci_lower: Math.max(0, pred.probability - 0.15),
                ci_upper: Math.min(1, pred.probability + 0.15),
                reasoning: pred.reasoning
            }));
    }

    /**
     * Generate fallback prediction
     */
    generateFallbackPrediction(event) {
        return [
            {
                outcome: 'Yes',
                probability: 0.5,
                confidence: 'Low',
                ci_lower: 0.35,
                ci_upper: 0.65,
                reasoning: 'Insufficient causal data for prediction'
            }
        ];
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CausalityEngine;
}
