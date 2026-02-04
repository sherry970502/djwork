const Anthropic = require('@anthropic-ai/sdk');
const config = require('../config');

class ClaudeService {
  constructor() {
    this.client = new Anthropic({
      apiKey: config.claudeApiKey
    });
    this.model = 'claude-3-haiku-20240307';
  }

  /**
   * Call Claude API using official SDK
   */
  async callClaudeAPI(messages, maxTokens = 4096) {
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: maxTokens,
        messages: messages
      });

      return response;
    } catch (error) {
      throw new Error(`API call failed: ${error.message}`);
    }
  }

  /**
   * Extract thoughts from meeting minutes content
   * @param {string} content - Meeting minutes content
   * @param {Array} tags - Available tags for classification
   * @returns {Promise<Array>} Extracted thoughts
   */
  async extractThoughts(content, tags) {
    const tagList = tags.map(t => `- ${t.name}: ${t.displayName} (${t.keywords.join(', ')})`).join('\n');

    const prompt = `你是一个会议纪要分析助手。请从以下会议纪要内容中提取 DJ 的核心结论和战略思考。

## 可用标签
${tagList}

## 会议纪要内容
${content}

## 任务要求
1. 只提取 DJ 表达的**战略层面的核心结论**，而非执行层面的观点或思路
2. 关注更高层面的洞察和判断，例如：
   - 战略方向的重大决策
   - 对行业/市场的本质判断
   - 核心能力的定义和取舍
   - 商业模式的关键认知
   - 组织发展的根本原则
3. **不要提取**以下内容：
   - 具体的执行步骤或操作建议
   - 临时性的工作安排
   - 对具体事务的讨论细节
   - 一般性的观点陈述
4. 每个结论应该是独立、完整、可沉淀的战略认知
5. 为每个结论选择1-3个最相关的标签
6. 保留原文中最相关的片段作为引用

## 输出格式
请以JSON数组格式输出，每个元素包含：
{
  "content": "提取的核心结论（战略层面的精炼概括）",
  "originalSegment": "原文中的相关片段",
  "tags": ["tag_name1", "tag_name2"],
  "confidence": 0.9,
  "isImportant": false
}

注意：
- 只输出JSON数组，不要有其他内容
- 宁缺毋滥：如果内容中没有战略层面的核心结论，返回空数组 []
- 标签名使用英文name字段
- isImportant 标记特别重要的战略决策或核心认知`;

    try {
      const response = await this.callClaudeAPI([
        { role: 'user', content: prompt }
      ]);

      const responseText = response.content[0].text.trim();

      // Parse JSON from response
      let thoughts = [];
      try {
        // Try to extract JSON array from response
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          thoughts = JSON.parse(jsonMatch[0]);
        }
      } catch (parseError) {
        console.error('Failed to parse Claude response:', parseError);
        console.error('Response text:', responseText);
        thoughts = [];
      }

      return thoughts;
    } catch (error) {
      console.error('Claude API error:', error);
      throw new Error(`Claude API call failed: ${error.message}`);
    }
  }

  /**
   * Extract thoughts from meeting minutes content (V2 - Improved)
   * @param {string} content - Meeting minutes content
   * @param {Array} tags - Available tags for classification
   * @returns {Promise<Array>} Extracted thoughts with enhanced metadata
   */
  async extractThoughtsV2(content, tags) {
    const tagList = tags.map(t => `- ${t.name}: ${t.displayName} (${t.keywords.join(', ')})`).join('\n');

    const prompt = `你是一个专业的会议纪要分析助手。请从会议纪要中提取有价值的观点和信息。

【提取原则】
1. **区分说话人**：如果能识别出是DJ的发言，speaker标记为"DJ"；如果是其他人说的，标记具体姓名或"参会者"
2. **内容类型分类**：根据内容性质标注类型（见下方说明）
3. **提供原文引用**：尽量提供原文片段，但如果会议纪要中没有明确的引号或段落，可以提取关键句子
4. **全面提取**：提取所有有价值的观点，包括待办事项、结论、想法、问题等

【内容类型说明】
- TODO: 待办事项，需要去做的事（"需要做..."、"计划..."、"安排..."）
- CONCLUSION: 分析后的结论（"所以..."、"因此..."、"可见..."）
- DECISION: 明确的决策（"决定..."、"确定..."、"就这么办"）
- QUESTION: 提出的问题或疑问（"如何...？"、"是否...？"、"怎么办？"）
- IDEA: 想法、建议、创意（"可以..."、"建议..."、"也许..."）
- OBSERVATION: 观察到的现象或事实（"发现..."、"看到..."、"目前..."）
- REFERENCE: 引用他人的观点或外部信息（"XX说..."、"根据..."）

【可用标签】
${tagList}

【会议纪要内容】
${content}

【输出格式】
请输出JSON数组，每个观点包含：
{
  "content": "观点概括（简明扼要，50字以内）",
  "contentType": "类型代码（见上方类型说明）",
  "speaker": "说话人（DJ/具体姓名/参会者，如无法判断则为DJ）",
  "originalQuote": "原文片段（尽量找到对应原文，如果整段都相关可以摘录关键句）",
  "context": "补充说明（可选，如果需要额外背景信息）",
  "confidence": 0.85,
  "tags": ["相关标签name"],
  "isImportant": false
}

【要求】
- 只输出JSON数组，不要其他文字
- 如果不确定类型，优先使用IDEA
- 如果不确定说话人，默认为DJ
- originalQuote尽量包含，但不强制要求完整引用
- 提取所有有价值的内容，不要遗漏重要信息

开始提取：`;

    try {
      const response = await this.callClaudeAPI([
        { role: 'user', content: prompt }
      ], 6000); // 增加 token 限制以支持更详细的输出

      const responseText = response.content[0].text.trim();

      // Parse JSON from response
      let thoughts = [];
      try {
        // Try to extract JSON array from response
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          thoughts = JSON.parse(jsonMatch[0]);
          // 添加版本标记
          thoughts = thoughts.map(t => ({
            ...t,
            extractionVersion: 2,
            // 确保必需字段有默认值
            contentType: t.contentType || 'IDEA',
            speaker: t.speaker || 'DJ',
            originalQuote: t.originalQuote || t.originalSegment || '',
            context: t.context || '',
            confidence: t.confidence || 0.8
          }));
        }
      } catch (parseError) {
        console.error('Failed to parse Claude response (V2):', parseError);
        console.error('Response text:', responseText);
        thoughts = [];
      }

      return thoughts;
    } catch (error) {
      console.error('Claude API error (V2):', error);
      throw new Error(`Claude API call failed: ${error.message}`);
    }
  }

  /**
   * Deduplicate thoughts from overlapping chunks
   * @param {Array} allThoughts - All extracted thoughts
   * @returns {Array} Deduplicated thoughts
   */
  deduplicateThoughts(allThoughts) {
    const seen = new Map();
    const deduplicated = [];

    for (const thought of allThoughts) {
      // Create a simple hash based on content
      const contentHash = this.simpleHash(thought.content);

      if (!seen.has(contentHash)) {
        seen.set(contentHash, true);
        deduplicated.push(thought);
      } else {
        // Check if existing thought has lower confidence
        const existingIndex = deduplicated.findIndex(
          t => this.simpleHash(t.content) === contentHash
        );
        if (existingIndex !== -1 && deduplicated[existingIndex].confidence < thought.confidence) {
          deduplicated[existingIndex] = thought;
        }
      }
    }

    return deduplicated;
  }

  /**
   * Simple content hash for deduplication
   */
  simpleHash(content) {
    // Normalize and create a simple hash
    const normalized = content
      .replace(/\s+/g, '')
      .toLowerCase()
      .substring(0, 100); // Use first 100 chars for comparison

    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString();
  }
}

module.exports = new ClaudeService();
