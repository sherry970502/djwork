const express = require('express');
const router = express.Router();
const mindMapController = require('../controllers/mindMapController');

// 创建思维导图
router.post('/', mindMapController.createMindMap);

// 获取思维导图
router.get('/:id', mindMapController.getMindMap);

// 根据设计ID获取思维导图
router.get('/design/:designId', mindMapController.getMindMapByDesignId);

// AI 发散节点
router.post('/:id/diverge', mindMapController.divergeNode);

// 更新节点
router.put('/:id/nodes', mindMapController.updateNode);

// 删除节点
router.delete('/:id/nodes', mindMapController.deleteNode);

// 添加手动节点
router.post('/:id/nodes', mindMapController.addManualNode);

// 删除思维导图
router.delete('/:id', mindMapController.deleteMindMap);

module.exports = router;
