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
  ColorPicker
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { Color } from 'antd/es/color-picker';
import { getTags, createTag, updateTag, deleteTag, getTagStats } from '../services/api';
import type { Tag as TagType, TagStats } from '../types';

const { Title } = Typography;

const TagsPage: React.FC = () => {
  const [tags, setTags] = useState<TagType[]>([]);
  const [stats, setStats] = useState<TagStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<TagType | null>(null);
  const [form] = Form.useForm();

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
      width: 150,
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
    </div>
  );
};

export default TagsPage;
