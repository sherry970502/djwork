const mongoose = require('mongoose');

const intelligenceKeywordSchema = new mongoose.Schema({
  keyword: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  category: {
    type: String,
    enum: ['技术', '市场', '竞品', '行业', '政策', '其他'],
    default: '其他'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  priority: {
    type: String,
    enum: ['high', 'medium', 'low'],
    default: 'medium'
  },
  searchQuery: {
    type: String,
    default: ''
  },
  lastFetchedAt: {
    type: Date,
    default: null
  },
  source: {
    type: String,
    enum: ['manual', 'ai_suggested'],
    default: 'manual'
  },
  relatedThoughts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Thought'
  }],
  relatedTasks: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'OrganizationTask'
  }],
  aiReasoning: {
    type: String,
    default: ''
  },
  createdBy: {
    type: String,
    enum: ['user', 'ai'],
    default: 'user'
  },
  reportCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// 索引
intelligenceKeywordSchema.index({ keyword: 1 });
intelligenceKeywordSchema.index({ isActive: 1 });
intelligenceKeywordSchema.index({ createdAt: -1 });

module.exports = mongoose.model('IntelligenceKeyword', intelligenceKeywordSchema);
