const mongoose = require('mongoose');

// 单个维度的创意发散结果
const dimensionIdeaSchema = new mongoose.Schema({
  dimensionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DesignDimension'
  },
  dimensionName: String,
  ideas: [{
    title: String,
    description: String,
    feasibility: {
      type: String,
      enum: ['high', 'medium', 'low'],
      default: 'medium'
    },
    innovation: {
      type: String,
      enum: ['high', 'medium', 'low'],
      default: 'medium'
    }
  }],
  summary: String,
  generatedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

// AI 综合创意方案
const creativeProposalSchema = new mongoose.Schema({
  title: String,
  coreIdea: String,           // 核心创意
  uniqueValue: String,        // 独特价值
  targetAudience: String,     // 目标受众
  keyFeatures: [String],      // 关键特性
  implementationSteps: [{     // 实现步骤
    step: Number,
    title: String,
    description: String
  }],
  potentialChallenges: [String],  // 潜在挑战
  inspirationSources: [String],   // 灵感来源（关联的维度）
  generatedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: true });

// 需求澄清问答
const clarifyingQASchema = new mongoose.Schema({
  question: String,
  questionType: {
    type: String,
    enum: ['single', 'multiple', 'text'],
    default: 'single'
  },
  options: [String],
  answer: [String],  // 用户选择的答案
  customAnswer: String,  // 用户自定义输入
  category: String  // 问题分类：target_user, core_value, use_case, constraint 等
}, { _id: false });

const personalDesignSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  // 需求澄清问答
  clarifyingQA: [clarifyingQASchema],
  // 需求澄清状态
  clarifyStatus: {
    type: String,
    enum: ['pending', 'questioning', 'completed', 'skipped'],
    default: 'pending'
  },
  // AI 生成的需求摘要
  requirementSummary: String,
  // 设计类型/分类
  category: {
    type: String,
    enum: ['product', 'experience', 'content', 'service', 'other'],
    default: 'other'
  },
  // 灵感来源/背景
  inspiration: {
    type: String
  },
  // 期望达成的目标
  goals: [{
    type: String
  }],
  // 状态
  status: {
    type: String,
    enum: ['draft', 'ideating', 'designing', 'prototyping', 'completed', 'archived'],
    default: 'draft'
  },
  // 优先级
  priority: {
    type: String,
    enum: ['high', 'medium', 'low'],
    default: 'medium'
  },
  // 选择的创意维度（用于 AI 发散）
  selectedDimensions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DesignDimension'
  }],
  // 各维度的创意发散结果
  dimensionIdeas: [dimensionIdeaSchema],
  // AI 生成的综合创意方案
  creativeProposals: [creativeProposalSchema],
  // 用户笔记/备注
  notes: {
    type: String
  },
  // 相关灵感思考（来自知识库）
  relatedThoughts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Thought'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

personalDesignSchema.index({ status: 1 });
personalDesignSchema.index({ category: 1 });
personalDesignSchema.index({ createdAt: -1 });

module.exports = mongoose.model('PersonalDesign', personalDesignSchema);
