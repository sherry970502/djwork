const agentService = require('../services/agentService');
const { MonthlyPlan, Thought, MeetingMinutes, Tag } = require('../models');

/**
 * Agent 控制器
 * 处理智能助手的对话和工具调用
 */
class AgentController {
  /**
   * 处理对话请求
   */
  async chat(req, res) {
    try {
      const { message, conversationHistory = [] } = req.body;

      if (!message) {
        return res.status(400).json({ error: '消息不能为空' });
      }

      // 调用 Agent 服务处理对话
      const result = await agentService.processMessage(message, conversationHistory);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Agent chat error:', error);
      res.status(500).json({
        success: false,
        error: error.message || '处理消息时发生错误'
      });
    }
  }

  /**
   * 执行工具调用
   */
  async executeTool(toolName, toolInput) {
    try {
      switch (toolName) {
        case 'get_monthly_plan':
          return await this.getMonthlyPlan(toolInput);

        case 'generate_work_review':
          return await this.generateWorkReview(toolInput);

        case 'extract_meeting_insights':
          return await this.extractMeetingInsights(toolInput);

        case 'search_knowledge':
          return await this.searchKnowledge(toolInput);

        default:
          throw new Error(`未知的工具: ${toolName}`);
      }
    } catch (error) {
      console.error(`Tool execution error (${toolName}):`, error);
      throw error;
    }
  }

  /**
   * 工具1: 获取月度计划
   */
  async getMonthlyPlan(input) {
    const { year, month } = input;

    // 默认当前月
    const now = new Date();
    const targetYear = year || now.getFullYear();
    const targetMonth = month || (now.getMonth() + 1);

    const plan = await MonthlyPlan.findOne({
      year: targetYear,
      month: targetMonth
    }).populate('tasks.relatedThoughts');

    if (!plan) {
      return {
        found: false,
        message: `未找到 ${targetYear}年${targetMonth}月 的计划`,
        year: targetYear,
        month: targetMonth
      };
    }

    // 计算统计数据
    const stats = {
      totalTasks: plan.tasks.length,
      completedTasks: plan.tasks.filter(t => t.status === 'completed').length,
      inProgressTasks: plan.tasks.filter(t => t.status === 'in_progress').length,
      pendingTasks: plan.tasks.filter(t => t.status === 'pending').length,
      progress: plan.progress || 0
    };

    return {
      found: true,
      year: plan.year,
      month: plan.month,
      title: plan.title,
      goals: plan.goals,
      stats,
      tasks: plan.tasks.map(task => ({
        id: task._id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        progress: task.progress,
        deadline: task.deadline,
        category: task.category
      })),
      summary: plan.summary,
      planId: plan._id
    };
  }

  /**
   * 工具2: 生成工作复盘
   */
  async generateWorkReview(input) {
    const { year, month, scope = 'month' } = input;

    const now = new Date();
    const targetYear = year || now.getFullYear();
    const targetMonth = month || (now.getMonth() + 1);

    // 获取月度计划
    const plan = await MonthlyPlan.findOne({
      year: targetYear,
      month: targetMonth
    });

    // 获取该月的重要灵感
    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59);

    const thoughts = await Thought.find({
      createdAt: {
        $gte: startDate,
        $lte: endDate
      },
      isImportant: true
    }).populate('tags').limit(10);

    // 获取该月的会议
    const meetings = await MeetingMinutes.find({
      meetingDate: {
        $gte: startDate,
        $lte: endDate
      }
    }).limit(10);

    return {
      period: {
        year: targetYear,
        month: targetMonth,
        scope
      },
      plan: plan ? {
        title: plan.title,
        goals: plan.goals,
        progress: plan.progress,
        totalTasks: plan.tasks.length,
        completedTasks: plan.tasks.filter(t => t.status === 'completed').length
      } : null,
      insights: {
        total: thoughts.length,
        items: thoughts.map(t => ({
          id: t._id,
          content: t.content,
          tags: t.tags.map(tag => tag.displayName),
          createdAt: t.createdAt
        }))
      },
      meetings: {
        total: meetings.length,
        items: meetings.map(m => ({
          id: m._id,
          title: m.title,
          date: m.meetingDate,
          thoughtCount: m.thoughtCount
        }))
      }
    };
  }

  /**
   * 工具3: 提取会议灵感
   */
  async extractMeetingInsights(input) {
    const { meetingId, limit = 10, tags } = input;

    let query = {};

    if (meetingId) {
      query.meetingId = meetingId;
    }

    if (tags && tags.length > 0) {
      query.tags = { $in: tags };
    }

    // 获取会议灵感
    const thoughts = await Thought.find(query)
      .populate('tags')
      .populate('meetingId', 'title meetingDate')
      .sort({ createdAt: -1 })
      .limit(limit);

    // 按标签分类
    const thoughtsByTag = {};
    thoughts.forEach(thought => {
      thought.tags.forEach(tag => {
        if (!thoughtsByTag[tag.name]) {
          thoughtsByTag[tag.name] = {
            tagName: tag.displayName,
            color: tag.color,
            thoughts: []
          };
        }
        thoughtsByTag[tag.name].thoughts.push({
          id: thought._id,
          content: thought.content,
          isImportant: thought.isImportant,
          createdAt: thought.createdAt,
          meeting: thought.meetingId ? {
            id: thought.meetingId._id,
            title: thought.meetingId.title,
            date: thought.meetingId.meetingDate
          } : null
        });
      });
    });

    return {
      total: thoughts.length,
      byTag: thoughtsByTag,
      recentThoughts: thoughts.slice(0, 5).map(t => ({
        id: t._id,
        content: t.content,
        tags: t.tags.map(tag => tag.displayName),
        isImportant: t.isImportant,
        meeting: t.meetingId ? {
          id: t.meetingId._id,
          title: t.meetingId.title
        } : null
      }))
    };
  }

  /**
   * 工具4: 知识查询
   */
  async searchKnowledge(input) {
    const { query, type = 'all', limit = 10 } = input;

    const results = {
      thoughts: [],
      meetings: [],
      tags: []
    };

    // 搜索灵感
    if (type === 'all' || type === 'thoughts') {
      const thoughts = await Thought.find({
        $or: [
          { content: { $regex: query, $options: 'i' } },
          { summary: { $regex: query, $options: 'i' } }
        ]
      })
        .populate('tags')
        .sort({ isImportant: -1, createdAt: -1 })
        .limit(limit);

      results.thoughts = thoughts.map(t => ({
        id: t._id,
        content: t.content,
        summary: t.summary,
        tags: t.tags.map(tag => tag.displayName),
        isImportant: t.isImportant,
        createdAt: t.createdAt
      }));
    }

    // 搜索会议
    if (type === 'all' || type === 'meetings') {
      const meetings = await MeetingMinutes.find({
        $or: [
          { title: { $regex: query, $options: 'i' } },
          { content: { $regex: query, $options: 'i' } }
        ]
      })
        .sort({ meetingDate: -1 })
        .limit(limit);

      results.meetings = meetings.map(m => ({
        id: m._id,
        title: m.title,
        date: m.meetingDate,
        thoughtCount: m.thoughtCount
      }));
    }

    // 搜索标签
    if (type === 'all' || type === 'tags') {
      const tags = await Tag.find({
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { displayName: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } }
        ]
      }).limit(5);

      results.tags = tags.map(t => ({
        id: t._id,
        name: t.name,
        displayName: t.displayName,
        description: t.description,
        thoughtCount: t.thoughtCount
      }));
    }

    return {
      query,
      results,
      totalFound: results.thoughts.length + results.meetings.length + results.tags.length
    };
  }
}

module.exports = new AgentController();
