import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  Button,
  Tag,
  Space,
  message,
  Popconfirm,
  Typography,
  Select
} from 'antd';
import {
  PlusOutlined,
  PlayCircleOutlined,
  DeleteOutlined,
  EyeOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { getMeetings, processMeeting, deleteMeeting } from '../services/api';
import type { MeetingMinutes, Pagination } from '../types';
import MeetingUploader from '../components/MeetingUploader';

const { Title } = Typography;

const statusMap: Record<string, { color: string; text: string }> = {
  pending: { color: 'orange', text: '待处理' },
  processing: { color: 'blue', text: '处理中' },
  completed: { color: 'green', text: '已完成' },
  failed: { color: 'red', text: '处理失败' }
};

const MeetingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState<MeetingMinutes[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  });
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [uploaderOpen, setUploaderOpen] = useState(false);

  const fetchMeetings = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await getMeetings({
        page,
        limit: pagination.limit,
        status: statusFilter || undefined
      });
      setMeetings(res.data);
      if (res.pagination) {
        setPagination(res.pagination);
      }
    } catch {
      message.error('获取会议列表失败');
    } finally {
      setLoading(false);
    }
  }, [pagination.limit, statusFilter]);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  // Poll for processing status
  useEffect(() => {
    const hasProcessing = meetings.some(m => m.processStatus === 'processing');
    if (hasProcessing) {
      const timer = setInterval(() => {
        fetchMeetings(pagination.page);
      }, 5000);
      return () => clearInterval(timer);
    }
  }, [meetings, pagination.page, fetchMeetings]);

  const handleProcess = async (id: string) => {
    try {
      await processMeeting(id);
      message.success('开始处理');
      fetchMeetings(pagination.page);
    } catch {
      message.error('触发处理失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMeeting(id);
      message.success('删除成功');
      fetchMeetings(pagination.page);
    } catch {
      message.error('删除失败');
    }
  };

  const columns: ColumnsType<MeetingMinutes> = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      render: (text, record) => (
        <a onClick={() => navigate(`/meetings/${record._id}`)}>{text}</a>
      )
    },
    {
      title: '会议日期',
      dataIndex: 'meetingDate',
      key: 'meetingDate',
      width: 120,
      render: date => dayjs(date).format('YYYY-MM-DD')
    },
    {
      title: '来源',
      dataIndex: 'sourceType',
      key: 'sourceType',
      width: 80,
      render: type => {
        const typeMap: Record<string, string> = {
          paste: '粘贴',
          word: 'Word',
          pdf: 'PDF',
          txt: '文本'
        };
        return typeMap[type] || type;
      }
    },
    {
      title: '状态',
      dataIndex: 'processStatus',
      key: 'processStatus',
      width: 100,
      render: status => {
        const { color, text } = statusMap[status] || { color: 'default', text: status };
        return <Tag color={color}>{text}</Tag>;
      }
    },
    {
      title: '思考数',
      dataIndex: 'thoughtCount',
      key: 'thoughtCount',
      width: 80
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: date => dayjs(date).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/meetings/${record._id}`)}
          >
            查看
          </Button>
          {record.processStatus === 'pending' && (
            <Button
              type="link"
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={() => handleProcess(record._id)}
            >
              处理
            </Button>
          )}
          {record.processStatus === 'failed' && (
            <Button
              type="link"
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => handleProcess(record._id)}
            >
              重试
            </Button>
          )}
          <Popconfirm
            title="确定删除此会议纪要吗？"
            description="关联的思考也将被删除"
            onConfirm={() => handleDelete(record._id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
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
          会议纪要管理
        </Title>
        <Space>
          <Select
            style={{ width: 120 }}
            placeholder="状态筛选"
            allowClear
            value={statusFilter || undefined}
            onChange={v => setStatusFilter(v || '')}
            options={[
              { value: 'pending', label: '待处理' },
              { value: 'processing', label: '处理中' },
              { value: 'completed', label: '已完成' },
              { value: 'failed', label: '处理失败' }
            ]}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setUploaderOpen(true)}
          >
            新建会议
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={meetings}
        rowKey="_id"
        loading={loading}
        pagination={{
          current: pagination.page,
          pageSize: pagination.limit,
          total: pagination.total,
          showSizeChanger: true,
          showTotal: total => `共 ${total} 条`,
          onChange: (page, pageSize) => {
            setPagination(prev => ({ ...prev, limit: pageSize }));
            fetchMeetings(page);
          }
        }}
      />

      <MeetingUploader
        open={uploaderOpen}
        onClose={() => setUploaderOpen(false)}
        onSuccess={() => fetchMeetings(1)}
      />
    </div>
  );
};

export default MeetingsPage;
