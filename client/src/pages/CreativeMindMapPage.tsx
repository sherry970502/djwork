import React, { useState, useEffect } from 'react';
import { Card, Button, Select, Input, Space, Typography, Modal, Form, message } from 'antd';
import { PlusOutlined, ThunderboltOutlined, SelectOutlined } from '@ant-design/icons';
import MindMapCanvas from '../components/MindMap/MindMapCanvas';
import * as api from '../services/api';
import type { PersonalDesign } from '../types';

const { Title, Text } = Typography;

const CreativeMindMapPage: React.FC = () => {
  const [designs, setDesigns] = useState<PersonalDesign[]>([]);
  const [selectedDesign, setSelectedDesign] = useState<PersonalDesign | null>(null);
  const [newDesignModalOpen, setNewDesignModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  // 加载设计列表
  useEffect(() => {
    loadDesigns();
  }, []);

  const loadDesigns = async () => {
    try {
      const response = await api.getDesigns({ page: 1, limit: 100 });
      setDesigns(response.data);
    } catch (error: any) {
      message.error('加载失败');
    }
  };

  // 创建新设计
  const handleCreateDesign = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();

      const response = await api.createDesign({
        title: values.title,
        description: values.description || '暂无描述',
        category: 'product',
        priority: 'medium',
        goals: [],
      });

      message.success('创建成功！');
      setNewDesignModalOpen(false);
      form.resetFields();

      await loadDesigns();
      setSelectedDesign(response.data);
    } catch (error: any) {
      console.error('Create design error:', error);
      const errorMsg = error.response?.data?.message || error.message || '创建失败';
      message.error(`创建失败: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      {/* 顶部选择区域 */}
      <Card
        style={{
          marginBottom: 24,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          border: 'none',
        }}
      >
        <div style={{ color: '#fff' }}>
          <Title level={3} style={{ color: '#fff', margin: 0, marginBottom: 8 }}>
            ⚡ 创意发散看板
          </Title>
          <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: '14px' }}>
            让 AI 帮你无限发散创意，点击节点自动探索新方向
          </Text>
        </div>

        <div style={{ marginTop: 24 }}>
          <Space size="large" style={{ width: '100%', justifyContent: 'space-between' }}>
            <Space>
              <Text style={{ color: '#fff', fontSize: '16px', fontWeight: 500 }}>
                选择设计：
              </Text>
              <Select
                style={{ width: 300 }}
                placeholder="从已有设计中选择"
                value={selectedDesign?._id}
                onChange={(value) => {
                  const design = designs.find((d) => d._id === value);
                  setSelectedDesign(design || null);
                }}
                options={designs.map((d) => ({
                  value: d._id,
                  label: d.title,
                }))}
                size="large"
                suffixIcon={<SelectOutlined style={{ color: '#fff' }} />}
              />
            </Space>

            <Button
              size="large"
              icon={<PlusOutlined />}
              onClick={() => setNewDesignModalOpen(true)}
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: '1px solid rgba(255,255,255,0.3)',
                color: '#fff',
                fontWeight: 500,
              }}
            >
              新建设计主题
            </Button>
          </Space>
        </div>
      </Card>

      {/* 思维导图区域 */}
      {selectedDesign ? (
        <Card
          style={{
            boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
            borderRadius: '12px',
          }}
        >
          <div style={{ marginBottom: 16 }}>
            <Space>
              <ThunderboltOutlined style={{ fontSize: '20px', color: '#667eea' }} />
              <Title level={4} style={{ margin: 0 }}>
                {selectedDesign.title}
              </Title>
            </Space>
            {selectedDesign.description && (
              <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                {selectedDesign.description}
              </Text>
            )}
          </div>

          <MindMapCanvas
            designId={selectedDesign._id}
            designTitle={selectedDesign.title}
          />
        </Card>
      ) : (
        <Card
          style={{
            height: '500px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '64px', marginBottom: 16 }}>🎨</div>
            <Title level={4} style={{ color: '#666' }}>
              选择一个设计或创建新主题开始发散
            </Title>
            <Text type="secondary">AI 将帮你无限探索创意的可能性</Text>
          </div>
        </Card>
      )}

      {/* 新建设计模态框 */}
      <Modal
        title="🎨 新建设计主题"
        open={newDesignModalOpen}
        onCancel={() => {
          setNewDesignModalOpen(false);
          form.resetFields();
        }}
        onOk={handleCreateDesign}
        okText="创建并开始发散"
        cancelText="取消"
        confirmLoading={loading}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="设计主题"
            name="title"
            rules={[{ required: true, message: '请输入设计主题' }]}
          >
            <Input
              placeholder="例如：为母亲设计一个雕像"
              size="large"
            />
          </Form.Item>

          <Form.Item
            label="简要描述"
            name="description"
            rules={[{ required: true, message: '请输入设计描述' }]}
          >
            <Input.TextArea
              placeholder="补充一些背景信息，帮助 AI 更好地理解你的需求..."
              rows={3}
            />
          </Form.Item>
        </Form>

        <div
          style={{
            background: '#f0f5ff',
            padding: '12px',
            borderRadius: '8px',
            marginTop: '16px',
          }}
        >
          <Text type="secondary" style={{ fontSize: '12px' }}>
            💡 提示：主题越具体，AI 发散的方向越准确。创建后可以随时点击节点继续发散。
          </Text>
        </div>
      </Modal>
    </div>
  );
};

export default CreativeMindMapPage;
