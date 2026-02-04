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
  Select,
  Modal,
  Checkbox
} from 'antd';
import {
  PlusOutlined,
  PlayCircleOutlined,
  DeleteOutlined,
  EyeOutlined,
  ReloadOutlined,
  SyncOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { getMeetings, processMeeting, deleteMeeting, reprocessMeeting } from '../services/api';
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

  const handleReprocess = (record: MeetingMinutes) => {
    let preserveManual = false;
    let preserveMerged = true;

    Modal.confirm({
      title: '重新整理会议灵感',
      width: 500,
      content: (
        <div>
          <p style={{ marginBottom: 16 }}>
            此操作将使用改进的算法重新提取灵感，解决以下问题：
          </p>
          <ul style={{ marginBottom: 16, paddingLeft: 20 }}>
            <li>区分DJ和其他参会者的发言</li>
            <li>分类内容类型（待办、结论、问题等）</li>
            <li>提供原文引用，避免误解</li>
            <li>更准确的灵感提取</li>
          </ul>
          <p style={{ color: '#ff4d4f', marginBottom: 12 }}>
            ⚠️ 现有的 <strong>{record.thoughtCount || 0}</strong> 条灵感将被删除
          </p>
          <div>
            <Checkbox
              defaultChecked={preserveManual}
              onChange={e => preserveManual = e.target.checked}
            >
              保留手动添加的灵感
            </Checkbox>
            <br />
            <Checkbox
              defaultChecked={preserveMerged}
              onChange={e => preserveMerged = e.target.checked}
            >
              保留已合并的灵感（推荐）
            </Checkbox>
          </div>
        </div>
      ),
      okText: '确认重新整理',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await reprocessMeeting(record._id, {
            preserveManual,
            preserveMerged
          });
          message.success('已开始重新整理，请稍后刷新查看结果');
          fetchMeetings(pagination.page);
        } catch (error: any) {
          message.error(error.response?.data?.message || '重新整理失败');
        }
      }
    });
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
          {record.processStatus === 'completed' && (
            <Button
              type="link"
              size="small"
              icon={<SyncOutlined />}
              onClick={() => handleReprocess(record)}
            >
              重新整理
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
