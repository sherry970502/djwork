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
// AI 事务前置判断 - 判断是否应该由 DJ 完成
exports.preCheckTask = async (req, res) => {
  try {
    console.log('Pre-check task request:', req.body);
    const { title, description } = req.body;

    if (!title || !description) {
      return res.status(400).json({
        success: false,
        message: 'Title and description are required'
      });
    }

    console.log('Initializing Anthropic client...');
    const client = new Anthropic({ apiKey: config.claudeApiKey });

    const prompt = `你是一个组织事务前置判断助手。你需要判断一个事务是否应该由 DJ（公司董事长 + 顶层设计师）来完成。

## DJ 的角色定位
DJ 是公司董事长，同时也是一位顶尖的设计师。他应该专注于：
1. **顶层战略决策** - 需要董事长权限和全局视野的决策
2. **资源调动** - 需要协调多方资源、跨部门合作的事务
3. **核心设计创新** - 需要顶级设计能力、开创性思考的项目
4. **关键节点把关** - 重要项目的设计验收和质量把关
5. **方法论传授** - 团队遇到重大设计思考瓶颈时的指导

## 不应该由 DJ 完成的事务
1. 执行层面的具体工作（可以由团队成员完成）
2. 常规的业务操作和流程性事务
3. 技术实现细节（除非涉及架构级别决策）
4. 日常的客户沟通和支持
5. 可以授权给下属独立完成的事务

## 待判断的事务
标题：${title}
描述：${description}

## 请按以下格式返回 JSON：
{
  "shouldDJHandle": "必须" | "建议" | "可选" | "不建议",
  "confidence": 0.0-1.0,
  "reasoning": "详细说明为什么这个事务应该/不应该由 DJ 完成",
  "suggestedOwner": "如果不建议 DJ 完成，建议谁来完成（例如：产品经理、设计团队、技术团队、运营团队等）",
  "criticalFactors": ["列出1-3个关键判断因素"]
}

判断标准：
- "必须"：只有 DJ 能完成，涉及顶层战略、重大资源调动、核心创新设计
- "建议"：DJ 来做会更好，但理论上也可以授权给其他人
- "可选"：DJ 可以参与但不是必须的，主要是提供指导或把关
- "不建议"：明显不需要 DJ 亲自处理，应该由团队成员完成

请直接返回 JSON，不要包含任何其他文字。`;

    console.log('Calling Claude API for pre-check...');
    const message = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      temperature: 0.3,
      messages: [{ role: 'user', content: prompt }]
    });

    console.log('Received AI response');
    const responseText = message.content[0].text.trim();
    console.log('AI response text:', responseText.substring(0, 200) + '...');

    // 尝试提取 JSON
    let result;
    try {
      // 移除可能的 markdown 代码块标记
      const jsonText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      result = JSON.parse(jsonText);
      console.log('Parsed result:', result);
    } catch (parseError) {
      console.error('Failed to parse AI response:', responseText);
      throw new Error('AI 返回格式错误');
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Pre-check task error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: error.message || '事务前置判断失败'
    });
  }
};

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
