const express = require('express');
const router = express.Router();
const thoughtController = require('../controllers/thoughtController');

// GET /api/thoughts - Get all thoughts with filtering
router.get('/', thoughtController.getThoughts);

// GET /api/thoughts/similar - Get thoughts with pending similar items
router.get('/similar', thoughtController.getSimilarThoughts);

// POST /api/thoughts/merge - Merge similar thoughts
router.post('/merge', thoughtController.mergeThoughts);

// POST /api/thoughts/dismiss - Dismiss similar thought
router.post('/dismiss', thoughtController.dismissSimilar);

// GET /api/thoughts/:id - Get thought by ID
router.get('/:id', thoughtController.getThought);

// PUT /api/thoughts/:id - Update thought
router.put('/:id', thoughtController.updateThought);

// POST /api/thoughts/:id/important - Toggle important status
router.post('/:id/important', thoughtController.toggleImportant);

// DELETE /api/thoughts/:id - Delete thought
router.delete('/:id', thoughtController.deleteThought);

module.exports = router;
