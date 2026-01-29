import React, { useEffect, useState, useCallback } from 'react';
import {
  Table,
  Button,
  Tag,
  Space,
  message,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  Card,
  Typography,
  Popconfirm,
  Collapse,
  List,
  Avatar,
  Divider,
  Alert
} from 'antd';
import {
  PlusOutlined,
  ThunderboltOutlined,
  DeleteOutlined,
  EyeOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  BulbOutlined,
  AimOutlined,
  RocketOutlined,
  SafetyOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import {
  getTasks,
  getTask,
  createTask,
  analyzeTask,
  deleteTask
} from '../services/api';
import type { OrganizationTask, Pagination } from '../types';

const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;

const categoryMap: Record<string, { color: string; text: string; gradient: string }> = {
  business: { color: 'blue', text: '业务/产品类', gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
  organization: { color: 'purple', text: '组织/管理类', gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  strategy: { color: 'gold', text: '战略/资本类', gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
  brand: { color: 'green', text: '品牌/生态类', gradient: 'linear-gradient(135deg, #38ef7d 0%, #11998e 100%)' },
  unknown: { color: 'default', text: '待分类', gradient: 'linear-gradient(135deg, #bdc3c7 0%, #2c3e50 100%)' }
};

const priorityMap: Record<string, { color: string; text: string }> = {
  high: { color: 'red', text: '高' },
  medium: { color: 'orange', text: '中' },
  low: { color: 'default', text: '低' }
};

const statusMap: Record<string, { color: string; text: string }> = {
  pending: { color: 'orange', text: '待分析' },
  analyzing: { color: 'blue', text: '分析中' },
  completed: { color: 'green', text: '已完成' },
  archived: { color: 'default', text: '已归档' }
};

const TasksPage: React.FC = () => {
  const [tasks, setTasks] = useState<OrganizationTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  });
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<OrganizationTask | null>(null);
  const [form] = Form.useForm();

  const fetchTasks = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await getTasks({ page, limit: pagination.limit });
      setTasks(res.data);
      if (res.pagination) {
        setPagination(res.pagination);
      }
    } catch {
      message.error('获取任务列表失败');
    } finally {
      setLoading(false);
    }
  }, [pagination.limit]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    const hasAnalyzing = tasks.some(t => t.status === 'analyzing');
    if (hasAnalyzing) {
      const timer = setInterval(() => {
        fetchTasks(pagination.page);
      }, 5000);
      return () => clearInterval(timer);
    }
  }, [tasks, pagination.page, fetchTasks]);

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      await createTask({
        ...values,
        dueDate: values.dueDate?.toISOString()
      });
      message.success('任务创建成功');
      setCreateModalOpen(false);
      form.resetFields();
      fetchTasks(1);
    } catch {
      message.error('创建失败');
    }
  };

  const handleAnalyze = async (id: string) => {
    try {
      await analyzeTask(id);
      message.success('开始分析');
      fetchTasks(pagination.page);
    } catch {
      message.error('触发分析失败');
    }
  };

  const handleViewDetail = async (id: string) => {
    try {
      const res = await getTask(id);
      setSelectedTask(res.data);
      setDetailModalOpen(true);
    } catch {
      message.error('获取详情失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTask(id);
      message.success('删除成功');
      fetchTasks(pagination.page);
    } catch {
      message.error('删除失败');
    }
  };

  const columns: ColumnsType<OrganizationTask> = [
    {
      title: '任务标题',
      dataIndex: 'title',
      key: 'title',
      render: (text, record) => (
        <a onClick={() => handleViewDetail(record._id)} style={{ fontWeight: 500 }}>{text}</a>
      )
    },
    {
      title: '来源',
      dataIndex: 'source',
      key: 'source',
      width: 120
    },
    {
      title: '类型',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      render: category => {
        const { color, text } = categoryMap[category] || categoryMap.unknown;
        return <Tag color={color}>{text}</Tag>;
      }
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 80,
      render: priority => {
        const { color, text } = priorityMap[priority];
        return <Tag color={color}>{text}</Tag>;
      }
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: status => {
        const { color, text } = statusMap[status];
        return <Tag color={color}>{text}</Tag>;
      }
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
            onClick={() => handleViewDetail(record._id)}
          >
            查看
          </Button>
          {record.status === 'pending' && (
            <Button
              type="link"
              size="small"
              icon={<ThunderboltOutlined />}
              onClick={() => handleAnalyze(record._id)}
            >
              分析
            </Button>
          )}
          {record.status === 'completed' && (
            <Button
              type="link"
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => handleAnalyze(record._id)}
            >
              重新分析
            </Button>
          )}
          <Popconfirm
            title="确定删除此任务吗？"
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

  // 渲染分析内容段落
  const renderAnalysisParagraph = (label: string, content: string) => (
    <div style={{ marginBottom: 16 }}>
      <Text strong style={{ color: '#667eea', display: 'block', marginBottom: 8 }}>{label}</Text>
      <Paragraph style={{ margin: 0, color: '#444', lineHeight: 1.8, background: 'rgba(102, 126, 234, 0.03)', padding: 12, borderRadius: 8 }}>
        {content || <Text type="secondary">暂无数据</Text>}
      </Paragraph>
    </div>
  );

  return (
    <div className="fade-in-up">
      <div
        style={{
          marginBottom: 24,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <div>
          <Title level={3} style={{ margin: 0 }} className="page-title">
            组织事务池
          </Title>
          <Text type="secondary">AI 战略顾问为您分析决策议题</Text>
        </div>
        <Button
          type="primary"
          size="large"
          icon={<PlusOutlined />}
          onClick={() => setCreateModalOpen(true)}
        >
          新建任务
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={tasks}
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
            fetchTasks(page);
          }
        }}
      />

      {/* Create Modal */}
      <Modal
        title="新建组织事务"
        open={createModalOpen}
        onCancel={() => {
          setCreateModalOpen(false);
          form.resetFields();
        }}
        onOk={handleCreate}
        okText="创建"
        cancelText="取消"
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="title"
            label="任务标题"
            rules={[{ required: true, message: '请输入任务标题' }]}
          >
            <Input placeholder="例如：是否与XX公司进行战略合作" />
          </Form.Item>
          <Form.Item
            name="description"
            label="任务描述"
            rules={[{ required: true, message: '请输入任务描述' }]}
          >
            <TextArea
              rows={4}
              placeholder="详细描述需要决策的议题背景和关键信息..."
            />
          </Form.Item>
          <Form.Item name="source" label="来源部门">
            <Input placeholder="组织事务部" />
          </Form.Item>
          <Form.Item name="priority" label="优先级" initialValue="medium">
            <Select
              options={[
                { value: 'high', label: '高' },
                { value: 'medium', label: '中' },
                { value: 'low', label: '低' }
              ]}
            />
          </Form.Item>
          <Form.Item name="dueDate" label="截止日期">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Detail Modal */}
      <Modal
        title={null}
        open={detailModalOpen}
        onCancel={() => {
          setDetailModalOpen(false);
          setSelectedTask(null);
        }}
        footer={null}
        width={1000}
        styles={{ body: { padding: 0 } }}
      >
        {selectedTask && (
          <div>
            {/* Header */}
            <div style={{
              background: categoryMap[selectedTask.category]?.gradient || categoryMap.unknown.gradient,
              padding: '24px 32px',
              color: '#fff'
            }}>
              <Title level={4} style={{ color: '#fff', margin: 0, marginBottom: 12 }}>
                {selectedTask.title}
              </Title>
              <Space size={16}>
                <Tag style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none' }}>
                  {categoryMap[selectedTask.category]?.text || '待分类'}
                </Tag>
                <Tag style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none' }}>
                  {statusMap[selectedTask.status].text}
                </Tag>
                <Tag style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none' }}>
                  优先级: {priorityMap[selectedTask.priority].text}
                </Tag>
                <Text style={{ color: 'rgba(255,255,255,0.8)' }}>
                  来源: {selectedTask.source}
                </Text>
              </Space>
            </div>

            {/* Content */}
            <div style={{ padding: '24px 32px', maxHeight: '65vh', overflow: 'auto' }}>
              <Card size="small" style={{ marginBottom: 24, background: '#fafafa' }}>
                <Text strong>任务描述：</Text>
                <Paragraph style={{ marginTop: 8, marginBottom: 0 }}>{selectedTask.description}</Paragraph>
              </Card>

              {selectedTask.analysis && (
                <>
                  {/* Recommendation - 最重要的放在最前面 */}
                  <Alert
                    type="success"
                    style={{ marginBottom: 24, borderRadius: 12 }}
                    message={
                      <Space>
                        <CheckCircleOutlined />
                        <span style={{ fontWeight: 600, fontSize: 16 }}>战略建议</span>
                      </Space>
                    }
                    description={
                      <div style={{ marginTop: 12 }}>
                        <Paragraph style={{ fontSize: 15, fontWeight: 500, color: '#333' }}>
                          {selectedTask.analysis.recommendation.summary}
                        </Paragraph>
                        <Divider style={{ margin: '16px 0' }} />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                          <div>
                            <Text type="secondary">What - 建议做什么</Text>
                            <Paragraph style={{ margin: '4px 0 0' }}>{selectedTask.analysis.recommendation.whatToDo}</Paragraph>
                          </div>
                          <div>
                            <Text type="secondary">Why - 为什么要做</Text>
                            <Paragraph style={{ margin: '4px 0 0' }}>{selectedTask.analysis.recommendation.whyToDo}</Paragraph>
                          </div>
                          <div>
                            <Text type="secondary">Where - 核心抓手</Text>
                            <Paragraph style={{ margin: '4px 0 0' }}>{selectedTask.analysis.recommendation.whereToFocus}</Paragraph>
                          </div>
                          <div>
                            <Text type="secondary">How Much - 代价与回报</Text>
                            <Paragraph style={{ margin: '4px 0 0' }}>{selectedTask.analysis.recommendation.costAndReturn}</Paragraph>
                          </div>
                        </div>
                      </div>
                    }
                  />

                  <Collapse
                    defaultActiveKey={['step6']}
                    items={[
                      {
                        key: 'step1',
                        label: (
                          <Space>
                            <Avatar size="small" style={{ background: '#667eea' }}>1</Avatar>
                            <BulbOutlined style={{ color: '#667eea' }} />
                            <span>溯源与证伪 (Why & Falsification)</span>
                          </Space>
                        ),
                        children: (
                          <div>
                            {renderAnalysisParagraph('第一性原理', selectedTask.analysis.step1_falsification.firstPrinciple)}
                            {renderAnalysisParagraph('本分审计', selectedTask.analysis.step1_falsification.coreCapabilityFit)}
                            <Text strong style={{ color: '#667eea', display: 'block', marginBottom: 8 }}>替代路径</Text>
                            <List
                              size="small"
                              dataSource={selectedTask.analysis.step1_falsification.alternativePaths}
                              renderItem={(item, index) => (
                                <List.Item style={{ background: 'rgba(102, 126, 234, 0.03)', marginBottom: 8, borderRadius: 8, padding: '12px 16px' }}>
                                  <Space align="start">
                                    <Avatar size="small" style={{ background: '#667eea', minWidth: 24 }}>{index + 1}</Avatar>
                                    <Text>{item}</Text>
                                  </Space>
                                </List.Item>
                              )}
                            />
                          </div>
                        )
                      },
                      {
                        key: 'step2',
                        label: (
                          <Space>
                            <Avatar size="small" style={{ background: '#4facfe' }}>2</Avatar>
                            <AimOutlined style={{ color: '#4facfe' }} />
                            <span>环境与竞争审计 (External Dynamics)</span>
                          </Space>
                        ),
                        children: (
                          <div>
                            {renderAnalysisParagraph('市场环境适配', selectedTask.analysis.step2_external.marketFit)}
                            {renderAnalysisParagraph('竞争态势穿透', selectedTask.analysis.step2_external.competitiveAnalysis)}
                          </div>
                        )
                      },
                      {
                        key: 'step3',
                        label: (
                          <Space>
                            <Avatar size="small" style={{ background: '#38ef7d' }}>3</Avatar>
                            <RocketOutlined style={{ color: '#38ef7d' }} />
                            <span>商业逻辑算法 (Solid Frameworks)</span>
                          </Space>
                        ),
                        children: (
                          <div>
                            {renderAnalysisParagraph('波特五力', selectedTask.analysis.step3_frameworks.porterFiveForces)}
                            {renderAnalysisParagraph('规模化校验', selectedTask.analysis.step3_frameworks.scalabilityTest)}
                            {renderAnalysisParagraph('安索夫矩阵', selectedTask.analysis.step3_frameworks.ansoffMatrix)}
                          </div>
                        )
                      },
                      {
                        key: 'step4',
                        label: (
                          <Space>
                            <Avatar size="small" style={{ background: '#f093fb' }}>4</Avatar>
                            <ThunderboltOutlined style={{ color: '#f093fb' }} />
                            <span>执行策略与回报评估 (Execution & ROI)</span>
                          </Space>
                        ),
                        children: (
                          <div>
                            {renderAnalysisParagraph('路径优选', selectedTask.analysis.step4_execution.optimalPath)}
                            {renderAnalysisParagraph('ROI 分析', selectedTask.analysis.step4_execution.roiAnalysis)}
                            {renderAnalysisParagraph('核心抓手', selectedTask.analysis.step4_execution.leveragePoint)}
                          </div>
                        )
                      },
                      {
                        key: 'step5',
                        label: (
                          <Space>
                            <Avatar size="small" style={{ background: '#fa709a' }}>5</Avatar>
                            <span style={{ color: '#fa709a' }}>❤️</span>
                            <span>用户与场景锚定 (User Context)</span>
                          </Space>
                        ),
                        children: (
                          <div>
                            {renderAnalysisParagraph('快乐逻辑', selectedTask.analysis.step5_userContext.happinessLogic)}
                            {renderAnalysisParagraph('场景增量价值', selectedTask.analysis.step5_userContext.sceneValue)}
                          </div>
                        )
                      },
                      {
                        key: 'step6',
                        label: (
                          <Space>
                            <Avatar size="small" style={{ background: '#f5576c' }}>6</Avatar>
                            <SafetyOutlined style={{ color: '#f5576c' }} />
                            <span>风险审计与反直觉挑战</span>
                          </Space>
                        ),
                        children: (
                          <div>
                            <Text strong style={{ color: '#667eea', display: 'block', marginBottom: 16 }}>SWOT 分析</Text>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                              <Card size="small" style={{ background: 'linear-gradient(135deg, rgba(56, 239, 125, 0.1) 0%, rgba(17, 153, 142, 0.1) 100%)' }}>
                                <Text strong style={{ color: '#11998e' }}>优势 (S)</Text>
                                <List size="small" dataSource={selectedTask.analysis.step6_risk.swot.strengths} renderItem={item => <List.Item style={{ border: 'none', padding: '4px 0' }}><Text>{item}</Text></List.Item>} />
                              </Card>
                              <Card size="small" style={{ background: 'linear-gradient(135deg, rgba(245, 87, 108, 0.1) 0%, rgba(240, 147, 251, 0.1) 100%)' }}>
                                <Text strong style={{ color: '#f5576c' }}>劣势 (W)</Text>
                                <List size="small" dataSource={selectedTask.analysis.step6_risk.swot.weaknesses} renderItem={item => <List.Item style={{ border: 'none', padding: '4px 0' }}><Text>{item}</Text></List.Item>} />
                              </Card>
                              <Card size="small" style={{ background: 'linear-gradient(135deg, rgba(79, 172, 254, 0.1) 0%, rgba(0, 242, 254, 0.1) 100%)' }}>
                                <Text strong style={{ color: '#4facfe' }}>机会 (O)</Text>
                                <List size="small" dataSource={selectedTask.analysis.step6_risk.swot.opportunities} renderItem={item => <List.Item style={{ border: 'none', padding: '4px 0' }}><Text>{item}</Text></List.Item>} />
                              </Card>
                              <Card size="small" style={{ background: 'linear-gradient(135deg, rgba(254, 225, 64, 0.1) 0%, rgba(250, 112, 154, 0.1) 100%)' }}>
                                <Text strong style={{ color: '#fa709a' }}>威胁 (T)</Text>
                                <List size="small" dataSource={selectedTask.analysis.step6_risk.swot.threats} renderItem={item => <List.Item style={{ border: 'none', padding: '4px 0' }}><Text>{item}</Text></List.Item>} />
                              </Card>
                            </div>

                            <Alert
                              type="warning"
                              style={{ borderRadius: 8 }}
                              message={<Text strong><ExclamationCircleOutlined /> 直击命门的问题</Text>}
                              description={
                                <List
                                  size="small"
                                  dataSource={selectedTask.analysis.step6_risk.criticalQuestions}
                                  renderItem={(item, index) => (
                                    <List.Item style={{ border: 'none', padding: '8px 0' }}>
                                      <Text type="danger" strong>{index + 1}. {item}</Text>
                                    </List.Item>
                                  )}
                                />
                              }
                            />
                          </div>
                        )
                      }
                    ]}
                  />
                </>
              )}

              {!selectedTask.analysis && selectedTask.status === 'pending' && (
                <Card style={{ textAlign: 'center', padding: 40 }}>
                  <ThunderboltOutlined style={{ fontSize: 48, color: '#667eea', marginBottom: 16 }} />
                  <Title level={4}>该任务尚未分析</Title>
                  <Paragraph type="secondary">点击下方按钮，让 AI 战略顾问为您深度分析此议题</Paragraph>
                  <Button
                    type="primary"
                    size="large"
                    icon={<ThunderboltOutlined />}
                    onClick={() => {
                      handleAnalyze(selectedTask._id);
                      setDetailModalOpen(false);
                    }}
                  >
                    开始 AI 分析
                  </Button>
                </Card>
              )}

              {!selectedTask.analysis && selectedTask.status === 'analyzing' && (
                <Card style={{ textAlign: 'center', padding: 40 }}>
                  <div className="ant-spin ant-spin-lg ant-spin-spinning" style={{ marginBottom: 16 }}>
                    <span className="ant-spin-dot ant-spin-dot-spin">
                      <i className="ant-spin-dot-item"></i>
                      <i className="ant-spin-dot-item"></i>
                      <i className="ant-spin-dot-item"></i>
                      <i className="ant-spin-dot-item"></i>
                    </span>
                  </div>
                  <Title level={4}>AI 正在深度分析中...</Title>
                  <Paragraph type="secondary">这通常需要 1-2 分钟，请稍候</Paragraph>
                </Card>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default TasksPage;
