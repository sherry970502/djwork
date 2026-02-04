const mongoose = require('mongoose');

const similarThoughtSchema = new mongoose.Schema({
  thoughtId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Thought',
    required: true
  },
  similarity: {
    type: Number,
    required: true,
    min: 0,
    max: 1
  },
  status: {
    type: String,
    enum: ['pending', 'merged', 'dismissed'],
    default: 'pending'
  }
}, { _id: false });

const thoughtSchema = new mongoose.Schema({
  meetingMinutesId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MeetingMinutes',
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  // 内容类型：区分待办、结论、问题等
  contentType: {
    type: String,
    enum: ['TODO', 'CONCLUSION', 'QUESTION', 'IDEA', 'DECISION', 'OBSERVATION', 'REFERENCE'],
    default: 'IDEA'
  },
  // 说话人：重点关注DJ的发言
  speaker: {
    type: String,
    default: 'DJ'
  },
  // 原文引用：避免过度推断
  originalQuote: {
    type: String,
    default: ''
  },
  // 上下文补充：提供必要的背景信息
  context: {
    type: String,
    default: ''
  },
  // 旧字段保留兼容
  originalSegment: {
    type: String,
    default: ''
  },
  tags: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tag'
  }],
  confidence: {
    type: Number,
    default: 0.8,
    min: 0,
    max: 1
  },
  // 提取算法版本：用于追踪和重新整理
  extractionVersion: {
    type: Number,
    default: 2  // v2 是新版本
  },
  embedding: {
    type: [Number],
    default: []
  },
  similarThoughts: [similarThoughtSchema],
  isImportant: {
    type: Boolean,
    default: false
  },
  mergedFrom: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Thought'
  }],
  isMerged: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes
thoughtSchema.index({ meetingMinutesId: 1 });
thoughtSchema.index({ tags: 1 });
thoughtSchema.index({ isImportant: -1 });
thoughtSchema.index({ createdAt: -1 });
thoughtSchema.index({ 'similarThoughts.status': 1 });
thoughtSchema.index({ contentType: 1 });
thoughtSchema.index({ speaker: 1 });
thoughtSchema.index({ extractionVersion: 1 });

module.exports = mongoose.model('Thought', thoughtSchema);
