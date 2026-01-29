const mongoose = require('mongoose');

// 计划项目复盘结果
const reviewResultSchema = new mongoose.Schema({
  // 从会议纪要中提取的相关成果
  meetingOutcomes: [{
    meetingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MeetingMinutes'
    },
    meetingTitle: String,
    meetingDate: Date,
    relatedContent: String,  // 相关内容摘要
    conclusions: [String]    // 结论要点
  }],
  // 相关的灵感/思考
  relatedThoughts: [{
    thoughtId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Thought'
    },
    content: String,
    relevance: String  // 与议题的关联说明
  }],
  // AI 判断
  completionStatus: {
    type: String,
    enum: ['completed', 'partial', 'not_started', 'unclear'],
    default: 'unclear'
  },
  completionReason: String,  // 判断理由
  // 缺漏提示
  gaps: [{
    dimension: String,       // 缺漏维度
    description: String,     // 具体说明
    suggestion: String       // 建议补充
  }],
  // AI 综合评价
  summary: String,
  // 操作建议
  actionRecommendations: [{
    action: {
      type: String,
      enum: ['carry_over', 'close', 'upgrade', 'split', 'merge']
      // carry_over: 迁移到下月继续
      // close: 可以关闭
      // upgrade: 升级为2.0版本
      // split: 拆分为多个子任务
      // merge: 与其他事务合并
    },
    reason: String,
    priority: {
      type: String,
      enum: ['high', 'medium', 'low'],
      default: 'medium'
    }
  }],
  // 下月建议重点
  nextMonthFocus: String,
  reviewedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

// 计划项目
const planItemSchema = new mongoose.Schema({
  // 来源类型
  sourceType: {
    type: String,
    enum: ['task', 'topic', 'migrated', 'manual'],
    // task: 组织事务, topic: 推荐议题, migrated: 从上月迁移, manual: 手动添加
    required: true
  },
  // 关联的原始数据 ID
  referenceId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  // 基本信息（冗余存储，便于展示）
  title: {
    type: String,
    required: true
  },
  description: String,
  // 项目分类（四大项目）
  project: {
    type: String,
    enum: ['company_management', 'education', 'gaming', 'other'],
    // 公司管理、教育、游戏、其他
    default: 'other'
  },
  // 旧分类字段保留兼容
  category: {
    type: String,
    enum: ['business', 'organization', 'strategy', 'brand', 'unknown'],
    default: 'unknown'
  },
  priority: {
    type: String,
    enum: ['high', 'medium', 'low'],
    default: 'medium'
  },
  // 计划状态
  planStatus: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'deferred', 'migrated'],
    default: 'pending'
  },
  // 计划执行备注
  notes: String,
  // AI 复盘结果
  review: reviewResultSchema,
  // 迁移相关信息
  migration: {
    fromMonth: String,        // 从哪个月迁移来的
    fromItemId: mongoose.Schema.Types.ObjectId,  // 原始项目ID
    version: { type: Number, default: 1 },  // 版本号 1.0, 2.0 等
    inheritedContext: String,  // 继承的上下文信息
    evolutionNotes: String     // 演进说明（为什么升级到2.0）
  },
  // 添加时间
  addedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: true });

// 月度计划
const monthlyPlanSchema = new mongoose.Schema({
  month: {
    type: String,  // Format: "2026-01"
    required: true,
    unique: true
  },
  // 计划项目列表
  items: [planItemSchema],
  // 月度总结（AI 生成）
  monthlySummary: {
    totalItems: { type: Number, default: 0 },
    completedItems: { type: Number, default: 0 },
    partialItems: { type: Number, default: 0 },
    overallAssessment: String,  // 整体评价
    keyAchievements: [String],  // 主要成果
    areasForImprovement: [String],  // 待改进领域
    generatedAt: Date
  },
  // 上次同步时间
  lastSyncAt: Date,
  // 上次复盘时间
  lastReviewAt: Date
}, {
  timestamps: true
});

// Indexes
monthlyPlanSchema.index({ month: 1 });
monthlyPlanSchema.index({ 'items.sourceType': 1 });
monthlyPlanSchema.index({ 'items.planStatus': 1 });

module.exports = mongoose.model('MonthlyPlan', monthlyPlanSchema);
