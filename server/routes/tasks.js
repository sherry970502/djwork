const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');

// GET /api/tasks - Get all tasks
router.get('/', taskController.getTasks);

// GET /api/tasks/stats - Get task statistics
router.get('/stats', taskController.getTaskStats);

// GET /api/tasks/:id - Get task by ID
router.get('/:id', taskController.getTask);

// POST /api/tasks - Create new task
router.post('/', taskController.createTask);

// PUT /api/tasks/:id - Update task
router.put('/:id', taskController.updateTask);

// POST /api/tasks/:id/analyze - Analyze task with AI
router.post('/:id/analyze', taskController.analyzeTask);

// DELETE /api/tasks/:id - Delete task
router.delete('/:id', taskController.deleteTask);

module.exports = router;
