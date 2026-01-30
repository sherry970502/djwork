const { OrganizationTask, Thought } = require('../models');
const strategicAdvisorService = require('../services/strategicAdvisorService');
const Anthropic = require('@anthropic-ai/sdk');
const config = require('../config');

// DJ 角色映射
const DJ_ROLES = {
  manager: { label: '管理者', description: '去做决策' },
  lead_designer: { label: '主设计师', description: '去做设计' },
  mentor: { label: '指导设计师', description: '提供辅导或培训' },
  expert: { label: '专家', description: '进行验收' }
};

// AI 分析 DJ 角色
async function analyzeDJRole(title, description) {
  try {
    const client = new Anthropic({ apiKey: config.claudeApiKey });

    const prompt = `你是一个组织管理分析助手。请根据以下事务的标题和描述，判断 DJ（董事长）在这件事情上应该扮演什么角色。

## 事务信息
标题：${title}
描述：${description}

## 可选角色（只能选择一个）
1. manager（管理者）：需要 DJ 做出关键决策、拍板、审批的事务
2. lead_designer（主设计师）：需要 DJ 亲自主导设计、规划方案的事务
3. mentor（指导设计师）：需要 DJ 提供指导、辅导、培训，但不需要亲自执行的事务
4. expert（专家）：需要 DJ 进行最终验收、评审、把关质量的事务

## 判断原则
- 如果是战略决策、资源分配、重大方向选择 → manager
- 如果是核心产品/业务的设计、创新方案的制定 → lead_designer
- 如果是团队能力提升、方法论传授、过程中的指导 → mentor
- 如果是成果验收、质量把关、最终评审 → expert

## 输出格式（JSON）
{
  "role": "角色英文名（manager/lead_designer/mentor/expert）",
  "reason": "简短说明为什么推荐这个角色（20字以内）"
}

只输出JSON，不要有其他内容。`;

    const response = await client.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }]
    });

    const responseText = response.content[0].text.trim();
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      const role = result.role || 'unknown';
      const roleInfo = DJ_ROLES[role];

      return {
        djRole: role,
        djRoleLabel: roleInfo ? roleInfo.label : '未知',
        djRoleReason: result.reason || ''
      };
    }
  } catch (error) {
    console.error('DJ role analysis error:', error);
  }

  return {
    djRole: 'unknown',
    djRoleLabel: '未知',
    djRoleReason: ''
  };
}

// Get all tasks
exports.getTasks = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, category, priority } = req.query;
    const query = {};

    if (status) query.status = status;
    if (category) query.category = category;
    if (priority) query.priority = priority;

    const tasks = await OrganizationTask.find(query)
      .sort({ priority: 1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await OrganizationTask.countDocuments(query);

    res.json({
      success: true,
      data: tasks,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get task by ID
exports.getTask = async (req, res) => {
  try {
    const task = await OrganizationTask.findById(req.params.id)
      .populate('analysis.relatedThoughts');

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    res.json({
      success: true,
      data: task
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Create task
exports.createTask = async (req, res) => {
  try {
    const { title, description, source, priority, dueDate } = req.body;

    if (!title || !description) {
      return res.status(400).json({
        success: false,
        message: 'Title and description are required'
      });
    }

    const task = new OrganizationTask({
      title,
      description,
      source: source || '组织事务部',
      priority: priority || 'medium',
      dueDate: dueDate ? new Date(dueDate) : null,
      status: 'pending'
    });

    await task.save();

    // 异步分析 DJ 角色（不阻塞响应）
    analyzeDJRoleAsync(task._id).catch(err => {
      console.error('DJ role analysis error:', err);
    });

    res.status(201).json({
      success: true,
      data: task
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// 异步分析 DJ 角色
async function analyzeDJRoleAsync(taskId) {
  const task = await OrganizationTask.findById(taskId);
  if (!task) return;

  const roleResult = await analyzeDJRole(task.title, task.description);

  task.djRole = roleResult.djRole;
  task.djRoleLabel = roleResult.djRoleLabel;
  task.djRoleReason = roleResult.djRoleReason;

  await task.save();
  console.log(`DJ role assigned for task "${task.title}": ${roleResult.djRoleLabel}`);
}

// Update task
exports.updateTask = async (req, res) => {
  try {
    const { title, description, source, priority, status, dueDate } = req.body;

    const task = await OrganizationTask.findById(req.params.id);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    if (title) task.title = title;
    if (description) task.description = description;
    if (source) task.source = source;
    if (priority) task.priority = priority;
    if (status) task.status = status;
    if (dueDate !== undefined) task.dueDate = dueDate ? new Date(dueDate) : null;

    await task.save();

    res.json({
      success: true,
      data: task
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Analyze task with AI
exports.analyzeTask = async (req, res) => {
  try {
    const task = await OrganizationTask.findById(req.params.id);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    if (task.status === 'analyzing') {
      return res.status(400).json({
        success: false,
        message: 'Task is already being analyzed'
      });
    }

    // Update status
    task.status = 'analyzing';
    await task.save();

    // Start async analysis
    analyzeTaskAsync(task._id).catch(error => {
      console.error('Async analysis error:', error);
    });

    res.json({
      success: true,
      message: 'Analysis started',
      data: task
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Async analysis function
async function analyzeTaskAsync(taskId) {
  const task = await OrganizationTask.findById(taskId);
  if (!task) return;

  try {
    // Find related thoughts
    const relatedThoughts = await strategicAdvisorService.findRelatedThoughts(
      `${task.title} ${task.description}`,
      10
    );

    console.log(`Found ${relatedThoughts.length} related thoughts for task: ${task.title}`);

    // Analyze task
    const analysis = await strategicAdvisorService.analyzeTask(task, relatedThoughts);

    // Update task
    task.analysis = analysis;
    task.category = analysis.categoryPrediction;
    task.status = 'completed';
    await task.save();

    console.log(`Task analysis completed: ${task.title}`);
  } catch (error) {
    console.error('Task analysis failed:', error);
    task.status = 'pending';
    await task.save();
  }
}

// Delete task
exports.deleteTask = async (req, res) => {
  try {
    const task = await OrganizationTask.findById(req.params.id);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    await OrganizationTask.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Task deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get task statistics
exports.getTaskStats = async (req, res) => {
  try {
    const [
      total,
      pending,
      analyzing,
      completed,
      byCategory,
      byPriority
    ] = await Promise.all([
      OrganizationTask.countDocuments(),
      OrganizationTask.countDocuments({ status: 'pending' }),
      OrganizationTask.countDocuments({ status: 'analyzing' }),
      OrganizationTask.countDocuments({ status: 'completed' }),
      OrganizationTask.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } }
      ]),
      OrganizationTask.aggregate([
        { $group: { _id: '$priority', count: { $sum: 1 } } }
      ])
    ]);

    res.json({
      success: true,
      data: {
        total,
        pending,
        analyzing,
        completed,
        byCategory: byCategory.reduce((acc, item) => {
          acc[item._id || 'unknown'] = item.count;
          return acc;
        }, {}),
        byPriority: byPriority.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {})
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
