const Wishlist = require('../models/wishlist');
const Anthropic = require('@anthropic-ai/sdk');
const config = require('../config');

// 获取所有 Wishlist
exports.getWishlist = async (req, res) => {
  try {
    const items = await Wishlist.find().sort({ order: 1 });
    res.json({
      success: true,
      data: items
    });
  } catch (error) {
    console.error('Get wishlist error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// 创建 Wishlist 项
exports.createItem = async (req, res) => {
  try {
    const { content, category } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        message: 'Content is required'
      });
    }

    // 获取当前最大 order
    const maxOrderItem = await Wishlist.findOne().sort({ order: -1 });
    const order = maxOrderItem ? maxOrderItem.order + 1 : 0;

    const item = new Wishlist({
      content,
      category,
      order
    });

    await item.save();

    res.status(201).json({
      success: true,
      data: item
    });
  } catch (error) {
    console.error('Create wishlist item error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// 更新 Wishlist 项
exports.updateItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { content, category } = req.body;

    const item = await Wishlist.findByIdAndUpdate(
      id,
      { content, category, updatedAt: new Date() },
      { new: true }
    );

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }

    res.json({
      success: true,
      data: item
    });
  } catch (error) {
    console.error('Update wishlist item error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// 删除 Wishlist 项
exports.deleteItem = async (req, res) => {
  try {
    const { id } = req.params;

    const item = await Wishlist.findByIdAndDelete(id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }

    res.json({
      success: true,
      message: 'Item deleted'
    });
  } catch (error) {
    console.error('Delete wishlist item error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// 移动 Wishlist 项
exports.moveItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { direction } = req.body;

    const item = await Wishlist.findById(id);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }

    // 找到要交换的项
    let targetItem;
    if (direction === 'up') {
      targetItem = await Wishlist.findOne({ order: { $lt: item.order } }).sort({ order: -1 });
    } else {
      targetItem = await Wishlist.findOne({ order: { $gt: item.order } }).sort({ order: 1 });
    }

    if (!targetItem) {
      return res.json({
        success: true,
        message: 'Already at the edge'
      });
    }

    // 交换 order
    const tempOrder = item.order;
    item.order = targetItem.order;
    targetItem.order = tempOrder;

    await item.save();
    await targetItem.save();

    res.json({
      success: true,
      data: item
    });
  } catch (error) {
    console.error('Move wishlist item error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// AI 自动分类
exports.autoClassify = async (req, res) => {
  try {
    // 只获取没有分类的项目
    const unclassifiedItems = await Wishlist.find({
      $or: [
        { category: { $exists: false } },
        { category: null },
        { category: '' }
      ]
    });

    if (unclassifiedItems.length === 0) {
      return res.json({
        success: true,
        message: '所有项目都已有分类，无需分类'
      });
    }

    const client = new Anthropic({ apiKey: config.claudeApiKey });

    const itemsText = unclassifiedItems.map((item, index) => `${index + 1}. ${item.content}`).join('\n');

    const prompt = `请帮我将以下人生愿望清单进行分类。

愿望清单：
${itemsText}

请按以下分类标准进行分类：
- 个人成长：学习技能、自我提升、个人发展
- 健康生活：运动、健康、养生
- 旅行探索：旅行、探险、体验新事物
- 创意项目：创作、艺术、DIY项目
- 人际关系：家庭、朋友、社交
- 学习发展：专业学习、职业发展

请返回 JSON 数组，格式：
[
  { "index": 1, "category": "分类名称" },
  { "index": 2, "category": "分类名称" }
]

只返回 JSON，不要其他文字。`;

    const message = await client.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 2000,
      temperature: 0.3,
      messages: [{ role: 'user', content: prompt }]
    });

    const responseText = message.content[0].text.trim();
    const jsonText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const classifications = JSON.parse(jsonText);

    // 更新分类 - 只更新未分类的项目
    let classifiedCount = 0;
    for (const classification of classifications) {
      const item = unclassifiedItems[classification.index - 1];
      if (item) {
        item.category = classification.category;
        await item.save();
        classifiedCount++;
      }
    }

    res.json({
      success: true,
      message: `已为 ${classifiedCount} 个项目添加分类`
    });
  } catch (error) {
    console.error('Auto classify error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// AI 总结
exports.summarize = async (req, res) => {
  try {
    const items = await Wishlist.find().sort({ order: 1 });

    if (items.length === 0) {
      return res.json({
        success: true,
        data: { summary: '你还没有添加任何愿望，快来添加第一个吧！' }
      });
    }

    const client = new Anthropic({ apiKey: config.claudeApiKey });

    const itemsText = items.map(item => {
      const category = item.category ? `[${item.category}] ` : '';
      return `${category}${item.content}`;
    }).join('\n');

    const prompt = `请帮我总结和分析这份人生愿望清单，从以下角度：
1. 整体特点和主题
2. 反映出的价值观和生活追求
3. 建议和鼓励

愿望清单：
${itemsText}

请用温暖、鼓励的语气，2-3段话总结。`;

    const message = await client.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1000,
      temperature: 0.7,
      messages: [{ role: 'user', content: prompt }]
    });

    const summary = message.content[0].text.trim();

    res.json({
      success: true,
      data: { summary }
    });
  } catch (error) {
    console.error('Summarize error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// AI 发散单个项
exports.diverge = async (req, res) => {
  try {
    const { id } = req.params;

    const item = await Wishlist.findById(id);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }

    const client = new Anthropic({ apiKey: config.claudeApiKey });

    const prompt = `基于这个人生愿望："${item.content}"，请帮我发散思考，提供3-5个相关的、更具体的或者延伸的建议。

要求：
1. 每个建议都要有创意和可行性
2. 可以是更具体的实现方式，也可以是相关的新想法
3. 每个建议要说明推荐理由

返回 JSON 格式：
[
  { "content": "具体建议内容", "reason": "推荐理由" }
]

只返回 JSON，不要其他文字。`;

    const message = await client.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1500,
      temperature: 0.8,
      messages: [{ role: 'user', content: prompt }]
    });

    const responseText = message.content[0].text.trim();
    const jsonText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const suggestions = JSON.parse(jsonText);

    res.json({
      success: true,
      data: { suggestions }
    });
  } catch (error) {
    console.error('Diverge error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// AI 推荐
exports.recommend = async (req, res) => {
  try {
    const items = await Wishlist.find().sort({ order: 1 });

    const client = new Anthropic({ apiKey: config.claudeApiKey });

    let prompt;
    if (items.length > 0) {
      const itemsText = items.map(item => item.content).join('\n');
      prompt = `基于这个人的愿望清单，推荐5个他可能感兴趣的新活动或体验：

现有愿望：
${itemsText}

要求：
1. 推荐要与现有愿望有关联但又有新意
2. 考虑不同类型的活动（学习、体验、创作等）
3. 每个推荐要说明为什么适合这个人

返回 JSON 格式：
[
  { "content": "推荐活动", "reason": "推荐理由" }
]

只返回 JSON，不要其他文字。`;
    } else {
      prompt = `请推荐5个有意义、有趣的人生体验或活动，适合一般人尝试：

要求：
1. 涵盖不同领域（学习、旅行、创作、运动等）
2. 既有挑战性又有可行性
3. 每个推荐要说明价值所在

返回 JSON 格式：
[
  { "content": "推荐活动", "reason": "推荐理由" }
]

只返回 JSON，不要其他文字。`;
    }

    const message = await client.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1500,
      temperature: 0.8,
      messages: [{ role: 'user', content: prompt }]
    });

    const responseText = message.content[0].text.trim();
    const jsonText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const recommendations = JSON.parse(jsonText);

    res.json({
      success: true,
      data: { recommendations }
    });
  } catch (error) {
    console.error('Recommend error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// 批量更新顺序
exports.reorderItems = async (req, res) => {
  try {
    const { items } = req.body; // items: [{ _id, order }, ...]

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid items data'
      });
    }

    // 批量更新
    const updatePromises = items.map(({ _id, order }) =>
      Wishlist.findByIdAndUpdate(_id, { order, updatedAt: new Date() })
    );

    await Promise.all(updatePromises);

    res.json({
      success: true,
      message: 'Order updated successfully'
    });
  } catch (error) {
    console.error('Reorder items error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
