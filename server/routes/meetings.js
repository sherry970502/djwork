const express = require('express');
const router = express.Router();
const meetingController = require('../controllers/meetingController');
const upload = require('../middlewares/upload');

// GET /api/meetings - Get all meetings
router.get('/', meetingController.getMeetings);

// GET /api/meetings/:id - Get meeting by ID
router.get('/:id', meetingController.getMeeting);

// POST /api/meetings - Create meeting from pasted text
router.post('/', meetingController.createMeeting);

// POST /api/meetings/upload - Upload meeting file
router.post('/upload', upload.single('file'), meetingController.uploadMeeting);

// POST /api/meetings/:id/process - Process meeting with AI
router.post('/:id/process', meetingController.processMeeting);

// POST /api/meetings/:id/reprocess - Reprocess meeting with improved extraction
router.post('/:id/reprocess', meetingController.reprocessMeeting);

// DELETE /api/meetings/:id - Delete meeting
router.delete('/:id', meetingController.deleteMeeting);

module.exports = router;
