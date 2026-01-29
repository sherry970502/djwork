import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Card,
  Select,
  DatePicker,
  Input,
  Space,
  message,
  Modal,
  Form,
  Switch,
  Typography
} from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  getThoughts,
  getTags,
  updateThought,
  toggleImportant,
  deleteThought
} from '../services/api';
import type { Thought, Tag, Pagination } from '../types';
import ThoughtList from '../components/ThoughtList';

const { Title } = Typography;
const { RangePicker } = DatePicker;
const { TextArea } = Input;

const ThoughtsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  });

  // Filters
  const [selectedTags, setSelectedTags] = useState<string[]>(
    searchParams.get('tags')?.split(',').filter(Boolean) || []
  );
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([
    null,
    null
  ]);
  const [searchText, setSearchText] = useState('');
  const [showImportantOnly, setShowImportantOnly] = useState(
    searchParams.get('important') === 'true'
  );

  // Edit modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingThought, setEditingThought] = useState<Thought | null>(null);
  const [form] = Form.useForm();

  const fetchThoughts = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params: Record<string, string | number | undefined> = {
        page,
        limit: pagination.limit
      };

      if (selectedTags.length > 0) {
        params.tags = selectedTags.join(',');
      }
      if (dateRange[0] && dateRange[1]) {
        params.startDate = dateRange[0].format('YYYY-MM-DD');
        params.endDate = dateRange[1].format('YYYY-MM-DD');
      }
      if (searchText) {
        params.search = searchText;
      }
      if (showImportantOnly) {
        params.isImportant = 'true';
      }

      const res = await getThoughts(params);
      setThoughts(res.data);
      if (res.pagination) {
        setPagination(res.pagination);
      }
    } catch {
      message.error('获取思考列表失败');
    } finally {
      setLoading(false);
    }
  }, [pagination.limit, selectedTags, dateRange, searchText, showImportantOnly]);

  const fetchTags = async () => {
    try {
      const res = await getTags();
      setTags(res.data);
    } catch {
      console.error('Failed to fetch tags');
    }
  };

  useEffect(() => {
    fetchTags();
  }, []);

  useEffect(() => {
    fetchThoughts();
  }, [fetchThoughts]);

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedTags.length > 0) {
      params.set('tags', selectedTags.join(','));
    }
    if (showImportantOnly) {
      params.set('important', 'true');
    }
    setSearchParams(params);
  }, [selectedTags, showImportantOnly, setSearchParams]);

  const handleToggleImportant = async (thoughtId: string) => {
    try {
      await toggleImportant(thoughtId);
      fetchThoughts(pagination.page);
    } catch {
      message.error('操作失败');
    }
  };

  const handleEdit = (thought: Thought) => {
    setEditingThought(thought);
    form.setFieldsValue({
      content: thought.content,
      tags: thought.tags.map(t => t._id),
      isImportant: thought.isImportant
    });
    setEditModalOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!editingThought) return;
    try {
      const values = await form.validateFields();
      await updateThought(editingThought._id, {
        content: values.content,
        tags: values.tags,
        isImportant: values.isImportant
      });
      message.success('更新成功');
      setEditModalOpen(false);
      setEditingThought(null);
      fetchThoughts(pagination.page);
    } catch {
      message.error('更新失败');
    }
  };

  const handleDelete = async (thoughtId: string) => {
    try {
      await deleteThought(thoughtId);
      message.success('删除成功');
      fetchThoughts(pagination.page);
    } catch {
      message.error('删除失败');
    }
  };

  const handleViewMeeting = (meetingId: string) => {
    navigate(`/meetings/${meetingId}`);
  };

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
          思考浏览
        </Title>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap size="middle">
          <Select
            mode="multiple"
            style={{ minWidth: 200 }}
            placeholder="按标签筛选"
            value={selectedTags}
            onChange={setSelectedTags}
            options={tags.map(tag => ({
              value: tag._id,
              label: (
                <span>
                  <span
                    style={{
                      display: 'inline-block',
                      width: 12,
                      height: 12,
                      borderRadius: 2,
                      background: tag.color,
                      marginRight: 8
                    }}
                  />
                  {tag.displayName} ({tag.thoughtCount})
                </span>
              )
            }))}
            allowClear
          />

          <RangePicker
            value={dateRange}
            onChange={(dates) => setDateRange(dates as [dayjs.Dayjs | null, dayjs.Dayjs | null])}
            placeholder={['开始日期', '结束日期']}
          />

          <Input
            style={{ width: 200 }}
            placeholder="搜索内容"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            onPressEnter={() => fetchThoughts(1)}
          />

          <Space>
            <span>只看重要:</span>
            <Switch
              checked={showImportantOnly}
              onChange={setShowImportantOnly}
            />
          </Space>
        </Space>
      </Card>

      <ThoughtList
        thoughts={thoughts}
        loading={loading}
        onToggleImportant={handleToggleImportant}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onViewMeeting={handleViewMeeting}
        pagination={{
          current: pagination.page,
          pageSize: pagination.limit,
          total: pagination.total,
          onChange: (page, pageSize) => {
            setPagination(prev => ({ ...prev, limit: pageSize }));
            fetchThoughts(page);
          }
        }}
      />

      <Modal
        title="编辑思考"
        open={editModalOpen}
        onCancel={() => {
          setEditModalOpen(false);
          setEditingThought(null);
        }}
        onOk={handleEditSubmit}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="content"
            label="内容"
            rules={[{ required: true, message: '请输入内容' }]}
          >
            <TextArea rows={4} />
          </Form.Item>
          <Form.Item name="tags" label="标签">
            <Select
              mode="multiple"
              placeholder="选择标签"
              options={tags.map(tag => ({
                value: tag._id,
                label: (
                  <span>
                    <span
                      style={{
                        display: 'inline-block',
                        width: 12,
                        height: 12,
                        borderRadius: 2,
                        background: tag.color,
                        marginRight: 8
                      }}
                    />
                    {tag.displayName}
                  </span>
                )
              }))}
            />
          </Form.Item>
          <Form.Item name="isImportant" label="标记为重要" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ThoughtsPage;
