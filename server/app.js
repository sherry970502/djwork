const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const config = require('./config');

// Import routes
const tagsRouter = require('./routes/tags');
const meetingsRouter = require('./routes/meetings');
const thoughtsRouter = require('./routes/thoughts');
const tasksRouter = require('./routes/tasks');
const knowledgeRouter = require('./routes/knowledge');
const designsRouter = require('./routes/designs');
const monthlyPlansRouter = require('./routes/monthlyPlans');
const mindmapsRouter = require('./routes/mindmaps');
const wishlistRouter = require('./routes/wishlist');
const projectsRouter = require('./routes/projects');
const expertsRouter = require('./routes/experts');
const intelligenceRouter = require('./routes/intelligence');
const notificationsRouter = require('./routes/notifications');
const agentRouter = require('./routes/agent');

// Import controllers for initialization
const { initPresetTags } = require('./controllers/tagController');
const { initPresetDimensions } = require('./controllers/designController');

// Import notification scheduler
const { initScheduler } = require('./services/notificationScheduler');

const app = express();

// CORS 配置 - 支持生产环境
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? [
        process.env.FRONTEND_URL,           // 主前端域名
        'https://djwork-zeta.vercel.app',   // 当前 Vercel 部署地址
        'https://dj-meeting.vercel.app',    // 旧 Vercel 部署地址
        /\.vercel\.app$/                     // 所有 Vercel 预览地址
      ].filter(Boolean)
    : true,  // 开发环境允许所有
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

// Middleware
app.use(cors(corsOptions));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// API Routes
app.use('/api/tags', tagsRouter);
app.use('/api/meetings', meetingsRouter);
app.use('/api/thoughts', thoughtsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/knowledge', knowledgeRouter);
app.use('/api/designs', designsRouter);
app.use('/api/monthly-plans', monthlyPlansRouter);
app.use('/api/mindmaps', mindmapsRouter);
app.use('/api/wishlist', wishlistRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/experts', expertsRouter);
app.use('/api/intelligence', intelligenceRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/agent', agentRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Dashboard stats endpoint
app.get('/api/stats', async (req, res) => {
  try {
    const { MeetingMinutes, Thought, Tag, OrganizationTask, PersonalDesign } = require('./models');

    const [
      totalMeetings,
      totalThoughts,
      importantThoughts,
      pendingProcessing,
      pendingSimilar,
      tagStats,
      pendingTasks,
      completedTasks,
      totalDesigns,
      activeDesigns
    ] = await Promise.all([
      MeetingMinutes.countDocuments(),
      Thought.countDocuments({ isMerged: false }),
      Thought.countDocuments({ isImportant: true, isMerged: false }),
      MeetingMinutes.countDocuments({ processStatus: 'pending' }),
      Thought.countDocuments({ 'similarThoughts.status': 'pending', isMerged: false }),
      Tag.find().sort({ thoughtCount: -1 }).limit(8).select('name displayName color thoughtCount'),
      OrganizationTask.countDocuments({ status: 'pending' }),
      OrganizationTask.countDocuments({ status: 'completed' }),
      PersonalDesign.countDocuments(),
      PersonalDesign.countDocuments({ status: { $in: ['draft', 'ideating', 'designing', 'prototyping'] } })
    ]);

    res.json({
      success: true,
      data: {
        totalMeetings,
        totalThoughts,
        importantThoughts,
        pendingProcessing,
        pendingSimilar,
        topTags: tagStats,
        pendingTasks,
        completedTasks,
        totalDesigns,
        activeDesigns
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: 'File too large. Maximum size is 10MB.'
    });
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found'
  });
});

// Connect to MongoDB and start server
const startServer = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(config.mongodbUri);
    console.log('MongoDB connected successfully');

    // Initialize preset tags
    await initPresetTags();
    console.log('Preset tags initialized');

    // Initialize preset design dimensions
    await initPresetDimensions();
    console.log('Preset design dimensions initialized');

    // Initialize notification scheduler
    initScheduler();

    app.listen(config.port, () => {
      console.log(`Server running on port ${config.port}`);
      console.log(`API available at http://localhost:${config.port}/api`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
