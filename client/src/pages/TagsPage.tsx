import React, { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Tag,
  Space,
  message,
  Modal,
  Form,
  Input,
  Popconfirm,
  Typography,
  ColorPicker,
  Spin,
  Alert,
  Checkbox,
  List,
  Divider,
  Statistic,
  Row,
  Col,
  Badge
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  HistoryOutlined,
  CalendarOutlined,
  BulbOutlined,
  StarOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { Color } from 'antd/es/color-picker';
import { getTags, createTag, updateTag, deleteTag, getTagStats, findTagMatches, applyTagToHistory } from '../services/api';
import type { Tag as TagType, TagStats } from '../types';

const { Title } = Typography;

const TagsPage: React.FC = () => {
  const [tags, setTags] = useState<TagType[]>([]);
  const [stats, setStats] = useState<TagStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<TagType | null>(null);
  const [form] = Form.useForm();

  // 应用到历史数据相关状态
  const [matchModalOpen, setMatchModalOpen] = useState(false);
  const [matchingTag, setMatchingTag] = useState<TagType | null>(null);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [matchedMeetings, setMatchedMeetings] = useState<any[]>([]);
  const [matchedThoughts, setMatchedThoughts] = useState<any[]>([]);
  const [selectedMeetingIds, setSelectedMeetingIds] = useState<string[]>([]);
  const [selectedThoughtIds, setSelectedThoughtIds] = useState<string[]>([]);
  const [applyToMeetingThoughts, setApplyToMeetingThoughts] = useState(true);
  const [applying, setApplying] = useState(false);

  const fetchTags = async () => {
    setLoading(true);
    try {
      const [tagsRes, statsRes] = await Promise.all([getTags(), getTagStats()]);
      setTags(tagsRes.data);
      setStats(statsRes.data);
    } catch {
      message.error('获取标签失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTags();
  }, []);

  const handleCreate = () => {
    setEditingTag(null);
    form.resetFields();
    form.setFieldsValue({ color: '#1890ff' });
    setModalOpen(true);
  };

  const handleEdit = (tag: TagType) => {
    setEditingTag(tag);
    form.setFieldsValue({
      name: tag.name,
      displayName: tag.displayName,
      description: tag.description,
      color: tag.color,
      keywords: tag.keywords.join(', ')
    });
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTag(id);
      message.success('删除成功');
      fetchTags();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      message.error(err.response?.data?.message || '删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const colorValue = typeof values.color === 'string'
        ? values.color
        : (values.color as Color)?.toHexString?.() || '#1890ff';

      const data = {
        name: values.name,
        displayName: values.displayName,
        description: values.description || '',
        color: colorValue,
        keywords: values.keywords
          ? values.keywords.split(/[,，]/).map((k: string) => k.trim()).filter(Boolean)
          : []
      };

      if (editingTag) {
        await updateTag(editingTag._id, data);
        message.success('更新成功');
      } else {
        await createTag(data);
        message.success('创建成功');
      }

      setModalOpen(false);
      fetchTags();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      message.error(err.response?.data?.message || '操作失败');
    }
  };

  // 打开匹配对话框
  const handleOpenMatchModal = async (tag: TagType) => {
    if (!tag.keywords || tag.keywords.length === 0) {
      message.warning('请先为标签添加关键词，用于匹配历史内容');
      return;
    }

    setMatchingTag(tag);
    setMatchModalOpen(true);
    setMatchedMeetings([]);
    setMatchedThoughts([]);
    setSelectedMeetingIds([]);
    setSelectedThoughtIds([]);
    setLoadingMatches(true);

    try {
      const res = await findTagMatches(tag._id);
      if (res.success) {
        setMatchedMeetings(res.data.matchedMeetings || []);
        setMatchedThoughts(res.data.matchedThoughts || []);

        // 默认选中高匹配度的项目
        const highScoreMeetings = (res.data.matchedMeetings || [])
          .filter((m: any) => m.matchPercentage >= 80)
          .map((m: any) => m._id);
        const highScoreThoughts = (res.data.matchedThoughts || [])
          .filter((t: any) => t.matchPercentage >= 80)
          .map((t: any) => t._id);

        setSelectedMeetingIds(highScoreMeetings);
        setSelectedThoughtIds(highScoreThoughts);

        message.success(`找到 ${res.data.summary.totalMeetings} 个相关会议和 ${res.data.summary.totalThoughts} 条相关灵感`);
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '查找匹配内容失败');
    } finally {
      setLoadingMatches(false);
    }
  };

  // 应用标签到选中的内容
  const handleApplyTag = async () => {
    if (!matchingTag) return;

    if (selectedMeetingIds.length === 0 && selectedThoughtIds.length === 0) {
      message.warning('请至少选择一项内容');
      return;
    }

    setApplying(true);
    try {
      const res = await applyTagToHistory(matchingTag._id, {
        meetingIds: selectedMeetingIds,
        thoughtIds: selectedThoughtIds,
        applyToMeetingThoughts
      });

      if (res.success) {
        message.success(res.message || '应用成功');
        setMatchModalOpen(false);
        fetchTags(); // 刷新标签统计
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '应用失败');
    } finally {
      setApplying(false);
    }
  };

  // Merge tags with stats
  const tagsWithStats = tags.map(tag => {
    const stat = stats.find(s => s._id === tag._id);
    return {
      ...tag,
      thoughtCount: stat?.thoughtCount || tag.thoughtCount,
      importantCount: stat?.importantCount || 0
    };
  });

  const columns: ColumnsType<TagType & { importantCount?: number }> = [
    {
      title: '标签',
      dataIndex: 'displayName',
      key: 'displayName',
      render: (text, record) => (
        <Tag color={record.color}>{text}</Tag>
      )
    },
    {
      title: '标识',
      dataIndex: 'name',
      key: 'name'
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true
    },
    {
      title: '关键词',
      dataIndex: 'keywords',
      key: 'keywords',
      render: (keywords: string[]) => (
        <Space wrap>
          {keywords.slice(0, 3).map(k => (
            <Tag key={k}>{k}</Tag>
          ))}
          {keywords.length > 3 && <Tag>+{keywords.length - 3}</Tag>}
        </Space>
      )
    },
    {
      title: '思考数',
      dataIndex: 'thoughtCount',
      key: 'thoughtCount',
      width: 80,
      sorter: (a, b) => a.thoughtCount - b.thoughtCount
    },
    {
      title: '重要数',
      dataIndex: 'importantCount',
      key: 'importantCount',
      width: 80
    },
    {
      title: '类型',
      key: 'isPreset',
      width: 80,
      render: (_, record) =>
        record.isPreset ? (
          <Tag color="blue">预设</Tag>
        ) : (
          <Tag color="green">自定义</Tag>
        )
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            icon={<HistoryOutlined />}
            onClick={() => handleOpenMatchModal(record)}
            disabled={!record.keywords || record.keywords.length === 0}
          >
            应用到历史
          </Button>
          {!record.isPreset && (
            <Popconfirm
              title="确定删除此标签吗？"
              description="关联的思考将移除此标签"
              onConfirm={() => handleDelete(record._id)}
              okText="确定"
              cancelText="取消"
            >
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ];

  return (
    <div>
      <div
        style={{
          marginBottom: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <Title level={4} style={{ margin: 0 }}>
          标签管理
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          新建标签
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={tagsWithStats}
        rowKey="_id"
        loading={loading}
        pagination={false}
      />

      <Modal
        title={editingTag ? '编辑标签' : '新建标签'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="标识名"
            rules={[
              { required: true, message: '请输入标识名' },
              { pattern: /^[a-z_]+$/, message: '只能使用小写字母和下划线' }
            ]}
            extra="唯一标识，只能使用小写字母和下划线"
          >
            <Input placeholder="例如: my_tag" disabled={!!editingTag} />
          </Form.Item>

          <Form.Item
            name="displayName"
            label="显示名称"
            rules={[{ required: true, message: '请输入显示名称' }]}
          >
            <Input placeholder="例如: 我的标签" />
          </Form.Item>

          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="标签描述（可选）" />
          </Form.Item>

          <Form.Item name="color" label="颜色">
            <ColorPicker />
          </Form.Item>

          <Form.Item
            name="keywords"
            label="关键词"
            extra="多个关键词用逗号分隔，用于 AI 分类参考"
          >
            <Input placeholder="例如: 战略, 规划, 方向" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 应用到历史数据对话框 */}
      <Modal
        title={
          <Space>
            <HistoryOutlined />
            为标签「{matchingTag?.displayName}」匹配历史内容
          </Space>
        }
        open={matchModalOpen}
        onCancel={() => setMatchModalOpen(false)}
        width={900}
        footer={[
          <Button key="cancel" onClick={() => setMatchModalOpen(false)}>
            取消
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={applying}
            disabled={selectedMeetingIds.length === 0 && selectedThoughtIds.length === 0}
            onClick={handleApplyTag}
          >
            应用到选中项 ({selectedMeetingIds.length + selectedThoughtIds.length})
          </Button>
        ]}
      >
        {matchingTag && (
          <div>
            <Alert
              message={
                <div>
                  <strong>匹配关键词：</strong>
                  {matchingTag.keywords.map(k => (
                    <Tag key={k} color="blue" style={{ marginLeft: 4 }}>
                      {k}
                    </Tag>
                  ))}
                </div>
              }
              type="info"
              style={{ marginBottom: 16 }}
            />

            {loadingMatches ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <Spin tip="正在分析匹配内容..." />
              </div>
            ) : (
              <div>
                {/* 统计信息 */}
                <Row gutter={16} style={{ marginBottom: 16 }}>
                  <Col span={8}>
                    <Statistic
                      title="匹配会议"
                      value={matchedMeetings.length}
                      suffix="个"
                      prefix={<CalendarOutlined />}
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title="匹配灵感"
                      value={matchedThoughts.length}
                      suffix="条"
                      prefix={<BulbOutlined />}
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title="高匹配度"
                      value={
                        matchedMeetings.filter(m => m.matchPercentage >= 80).length +
                        matchedThoughts.filter(t => t.matchPercentage >= 80).length
                      }
                      suffix="项"
                      prefix={<StarOutlined />}
                    />
                  </Col>
                </Row>

                <Divider />

                {/* 会议列表 */}
                {matchedMeetings.length > 0 && (
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong>
                        <CalendarOutlined style={{ marginRight: 8 }} />
                        匹配的会议 ({matchedMeetings.length})
                      </strong>
                      <Space>
                        <Checkbox
                          checked={applyToMeetingThoughts}
                          onChange={e => setApplyToMeetingThoughts(e.target.checked)}
                        >
                          同时应用到会议下的所有灵感
                        </Checkbox>
                        <Button
                          size="small"
                          onClick={() => setSelectedMeetingIds(matchedMeetings.map(m => m._id))}
                        >
                          全选
                        </Button>
                        <Button
                          size="small"
                          onClick={() => setSelectedMeetingIds([])}
                        >
                          清空
                        </Button>
                      </Space>
                    </div>
                    <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                      <Checkbox.Group
                        value={selectedMeetingIds}
                        onChange={values => setSelectedMeetingIds(values as string[])}
                        style={{ width: '100%' }}
                      >
                        <List
                          dataSource={matchedMeetings}
                          renderItem={(meeting: any) => (
                            <List.Item
                              style={{
                                padding: 12,
                                background: selectedMeetingIds.includes(meeting._id) ? '#e6f7ff' : '#fafafa',
                                marginBottom: 8,
                                borderRadius: 4,
                                border: selectedMeetingIds.includes(meeting._id) ? '1px solid #1890ff' : '1px solid #f0f0f0'
                              }}
                            >
                              <div style={{ width: '100%', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                                <Checkbox value={meeting._id} />
                                <div style={{ flex: 1 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                    <strong>{meeting.title}</strong>
                                    <Space>
                                      <Badge
                                        count={`${meeting.matchPercentage}%`}
                                        style={{
                                          backgroundColor: meeting.matchPercentage >= 80 ? '#52c41a' :
                                            meeting.matchPercentage >= 60 ? '#faad14' : '#d9d9d9'
                                        }}
                                      />
                                      <span style={{ color: '#999', fontSize: 12 }}>
                                        {new Date(meeting.meetingDate).toLocaleDateString('zh-CN')}
                                      </span>
                                    </Space>
                                  </div>
                                  {meeting.matchedKeywords?.length > 0 && (
                                    <div>
                                      <span style={{ fontSize: 12, color: '#666' }}>匹配: </span>
                                      {meeting.matchedKeywords.map((mk: any, i: number) => (
                                        <Tag key={i} color="blue" style={{ fontSize: 11 }}>
                                          {mk.keyword} ({mk.source})
                                        </Tag>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </List.Item>
                          )}
                        />
                      </Checkbox.Group>
                    </div>
                  </div>
                )}

                {/* 灵感列表 */}
                {matchedThoughts.length > 0 && (
                  <div>
                    <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong>
                        <BulbOutlined style={{ marginRight: 8 }} />
                        匹配的灵感 ({matchedThoughts.length})
                      </strong>
                      <Space>
                        <Button
                          size="small"
                          onClick={() => setSelectedThoughtIds(matchedThoughts.map(t => t._id))}
                        >
                          全选
                        </Button>
                        <Button
                          size="small"
                          onClick={() => setSelectedThoughtIds([])}
                        >
                          清空
                        </Button>
                      </Space>
                    </div>
                    <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                      <Checkbox.Group
                        value={selectedThoughtIds}
                        onChange={values => setSelectedThoughtIds(values as string[])}
                        style={{ width: '100%' }}
                      >
                        <List
                          dataSource={matchedThoughts}
                          renderItem={(thought: any) => (
                            <List.Item
                              style={{
                                padding: 12,
                                background: selectedThoughtIds.includes(thought._id) ? '#e6f7ff' : '#fafafa',
                                marginBottom: 8,
                                borderRadius: 4,
                                border: selectedThoughtIds.includes(thought._id) ? '1px solid #1890ff' : '1px solid #f0f0f0'
                              }}
                            >
                              <div style={{ width: '100%', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                                <Checkbox value={thought._id} />
                                <div style={{ flex: 1 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                    <span style={{ fontSize: 13 }}>{thought.content.substring(0, 100)}{thought.content.length > 100 ? '...' : ''}</span>
                                    <Badge
                                      count={`${thought.matchPercentage}%`}
                                      style={{
                                        backgroundColor: thought.matchPercentage >= 80 ? '#52c41a' :
                                          thought.matchPercentage >= 60 ? '#faad14' : '#d9d9d9'
                                      }}
                                    />
                                  </div>
                                  <div style={{ fontSize: 12, color: '#999' }}>
                                    来自: {thought.meetingTitle} ({new Date(thought.meetingDate).toLocaleDateString('zh-CN')})
                                  </div>
                                  {thought.matchedKeywords?.length > 0 && (
                                    <div style={{ marginTop: 4 }}>
                                      <span style={{ fontSize: 12, color: '#666' }}>匹配: </span>
                                      {thought.matchedKeywords.map((mk: any, i: number) => (
                                        <Tag key={i} color="green" style={{ fontSize: 11 }}>
                                          {mk.keyword}
                                        </Tag>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </List.Item>
                          )}
                        />
                      </Checkbox.Group>
                    </div>
                  </div>
                )}

                {matchedMeetings.length === 0 && matchedThoughts.length === 0 && (
                  <Alert
                    message="未找到匹配内容"
                    description="没有找到包含指定关键词的会议或灵感。您可以尝试调整标签的关键词。"
                    type="info"
                    showIcon
                  />
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default TagsPage;
