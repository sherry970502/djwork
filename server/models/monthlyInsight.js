const mongoose = require('mongoose');

const suggestedTopicSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['business', 'organization', 'strategy', 'brand']
  },
  reasoning: {
    type: String  // 为什么推荐这个议题
  },
  relatedThoughts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Thought'
  }],
  relatedTasks: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'OrganizationTask'
  }],
  priority: {
    type: String,
    enum: ['high', 'medium', 'low'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['suggested', 'accepted', 'dismissed'],
    default: 'suggested'
  }
}, { _id: true });

const monthlyInsightSchema = new mongoose.Schema({
  month: {
    type: String,  // Format: "2026-01"
    required: true,
    unique: true
  },
  recentThoughts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Thought'
  }],
  pendingTasks: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'OrganizationTask'
  }],
  thoughtsSummary: {
    type: String  // 本月思考总结
  },
  tasksSummary: {
    type: String  // 待处理任务总结
  },
  suggestedTopics: [suggestedTopicSchema],
  generatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes
monthlyInsightSchema.index({ month: 1 });
monthlyInsightSchema.index({ generatedAt: -1 });

module.exports = mongoose.model('MonthlyInsight', monthlyInsightSchema);
