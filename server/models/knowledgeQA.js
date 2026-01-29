const mongoose = require('mongoose');

const knowledgeQASchema = new mongoose.Schema({
  question: {
    type: String,
    required: true,
    trim: true
  },
  answer: {
    type: String,
    required: true
  },
  relatedThoughts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Thought'
  }],
  confidence: {
    type: Number,
    default: 0.8,
    min: 0,
    max: 1
  },
  helpful: {
    type: Boolean,
    default: null  // null = 未评价, true = 有帮助, false = 无帮助
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes
knowledgeQASchema.index({ createdAt: -1 });
knowledgeQASchema.index({ question: 'text' });

module.exports = mongoose.model('KnowledgeQA', knowledgeQASchema);
