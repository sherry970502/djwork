const natural = require('natural');
const config = require('../config');

class SimilarityService {
  constructor() {
    this.tfidf = new natural.TfIdf();
    this.tokenizer = new natural.WordTokenizer();
  }

  /**
   * Calculate TF-IDF similarity between two texts
   * @param {string} text1 - First text
   * @param {string} text2 - Second text
   * @returns {number} Similarity score (0-1)
   */
  calculateTfIdfSimilarity(text1, text2) {
    const tfidf = new natural.TfIdf();
    tfidf.addDocument(text1);
    tfidf.addDocument(text2);

    // Get terms from both documents
    const terms1 = new Set(this.tokenizer.tokenize(text1.toLowerCase()));
    const terms2 = new Set(this.tokenizer.tokenize(text2.toLowerCase()));
    const allTerms = new Set([...terms1, ...terms2]);

    // Calculate TF-IDF vectors
    const vector1 = [];
    const vector2 = [];

    allTerms.forEach(term => {
      let score1 = 0, score2 = 0;
      tfidf.tfidfs(term, (i, measure) => {
        if (i === 0) score1 = measure;
        if (i === 1) score2 = measure;
      });
      vector1.push(score1);
      vector2.push(score2);
    });

    // Calculate cosine similarity
    return this.cosineSimilarity(vector1, vector2);
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity(vec1, vec2) {
    if (vec1.length !== vec2.length) return 0;

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    norm1 = Math.sqrt(norm1);
    norm2 = Math.sqrt(norm2);

    if (norm1 === 0 || norm2 === 0) return 0;
    return dotProduct / (norm1 * norm2);
  }

  /**
   * Get embedding using Voyage AI API
   * @param {string} text - Text to embed
   * @returns {Promise<number[]>} Embedding vector
   */
  async getEmbedding(text) {
    if (!config.voyageApiKey) {
      // If no Voyage API key, return empty array (skip embedding)
      return [];
    }

    try {
      const response = await fetch('https://api.voyageai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.voyageApiKey}`
        },
        body: JSON.stringify({
          model: 'voyage-2',
          input: text.substring(0, 4000) // Limit input length
        })
      });

      if (!response.ok) {
        throw new Error(`Voyage API error: ${response.status}`);
      }

      const data = await response.json();
      return data.data[0].embedding;
    } catch (error) {
      console.error('Failed to get embedding:', error);
      return [];
    }
  }

  /**
   * Find similar thoughts for a given thought
   * @param {Object} thought - The thought to find similarities for
   * @param {Array} allThoughts - All existing thoughts to compare against
   * @returns {Promise<Array>} Similar thoughts with similarity scores
   */
  async findSimilarThoughts(thought, allThoughts) {
    const similarThoughts = [];
    const { tfidf: tfidfThreshold, embedding: embeddingThreshold } = config.similarityThreshold;

    for (const other of allThoughts) {
      // Skip self comparison
      if (other._id && thought._id && other._id.toString() === thought._id.toString()) {
        continue;
      }

      // Skip merged thoughts
      if (other.isMerged) {
        continue;
      }

      // Stage 1: TF-IDF quick filter
      const tfidfScore = this.calculateTfIdfSimilarity(thought.content, other.content);

      if (tfidfScore < tfidfThreshold) {
        continue;
      }

      // Stage 2: Embedding comparison (if available)
      let finalScore = tfidfScore;

      if (thought.embedding?.length > 0 && other.embedding?.length > 0) {
        const embeddingScore = this.cosineSimilarity(thought.embedding, other.embedding);
        // Weight: 40% TF-IDF, 60% Embedding
        finalScore = tfidfScore * 0.4 + embeddingScore * 0.6;
      }

      if (finalScore >= tfidfThreshold) {
        similarThoughts.push({
          thoughtId: other._id,
          similarity: parseFloat(finalScore.toFixed(4)),
          status: 'pending'
        });
      }
    }

    // Sort by similarity descending and limit to top 5
    return similarThoughts
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5);
  }

  /**
   * Batch process embeddings for multiple thoughts
   * @param {Array} thoughts - Array of thoughts
   * @returns {Promise<Array>} Thoughts with embeddings
   */
  async batchGetEmbeddings(thoughts) {
    if (!config.voyageApiKey) {
      return thoughts;
    }

    const batchSize = 10;
    const results = [...thoughts];

    for (let i = 0; i < thoughts.length; i += batchSize) {
      const batch = thoughts.slice(i, i + batchSize);
      const texts = batch.map(t => t.content.substring(0, 4000));

      try {
        const response = await fetch('https://api.voyageai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.voyageApiKey}`
          },
          body: JSON.stringify({
            model: 'voyage-2',
            input: texts
          })
        });

        if (response.ok) {
          const data = await response.json();
          data.data.forEach((item, idx) => {
            results[i + idx].embedding = item.embedding;
          });
        }
      } catch (error) {
        console.error('Batch embedding error:', error);
      }
    }

    return results;
  }
}

module.exports = new SimilarityService();
