import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Card,
  Button,
  Tag,
  Space,
  message,
  Spin,
  Typography,
  Descriptions,
  Modal,
  Form,
  Input,
  Select,
  Divider,
  Empty
} from 'antd';
import {
  ArrowLeftOutlined,
  PlayCircleOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  getMeeting,
  processMeeting,
  getTags,
  updateThought,
  toggleImportant,
  deleteThought
} from '../services/api';
import type { MeetingMinutes, Thought, Tag as TagType } from '../types';
import ThoughtList from '../components/ThoughtList';

const { Title, Paragraph } = Typography;
const { TextArea } = Input;

const statusMap: Record<string, { color: string; text: string }> = {
  pending: { color: 'orange', text: '待处理' },
  processing: { color: 'blue', text: '处理中' },
  completed: { color: 'green', text: '已完成' },
  failed: { color: 'red', text: '处理失败' }
};

const MeetingDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const highlightText = searchParams.get('highlight');
  const contentRef = useRef<HTMLDivElement>(null);
  const [meeting, setMeeting] = useState<MeetingMinutes & { thoughts: Thought[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [tags, setTags] = useState<TagType[]>([]);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingThought, setEditingThought] = useState<Thought | null>(null);
  const [form] = Form.useForm();

  const fetchMeeting = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await getMeeting(id);
      setMeeting(res.data);
    } catch {
      message.error('获取会议详情失败');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchTags = async () => {
    try {
      const res = await getTags();
      setTags(res.data);
    } catch {
      console.error('Failed to fetch tags');
    }
  };

  useEffect(() => {
    fetchMeeting();
    fetchTags();
  }, [fetchMeeting]);

  // Poll for processing status
  useEffect(() => {
    if (meeting?.processStatus === 'processing') {
      const timer = setInterval(fetchMeeting, 5000);
      return () => clearInterval(timer);
    }
  }, [meeting?.processStatus, fetchMeeting]);

  const handleProcess = async () => {
    if (!id) return;
    try {
      await processMeeting(id);
      message.success('开始处理');
      fetchMeeting();
    } catch {
      message.error('触发处理失败');
    }
  };

  const handleToggleImportant = async (thoughtId: string) => {
    try {
      await toggleImportant(thoughtId);
      fetchMeeting();
    } catch {
      message.error('操作失败');
    }
  };

  const handleEdit = (thought: Thought) => {
    setEditingThought(thought);
    form.setFieldsValue({
      content: thought.content,
      tags: thought.tags.map(t => t._id)
    });
    setEditModalOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!editingThought) return;
    try {
      const values = await form.validateFields();
      await updateThought(editingThought._id, {
        content: values.content,
        tags: values.tags
      });
      message.success('更新成功');
      setEditModalOpen(false);
      setEditingThought(null);
      fetchMeeting();
    } catch {
      message.error('更新失败');
    }
  };

  const handleDelete = async (thoughtId: string) => {
    try {
      await deleteThought(thoughtId);
      message.success('删除成功');
      fetchMeeting();
    } catch {
      message.error('删除失败');
    }
  };

  // 渲染高亮内容 - 使用 useMemo 确保响应 highlightText 变化
  const renderedContent = React.useMemo(() => {
    if (!meeting || !highlightText) {
      return meeting?.content || '';
    }

    const content = meeting.content;
    const index = content.indexOf(highlightText);
    if (index === -1) {
      return content;
    }

    return (
      <>
        {content.substring(0, index)}
        <span
          key={highlightText}
          className="highlight-text"
          style={{
            backgroundColor: '#fff566',
            padding: '2px 4px',
            borderRadius: 2,
            fontWeight: 500
          }}
        >
          {highlightText}
        </span>
        {content.substring(index + highlightText.length)}
      </>
    );
  }, [meeting, highlightText]);

  // 高亮并滚动到指定文本
  useEffect(() => {
    if (meeting && highlightText && contentRef.current) {
      // 延迟确保 DOM 已更新
      setTimeout(() => {
        const highlightElement = contentRef.current?.querySelector('.highlight-text');
        if (highlightElement) {
          highlightElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 200);
    }
  }, [meeting, highlightText]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!meeting) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Empty description="会议不存在" />
        <Button type="primary" onClick={() => navigate('/meetings')}>
          返回列表
        </Button>
      </div>
    );
  }

  const { color, text } = statusMap[meeting.processStatus];

  return (
    <div>
      <Button
        type="link"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/meetings')}
        style={{ marginBottom: 16, padding: 0 }}
      >
        返回列表
      </Button>

      <Card>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 24
          }}
        >
          <div>
            <Title level={4} style={{ margin: 0 }}>
              {meeting.title}
            </Title>
            <Space style={{ marginTop: 8 }}>
              <Tag color={color}>{text}</Tag>
              {meeting.processError && (
                <Tag color="red">错误: {meeting.processError}</Tag>
              )}
            </Space>
          </div>
          <Space>
            {(meeting.processStatus === 'pending' ||
              meeting.processStatus === 'failed') && (
              <Button
                type="primary"
                icon={
                  meeting.processStatus === 'failed' ? (
                    <ReloadOutlined />
                  ) : (
                    <PlayCircleOutlined />
                  )
                }
                onClick={handleProcess}
              >
                {meeting.processStatus === 'failed' ? '重新处理' : '开始处理'}
              </Button>
            )}
          </Space>
        </div>

        <Descriptions column={3}>
          <Descriptions.Item label="会议日期">
            {dayjs(meeting.meetingDate).format('YYYY-MM-DD')}
          </Descriptions.Item>
          <Descriptions.Item label="来源类型">
            {meeting.sourceType === 'paste'
              ? '文本粘贴'
              : meeting.sourceType.toUpperCase()}
          </Descriptions.Item>
          <Descriptions.Item label="思考数量">
            {meeting.thoughtCount}
          </Descriptions.Item>
          {meeting.originalFileName && (
            <Descriptions.Item label="原始文件">
              {meeting.originalFileName}
            </Descriptions.Item>
          )}
          {meeting.processedAt && (
            <Descriptions.Item label="处理时间">
              {dayjs(meeting.processedAt).format('YYYY-MM-DD HH:mm')}
            </Descriptions.Item>
          )}
        </Descriptions>

        <Divider />

        <div style={{ marginBottom: 24 }}>
          <Title level={5}>
            原始内容
            {highlightText && (
              <Tag color="gold" style={{ marginLeft: 8 }}>
                已定位到引用文本
              </Tag>
            )}
          </Title>
          <div
            ref={contentRef}
            style={{
              maxHeight: 400,
              overflow: 'auto',
              background: '#f5f5f5',
              padding: 16,
              borderRadius: 4
            }}
          >
            <Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>
              {renderedContent}
            </Paragraph>
          </div>
        </div>

        <Divider />

        <Title level={5}>提取的思考 ({meeting.thoughts?.length || 0})</Title>
        {meeting.thoughts && meeting.thoughts.length > 0 ? (
          <ThoughtList
            thoughts={meeting.thoughts}
            onToggleImportant={handleToggleImportant}
            onEdit={handleEdit}
            onDelete={handleDelete}
            showMeeting={false}
          />
        ) : (
          <Empty
            description={
              meeting.processStatus === 'pending'
                ? '请先处理会议纪要以提取思考'
                : meeting.processStatus === 'processing'
                ? '正在处理中...'
                : '未提取到思考'
            }
          />
        )}
      </Card>

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
        </Form>
      </Modal>
    </div>
  );
};

export default MeetingDetailPage;
