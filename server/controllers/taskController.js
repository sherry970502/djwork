const { OrganizationTask, Thought } = require('../models');
const strategicAdvisorService = require('../services/strategicAdvisorService');

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
