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
      // 根节点：生成初始的主要探索方向
      prompt = `你是创意发散助手。基于以下设计主题，提供4-6个主要的探索方向。

设计主题：${nodeContent}

要求：
1. 提供4-6个不同角度的探索方向
2. 覆盖不同维度：用户体验、技术实现、商业模式、内容形式等
3. 每个方向简洁有力（8-15字）
4. 既要创新，也要可行

输出JSON格式：
[
  { "content": "探索方向1", "type": "horizontal" },
  { "content": "探索方向2", "type": "horizontal" }
]

只输出JSON数组，不要其他内容。`;
    } else {
      // 子节点：基于当前节点深入发散
      const rootInfo = rootContent
        ? `\n\n⚠️ 原始需求：${rootContent}\n所有创意必须紧扣这个原始需求，不能偏离主题！`
        : '';

      const contextInfo = parentNodes.length > 0
        ? `\n\n探索路径：${parentNodes.join(' → ')} → ${nodeContent}`
        : '';

      const interestInfo = markedNodes.length > 0
        ? `\n\n用户特别感兴趣的方向：${markedNodes.join(', ')}`
        : '';

      prompt = `你是创意发散助手。基于当前创意节点，提供3-5个发散方向。${rootInfo}

当前节点：${nodeContent}${contextInfo}${interestInfo}

⚠️ 核心约束：
- 所有创意必须服务于原始需求"${rootContent || nodeContent}"
- 不能偏离主题（例如原始需求是"雕像"就不能变成"绘画"）
- 向上追溯，确保与父节点和根节点逻辑一致

发散策略：
1. 横向发散（同级的其他可能）：在当前方向下，还有哪些平行的选择？
2. 纵向发散（深入细化）：这个想法可以如何具体实现和落地？
3. 结合用户兴趣，提供更符合用户偏好的建议

要求：
- 提供3-5个创意，横向和纵向都要有
- 每个创意10-20字，简洁有力
- 既要创新，也要实用
- 必须与原始需求"${rootContent || nodeContent}"高度相关
- type: "horizontal" (横向) 或 "vertical" (纵向)

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
        return this._getFallbackIdeas(nodeContent, isRoot);
      }

      const ideas = JSON.parse(jsonMatch[0]);

      // 验证格式
      if (!Array.isArray(ideas) || ideas.length === 0) {
        return this._getFallbackIdeas(nodeContent, isRoot);
      }

      return ideas.map(idea => ({
        content: idea.content || '创意想法',
        type: idea.type || 'vertical'
      }));

    } catch (error) {
      console.error('Creative divergence error:', error);
      return this._getFallbackIdeas(nodeContent, isRoot);
    }
  }

  /**
   * 备用创意（当 AI 失败时）
   */
  _getFallbackIdeas(nodeContent, isRoot) {
    if (isRoot) {
      return [
        { content: '用户体验创新', type: 'horizontal' },
        { content: '技术实现方式', type: 'horizontal' },
        { content: '商业模式探索', type: 'horizontal' },
        { content: '内容形式设计', type: 'horizontal' }
      ];
    } else {
      return [
        { content: '具体实现方案', type: 'vertical' },
        { content: '其他可行路径', type: 'horizontal' },
        { content: '用户价值分析', type: 'vertical' }
      ];
    }
  }
}

module.exports = new CreativeDivergenceService();
