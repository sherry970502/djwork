import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Modal,
  Form,
  Input,
  message,
  List,
  Space,
  Tag,
  Popconfirm,
  Empty,
  Typography,
  Spin,
  Alert
} from 'antd';
import {
  PlusOutlined,
  HeartOutlined,
  DeleteOutlined,
  EditOutlined,
  BulbOutlined,
  ThunderboltOutlined,
  RobotOutlined,
  StarOutlined,
  CheckCircleOutlined,
  HolderOutlined
} from '@ant-design/icons';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import * as api from '../services/api';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

interface WishlistItem {
  _id: string;
  content: string;
  category?: string;
  order: number;
  createdAt: string;
}

interface AISuggestion {
  content: string;
  reason: string;
}

// 可拖拽的列表项组件
const SortableItem: React.FC<{
  item: WishlistItem;
  onEdit: (item: WishlistItem) => void;
  onDelete: (id: string) => void;
  onDiverge: (item: WishlistItem) => void;
}> = ({ item, onEdit, onDelete, onDiverge }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      '个人成长': 'blue',
      '健康生活': 'green',
      '旅行探索': 'orange',
      '创意项目': 'purple',
      '人际关系': 'pink',
      '学习发展': 'cyan',
    };
    return colors[category] || 'default';
  };

  return (
    <Card
      ref={setNodeRef}
      style={{ ...style, marginBottom: 16, cursor: isDragging ? 'grabbing' : 'grab' }}
      size="small"
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', flex: 1 }}>
          <div
            {...attributes}
            {...listeners}
            style={{
              cursor: isDragging ? 'grabbing' : 'grab',
              marginRight: 12,
              marginTop: 4,
              color: '#8c8c8c'
            }}
          >
            <HolderOutlined />
          </div>
          <div style={{ flex: 1 }}>
            <Space>
              <Text strong style={{ fontSize: 16 }}>
                {item.content}
              </Text>
              {item.category && (
                <Tag color={getCategoryColor(item.category)}>
                  {item.category}
                </Tag>
              )}
            </Space>
          </div>
        </div>
        <Space>
          <Button
            type="text"
            size="small"
            icon={<ThunderboltOutlined />}
            onClick={() => onDiverge(item)}
          >
            AI 发散
          </Button>
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => onEdit(item)}
          />
          <Popconfirm
            title="确定删除这条 Wish 吗？"
            onConfirm={() => onDelete(item._id)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
            />
          </Popconfirm>
        </Space>
      </div>
    </Card>
  );
};

const WishlistPage: React.FC = () => {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<WishlistItem | null>(null);
  const [form] = Form.useForm();

  // AI 功能状态
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summary, setSummary] = useState('');
  const [divergeSuggestions, setDivergeSuggestions] = useState<AISuggestion[]>([]);
  const [selectedItemForDiverge, setSelectedItemForDiverge] = useState<WishlistItem | null>(null);
  const [recommendLoading, setRecommendLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<AISuggestion[]>([]);

  // 拖拽传感器配置
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await api.getWishlist();
      setItems(res.data);
    } catch (error) {
      message.error('获取列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingItem(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (item: WishlistItem) => {
    setEditingItem(item);
    form.setFieldsValue(item);
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      if (editingItem) {
        await api.updateWishlistItem(editingItem._id, values);
        message.success('更新成功');
      } else {
        await api.createWishlistItem(values);
        message.success('添加成功');
      }

      setModalVisible(false);
      fetchItems();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteWishlistItem(id);
      message.success('删除成功');
      fetchItems();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleAutoClassify = async () => {
    try {
      const res = await api.autoClassifyWishlist();
      message.success(res.message || '分类完成');
      fetchItems();
    } catch (error) {
      message.error('分类失败');
    }
  };

  const handleSummarize = async () => {
    try {
      setSummaryLoading(true);
      const res = await api.summarizeWishlist();
      setSummary(res.data.summary);
    } catch (error) {
      message.error('生成总结失败');
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleDiverge = async (item: WishlistItem) => {
    try {
      setSelectedItemForDiverge(item);
      const res = await api.divergeWishlistItem(item._id);
      setDivergeSuggestions(res.data.suggestions);
    } catch (error) {
      message.error('生成建议失败');
    }
  };

  const handleRecommend = async () => {
    try {
      setRecommendLoading(true);
      const res = await api.recommendWishlist();
      setRecommendations(res.data.recommendations);
    } catch (error) {
      message.error('获取推荐失败');
    } finally {
      setRecommendLoading(false);
    }
  };

  const handleAddSuggestion = async (content: string) => {
    try {
      await api.createWishlistItem({ content });
      message.success('已添加到 Wishlist');
      fetchItems();
    } catch (error) {
      message.error('添加失败');
    }
  };

  // 拖拽结束处理
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item._id === active.id);
      const newIndex = items.findIndex((item) => item._id === over.id);

      const newItems = arrayMove(items, oldIndex, newIndex);

      // 更新本地状态
      setItems(newItems);

      // 更新 order 字段并同步到服务器
      const updatedItems = newItems.map((item, index) => ({
        _id: item._id,
        order: index,
      }));

      try {
        await api.reorderWishlist(updatedItems);
        message.success('顺序已更新');
      } catch (error) {
        message.error('更新顺序失败');
        // 如果失败，重新获取数据恢复原状态
        fetchItems();
      }
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <HeartOutlined style={{ marginRight: 8, color: '#ff4d4f' }} />
            DJ Wishlist
          </Title>
          <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
            记录和管理你的人生愿望清单，让 AI 帮你探索更多可能。拖动 <HolderOutlined /> 图标可调整顺序
          </Paragraph>
        </div>
        <Space>
          <Button icon={<BulbOutlined />} onClick={handleAutoClassify}>
            AI 智能分类
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAdd}
            size="large"
          >
            添加 Wish
          </Button>
        </Space>
      </div>

      {/* AI 功能区 */}
      <Card style={{ marginBottom: 24 }}>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {/* 总结 */}
          <div>
            <Button
              icon={<RobotOutlined />}
              onClick={handleSummarize}
              loading={summaryLoading}
            >
              AI 总结我的 Wishlist
            </Button>
            {summary && (
              <Alert
                type="info"
                message="AI 总结"
                description={summary}
                style={{ marginTop: 12 }}
                closable
                onClose={() => setSummary('')}
              />
            )}
          </div>

          {/* 推荐 */}
          <div>
            <Button
              icon={<StarOutlined />}
              onClick={handleRecommend}
              loading={recommendLoading}
            >
              AI 推荐新的活动
            </Button>
            {recommendations.length > 0 && (
              <Card size="small" style={{ marginTop: 12 }}>
                <Title level={5}>💡 AI 推荐</Title>
                <List
                  size="small"
                  dataSource={recommendations}
                  renderItem={(item) => (
                    <List.Item
                      actions={[
                        <Button
                          key="add"
                          type="link"
                          icon={<CheckCircleOutlined />}
                          onClick={() => handleAddSuggestion(item.content)}
                        >
                          加入 Wishlist
                        </Button>
                      ]}
                    >
                      <List.Item.Meta
                        title={item.content}
                        description={item.reason}
                      />
                    </List.Item>
                  )}
                />
              </Card>
            )}
          </div>
        </Space>
      </Card>

      {/* Wishlist 列表 */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Spin size="large" />
        </div>
      ) : items.length === 0 ? (
        <Empty
          description="还没有添加任何 Wish"
          style={{ marginTop: 60 }}
        >
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            添加第一个 Wish
          </Button>
        </Empty>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={items.map(item => item._id)}
            strategy={verticalListSortingStrategy}
          >
            {items.map((item) => (
              <SortableItem
                key={item._id}
                item={item}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onDiverge={handleDiverge}
              />
            ))}
          </SortableContext>
        </DndContext>
      )}

      {/* 添加/编辑 Modal */}
      <Modal
        title={editingItem ? '编辑 Wish' : '添加 Wish'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="content"
            label="内容"
            rules={[{ required: true, message: '请输入内容' }]}
          >
            <TextArea rows={4} placeholder="输入你的愿望..." />
          </Form.Item>
          <Form.Item name="category" label="分类">
            <Input placeholder="可选，如：旅行、学习、健康等" />
          </Form.Item>
        </Form>
      </Modal>

      {/* AI 发散建议 Modal */}
      <Modal
        title={`💡 AI 发散建议：${selectedItemForDiverge?.content.substring(0, 30)}...`}
        open={divergeSuggestions.length > 0}
        onCancel={() => setDivergeSuggestions([])}
        footer={null}
        width={700}
      >
        <List
          dataSource={divergeSuggestions}
          renderItem={(item) => (
            <List.Item
              actions={[
                <Button
                  key="add"
                  type="primary"
                  size="small"
                  icon={<CheckCircleOutlined />}
                  onClick={() => {
                    handleAddSuggestion(item.content);
                    setDivergeSuggestions([]);
                  }}
                >
                  加入 Wishlist
                </Button>
              ]}
            >
              <List.Item.Meta
                title={item.content}
                description={item.reason}
              />
            </List.Item>
          )}
        />
      </Modal>
    </div>
  );
};

export default WishlistPage;
