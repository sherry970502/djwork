import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Modal,
  Form,
  Input,
  message,
  Row,
  Col,
  Space,
  Popconfirm,
  Empty,
  Select
} from 'antd';
import {
  PlusOutlined,
  LinkOutlined,
  EditOutlined,
  DeleteOutlined,
  GlobalOutlined,
  ToolOutlined,
  AppstoreOutlined,
  DatabaseOutlined,
  CloudOutlined,
  CodeOutlined
} from '@ant-design/icons';
import { Typography } from 'antd';

const { Title, Text, Paragraph } = Typography;

interface ExternalTool {
  id: string;
  name: string;
  url: string;
  description?: string;
  icon: string;
  category?: string;
}

const iconMap: Record<string, React.ReactNode> = {
  link: <LinkOutlined />,
  global: <GlobalOutlined />,
  tool: <ToolOutlined />,
  app: <AppstoreOutlined />,
  database: <DatabaseOutlined />,
  cloud: <CloudOutlined />,
  code: <CodeOutlined />
};

const LifeToolsPage: React.FC = () => {
  const [tools, setTools] = useState<ExternalTool[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTool, setEditingTool] = useState<ExternalTool | null>(null);
  const [form] = Form.useForm();

  // 从 localStorage 加载配置
  useEffect(() => {
    const savedTools = localStorage.getItem('dj_external_tools');
    if (savedTools) {
      try {
        setTools(JSON.parse(savedTools));
      } catch (error) {
        console.error('Failed to load tools:', error);
      }
    }
  }, []);

  // 保存到 localStorage
  const saveTools = (newTools: ExternalTool[]) => {
    localStorage.setItem('dj_external_tools', JSON.stringify(newTools));
    setTools(newTools);
  };

  const handleAdd = () => {
    setEditingTool(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (tool: ExternalTool) => {
    setEditingTool(tool);
    form.setFieldsValue(tool);
    setModalVisible(true);
  };

  const handleDelete = (id: string) => {
    const newTools = tools.filter(t => t.id !== id);
    saveTools(newTools);
    message.success('删除成功');
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      if (editingTool) {
        // 编辑
        const newTools = tools.map(t =>
          t.id === editingTool.id ? { ...values, id: t.id } : t
        );
        saveTools(newTools);
        message.success('更新成功');
      } else {
        // 新增
        const newTool: ExternalTool = {
          ...values,
          id: Date.now().toString()
        };
        saveTools([...tools, newTool]);
        message.success('添加成功');
      }

      setModalVisible(false);
      form.resetFields();
    } catch (error) {
      console.error('Form validation failed:', error);
    }
  };

  const openTool = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <ToolOutlined style={{ marginRight: 8, color: '#667eea' }} />
            外部工具链接
          </Title>
          <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
            配置和管理常用的外部工具链接，快速访问各类服务
          </Paragraph>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleAdd}
          size="large"
        >
          添加工具
        </Button>
      </div>

      {tools.length === 0 ? (
        <Empty
          description="暂无配置的外部工具"
          style={{ marginTop: 80 }}
        >
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            添加第一个工具
          </Button>
        </Empty>
      ) : (
        <Row gutter={[16, 16]}>
          {tools.map(tool => (
            <Col key={tool.id} xs={24} sm={12} md={8} lg={6}>
              <Card
                hoverable
                onClick={() => openTool(tool.url)}
                style={{
                  height: '100%',
                  borderRadius: 12,
                  cursor: 'pointer',
                  transition: 'all 0.3s'
                }}
                bodyStyle={{ padding: 20 }}
                actions={[
                  <EditOutlined
                    key="edit"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(tool);
                    }}
                  />,
                  <Popconfirm
                    title="确认删除？"
                    onConfirm={(e) => {
                      e?.stopPropagation();
                      handleDelete(tool.id);
                    }}
                    onCancel={(e) => e?.stopPropagation()}
                  >
                    <DeleteOutlined
                      key="delete"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </Popconfirm>
                ]}
              >
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    fontSize: 40,
                    marginBottom: 16,
                    color: '#667eea'
                  }}>
                    {iconMap[tool.icon] || <LinkOutlined />}
                  </div>
                  <Title level={5} style={{ marginBottom: 8 }}>
                    {tool.name}
                  </Title>
                  {tool.description && (
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      {tool.description}
                    </Text>
                  )}
                  {tool.category && (
                    <div style={{ marginTop: 12 }}>
                      <Text
                        type="secondary"
                        style={{
                          fontSize: 12,
                          padding: '2px 8px',
                          background: '#f0f0f0',
                          borderRadius: 4
                        }}
                      >
                        {tool.category}
                      </Text>
                    </div>
                  )}
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <Modal
        title={editingTool ? '编辑工具' : '添加工具'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        onOk={handleSubmit}
        okText="确定"
        cancelText="取消"
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            icon: 'link'
          }}
        >
          <Form.Item
            name="name"
            label="工具名称"
            rules={[{ required: true, message: '请输入工具名称' }]}
          >
            <Input placeholder="例如：Notion、Figma、GitHub" />
          </Form.Item>

          <Form.Item
            name="url"
            label="链接地址"
            rules={[
              { required: true, message: '请输入链接地址' },
              { type: 'url', message: '请输入有效的 URL' }
            ]}
          >
            <Input placeholder="https://example.com" />
          </Form.Item>

          <Form.Item
            name="description"
            label="描述"
          >
            <Input.TextArea
              rows={3}
              placeholder="简要描述这个工具的用途..."
            />
          </Form.Item>

          <Form.Item
            name="category"
            label="分类"
          >
            <Input placeholder="例如：设计工具、开发工具、文档管理" />
          </Form.Item>

          <Form.Item
            name="icon"
            label="图标"
            rules={[{ required: true, message: '请选择图标' }]}
          >
            <Select>
              <Select.Option value="link">
                <Space><LinkOutlined /> 链接</Space>
              </Select.Option>
              <Select.Option value="global">
                <Space><GlobalOutlined /> 地球</Space>
              </Select.Option>
              <Select.Option value="tool">
                <Space><ToolOutlined /> 工具</Space>
              </Select.Option>
              <Select.Option value="app">
                <Space><AppstoreOutlined /> 应用</Space>
              </Select.Option>
              <Select.Option value="database">
                <Space><DatabaseOutlined /> 数据库</Space>
              </Select.Option>
              <Select.Option value="cloud">
                <Space><CloudOutlined /> 云服务</Space>
              </Select.Option>
              <Select.Option value="code">
                <Space><CodeOutlined /> 代码</Space>
              </Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default LifeToolsPage;
