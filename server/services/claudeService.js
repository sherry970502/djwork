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

    const prompt = `⚠️ 核心要求：只提取DJ的发言，其他人发言完全忽略

【识别DJ发言】
- 明确标注"DJ："、"DJ说："→只提取这些
- 无标注时→提取主持人/决策者观点
【必须忽略其他人】
- 标注其他人名字（"小王说"、"张三"）→完全不提取
- "XX说"、"XX认为"开头→完全不提取
- 团队汇报、建议、提问→完全不提取
⚠️ 宁可少提取，不要把他人话当DJ的

【content要求-保持具象】
1. 不要抽象化
   ✗ 错误："公司能力需要提高"
   ✓ 正确："AI生产线能力需要提高"
2. 保留具体数据和业务领域
   - 数字、指标、产品名必须保留
   - 业务领域（AI、教育、设计等）不能丢
3. 理解本质意思，不过度概括

【类型】TODO/CONCLUSION/DECISION/QUESTION/IDEA/OBSERVATION

【originalQuote要求】
- 从会议纪要逐字复制原文，80-150字
- 包含完整讨论片段（问题+讨论+结论）
- 不要改写或总结，直接复制粘贴原文

【context要求-必填】
补充结论的背景信息，说明：
1. 这个结论是在讨论什么事情（业务背景、具体场景）
2. 它是如何被提出的（决策依据、讨论过程）
目的：让用户结合context和originalQuote，完整理解这个结论

【标签】
${tagList}

【会议内容】
${content}

【输出格式】
[{
  "content": "结论概括（具象，保留数据和领域）",
  "contentType": "类型",
  "speaker": "DJ",
  "originalQuote": "会议纪要的原文（逐字复制，80-150字）",
  "context": "讨论背景+决策过程的详细说明",
  "confidence": 0.85,
  "tags": ["标签name"],
  "isImportant": false
}]

⚠️ 再次强调：只提取DJ的发言，其他参会者一律不提取

只输出JSON数组：`;

    try {
      const response = await this.callClaudeAPI([
        { role: 'user', content: prompt }
      ], 4096); // Haiku 最大支持 4096 tokens

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
