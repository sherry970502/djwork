const express = require('express');
const router = express.Router();
const designController = require('../controllers/designController');

// ==================== 设计维度路由 ====================

// 获取所有维度
router.get('/dimensions', designController.getDimensions);

// 获取单个维度
router.get('/dimensions/:id', designController.getDimension);

// 创建维度
router.post('/dimensions', designController.createDimension);

// 更新维度
router.put('/dimensions/:id', designController.updateDimension);

// 删除维度
router.delete('/dimensions/:id', designController.deleteDimension);

// ==================== 个人设计路由 ====================

// 获取所有设计
router.get('/', designController.getDesigns);

// 获取单个设计
router.get('/:id', designController.getDesign);

// 创建设计
router.post('/', designController.createDesign);

// 更新设计
router.put('/:id', designController.updateDesign);

// 删除设计
router.delete('/:id', designController.deleteDesign);

// 需求澄清
router.post('/:id/clarify', designController.generateClarifyingQuestions);
router.post('/:id/clarify/submit', designController.submitClarifyingAnswers);
router.post('/:id/clarify/skip', designController.skipClarification);

// AI 创意发散
router.post('/:id/generate-ideas', designController.generateIdeas);

// 生成综合创意方案
router.post('/:id/generate-proposal', designController.generateProposal);

module.exports = router;
