/**
 * Causality Inference Engine
 * Predicts future outcomes using knowledge graph causal relationships
 */

class CausalityEngine {
    constructor() {
        this.graph = null;
        this.causalPaths = [];
        this.predictions = [];
    }

    /**
     * Build causal knowledge graph from sources
     */
    buildCausalGraph(sources, event) {
        const nodes = new Map();
        const edges = [];
        
        // Central event node
        const eventId = event.id || 'event';
        nodes.set(eventId, {
            id: eventId,
            label: event.title,
            type: 'event',
            size: 30,
            color: '#4ec9b0',
            properties: {
                volume: event.volume || 0,
                liquidity: event.liquidity || 0,
                closeDate: event.closeDate
            }
        });

        // Extract entities and causal relationships
        sources.forEach((source, idx) => {
            const sourceId = `source_${idx}`;
            nodes.set(sourceId, {
                id: sourceId,
                label: source.title?.substring(0, 40) || `Source ${idx + 1}`,
                type: 'source',
                size: 15,
                color: '#569cd6',
                properties: {
                    url: source.url,
                    relevance: source.relevanceScore || 0.5,
                    text: source.text || ''
                }
            });

            // Connect source to event
            edges.push({
                source: sourceId,
                target: eventId,
                type: 'informs',
                strength: source.relevanceScore || 0.5,
                weight: this.calculateEdgeWeight(source, 'informs')
            });

            // Extract causal relationships using advanced NLP
            const causalRelations = this.extractCausalRelations(source.text || '', source);
            causalRelations.forEach((relation, rIdx) => {
                const { cause, effect, confidence, temporal } = relation;
                
                const causeId = `cause_${idx}_${rIdx}`;
                const effectId = `effect_${idx}_${rIdx}`;

                // Add cause node
                if (!nodes.has(causeId)) {
                    nodes.set(causeId, {
                        id: causeId,
                        label: cause.substring(0, 40),
                        type: 'factor',
                        size: 12 + (confidence * 8),
                        color: '#ce9178',
                        properties: {
                            confidence,
                            temporal,
                            sourceIdx: idx
                        }
                    });
                }

                // Add effect node
                if (!nodes.has(effectId)) {
                    nodes.set(effectId, {
                        id: effectId,
                        label: effect.substring(0, 40),
                        type: 'outcome',
                        size: 12 + (confidence * 8),
                        color: '#b5cea8',
                        properties: {
                            confidence,
                            temporal,
                            sourceIdx: idx
                        }
                    });
                }

                // Causal edge
                edges.push({
                    source: causeId,
                    target: effectId,
                    type: 'causes',
                    strength: confidence,
                    weight: confidence,
                    temporal,
                    label: 'causes'
                });

                // Connect cause to event
                edges.push({
                    source: causeId,
                    target: eventId,
                    type: 'influences',
                    strength: confidence * 0.8,
                    weight: confidence * 0.8,
                    label: 'influences'
                });
            });
        });

        this.graph = {
            nodes: Array.from(nodes.values()),
            edges: edges,
            metadata: {
                totalSources: sources.length,
                totalRelations: edges.length,
                causalChains: this.findCausalChains(nodes, edges, eventId)
            }
        };

        return this.graph;
    }

    /**
     * Advanced causal relationship extraction using pattern matching and NLP
     */
    extractCausalRelations(text, source) {
        const relations = [];
        if (!text || text.length < 20) return relations;

        // Enhanced causal patterns
        const patterns = [
            // Direct causation
            {
                regex: /(?:because|due to|as a result of|caused by|stemming from)\s+([^,\.;]+?)(?:\s+(?:will|may|could|leads? to|results? in|causes?|triggers?|brings? about)\s+([^,\.;]+?))?/gi,
                type: 'direct',
                confidence: 0.8
            },
            // Conditional causation
            {
                regex: /(?:if|when|once)\s+([^,\.;]+?)(?:\s+then\s+([^,\.;]+?))?/gi,
                type: 'conditional',
                confidence: 0.7
            },
            // Temporal causation
            {
                regex: /([^,\.;]+?)\s+(?:will|may|could|leads? to|results? in|causes?|triggers?|brings? about)\s+([^,\.;]+?)/gi,
                type: 'temporal',
                confidence: 0.75
            },
            // Correlation-based (weaker)
            {
                regex: /([^,\.;]+?)\s+(?:is associated with|correlates with|linked to)\s+([^,\.;]+?)/gi,
                type: 'correlation',
                confidence: 0.5
            },
            // Negative causation
            {
                regex: /([^,\.;]+?)\s+(?:prevents?|blocks?|stops?|hinders?|reduces?)\s+([^,\.;]+?)/gi,
                type: 'negative',
                confidence: 0.7
            }
        ];

        patterns.forEach(pattern => {
            let match;
            while ((match = pattern.regex.exec(text)) !== null) {
                const cause = this.cleanEntity(match[1]);
                const effect = match[2] ? this.cleanEntity(match[2]) : this.inferEffect(cause, text);

                if (cause && effect && cause.length > 3 && effect.length > 3) {
                    // Check for temporal indicators
                    const temporal = this.extractTemporalInfo(match[0], text);
                    
                    relations.push({
                        cause,
                        effect,
                        confidence: pattern.confidence * (source.relevanceScore || 0.5),
                        type: pattern.type,
                        temporal,
                        source: source.title || 'Unknown'
                    });
                }
            }
        });

        // Remove duplicates and sort by confidence
        return this.deduplicateRelations(relations)
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, 10); // Limit to top 10 per source
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
        // Look for outcomes mentioned after the cause
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
     * Extract temporal information (past, present, future)
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
     * Remove duplicate causal relations
     */
    deduplicateRelations(relations) {
        const seen = new Set();
        return relations.filter(rel => {
            const key = `${rel.cause.toLowerCase()}|${rel.effect.toLowerCase()}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    /**
     * Calculate edge weight based on multiple factors
     */
    calculateEdgeWeight(source, type) {
        let weight = source.relevanceScore || 0.5;
        
        // Boost for recent sources
        if (source.isRecent) weight *= 1.2;
        
        // Boost for high-quality sources
        if (source.source === 'Airweave' || source.source === 'Exa AI') weight *= 1.15;
        
        // Adjust by type
        if (type === 'causes') weight *= 1.1;
        if (type === 'influences') weight *= 0.9;
        
        return Math.min(1, weight);
    }

    /**
     * Find causal chains leading to the event
     */
    findCausalChains(nodes, edges, eventId) {
        const chains = [];
        const causeNodes = nodes.filter(n => n.type === 'factor');
        
        causeNodes.forEach(cause => {
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
        });

        return chains.sort((a, b) => b.strength - a.strength).slice(0, 10);
    }

    /**
     * Find path from node to event using DFS
     */
    findPathToEvent(nodeId, eventId, edges, visited) {
        if (nodeId === eventId) return [nodeId];
        if (visited.includes(nodeId)) return [];

        visited.push(nodeId);
        const outgoing = edges.filter(e => e.source === nodeId);

        for (const edge of outgoing) {
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
        if (path.length < 2) return 0;

        let strength = 1;
        for (let i = 0; i < path.length - 1; i++) {
            const edge = edges.find(e => e.source === path[i] && e.target === path[i + 1]);
            if (edge) {
                strength *= edge.strength || 0.5;
            } else {
                strength *= 0.3; // Penalty for missing edge
            }
        }

        // Apply path length penalty (longer paths are weaker)
        strength *= Math.pow(0.9, path.length - 2);

        return strength;
    }

    /**
     * Predict future outcomes using causal inference
     */
    predictFromCausality(event, graph) {
        if (!graph || !graph.nodes || graph.nodes.length === 0) {
            return this.generateFallbackPrediction(event);
        }

        this.graph = graph;
        const predictions = [];

        // Get all causal chains
        const chains = graph.metadata?.causalChains || [];
        
        // Analyze each chain for predictive power
        chains.forEach(chain => {
            const chainStrength = chain.strength;
            const pathNodes = chain.path.map(id => 
                graph.nodes.find(n => n.id === id)
            ).filter(Boolean);

            // Extract predictive signals
            const positiveSignals = pathNodes.filter(n => 
                this.isPositiveSignal(n, graph)
            ).length;
            const negativeSignals = pathNodes.filter(n => 
                this.isNegativeSignal(n, graph)
            ).length;

            // Calculate probability based on causal chain
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
        });

        // Aggregate predictions
        if (predictions.length > 0) {
            return this.aggregatePredictions(predictions);
        }

        return this.generateFallbackPrediction(event);
    }

    /**
     * Check if node represents positive signal
     */
    isPositiveSignal(node, graph) {
        const text = (node.label || '').toLowerCase();
        const positiveWords = ['increase', 'rise', 'growth', 'success', 'positive', 'gain', 'improve', 'boost'];
        return positiveWords.some(word => text.includes(word));
    }

    /**
     * Check if node represents negative signal
     */
    isNegativeSignal(node, graph) {
        const text = (node.label || '').toLowerCase();
        const negativeWords = ['decrease', 'fall', 'decline', 'failure', 'negative', 'loss', 'worsen', 'drop'];
        return negativeWords.some(word => text.includes(word));
    }

    /**
     * Infer outcome from causal chain
     */
    inferOutcome(pathNodes, graph) {
        const lastNode = pathNodes[pathNodes.length - 1];
        if (lastNode && lastNode.type === 'outcome') {
            return lastNode.label;
        }

        // Look for outcome nodes connected to the chain
        const outcomeEdges = graph.edges.filter(e => 
            pathNodes.some(n => n.id === e.source) && 
            graph.nodes.find(n => n.id === e.target)?.type === 'outcome'
        );

        if (outcomeEdges.length > 0) {
            const outcomeNode = graph.nodes.find(n => 
                n.id === outcomeEdges[0].target
            );
            return outcomeNode?.label || 'Yes';
        }

        return 'Yes'; // Default
    }

    /**
     * Generate reasoning for prediction
     */
    generateReasoning(chain, pathNodes, graph) {
        const steps = pathNodes.map((node, idx) => {
            if (idx === 0) {
                return `Factor: ${node.label}`;
            } else if (idx === pathNodes.length - 1) {
                return `→ Outcome: ${node.label}`;
            } else {
                return `→ ${node.label}`;
            }
        }).join(' ');

        return `Causal chain: ${steps}. Strength: ${(chain.strength * 100).toFixed(1)}%`;
    }

    /**
     * Aggregate multiple predictions into final predictions
     */
    aggregatePredictions(predictions) {
        // Group by outcome
        const grouped = {};
        predictions.forEach(pred => {
            const key = pred.outcome;
            if (!grouped[key]) {
                grouped[key] = [];
            }
            grouped[key].push(pred);
        });

        // Calculate weighted average for each outcome
        const aggregated = Object.entries(grouped).map(([outcome, preds]) => {
            const totalWeight = preds.reduce((sum, p) => sum + p.confidence, 0);
            const weightedProb = preds.reduce((sum, p) => 
                sum + (p.probability * p.confidence), 0
            ) / totalWeight;

            const avgConfidence = preds.reduce((sum, p) => sum + p.confidence, 0) / preds.length;
            const reasoning = preds.map(p => p.reasoning).join('; ');

            return {
                outcome,
                probability: Math.max(0.1, Math.min(0.9, weightedProb)),
                confidence: avgConfidence > 0.7 ? 'High' : avgConfidence > 0.5 ? 'Medium' : 'Low',
                reasoning,
                causalChains: preds.length
            };
        });

        // Sort by probability and return top 2
        return aggregated
            .sort((a, b) => b.probability - a.probability)
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
     * Generate fallback prediction when graph is insufficient
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
