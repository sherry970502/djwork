const mongoose = require('mongoose');

const analysisSchema = new mongoose.Schema({
  categoryPrediction: {
    type: String,
    enum: ['business', 'organization', 'strategy', 'brand', 'unknown'],
    default: 'unknown'
  },
  categoryLabel: {
    type: String  // 中文标签：业务/产品类、组织/管理类、战略/资本类、品牌/生态类
  },
  // Step 1: 溯源与证伪
  step1_falsification: {
    firstPrinciple: String,      // 第一性原理分析
    coreCapabilityFit: String,   // 本分审计
    alternativePaths: [String]   // 替代路径
  },
  // Step 2: 环境与竞争审计
  step2_external: {
    marketFit: String,           // 市场环境适配
    competitiveAnalysis: String  // 竞争态势穿透
  },
  // Step 3: 商业逻辑算法
  step3_frameworks: {
    porterFiveForces: String,    // 波特五力
    scalabilityTest: String,     // 规模化校验
    ansoffMatrix: String         // 安索夫矩阵定位
  },
  // Step 4: 执行策略与回报评估
  step4_execution: {
    optimalPath: String,         // 路径优选
    roiAnalysis: String,         // ROI 计算
    leveragePoint: String        // 核心抓手
  },
  // Step 5: 用户与场景锚定
  step5_userContext: {
    happinessLogic: String,      // 快乐逻辑
    sceneValue: String           // 场景匹配
  },
  // Step 6: 风险审计
  step6_risk: {
    swot: {
      strengths: [String],
      weaknesses: [String],
      opportunities: [String],
      threats: [String]
    },
    criticalQuestions: [String]  // 直击命门的问题
  },
  // 最终建议
  recommendation: {
    summary: String,             // 总结建议
    whatToDo: String,            // What
    whyToDo: String,             // Why
    whereToFocus: String,        // Where (抓手)
    costAndReturn: String        // How Much (代价与回报)
  },
  relatedThoughts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Thought'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const organizationTaskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  source: {
    type: String,
    default: '组织事务部'
  },
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
  status: {
    type: String,
    enum: ['pending', 'analyzing', 'completed', 'archived'],
    default: 'pending'
  },
  dueDate: {
    type: Date,
    default: null
  },
  // DJ 角色推荐
  djRole: {
    type: String,
    enum: ['manager', 'lead_designer', 'mentor', 'expert', 'unknown'],
    default: 'unknown'
  },
  djRoleLabel: {
    type: String  // 中文标签：管理者、主设计师、指导设计师、专家
  },
  djRoleReason: {
    type: String  // AI 推荐理由
  },
  analysis: analysisSchema,
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

// Indexes
organizationTaskSchema.index({ status: 1 });
organizationTaskSchema.index({ category: 1 });
organizationTaskSchema.index({ createdAt: -1 });
organizationTaskSchema.index({ dueDate: 1 });

module.exports = mongoose.model('OrganizationTask', organizationTaskSchema);
