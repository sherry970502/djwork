const { OrganizationTask, Thought } = require('../models');
const strategicAdvisorService = require('../services/strategicAdvisorService');
const Anthropic = require('@anthropic-ai/sdk');
const config = require('../config');

// DJ 角色映射
const DJ_ROLES = {
  manager: { label: '管理者', description: '去做决策' },
  lead_designer: { label: '主设计师', description: '去做设计' },
  mentor: { label: '指导设计师', description: '提供设计指导' },
  expert: { label: '专家', description: '进行验收' }
};

// AI 分析 DJ 角色
async function analyzeDJRole(title, description) {
  try {
    const client = new Anthropic({ apiKey: config.claudeApiKey });

    const prompt = `你是一个组织角色分析助手。DJ 是一位资深设计师出身的领导者，请根据事务的本质来判断 DJ 应该扮演什么角色。

## 事务信息
标题：${title}
描述：${description}

## 可选角色（只能选择一个）

### 1. mentor（指导设计师）- 最常见的角色
DJ 需要以设计思维来引导团队思考"为什么"和"价值是什么"的事务。
典型特征：
- 涉及"为什么要这样做"、"这样做的价值是什么"等设计思考
- 需要分析事物背后的逻辑和意义
- 需要传授设计方法论或思维方式
- 产品/功能/体验相关的优化和改进思考
- 需要 DJ 提供方向性指导，但团队来执行

### 2. lead_designer（主设计师）
DJ 需要亲自动手设计、亲自产出方案的事务。
典型特征：
- DJ 需要亲自完成设计产出物
- 核心创新项目需要 DJ 亲自操刀
- 重要的对外展示/汇报材料需要 DJ 亲自制作

### 3. manager（管理者）
纯粹的管理决策事务，与设计思考无关。
典型特征：
- 预算审批、资源分配
- 人事决策（招聘、晋升、调岗）
- 商务合作的最终拍板
- 组织架构调整

### 4. expert（专家）
DJ 需要进行质量把关和验收的事务。
典型特征：
- 项目交付前的最终评审
- 重要产出物的质量验收
- 对外发布前的把关

## 判断要点
⚠️ 很多看起来像"决策"的事务，本质上是"设计思考"：
- "XX需要增加/优化/改进" → 这是设计问题，需要分析"为什么"→ mentor
- "如何提升XX效果" → 这是设计问题，需要思考价值和方法 → mentor
- "XX方案的选择" → 如果涉及设计取舍 → mentor；如果纯粹是资源/预算 → manager

## 输出格式（JSON）
{
  "role": "角色英文名",
  "reason": "说明这个事务的本质是什么，为什么需要这个角色（30字以内）"
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
