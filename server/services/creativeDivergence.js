const claudeService = require('./claudeService');

class CreativeDivergenceService {
  /**
   * 从一个节点发散出新的创意
   * @param {string} nodeContent - 当前节点内容
   * @param {object} context - 上下文信息
   * @returns {Promise<Array>} 发散的创意节点
   */
  async divergeFromNode(nodeContent, context = {}) {
    const { parentNodes = [], markedNodes = [], level = 1, isRoot = false, rootContent = '' } = context;

    let prompt;

    if (isRoot) {
      // 根节点：第一步先建立分类框架，不要直接跳到具体实现
      prompt = `你是创意发散助手。请模拟人的思维方式，对以下主题进行初步的分类归纳。

设计主题：${nodeContent}

⚠️ 重要原则 - 模拟人的思维链：
第一步不要直接发散到具体实现！而是先建立思考框架。

思考方式举例：
- 如果主题是"在不同材质上画画"，应该先分类：时尚类材质、日常生活类材质、创想类特殊材质、配套装饰考虑等
- 如果主题是"为母亲设计雕像"，应该先分类：雕像风格类型、材质选择维度、摆放场景考虑、情感表达方式等
- 如果主题是"设计读书工具"，应该先分类：阅读场景分类、用户人群分类、功能维度分类、载体形式分类等

要求：
1. 提供3-5个主要的"分类维度"或"探索类别"
2. 这些类别应该是对主题的不同角度分解，而不是具体方案
3. 类别名称清晰（6-12字），便于后续在该类别下继续深入
4. 紧扣主题，确保分类合理且覆盖主要方向

输出JSON格式：
[
  { "content": "分类维度1", "type": "horizontal" },
  { "content": "分类维度2", "type": "horizontal" }
]

只输出JSON数组，不要其他内容。`;
    } else {
      // 子节点：基于当前节点深入发散，策略根据层级调整
      const rootInfo = rootContent
        ? `\n\n⚠️ 原始需求：${rootContent}\n所有创意必须紧扣这个原始需求，不能偏离主题！`
        : '';

      const contextInfo = parentNodes.length > 0
        ? `\n\n探索路径：${parentNodes.join(' → ')} → ${nodeContent}`
        : '';

      const interestInfo = markedNodes.length > 0
        ? `\n\n用户特别感兴趣的方向：${markedNodes.join(', ')}`
        : '';

      // 根据层级调整发散策略
      let strategyGuide = '';
      if (level === 1) {
        // 第二层：在某个分类下，开始列举主要选项
        strategyGuide = `
⚠️ 当前是第二层思考（在分类"${nodeContent}"下的具体选项）：
- 应该列举这个分类下的主要选项或代表性例子
- 不要太发散，保持在该分类的范围内
- 每个选项应该是该分类下具体的、可操作的方向
- 提供3-4个代表性选项即可`;
      } else {
        // 第三层及以后：可以更具体地细化或横向扩展
        strategyGuide = `
⚠️ 当前是第${level + 1}层思考（已经比较具体了）：
- 可以继续深入细化具体实现方案
- 或者横向列举同级的其他可能性
- 注意不要偏离上级节点的方向`;
      }

      prompt = `你是创意发散助手。请继续模拟人的逐步深入思维。${rootInfo}

当前节点：${nodeContent}${contextInfo}${interestInfo}${strategyGuide}

⚠️ 核心约束：
- 所有创意必须服务于原始需求"${rootContent || nodeContent}"
- 不能偏离主题（例如原始需求是"雕像"就不能变成"绘画"）
- 向上追溯，确保与父节点和根节点逻辑一致
- 保持渐进式思考，不要一下子跳跃太大

发散策略：
1. 横向发散（type: "horizontal"）：在当前节点的同级，还有哪些平行的选择？
2. 纵向发散（type: "vertical"）：在当前节点下，可以如何进一步细化或具体化？

要求：
- 提供3-4个创意（不要太多，保持聚焦）
- 每个创意8-20字，简洁明确
- 既要有深度，也要贴近实际
- 必须与原始需求"${rootContent || nodeContent}"高度相关
- 合理分配横向和纵向，至少要有一个纵向深入的选项

输出JSON格式：
[
  { "content": "创意想法", "type": "horizontal" },
  { "content": "创意想法", "type": "vertical" }
]

只输出JSON数组，不要其他内容。`;
    }

    try {
      const response = await claudeService.callClaudeAPI([
        { role: 'user', content: prompt }
      ], 2048);

      const responseText = response.content[0].text.trim();

      // 提取 JSON 数组
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.error('AI response does not contain valid JSON array');
        return this._getFallbackIdeas(nodeContent, isRoot, level);
      }

      const ideas = JSON.parse(jsonMatch[0]);

      // 验证格式
      if (!Array.isArray(ideas) || ideas.length === 0) {
        return this._getFallbackIdeas(nodeContent, isRoot, level);
      }

      return ideas.map(idea => ({
        content: idea.content || '创意想法',
        type: idea.type || 'vertical'
      }));

    } catch (error) {
      console.error('Creative divergence error:', error);
      return this._getFallbackIdeas(nodeContent, isRoot, level);
    }
  }

  /**
   * 备用创意（当 AI 失败时）
   */
  _getFallbackIdeas(nodeContent, isRoot, level = 0) {
    if (isRoot) {
      // 第一层：提供分类维度
      return [
        { content: '场景分类维度', type: 'horizontal' },
        { content: '用户人群维度', type: 'horizontal' },
        { content: '功能形式维度', type: 'horizontal' },
        { content: '实现方式维度', type: 'horizontal' }
      ];
    } else {
      // 后续层级：提供具体选项
      return [
        { content: '方案A：常规路径', type: 'horizontal' },
        { content: '方案B：创新尝试', type: 'horizontal' },
        { content: '深入细化方向', type: 'vertical' }
      ];
    }
  }
}

module.exports = new CreativeDivergenceService();
