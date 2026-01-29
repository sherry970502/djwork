const { PersonalDesign, DesignDimension, Thought } = require('../models');
const creativeService = require('../services/creativeService');

// ==================== 设计维度 CRUD ====================

// 获取所有维度
exports.getDimensions = async (req, res) => {
  try {
    const dimensions = await DesignDimension.find({ isActive: true })
      .sort({ sortOrder: 1, createdAt: 1 });

    res.json({
      success: true,
      data: dimensions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// 获取单个维度
exports.getDimension = async (req, res) => {
  try {
    const dimension = await DesignDimension.findById(req.params.id);

    if (!dimension) {
      return res.status(404).json({
        success: false,
        message: 'Dimension not found'
      });
    }

    res.json({
      success: true,
      data: dimension
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// 创建维度
exports.createDimension = async (req, res) => {
  try {
    const { name, displayName, description, prompts, examples, color, icon } = req.body;

    const existing = await DesignDimension.findOne({ name });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Dimension with this name already exists'
      });
    }

    const dimension = new DesignDimension({
      name,
      displayName,
      description,
      prompts: prompts || [],
      examples: examples || [],
      color,
      icon
    });

    await dimension.save();

    res.status(201).json({
      success: true,
      data: dimension
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// 更新维度
exports.updateDimension = async (req, res) => {
  try {
    const { displayName, description, prompts, examples, color, icon, isActive, sortOrder } = req.body;

    const dimension = await DesignDimension.findById(req.params.id);
    if (!dimension) {
      return res.status(404).json({
        success: false,
        message: 'Dimension not found'
      });
    }

    if (displayName !== undefined) dimension.displayName = displayName;
    if (description !== undefined) dimension.description = description;
    if (prompts !== undefined) dimension.prompts = prompts;
    if (examples !== undefined) dimension.examples = examples;
    if (color !== undefined) dimension.color = color;
    if (icon !== undefined) dimension.icon = icon;
    if (isActive !== undefined) dimension.isActive = isActive;
    if (sortOrder !== undefined) dimension.sortOrder = sortOrder;

    await dimension.save();

    res.json({
      success: true,
      data: dimension
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// 删除维度
exports.deleteDimension = async (req, res) => {
  try {
    const dimension = await DesignDimension.findById(req.params.id);
    if (!dimension) {
      return res.status(404).json({
        success: false,
        message: 'Dimension not found'
      });
    }

    await dimension.deleteOne();

    res.json({
      success: true,
      message: 'Dimension deleted'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// 初始化预设维度
exports.initPresetDimensions = async () => {
  const presets = [
    {
      name: 'digitalization',
      displayName: '电子化',
      description: '将传统概念转化为数字化形态，利用电子技术增强体验',
      prompts: [
        '如何将这个设计数字化？',
        '可以开发什么样的 App 或软件？',
        '如何利用传感器和物联网？',
        '数字化后能带来什么新的可能性？'
      ],
      examples: [
        { title: '电子墨水屏日历', description: '将传统纸质日历转化为低功耗电子墨水屏' },
        { title: '数字化收藏卡牌', description: 'NFT + 实体卡牌的结合' }
      ],
      color: '#4facfe',
      icon: 'laptop',
      sortOrder: 1
    },
    {
      name: 'ai_integration',
      displayName: '与AI结合',
      description: '融入人工智能技术，实现智能化和个性化',
      prompts: [
        '如何让 AI 参与到这个设计中？',
        'AI 可以帮助用户解决什么问题？',
        '如何实现个性化推荐或生成？',
        'AI 能否让这个设计具有学习能力？'
      ],
      examples: [
        { title: 'AI 私人教练', description: '根据用户状态实时调整训练计划' },
        { title: '智能创意助手', description: 'AI 辅助头脑风暴和创意生成' }
      ],
      color: '#667eea',
      icon: 'robot',
      sortOrder: 2
    },
    {
      name: 'education_integration',
      displayName: '与教育结合',
      description: '融入教育元素，让设计具有知识传递和能力培养的功能',
      prompts: [
        '这个设计如何帮助用户学习新知识？',
        '能否将学习过程游戏化？',
        '如何在娱乐中融入教育价值？',
        '怎样让用户在使用中获得成长？'
      ],
      examples: [
        { title: '编程闯关游戏', description: '通过游戏关卡学习编程概念' },
        { title: '历史穿越体验', description: 'VR/AR 沉浸式历史学习' }
      ],
      color: '#38ef7d',
      icon: 'book',
      sortOrder: 3
    },
    {
      name: 'freshness',
      displayName: '增强新鲜感',
      description: '打破常规，增加惊喜和新奇元素，保持用户的持续兴趣',
      prompts: [
        '如何让用户每次使用都有新鲜感？',
        '可以加入哪些随机或变化的元素？',
        '如何打破用户的预期？',
        '怎样让这个设计具有"彩蛋"效果？'
      ],
      examples: [
        { title: '动态变化的UI', description: '界面随时间、天气、用户情绪变化' },
        { title: '隐藏成就系统', description: '意想不到的解锁和奖励' }
      ],
      color: '#f093fb',
      icon: 'star',
      sortOrder: 4
    }
  ];

  for (const preset of presets) {
    const existing = await DesignDimension.findOne({ name: preset.name });
    if (!existing) {
      await DesignDimension.create(preset);
      console.log(`Created dimension: ${preset.displayName}`);
    }
  }
};

// ==================== 个人设计 CRUD ====================

// 获取所有设计
exports.getDesigns = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, category } = req.query;

    const query = {};
    if (status) query.status = status;
    if (category) query.category = category;

    const designs = await PersonalDesign.find(query)
      .populate('selectedDimensions')
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await PersonalDesign.countDocuments(query);

    res.json({
      success: true,
      data: designs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// 获取单个设计
exports.getDesign = async (req, res) => {
  try {
    const design = await PersonalDesign.findById(req.params.id)
      .populate('selectedDimensions')
      .populate('relatedThoughts');

    if (!design) {
      return res.status(404).json({
        success: false,
        message: 'Design not found'
      });
    }

    res.json({
      success: true,
      data: design
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// 创建设计
exports.createDesign = async (req, res) => {
  try {
    const { title, description, category, inspiration, goals, priority, selectedDimensions, notes } = req.body;

    const design = new PersonalDesign({
      title,
      description,
      category,
      inspiration,
      goals: goals || [],
      priority,
      selectedDimensions: selectedDimensions || [],
      notes
    });

    await design.save();
    await design.populate('selectedDimensions');

    res.status(201).json({
      success: true,
      data: design
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// 更新设计
exports.updateDesign = async (req, res) => {
  try {
    const updates = req.body;

    const design = await PersonalDesign.findById(req.params.id);
    if (!design) {
      return res.status(404).json({
        success: false,
        message: 'Design not found'
      });
    }

    const allowedFields = ['title', 'description', 'category', 'inspiration', 'goals', 'status', 'priority', 'selectedDimensions', 'notes'];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        design[field] = updates[field];
      }
    }

    await design.save();
    await design.populate('selectedDimensions');

    res.json({
      success: true,
      data: design
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// 删除设计
exports.deleteDesign = async (req, res) => {
  try {
    const design = await PersonalDesign.findById(req.params.id);
    if (!design) {
      return res.status(404).json({
        success: false,
        message: 'Design not found'
      });
    }

    await design.deleteOne();

    res.json({
      success: true,
      message: 'Design deleted'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==================== 需求澄清 ====================

// 生成澄清问题
exports.generateClarifyingQuestions = async (req, res) => {
  try {
    const design = await PersonalDesign.findById(req.params.id);

    if (!design) {
      return res.status(404).json({
        success: false,
        message: 'Design not found'
      });
    }

    // 如果已经有问题了，直接返回
    if (design.clarifyingQA && design.clarifyingQA.length > 0) {
      return res.json({
        success: true,
        data: {
          questions: design.clarifyingQA,
          clarifyStatus: design.clarifyStatus
        }
      });
    }

    // 生成问题
    const result = await creativeService.generateClarifyingQuestions(design);

    // 保存问题到设计
    design.clarifyingQA = result.questions.map(q => ({
      question: q.question,
      questionType: q.questionType || 'single',
      options: q.options || [],
      category: q.category,
      answer: [],
      customAnswer: ''
    }));
    design.clarifyStatus = 'questioning';
    await design.save();

    res.json({
      success: true,
      data: {
        questions: design.clarifyingQA,
        initialAssumptions: result.initialAssumptions,
        clarifyStatus: design.clarifyStatus
      }
    });
  } catch (error) {
    console.error('Generate clarifying questions failed:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// 提交澄清问题的回答
exports.submitClarifyingAnswers = async (req, res) => {
  try {
    const design = await PersonalDesign.findById(req.params.id);

    if (!design) {
      return res.status(404).json({
        success: false,
        message: 'Design not found'
      });
    }

    const { answers } = req.body;  // [{ questionIndex: 0, answer: ['选项1'], customAnswer: '' }, ...]

    // 更新答案
    if (answers && Array.isArray(answers)) {
      answers.forEach(a => {
        if (design.clarifyingQA[a.questionIndex]) {
          design.clarifyingQA[a.questionIndex].answer = a.answer || [];
          design.clarifyingQA[a.questionIndex].customAnswer = a.customAnswer || '';
        }
      });
    }

    // 生成需求摘要
    const summary = await creativeService.generateRequirementSummary(design);
    if (summary) {
      design.requirementSummary = summary;
    }

    design.clarifyStatus = 'completed';
    await design.save();

    res.json({
      success: true,
      data: design
    });
  } catch (error) {
    console.error('Submit clarifying answers failed:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// 跳过需求澄清
exports.skipClarification = async (req, res) => {
  try {
    const design = await PersonalDesign.findById(req.params.id);

    if (!design) {
      return res.status(404).json({
        success: false,
        message: 'Design not found'
      });
    }

    design.clarifyStatus = 'skipped';
    await design.save();

    res.json({
      success: true,
      data: design
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==================== AI 创意发散 ====================

// 触发 AI 创意发散（AI 自动筛选维度，或使用用户预设的维度）
exports.generateIdeas = async (req, res) => {
  try {
    const design = await PersonalDesign.findById(req.params.id)
      .populate('selectedDimensions');

    if (!design) {
      return res.status(404).json({
        success: false,
        message: 'Design not found'
      });
    }

    // 更新状态为发散中
    design.status = 'ideating';
    await design.save();

    res.json({
      success: true,
      message: 'Idea generation started',
      data: design
    });

    // 异步执行 AI 发散
    try {
      // 查找相关的灵感思考
      const relatedThoughts = await Thought.find({
        isMerged: false,
        $or: [
          { content: { $regex: design.title.substring(0, 10), $options: 'i' } },
          { content: { $regex: design.description?.substring(0, 20) || '', $options: 'i' } }
        ]
      })
      .populate('tags')
      .limit(10);

      let dimensionIdeas;

      // 如果用户已预设维度，直接使用；否则让 AI 筛选
      if (design.selectedDimensions && design.selectedDimensions.length > 0) {
        console.log(`Using user-specified dimensions: ${design.selectedDimensions.map(d => d.displayName).join(', ')}`);
        dimensionIdeas = await creativeService.generateDimensionIdeas(
          design,
          design.selectedDimensions,
          relatedThoughts
        );
      } else {
        // 获取所有激活的维度，让 AI 筛选
        const allDimensions = await DesignDimension.find({ isActive: true })
          .sort({ sortOrder: 1 });

        dimensionIdeas = await creativeService.generateIdeasWithDimensionSelection(
          design,
          allDimensions,
          relatedThoughts
        );

        // 更新选中的维度
        design.selectedDimensions = dimensionIdeas.map(di => di.dimensionId);
      }

      // 更新设计
      design.dimensionIdeas = dimensionIdeas;
      design.relatedThoughts = relatedThoughts.map(t => t._id);
      design.status = 'designing';
      await design.save();

    } catch (error) {
      console.error('Idea generation failed:', error);
      design.status = 'draft';
      await design.save();
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// 生成综合创意方案
exports.generateProposal = async (req, res) => {
  try {
    const design = await PersonalDesign.findById(req.params.id)
      .populate('selectedDimensions');

    if (!design) {
      return res.status(404).json({
        success: false,
        message: 'Design not found'
      });
    }

    if (!design.dimensionIdeas || design.dimensionIdeas.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please generate dimension ideas first'
      });
    }

    res.json({
      success: true,
      message: 'Proposal generation started'
    });

    // 异步执行
    try {
      const proposal = await creativeService.generateCreativeProposal(design);

      design.creativeProposals.push(proposal);
      await design.save();
    } catch (error) {
      console.error('Proposal generation failed:', error);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
