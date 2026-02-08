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
      // 根节点：第一步先建立结构化的分类框架
      prompt = `你是创意发散助手。请基于人的结构化思维方式，对主题建立初步的分析框架。

【原始主题】${nodeContent}

⚠️ 第一层发散原则（建立分析框架）：
不要直接给出具体方案或实现细节，而是先建立思考的分类维度。

思考方式示例：
- "在不同材质上画画" → 材质类型分类、应用场景维度、艺术风格考虑、技术实现维度
- "为母亲设计雕像" → 雕像风格类型、材质选择维度、摆放场景考虑、情感表达方式
- "拆解一首歌曲的创作" → 音乐元素分析、创作流程拆解、表现形式探索、情感传达维度

输出要求：
1. 提供3-5个主要的"分析维度"或"探索类别"
2. 这些维度应该是对主题的不同角度分解，概念层级清晰
3. 维度名称6-12字，描述性强，便于后续深入拆解
4. 紧扣主题，确保分类全面且互不重叠
5. 每个维度都要能继续向下细化（为第二层发散做准备）

输出JSON格式：
[
  { "content": "分析维度名称", "type": "vertical" },
  { "content": "分析维度名称", "type": "vertical" }
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
        // 第二层：在某个分类维度下，进行结构化的概念拆解
        strategyGuide = `
⚠️ 当前是第二层思考（对"${nodeContent}"进行概念细化）：
【核心要求】结合原始主题"${rootContent}"，对当前维度"${nodeContent}"进行结构化拆解：
- 不要给出具象的例子或操作建议
- 应该列举该维度下的子分类、子概念、或者平行的不同类型
- 每个子项应该是一个概念性的分类名称，而不是具体方案
- 保持在概念层级，为下一步细化留出空间

举例说明：
如果原始主题是"拆解一首歌曲的创作"，当前节点是"不同表现形式的探索"
✅ 好的发散：电子音乐形式、管弦乐形式、民谣形式、说唱形式（这些是表现形式的子分类）
❌ 不好的发散：使用合成器制作、邀请乐队演奏（这些太具象了）

提供3-5个子分类即可`;
      } else if (level === 2) {
        // 第三层：在子分类下，可以进一步细化或列举具体选项
        strategyGuide = `
⚠️ 当前是第三层思考（对"${nodeContent}"进行具体化）：
- 可以列举具体的实现方式、代表性案例、或操作步骤
- 也可以继续拆解为更细的子维度（如果"${nodeContent}"还比较抽象）
- 保持与"${rootContent}"的强关联
- 提供3-4个选项即可`;
      } else {
        // 第四层及以后：深度细化或横向扩展
        strategyGuide = `
⚠️ 当前是第${level + 1}层思考（深度细化）：
- 可以给出更具体的实现细节、技巧、或变体
- 或者横向列举同级的其他可能性
- 注意不要偏离上级节点的方向
- 保持内容的实用性和可操作性`;
      }

      prompt = `你是创意发散助手。请基于人的结构化思维方式，对当前节点进行概念拆解。${rootInfo}

【思维导图上下文】
原始主题：${rootContent || nodeContent}
当前节点：${nodeContent}${contextInfo}${interestInfo}

${strategyGuide}

⚠️ 核心约束：
1. 始终围绕原始主题"${rootContent || nodeContent}"展开，不能偏离
2. 与父节点保持逻辑一致性，向上可追溯
3. 根据当前层级控制抽象程度：
   - 第2层应该是概念分类，不是具体方案
   - 第3层可以介于概念和具体之间
   - 第4层及以后可以给出具体细节
4. 每个节点都要能继续向下拆解（为后续发散留出空间）

发散类型说明：
- horizontal（横向）：同级别的平行选项或不同类型
- vertical（纵向）：下一级的细化或子维度

输出要求：
- 提供3-5个节点（根据内容丰富度调整）
- 每个节点6-15字，简洁且概念清晰
- 节点之间要有明确的区分度，不重复
- 必须紧扣"${rootContent || nodeContent}"的主题
- 优先使用 vertical 类型（纵向深入）

输出JSON格式：
[
  { "content": "概念名称或分类标签", "type": "vertical" },
  { "content": "概念名称或分类标签", "type": "vertical" }
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
