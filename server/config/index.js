// Load .env only in development
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: '../.env' });
}

module.exports = {
  port: process.env.PORT || 3001,
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/chairman-meeting',
  claudeApiKey: process.env.CLAUDE_API_KEY,
  voyageApiKey: process.env.VOYAGE_API_KEY,
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024,
  uploadDir: process.env.UPLOAD_DIR || 'uploads',

  // AI Processing Config
  chunkSize: 3000,
  chunkOverlap: 200,
  similarityThreshold: {
    tfidf: 0.5,
    embedding: 0.85
  },

  // Preset Tags
  presetTags: [
    { name: 'education_core', displayName: '教育核心竞争力', color: '#1890ff', keywords: ['教育', '核心', '竞争力', '教学', '学习'] },
    { name: 'ai_technology', displayName: 'AI技术', color: '#52c41a', keywords: ['AI', '人工智能', '智能', '算法', '模型'] },
    { name: 'product_strategy', displayName: '产品战略', color: '#faad14', keywords: ['产品', '战略', '规划', '方向', '定位'] },
    { name: 'organization', displayName: '组织管理', color: '#722ed1', keywords: ['组织', '管理', '团队', '人员', '架构'] },
    { name: 'business_model', displayName: '商业模式', color: '#eb2f96', keywords: ['商业', '模式', '盈利', '变现', '收入'] },
    { name: 'market_insight', displayName: '市场洞察', color: '#13c2c2', keywords: ['市场', '洞察', '趋势', '竞品', '用户'] },
    { name: 'decision', displayName: '重要决策', color: '#f5222d', keywords: ['决策', '决定', '确定', '拍板', '定了'] },
    { name: 'reflection', displayName: '反思复盘', color: '#fa8c16', keywords: ['反思', '复盘', '总结', '教训', '经验'] }
  ]
};
