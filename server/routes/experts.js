const express = require('express');
const router = express.Router();
const expertController = require('../controllers/expertController');

// 获取所有专家
router.get('/', expertController.getExperts);

// 获取单个专家
router.get('/:id', expertController.getExpert);

// 咨询专家
router.post('/:id/consult', expertController.consultExpert);

// 流式咨询（分段返回）
router.post('/:id/consult-streaming', expertController.consultExpertStreaming);

module.exports = router;
