const mongoose = require('mongoose');

const intelligenceReportSchema = new mongoose.Schema({
  keyword: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'IntelligenceKeyword',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  summary: {
    type: String,
    default: ''
  },
  content: {
    type: String,
    default: ''
  },
  sourceUrl: {
    type: String,
    required: true
  },
  sourceName: {
    type: String,
    default: ''
  },
  publishedAt: {
    type: Date,
    default: null
  },
  fetchedAt: {
    type: Date,
    default: Date.now
  },

  // 评分系统
  relevanceScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 50
  },
  hotScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 50
  },
  freshnessScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 50
  },

  // 用户交互
  isBookmarked: {
    type: Boolean,
    default: false
  },
  bookmarkedAt: {
    type: Date,
    default: null
  },
  hasUpdate: {
    type: Boolean,
    default: false
  },
  lastCheckedAt: {
    type: Date,
    default: null
  },

  // AI 分析结果
  aiAnalysis: {
    businessValue: {
      type: String,
      default: ''
    },
    insights: [{
      type: String
    }],
    actionItems: [{
      type: String
    }],
    relatedConcepts: [{
      type: String
    }],
    potentialIssues: [{
      type: String
    }],
    analyzedAt: {
      type: Date,
      default: null
    }
  },

  relatedReports: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'IntelligenceReport'
  }],
  tags: [{
    type: String
  }]
}, {
  timestamps: true
});

// 索引
intelligenceReportSchema.index({ keyword: 1, fetchedAt: -1 });
intelligenceReportSchema.index({ isBookmarked: 1 });
intelligenceReportSchema.index({ publishedAt: -1 });
intelligenceReportSchema.index({ hotScore: -1 });
intelligenceReportSchema.index({ relevanceScore: -1 });

// 复合索引用于排序
intelligenceReportSchema.index({ hotScore: -1, freshnessScore: -1 });

module.exports = mongoose.model('IntelligenceReport', intelligenceReportSchema);
