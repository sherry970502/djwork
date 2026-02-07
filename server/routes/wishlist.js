const express = require('express');
const router = express.Router();
const wishlistController = require('../controllers/wishlistController');

// GET /api/wishlist - 获取所有 wishlist
router.get('/', wishlistController.getWishlist);

// POST /api/wishlist - 创建 wishlist 项
router.post('/', wishlistController.createItem);

// POST /api/wishlist/auto-classify - AI 自动分类
router.post('/auto-classify', wishlistController.autoClassify);

// POST /api/wishlist/summarize - AI 总结
router.post('/summarize', wishlistController.summarize);

// POST /api/wishlist/recommend - AI 推荐
router.post('/recommend', wishlistController.recommend);

// POST /api/wishlist/reorder - 批量更新顺序
router.post('/reorder', wishlistController.reorderItems);

// PUT /api/wishlist/:id - 更新 wishlist 项
router.put('/:id', wishlistController.updateItem);

// DELETE /api/wishlist/:id - 删除 wishlist 项
router.delete('/:id', wishlistController.deleteItem);

// POST /api/wishlist/:id/move - 移动 wishlist 项
router.post('/:id/move', wishlistController.moveItem);

// POST /api/wishlist/:id/diverge - AI 发散
router.post('/:id/diverge', wishlistController.diverge);

module.exports = router;
