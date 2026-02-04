const express = require('express');
const router = express.Router();
const tagController = require('../controllers/tagController');

// GET /api/tags - Get all tags
router.get('/', tagController.getTags);

// GET /api/tags/stats - Get tag statistics
router.get('/stats', tagController.getTagStats);

// GET /api/tags/:id - Get tag by ID
router.get('/:id', tagController.getTag);

// POST /api/tags - Create new tag
router.post('/', tagController.createTag);

// PUT /api/tags/:id - Update tag
router.put('/:id', tagController.updateTag);

// DELETE /api/tags/:id - Delete tag
router.delete('/:id', tagController.deleteTag);

// POST /api/tags/:id/find-matches - Find matching content for tag
router.get('/:id/find-matches', tagController.findMatchingContent);

// POST /api/tags/:id/apply-to-history - Apply tag to selected historical content
router.post('/:id/apply-to-history', tagController.applyTagToHistory);

module.exports = router;
