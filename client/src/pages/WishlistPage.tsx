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
  Divider,
  Spin,
  Alert,
  Collapse
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
  ArrowUpOutlined,
  ArrowDownOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
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

const WishlistPage: React.FC = () => {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<WishlistItem | null>(null);
  const [form] = Form.useForm();

  // AI 功能状态
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summary, setSummary] = useState('');
  const [divergeLoading, setDivergeLoading] = useState(false);
  const [divergeSuggestions, setDivergeSuggestions] = useState<AISuggestion[]>([]);
  const [selectedItemForDiverge, setSelectedItemForDiverge] = useState<WishlistItem | null>(null);
  const [recommendLoading, setRecommendLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<AISuggestion[]>([]);

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
      form.resetFields();
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

  const handleMove = async (id: string, direction: 'up' | 'down') => {
    try {
      await api.moveWishlistItem(id, direction);
      fetchItems();
    } catch (error) {
      message.error('移动失败');
    }
  };

  const handleAutoClassify = async () => {
    try {
      setLoading(true);
      await api.autoClassifyWishlist();
      message.success('AI 分类完成');
      fetchItems();
    } catch (error) {
      message.error('AI 分类失败');
    } finally {
      setLoading(false);
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
      setDivergeLoading(true);
      const res = await api.divergeWishlistItem(item._id);
      setDivergeSuggestions(res.data.suggestions);
    } catch (error) {
      message.error('生成建议失败');
    } finally {
      setDivergeLoading(false);
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
      setDivergeSuggestions([]);
      setRecommendations([]);
    } catch (error) {
      message.error('添加失败');
    }
  };

  const getCategoryColor = (category?: string) => {
    const colors: Record<string, string> = {
      '个人成长': 'blue',
      '健康生活': 'green',
      '旅行探索': 'orange',
      '创意项目': 'purple',
      '人际关系': 'pink',
      '学习发展': 'cyan'
    };
    return colors[category || ''] || 'default';
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
            记录和管理你的人生愿望清单，让 AI 帮你探索更多可能
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
        <List
          dataSource={items}
          renderItem={(item, index) => (
            <Card
              key={item._id}
              style={{ marginBottom: 16 }}
              size="small"
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
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
                <Space>
                  <Button
                    type="text"
                    size="small"
                    icon={<ThunderboltOutlined />}
                    onClick={() => handleDiverge(item)}
                  >
                    AI 发散
                  </Button>
                  <Button
                    type="text"
                    size="small"
                    icon={<ArrowUpOutlined />}
                    disabled={index === 0}
                    onClick={() => handleMove(item._id, 'up')}
                  />
                  <Button
                    type="text"
                    size="small"
                    icon={<ArrowDownOutlined />}
                    disabled={index === items.length - 1}
                    onClick={() => handleMove(item._id, 'down')}
                  />
                  <Button
                    type="text"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => handleEdit(item)}
                  />
                  <Popconfirm
                    title="确认删除？"
                    onConfirm={() => handleDelete(item._id)}
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
          )}
        />
      )}

      {/* 发散建议 Modal */}
      <Modal
        title={
          <Space>
            <ThunderboltOutlined style={{ color: '#667eea' }} />
            AI 发散建议
          </Space>
        }
        open={divergeSuggestions.length > 0}
        onCancel={() => setDivergeSuggestions([])}
        footer={null}
        width={700}
      >
        <Alert
          type="info"
          message={`基于"${selectedItemForDiverge?.content}"的发散建议`}
          style={{ marginBottom: 16 }}
        />
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
      </Modal>

      {/* 添加/编辑 Modal */}
      <Modal
        title={editingItem ? '编辑 Wish' : '添加 Wish'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        onOk={handleSubmit}
        okText="确定"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="content"
            label="愿望内容"
            rules={[{ required: true, message: '请输入愿望内容' }]}
          >
            <TextArea
              rows={3}
              placeholder="例如：学会弹吉他、去冰岛看极光、完成一次马拉松..."
            />
          </Form.Item>
          <Form.Item
            name="category"
            label="分类（可选）"
          >
            <Input placeholder="AI 会自动帮你分类，也可以手动输入" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default WishlistPage;
