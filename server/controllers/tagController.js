const { Tag, Thought } = require('../models');
const config = require('../config');

// Get all tags
exports.getTags = async (req, res) => {
  try {
    const tags = await Tag.find().sort({ thoughtCount: -1, displayName: 1 });
    res.json({
      success: true,
      data: tags
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get tag by ID
exports.getTag = async (req, res) => {
  try {
    const tag = await Tag.findById(req.params.id);
    if (!tag) {
      return res.status(404).json({
        success: false,
        message: 'Tag not found'
      });
    }
    res.json({
      success: true,
      data: tag
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Create tag
exports.createTag = async (req, res) => {
  try {
    const { name, displayName, description, color, keywords } = req.body;

    // Check if tag name already exists
    const existing = await Tag.findOne({ name });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Tag name already exists'
      });
    }

    const tag = new Tag({
      name,
      displayName,
      description: description || '',
      color: color || '#1890ff',
      keywords: keywords || [],
      isPreset: false
    });

    await tag.save();
    res.status(201).json({
      success: true,
      data: tag
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Update tag
exports.updateTag = async (req, res) => {
  try {
    const { displayName, description, color, keywords } = req.body;

    const tag = await Tag.findById(req.params.id);
    if (!tag) {
      return res.status(404).json({
        success: false,
        message: 'Tag not found'
      });
    }

    // Update fields
    if (displayName) tag.displayName = displayName;
    if (description !== undefined) tag.description = description;
    if (color) tag.color = color;
    if (keywords) tag.keywords = keywords;

    await tag.save();
    res.json({
      success: true,
      data: tag
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Delete tag (only non-preset tags)
exports.deleteTag = async (req, res) => {
  try {
    const tag = await Tag.findById(req.params.id);
    if (!tag) {
      return res.status(404).json({
        success: false,
        message: 'Tag not found'
      });
    }

    if (tag.isPreset) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete preset tags'
      });
    }

    // Remove tag from all thoughts
    await Thought.updateMany(
      { tags: tag._id },
      { $pull: { tags: tag._id } }
    );

    await Tag.findByIdAndDelete(req.params.id);
    res.json({
      success: true,
      message: 'Tag deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get tag statistics
exports.getTagStats = async (req, res) => {
  try {
    const stats = await Tag.aggregate([
      {
        $lookup: {
          from: 'thoughts',
          localField: '_id',
          foreignField: 'tags',
          as: 'thoughts'
        }
      },
      {
        $project: {
          name: 1,
          displayName: 1,
          color: 1,
          thoughtCount: { $size: '$thoughts' },
          importantCount: {
            $size: {
              $filter: {
                input: '$thoughts',
                as: 'thought',
                cond: { $eq: ['$$thought.isImportant', true] }
              }
            }
          }
        }
      },
      { $sort: { thoughtCount: -1 } }
    ]);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Initialize preset tags
exports.initPresetTags = async () => {
  try {
    for (const preset of config.presetTags) {
      const existing = await Tag.findOne({ name: preset.name });
      if (!existing) {
        await Tag.create({
          ...preset,
          isPreset: true,
          thoughtCount: 0
        });
        console.log(`Created preset tag: ${preset.displayName}`);
      }
    }
  } catch (error) {
    console.error('Failed to initialize preset tags:', error);
  }
};
