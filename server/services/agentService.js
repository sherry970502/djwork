const axios = require('axios');
const config = require('../config');
const { MonthlyPlan, Thought, MeetingMinutes, Tag, OrganizationTask } = require('../models');

/**
 * 智能工作助手服务
 * 提供综合分析和智能建议，而不仅仅是数据查询
 */
class AgentService {
  constructor() {
    this.model = 'claude-3-haiku-20240307';
    this.apiKey = config.claudeApiKey;
    this.apiUrl = 'https://api.anthropic.com/v1/messages';

    this.systemPrompt = `你是 DJ 的高级智能工作助手。你的职责不仅是回答问题，更重要的是：

1. **深入理解场景**：理解 DJ 当前的工作场景和真实需求
2. **综合分析数据**：整合多个数据源，发现问题和机会
3. **主动提供洞察**：不只是统计数据，要给出有价值的分析和建议
4. **提供可操作建议**：给出具体的行动建议和跳转链接

你可以访问的数据：
- 灵感知识库（会议纪要提取的战略思考）
- 组织事务池（待分析和决策的组织事务）
- 月度计划（当前工作计划和进度）
- 会议记录和标签分类

交互原则：
- 像真实助理一样思考和沟通
- 主动发现问题，不要等用户问
- 给出具体可操作的建议
- 解释你的推理过程

当前日期：${new Date().toLocaleDateString('zh-CN')}`;
  }

  /**
   * 调用 Claude API
   */
  async callClaude(messages, maxTokens = 4096) {
    try {
      const response = await axios.post(
        this.apiUrl,
        {
          model: this.model,
          max_tokens: maxTokens,
          messages: messages
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Claude API 调用失败:', error.response?.data || error.message);
      throw new Error(`API 调用失败: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * 处理用户消息 - 核心逻辑
   */
  async processMessage(userMessage, conversationHistory = []) {
    try {
      console.log('用户消息:', userMessage);

      // 第一步：识别场景和意图
      const scenario = await this.analyzeScenario(userMessage);
      console.log('识别的场景:', JSON.stringify(scenario, null, 2));

      // 第二步：收集相关数据
      const contextData = await this.gatherContextData(scenario);
      console.log('收集的数据:', {
        thoughts: contextData.thoughts?.length || 0,
        tasks: contextData.tasks?.length || 0,
        meetings: contextData.meetings?.length || 0,
        plan: contextData.plan ? 'yes' : 'no'
      });

      // 第三步：AI 综合分析和建议生成
      const analysis = await this.generateIntelligentResponse(
        userMessage,
        scenario,
        contextData,
        conversationHistory
      );

      // 第四步：构建结构化响应（包含可操作的内容块）
      const blocks = this.buildContentBlocks(scenario, contextData, analysis);

      return {
        reply: analysis.response,
        blocks: blocks, // 新增：结构化内容块
        toolCalls: [{
          toolName: 'intelligent_analysis',
          result: {
            scenario: scenario.type,
            dataUsed: {
              thoughts: contextData.thoughts?.length || 0,
              tasks: contextData.tasks?.length || 0,
              meetings: contextData.meetings?.length || 0
            },
            insights: analysis.insights,
            actions: analysis.actions
          }
        }],
        usage: { input_tokens: 0, output_tokens: 0 }
      };
    } catch (error) {
      console.error('Agent service error:', error);
      throw new Error(`AI 处理失败: ${error.message}`);
    }
  }

  /**
   * 构建结构化内容块
   */
  buildContentBlocks(scenario, contextData, analysis) {
    const blocks = [];

    // 根据场景类型，返回不同的内容块
    switch (scenario.type) {
      case 'decision_making':
      case 'meeting_prep':
        // 模块1：待分析的事务（需要前置AI分析）
        if (contextData.tasks && contextData.tasks.length > 0) {
          const needsAnalysisTasks = contextData.tasks.filter(t => t.needsAnalysis || !t.hasAnalysis);

          if (needsAnalysisTasks.length > 0) {
            blocks.push({
              type: 'task_list',
              title: '📋 待分析事务',
              description: '以下事务需要进行前置AI分析，帮助决策是否执行及如何执行。',
              items: needsAnalysisTasks.slice(0, 10).map(task => {
              // 如果是 task 类型，使用 organizationTask 的信息
              const orgTask = task.organizationTask;
              const taskId = orgTask ? orgTask._id : task._id;
              const taskTitle = task.title;
              const taskStatus = task.planStatus;

              return {
                id: taskId,
                title: taskTitle,
                priority: task.priority,
                status: taskStatus,
                category: task.category || task.project,
                createdAt: task.addedAt,
                needsAnalysis: task.needsAnalysis,
                hasAnalysis: task.hasAnalysis,
                isAnalyzing: task.isAnalyzing,
                hasReview: task.hasReview,
                actions: (() => {
                  // 如果有关联的组织事务
                  if (orgTask) {
                    // 已有分析结果 - 显示查看分析，跳转到组织事务池详情页
                    if (task.hasAnalysis) {
                      return [{
                        type: 'view',
                        label: '查看分析',
                        link: `/tasks/${taskId}` // 修正：直接跳转到详情页
                      }];
                    }
                    // 正在分析中 - 显示分析中状态
                    else if (task.isAnalyzing) {
                      return [{
                        type: 'view',
                        label: '分析中...',
                        link: `/tasks/${taskId}`,
                        disabled: true
                      }];
                    }
                    // 待分析 - 显示 AI 分析按钮
                    else {
                      return [{
                        type: 'analyze',
                        label: 'AI 分析',
                        endpoint: `/api/tasks/${taskId}/analyze`
                      }];
                    }
                  }
                  // 非组织事务类型的项目 - 跳转到月度计划
                  else {
                    return [{
                      type: 'view',
                      label: '查看月度计划',
                      link: '/monthly-plan'
                    }];
                  }
                })()
              };
            })
          });
          }

          // 模块2：待复盘事务（已进行或完成但未复盘的事项）
          const needsReviewTasks = contextData.tasks.filter(t => t.needsReview);
          if (needsReviewTasks.length > 0) {
            blocks.push({
              type: 'task_list',
              title: '📝 待复盘事务',
              description: '以下事务已进行或完成，需要进行月底复盘，总结经验和成果。',
              items: needsReviewTasks.slice(0, 10).map(task => {
                const orgTask = task.organizationTask;
                const taskId = orgTask ? orgTask._id : task._id;
                const taskTitle = task.title;

                return {
                  id: taskId,
                  title: taskTitle,
                  priority: task.priority,
                  status: task.planStatus,
                  category: task.category || task.project,
                  createdAt: task.addedAt,
                  actions: [{
                    type: 'review',
                    label: '开始复盘',
                    endpoint: `/api/monthly-plan/review/${task._id}` // 复盘接口，后续实现
                  }]
                };
              })
            });
          }
        }
        break;

      case 'inspiration_review':
        // 展示重要灵感列表
        if (contextData.thoughts && contextData.thoughts.length > 0) {
          const importantThoughts = contextData.thoughts.filter(t => t.isImportant);
          if (importantThoughts.length > 0) {
            blocks.push({
              type: 'thought_list',
              title: '重要灵感',
              description: '以下是近期标记为重要的战略思考',
              items: importantThoughts.slice(0, 10).map(thought => ({
                id: thought._id,
                content: thought.content,
                tags: thought.tags.map(t => ({ name: t.displayName, color: t.color })),
                meeting: thought.meetingMinutesId ? {
                  title: thought.meetingMinutesId.title,
                  date: thought.meetingMinutesId.meetingDate
                } : null,
                createdAt: thought.createdAt,
                actions: [
                  {
                    type: 'view',
                    label: '查看详情',
                    link: `/thoughts?thoughtId=${thought._id}`
                  }
                ]
              }))
            });
          }
        }
        break;

      case 'status_check':
        // 展示工作状态概览
        if (contextData.plan) {
          const progress = this.calculatePlanProgress(contextData.plan);
          blocks.push({
            type: 'status_overview',
            title: '工作状态概览',
            data: {
              plan: {
                progress: progress?.percentage || 0,
                total: progress?.total || 0,
                completed: progress?.completed || 0,
                inProgress: progress?.inProgress || 0,
                pending: progress?.pending || 0
              },
              tasks: {
                pending: contextData.stats.pendingTasks || 0,
                total: contextData.tasks?.length || 0
              },
              thoughts: {
                important: contextData.stats.importantThoughts || 0,
                total: contextData.thoughts?.length || 0
              }
            },
            actions: [
              {
                type: 'view',
                label: '查看月度计划',
                link: '/monthly-plan'
              },
              {
                type: 'view',
                label: '查看组织事务',
                link: '/tasks'
              }
            ]
          });
        }
        break;
    }

    return blocks;
  }

  /**
   * 分析用户场景
   */
  async analyzeScenario(userMessage) {
    const now = new Date();
    const prompt = `分析用户的场景和真实需求。

当前时间：${now.toLocaleString('zh-CN')}
用户消息：${userMessage}

常见场景：
1. meeting_prep - 会议准备（用户要开会，需要议题、背景资料）
2. work_review - 工作复盘（总结工作、查看进展）
3. decision_making - 决策支持（需要了解待决策事项）
4. knowledge_search - 知识查询（搜索特定主题的内容）
5. status_check - 状态检查（查看当前工作状态、进度）
6. inspiration_review - 灵感回顾（查看最近的重要思考）

请返回 JSON：
{
  "type": "场景类型",
  "intent": "用户真实意图的详细描述",
  "keywords": ["关键词1", "关键词2"],
  "timeRange": "recent|week|month|all",
  "urgency": "high|medium|low"
}

只返回 JSON，不要其他内容。`;

    try {
      const response = await this.callClaude([{ role: 'user', content: prompt }], 1024);
      const text = response.content[0].text.trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return { type: 'general', intent: userMessage, keywords: [], timeRange: 'recent', urgency: 'medium' };
    } catch (error) {
      console.error('Scenario analysis error:', error);
      return { type: 'general', intent: userMessage, keywords: [], timeRange: 'recent', urgency: 'medium' };
    }
  }

  /**
   * 收集上下文数据
   */
  async gatherContextData(scenario) {
    const now = new Date();
    const contextData = {};

    // 根据场景和时间范围确定查询时间
    let startDate;
    switch (scenario.timeRange) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'recent':
      default:
        startDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000); // 2周
        break;
    }

    // 第一步：获取本月月度计划
    const plan = await MonthlyPlan.findOne({
      month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    }).lean();

    // 第二步：从月度计划中提取待处理的任务ID
    let taskIds = [];
    let planTasks = [];
    if (plan && plan.items) {
      // 筛选出待处理和进行中的计划项
      const activeItems = plan.items.filter(item =>
        ['pending', 'in_progress'].includes(item.planStatus)
      );

      // 获取关联的组织事务ID
      taskIds = activeItems
        .filter(item => item.sourceType === 'task' && item.referenceId)
        .map(item => item.referenceId);

      // 同时保存计划项信息（用于非 task 类型的项目）
      planTasks = activeItems;
    }

    // 第三步：并行获取其他数据源
    const [thoughts, tasks, meetings, tags] = await Promise.all([
      // 获取灵感
      Thought.find({
        createdAt: { $gte: startDate },
        isMerged: false
      })
        .populate('tags')
        .populate('meetingMinutesId', 'title meetingDate')
        .sort({ isImportant: -1, createdAt: -1 })
        .limit(20)
        .lean(),

      // 从月度计划中获取关联的组织事务（优先处理月度计划中的任务）
      taskIds.length > 0
        ? OrganizationTask.find({
            _id: { $in: taskIds }
          })
            .sort({ priority: -1 })
            .lean()
        : [], // 如果月度计划为空，返回空数组

      // 获取会议
      MeetingMinutes.find({
        meetingDate: { $gte: startDate }
      })
        .sort({ meetingDate: -1 })
        .limit(10)
        .lean(),

      // 获取标签统计
      Tag.find()
        .sort({ thoughtCount: -1 })
        .limit(10)
        .lean()
    ]);

    // 第四步：结合月度计划项和组织事务，构建完整的任务列表
    // 将计划项和实际任务关联起来，加入 review 信息
    const enrichedTasks = planTasks.map(planItem => {
      if (planItem.sourceType === 'task' && planItem.referenceId) {
        // 查找对应的 OrganizationTask
        const orgTask = tasks.find(t => t._id.toString() === planItem.referenceId.toString());

        // 判断是否已有AI分析：主要看 status 状态
        const hasAnalysis = orgTask && (
          orgTask.status === 'completed' ||
          (orgTask.analysis && orgTask.analysis.categoryPrediction) // 检查是否有分析内容
        );
        const isAnalyzing = orgTask && orgTask.status === 'analyzing';
        const needsAnalysis = orgTask && orgTask.status === 'pending' && !hasAnalysis;

        return {
          ...planItem,
          organizationTask: orgTask, // 关联的完整组织事务信息
          needsAnalysis, // 需要前置分析
          hasAnalysis, // 已有前置分析
          isAnalyzing, // 分析中
          hasReview: !!planItem.review, // 是否已有月底复盘
          needsReview: !planItem.review && ['in_progress', 'completed'].includes(planItem.planStatus) // 需要复盘
        };
      }
      return {
        ...planItem,
        needsAnalysis: false,
        hasAnalysis: false,
        isAnalyzing: false,
        hasReview: !!planItem.review
      };
    });

    contextData.thoughts = thoughts;
    contextData.tasks = enrichedTasks; // 使用增强后的任务列表
    contextData.rawTasks = tasks; // 保留原始组织事务数据
    contextData.meetings = meetings;
    contextData.plan = plan;
    contextData.tags = tags;

    // 添加统计信息
    contextData.stats = {
      importantThoughts: thoughts.filter(t => t.isImportant).length,
      pendingTasks: enrichedTasks.filter(t => t.needsAnalysis).length,
      tasksWithReview: enrichedTasks.filter(t => t.hasReview).length,
      recentMeetings: meetings.length,
      planProgress: plan ? this.calculatePlanProgress(plan) : null
    };

    return contextData;
  }

  /**
   * 生成智能响应
   */
  async generateIntelligentResponse(userMessage, scenario, contextData, conversationHistory) {
    // 构建丰富的上下文提示
    const contextPrompt = this.buildContextPrompt(scenario, contextData);

    const analysisPrompt = `作为 DJ 的高级工作助手，基于以下信息提供深入的分析和建议。

用户场景：${scenario.type}
用户意图：${scenario.intent}
用户消息：${userMessage}

${contextPrompt}

请提供：
1. **综合分析**：基于多个数据源的深入分析，不只是数据统计
2. **关键发现**：主动发现的问题、机会或值得关注的点
3. **具体建议**：可操作的行动建议，包括：
   - 优先级排序
   - 具体操作步骤
   - 跳转链接建议（格式：[查看详情](/path)）
4. **解释推理**：说明为什么这样建议

回复格式：
---
[综合分析段落]

**关键发现：**
- 发现1
- 发现2

**建议：**
1. [具体建议1，包含理由]
   👉 [操作链接](/path)
2. [具体建议2]

**补充说明：**
[进一步的洞察和提醒]
---

要求：
- 像真实助理一样思考和表达
- 主动发现问题，不要只回答表面问题
- 提供有价值的洞察，不是简单重复数据
- 建议要具体可操作，不要空泛`;

    try {
      const messages = [{ role: 'user', content: analysisPrompt }];
      const response = await this.callClaude(messages, 4096);
      const responseText = response.content[0].text;

      // 解析响应，提取 insights 和 actions
      const insights = this.extractInsights(responseText);
      const actions = this.extractActions(responseText);

      return {
        response: responseText,
        insights,
        actions
      };
    } catch (error) {
      console.error('Response generation error:', error);
      throw error;
    }
  }

  /**
   * 构建上下文提示
   */
  buildContextPrompt(scenario, contextData) {
    let prompt = '## 当前数据概况\n\n';

    // 灵感知识库
    if (contextData.thoughts && contextData.thoughts.length > 0) {
      prompt += `### 灵感知识库 (${contextData.thoughts.length}条)\n`;
      prompt += `- 重要灵感：${contextData.stats.importantThoughts} 条\n`;

      const tagDistribution = {};
      contextData.thoughts.forEach(t => {
        t.tags.forEach(tag => {
          tagDistribution[tag.displayName] = (tagDistribution[tag.displayName] || 0) + 1;
        });
      });
      const topTags = Object.entries(tagDistribution)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([tag, count]) => `${tag}(${count})`)
        .join('、');
      prompt += `- 主要标签分布：${topTags}\n`;

      prompt += `- 最近5条重要灵感：\n`;
      contextData.thoughts.filter(t => t.isImportant).slice(0, 5).forEach((t, i) => {
        prompt += `  ${i + 1}. ${t.content.substring(0, 80)}...\n`;
      });
      prompt += '\n';
    }

    // 本月计划事务（优先关注）
    if (contextData.tasks && contextData.tasks.length > 0) {
      prompt += `### 本月计划事务 (${contextData.tasks.length}个)\n`;
      prompt += `**重要说明：这些是从本月度计划中筛选的待处理事务，是当月工作的重点。**\n`;
      prompt += `- 需要AI分析：${contextData.stats.pendingTasks} 个\n`;
      prompt += `- 已有复盘：${contextData.stats.tasksWithReview} 个\n`;
      prompt += `- 高优先级：${contextData.tasks.filter(t => t.priority === 'high').length} 个\n`;
      prompt += `- 计划事务列表：\n`;
      contextData.tasks.slice(0, 8).forEach((task, i) => {
        const statusTag = task.needsAnalysis ? '[待分析]' : task.hasReview ? '[已复盘]' : '[处理中]';
        const priorityTag = task.priority === 'high' ? '[高优先级]' : '';
        prompt += `  ${i + 1}. ${statusTag} ${priorityTag} ${task.title}\n`;
        // 如果有关联的灵感，提示
        if (task.review && task.review.relatedThoughts && task.review.relatedThoughts.length > 0) {
          prompt += `     └─ 关联灵感：${task.review.relatedThoughts.length}条\n`;
        }
      });
      prompt += '\n';
    }

    // 月度计划
    if (contextData.plan) {
      const progress = contextData.stats.planProgress;
      prompt += `### 月度计划\n`;
      prompt += `- 总计划项：${contextData.plan.items?.length || 0} 个\n`;
      if (progress) {
        prompt += `- 完成进度：${progress.completed}/${progress.total} (${progress.percentage}%)\n`;
        prompt += `- 进行中：${progress.inProgress} 个\n`;
        prompt += `- 待开始：${progress.pending} 个\n`;
      }
      prompt += '\n';
    }

    // 会议记录
    if (contextData.meetings && contextData.meetings.length > 0) {
      prompt += `### 近期会议 (${contextData.meetings.length}场)\n`;
      contextData.meetings.slice(0, 5).forEach((m, i) => {
        const date = new Date(m.meetingDate).toLocaleDateString('zh-CN');
        prompt += `  ${i + 1}. ${date} - ${m.title} (${m.thoughtCount || 0}条思考)\n`;
      });
      prompt += '\n';
    }

    return prompt;
  }

  /**
   * 提取洞察
   */
  extractInsights(responseText) {
    const insights = [];
    const lines = responseText.split('\n');
    let inInsights = false;

    for (const line of lines) {
      if (line.includes('关键发现') || line.includes('**关键发现')) {
        inInsights = true;
        continue;
      }
      if (inInsights && line.trim().startsWith('-')) {
        insights.push(line.trim().substring(1).trim());
      }
      if (inInsights && (line.includes('**建议') || line.includes('建议：'))) {
        break;
      }
    }

    return insights;
  }

  /**
   * 提取操作建议
   */
  extractActions(responseText) {
    const actions = [];
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;

    while ((match = linkRegex.exec(responseText)) !== null) {
      actions.push({
        label: match[1],
        link: match[2]
      });
    }

    return actions;
  }

  /**
   * 计算计划进度
   */
  calculatePlanProgress(plan) {
    if (!plan.items || plan.items.length === 0) {
      return null;
    }

    const total = plan.items.length;
    const completed = plan.items.filter(i => i.planStatus === 'completed').length;
    const inProgress = plan.items.filter(i => i.planStatus === 'in_progress').length;
    const pending = plan.items.filter(i => i.planStatus === 'pending').length;

    return {
      total,
      completed,
      inProgress,
      pending,
      percentage: Math.round((completed / total) * 100)
    };
  }

  /**
   * 获取快捷场景
   */
  getQuickScenarios() {
    return [
      {
        id: 'meeting_prep',
        icon: '💡',
        title: '会议准备',
        prompt: '我现在要开会了，帮我准备相关的议题和背景资料'
      },
      {
        id: 'status_check',
        icon: '📊',
        title: '工作状态检查',
        prompt: '帮我看看当前的工作状态，有什么需要注意的吗？'
      },
      {
        id: 'decision_support',
        icon: '🎯',
        title: '决策支持',
        prompt: '我需要做一些决策，有哪些待处理的组织事务？'
      },
      {
        id: 'inspiration_review',
        icon: '🔍',
        title: '灵感回顾',
        prompt: '最近有哪些重要的灵感和思考值得关注？'
      }
    ];
  }
}

module.exports = new AgentService();
