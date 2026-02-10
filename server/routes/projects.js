const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');

// 获取所有项目（扁平列表）
router.get('/', projectController.getAllProjects);

// 获取项目树
router.get('/tree', projectController.getProjectTree);

// AI 建议项目
router.get('/suggestions', projectController.suggestProjects);

// 获取单个项目
router.get('/:id', projectController.getProject);

// 创建项目
router.post('/', projectController.createProject);

// 从 PersonalDesign 同步创建项目
router.post('/sync-from-design', projectController.syncFromDesign);

// 调整顺序
router.post('/reorder', projectController.reorderProjects);

// 更新项目
router.put('/:id', projectController.updateProject);

// 删除项目
router.delete('/:id', projectController.deleteProject);

module.exports = router;
