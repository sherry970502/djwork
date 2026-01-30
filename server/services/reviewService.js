const Anthropic = require('@anthropic-ai/sdk');
const config = require('../config');

class ReviewService {
  constructor() {
    this.client = new Anthropic({
      apiKey: config.claudeApiKey
    });
    this.model = 'claude-3-haiku-20240307';
  }

  async callClaudeAPI(messages, maxTokens = 4096, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await this.client.messages.create({
          model: this.model,
          max_tokens: maxTokens,
          messages: messages
        });

        return response;
      } catch (error) {
        // 如果是过载错误，等待后重试
        if (error.status === 529 && attempt < retries) {
          console.log(`API 过载，等待 ${attempt * 5} 秒后重试 (${attempt}/${retries})...`);
          await new Promise(resolve => setTimeout(resolve, attempt * 5000));
          continue;
        }

        if (attempt === retries) {
          throw new Error(`API call failed: ${error.message}`);
        }

        // 其他错误也重试
        console.log(`API 调用失败，重试 (${attempt}/${retries})...`);
        await new Promise(resolve => setTimeout(resolve, attempt * 3000));
      }
    }
  }

  parseJsonResponse(text) {
    let trimmed = text.trim();
    trimmed = trimmed.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
    trimmed = trimmed.trim();

    try {
      return JSON.parse(trimmed);
    } catch (e) {
      // 尝试提取 JSON
      const start = trimmed.indexOf('{');
      const end = trimmed.lastIndexOf('}');
      if (start !== -1 && end > start) {
        let jsonStr = trimmed.substring(start, end + 1);
        jsonStr = jsonStr.replace(/[\x00-\x1F\x7F]/g, ' ')
                        .replace(/\r?\n/g, ' ')
                        .replace(/\s+/g, ' ')
                        .replace(/,\s*}/g, '}')
                        .replace(/,\s*]/g, ']');
        return JSON.parse(jsonStr);
      }
      throw e;
    }
  }

  /**
   * 复盘单个计划项目
   */
  async reviewPlanItem(item, meetings, thoughts) {
    console.log(`Reviewing plan item: ${item.title}`);

    // 准备会议纪要上下文
    const meetingsContext = meetings.map(m => {
      const thoughtsText = m.thoughts?.map(t => t.content).join('\n') || '';
      return `【${m.title}】(${new Date(m.meetingDate).toLocaleDateString('zh-CN')})
内容摘要: ${m.content?.substring(0, 500) || ''}
提取的思考: ${thoughtsText.substring(0, 500)}`;
    }).join('\n\n');

    // 准备灵感/思考上下文
    const thoughtsContext = thoughts.map(t => {
      const tags = t.tags?.map(tag => tag.displayName).join(', ') || '';
      return `- ${t.content} [标签: ${tags}]`;
    }).join('\n');

    // 获取迁移信息
    const migrationInfo = item.migration ?
      `\n版本: v${item.migration.version}.0\n从 ${item.migration.fromMonth} 迁移而来\n上月情况: ${item.migration.inheritedContext || '无'}` : '';

    const prompt = `你是一个严格的文本匹配和复盘分析系统。

## 待复盘的计划项目
标题: ${item.title}
描述: ${item.description || '无'}
类型: ${item.sourceType === 'task' ? '组织事务' : item.sourceType === 'migrated' ? '从上月迁移' : '推荐议题'}
优先级: ${item.priority}${migrationInfo}

## 本月会议纪要
${meetingsContext || '【无会议纪要】'}

## 本月灵感与思考
${thoughtsContext || '【无灵感记录】'}

## 分析规则（必须严格遵守）

### 规则1：提取议题核心关键词
从计划项目标题和描述中提取 2-3 个**专有名词或核心概念**。
- "Open-Q产品设计突破" → 关键词：Open-Q、界面改版、设计外包
- "AI教育产品国际化" → 关键词：国际化、东南亚、海外市场
- "AI虚拟教师" → 关键词：虚拟教师、AI答疑、立项
注意：不要用"AI"、"产品"、"设计"这种通用词作为关键词。

### 规则2：严格的字面匹配
判断会议是否相关的唯一标准：**会议内容中是否字面出现了关键词**。
- ❌ 会议讨论"AI表演"，计划是"Open-Q设计" → 不相关（没提到Open-Q）
- ❌ 会议讨论"美术史课件"，计划是"国际化战略" → 不相关（没提到国际化）
- ❌ 会议讨论"游戏AI"，计划是"教育产品" → 不相关（领域不同）
- ✅ 只有字面出现"Open-Q"或"界面改版"才算相关

### 规则3：没有匹配就返回空数组
如果没有任何会议字面包含关键词：
- meetingOutcomes = []（空数组）
- relatedThoughts = []（空数组）
- completionStatus = "not_started"

### 规则4：这是正常情况
大多数具体议题在一个月内可能根本没被安排讨论，返回 not_started + 空数组是**完全正常的**。
不要为了"有内容"而硬凑不相关的会议。

## 输出格式（JSON）
{
  "meetingOutcomes": [],  // 只收录字面匹配的会议，没有就返回 []
  "relatedThoughts": [],  // 只收录字面匹配的灵感，没有就返回 []
  "completionStatus": "not_started",  // 如果没有匹配的会议
  "completionReason": "本月未安排讨论此议题，会议纪要中未出现相关关键词",
  "gaps": [{"dimension": "未讨论", "description": "本月没有任何会议讨论此议题", "suggestion": "建议下月安排专门会议讨论"}],
  "actionRecommendations": [{"action": "carry_over", "reason": "本月未讨论，需迁移到下月", "priority": "high"}],
  "nextMonthFocus": "下月安排专门会议讨论此议题",
  "summary": "本月未安排讨论此议题，建议下月专门安排会议讨论"
}

如果确实有字面匹配的会议，则填写相应内容：
{
  "meetingOutcomes": [{"meetingTitle": "xxx", "relatedContent": "具体讨论内容", "conclusions": ["结论1"]}],
  "relatedThoughts": [{"content": "xxx", "relevance": "xxx"}],
  "completionStatus": "partial 或 completed",
  "completionReason": "解释为什么是partial/completed",
  ...
}

只输出 JSON，不要有其他内容。`;

    try {
      const response = await this.callClaudeAPI([{ role: 'user', content: prompt }], 4096);
      const result = this.parseJsonResponse(response.content[0].text);

      return {
        ...result,
        reviewedAt: new Date()
      };
    } catch (error) {
      console.error('Review failed:', error);
      return {
        meetingOutcomes: [],
        relatedThoughts: [],
        completionStatus: 'unclear',
        completionReason: `复盘分析失败: ${error.message}`,
        gaps: [],
        summary: '复盘分析失败，请重试',
        reviewedAt: new Date()
      };
    }
  }

  /**
   * 复盘单个计划项目（改进版 - 支持用户选择会议）
   */
  async reviewPlanItemWithContext(item, meetings, thoughts, userSelected = false) {
    console.log(`Reviewing plan item: ${item.title} (用户选择模式: ${userSelected})`);

    // 准备会议纪要上下文（如果是用户选择的，提供更详细的内容）
    const meetingsContext = meetings.map(m => {
      const thoughtsText = m.thoughts?.map(t => {
        const tags = t.tags?.map(tag => tag.displayName || tag.name).join(', ') || '';
        return `  - ${t.content} [标签: ${tags}]`;
      }).join('\n') || '';

      // 如果是用户选择的会议，提供完整内容
      const contentPreview = userSelected
        ? (m.content || '无内容')
        : (m.content?.substring(0, 800) || '无内容');

      return `【${m.title}】(${new Date(m.meetingDate).toLocaleDateString('zh-CN')})
会议内容:
${contentPreview}

提取的灵感思考:
${thoughtsText || '  (无)'}`;
    }).join('\n\n---\n\n');

    // 准备灵感/思考上下文
    const thoughtsContext = thoughts.slice(0, 30).map(t => {
      const tags = t.tags?.map(tag => tag.displayName || tag.name).join(', ') || '';
      return `- ${t.content} [标签: ${tags}]${t.isImportant ? ' ⭐重要' : ''}`;
    }).join('\n');

    // 获取迁移信息
    const migrationInfo = item.migration ?
      `\n版本: v${item.migration.version}.0\n从 ${item.migration.fromMonth} 迁移而来\n上月情况: ${item.migration.inheritedContext || '无'}` : '';

    const selectionNote = userSelected
      ? `\n\n【重要】用户已明确选择了 ${meetings.length} 个相关会议，请仔细分析这些会议中与计划项目相关的讨论内容。`
      : '';

    const prompt = `你是一个月度工作复盘助手。请根据会议纪要和灵感记录，评估计划项目的完成情况。

## 待复盘的计划项目
标题: ${item.title}
描述: ${item.description || '无详细描述'}
类型: ${item.sourceType === 'task' ? '组织事务' : item.sourceType === 'migrated' ? '从上月迁移' : '推荐议题'}
优先级: ${item.priority}${migrationInfo}${selectionNote}

## 本月会议纪要 (共 ${meetings.length} 个)
${meetingsContext || '【本月无会议纪要】'}

## 本月灵感与思考 (共 ${thoughts.length} 条)
${thoughtsContext || '【本月无灵感记录】'}

## 分析任务

请分析上述会议和灵感中与计划项目的相关性，评估完成情况：

1. **相关会议分析**: 从会议纪要中找出与计划项目相关的讨论，提取关键结论
2. **相关灵感分析**: 从灵感记录中找出与计划项目相关的思考
3. **完成度评估**:
   - completed: 有明确的讨论和结论，取得实质性进展
   - partial: 有相关讨论或思考，但尚未取得完整成果
   - in_progress: 有初步讨论或思考，正在推进中
   - not_started: 本月没有任何相关讨论或思考
4. **差距分析**: 指出还缺少什么
5. **下月建议**: 给出具体的后续行动建议

## 输出格式（JSON）
{
  "meetingOutcomes": [
    {
      "meetingTitle": "会议标题",
      "relatedContent": "与计划项目相关的具体讨论内容摘要",
      "conclusions": ["结论1", "结论2"]
    }
  ],
  "relatedThoughts": [
    {
      "content": "相关灵感内容",
      "relevance": "与计划项目的关联说明"
    }
  ],
  "completionStatus": "completed|partial|in_progress|not_started",
  "completionReason": "完成度评估的依据说明",
  "progressHighlights": ["进展亮点1", "进展亮点2"],
  "gaps": [
    {
      "dimension": "缺漏维度",
      "description": "具体缺少什么",
      "suggestion": "建议如何补充"
    }
  ],
  "actionRecommendations": [
    {
      "action": "carry_over|close|split|merge",
      "reason": "建议原因",
      "priority": "high|medium|low"
    }
  ],
  "nextMonthFocus": "下月应该重点关注的方向",
  "summary": "100字左右的复盘总结"
}

只输出 JSON，不要有其他内容。`;

    try {
      const response = await this.callClaudeAPI([{ role: 'user', content: prompt }], 4096);
      const result = this.parseJsonResponse(response.content[0].text);

      return {
        ...result,
        userSelectedMeetings: userSelected,
        analyzedMeetingCount: meetings.length,
        reviewedAt: new Date()
      };
    } catch (error) {
      console.error('Review failed:', error);
      return {
        meetingOutcomes: [],
        relatedThoughts: [],
        completionStatus: 'unclear',
        completionReason: `复盘分析失败: ${error.message}`,
        gaps: [],
        summary: '复盘分析失败，请重试',
        reviewedAt: new Date()
      };
    }
  }

  /**
   * 生成月度总结
   */
  async generateMonthlySummary(plan, meetings, thoughts) {
    console.log(`Generating monthly summary for: ${plan.month}`);

    // 准备项目复盘结果
    const itemsReview = plan.items.map(item => {
      const review = item.review || {};
      return `【${item.title}】
类型: ${item.sourceType === 'task' ? '组织事务' : '推荐议题'}
状态: ${item.planStatus}
完成度: ${review.completionStatus || '未复盘'}
评价: ${review.summary || '无'}
缺漏: ${review.gaps?.map(g => g.dimension).join(', ') || '无'}`;
    }).join('\n\n');

    const prompt = `你是一位资深的月度复盘专家。请对以下月度计划进行整体总结。

## 月份: ${plan.month}

## 各项目复盘结果
${itemsReview}

## 本月会议数量: ${meetings.length}
## 本月灵感数量: ${thoughts.length}

## 总结任务

请生成月度总结，包括:
1. 整体完成情况评估
2. 主要成果亮点 (3-5 条)
3. 待改进领域 (2-3 条)

## 输出格式 (JSON)
{
  "overallAssessment": "整体评价，100-150字",
  "keyAchievements": ["成果1", "成果2", "成果3"],
  "areasForImprovement": ["改进点1", "改进点2"]
}

只输出 JSON，不要有其他内容。`;

    try {
      const response = await this.callClaudeAPI([{ role: 'user', content: prompt }], 2048);
      const result = this.parseJsonResponse(response.content[0].text);

      return {
        totalItems: plan.items.length,
        completedItems: plan.items.filter(i => i.review?.completionStatus === 'completed').length,
        partialItems: plan.items.filter(i => i.review?.completionStatus === 'partial').length,
        ...result
      };
    } catch (error) {
      console.error('Generate summary failed:', error);
      return {
        totalItems: plan.items.length,
        completedItems: 0,
        partialItems: 0,
        overallAssessment: '月度总结生成失败',
        keyAchievements: [],
        areasForImprovement: []
      };
    }
  }
}

module.exports = new ReviewService();
