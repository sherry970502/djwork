import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Table,
  Tag,
  Space,
  Modal,
  Form,
  Input,
  Select,
  message,
  Tabs,
  Empty,
  Spin,
  Collapse,
  List,
  Badge,
  Tooltip,
  Popconfirm,
  Avatar,
  Radio,
  Checkbox,
  Alert
} from 'antd';
import {
  PlusOutlined,
  BulbOutlined,
  RocketOutlined,
  DeleteOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  StarOutlined,
  ExperimentOutlined,
  BookOutlined,
  LaptopOutlined,
  RobotOutlined,
  EditOutlined,
  GlobalOutlined,
  ToolOutlined,
  UserOutlined,
  CrownOutlined,
  AppstoreOutlined,
  PictureOutlined,
  FileTextOutlined,
  SearchOutlined,
  QuestionCircleOutlined,
  FormOutlined
} from '@ant-design/icons';
import type { PersonalDesign, DesignDimension, DimensionIdeaResult, CreativeProposal, ClarifyingQA } from '../types';
import * as api from '../services/api';

const { TextArea } = Input;
const { Option } = Select;
const { TabPane } = Tabs;
const { Panel } = Collapse;

const categoryLabels: Record<string, string> = {
  product: '产品设计',
  experience: '体验设计',
  content: '内容设计',
  service: '服务设计',
  other: '其他'
};

const statusLabels: Record<string, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'default' },
  ideating: { label: '发散中', color: 'processing' },
  designing: { label: '设计中', color: 'blue' },
  prototyping: { label: '原型中', color: 'orange' },
  completed: { label: '已完成', color: 'success' },
  archived: { label: '已归档', color: 'default' }
};

const priorityLabels: Record<string, { label: string; color: string }> = {
  high: { label: '高优先级', color: 'red' },
  medium: { label: '中优先级', color: 'orange' },
  low: { label: '低优先级', color: 'default' }
};

const dimensionIcons: Record<string, React.ReactNode> = {
  laptop: <LaptopOutlined />,
  robot: <RobotOutlined />,
  book: <BookOutlined />,
  star: <StarOutlined />,
  bulb: <BulbOutlined />,
  rocket: <RocketOutlined />,
  global: <GlobalOutlined />,
  tool: <ToolOutlined />,
  user: <UserOutlined />,
  crown: <CrownOutlined />,
  appstore: <AppstoreOutlined />,
  picture: <PictureOutlined />,
  'file-text': <FileTextOutlined />
};

// 维度分类颜色
const categoryColors: Record<string, string> = {
  '用户体验': '#4facfe',
  '表现手法': '#667eea',
  '价值观': '#f093fb',
  '教育相关': '#38ef7d',
  '游戏化相关': '#ff6b6b',
  '外部带来的': '#feca57',
  '操作方式': '#54a0ff',
  '角色特点': '#5f27cd',
  'IP带来的': '#00d2d3',
  'AI带来的': '#ff9ff3',
  '元宇宙带来的': '#c8d6e5',
  '艺术带来的': '#ee5a24',
  '剧本内容': '#10ac84'
};

const PersonalDesignsPage: React.FC = () => {
  const [designs, setDesigns] = useState<PersonalDesign[]>([]);
  const [dimensions, setDimensions] = useState<DesignDimension[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [dimensionModalVisible, setDimensionModalVisible] = useState(false);
  const [selectedDesign, setSelectedDesign] = useState<PersonalDesign | null>(null);
  const [generatingIdeas, setGeneratingIdeas] = useState<string | null>(null);
  const [generatingProposal, setGeneratingProposal] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('designs');
  const [form] = Form.useForm();
  const [dimensionForm] = Form.useForm();

  // 维度编辑相关状态
  const [editDimensionModalVisible, setEditDimensionModalVisible] = useState(false);
  const [selectedDimension, setSelectedDimension] = useState<DesignDimension | null>(null);
  const [editDimensionForm] = Form.useForm();
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [dimensionSearch, setDimensionSearch] = useState('');

  // 需求澄清相关状态
  const [clarifyModalVisible, setClarifyModalVisible] = useState(false);
  const [clarifyingQuestions, setClarifyingQuestions] = useState<ClarifyingQA[]>([]);
  const [clarifyAnswers, setClarifyAnswers] = useState<Record<number, { answer: string[]; customAnswer: string }>>({});
  const [loadingClarify, setLoadingClarify] = useState(false);
  const [submittingClarify, setSubmittingClarify] = useState(false);

  const fetchDesigns = async () => {
    setLoading(true);
    try {
      const res = await api.getDesigns();
      if (res.success) {
        setDesigns(res.data);
      }
    } catch (error) {
      message.error('获取设计列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchDimensions = async () => {
    try {
      const res = await api.getDimensions();
      if (res.success) {
        setDimensions(res.data);
      }
    } catch (error) {
      message.error('获取维度列表失败');
    }
  };

  useEffect(() => {
    fetchDesigns();
    fetchDimensions();
  }, []);

  const handleCreateDesign = async (values: any) => {
    try {
      const res = await api.createDesign({
        ...values,
        goals: values.goals?.split('\n').filter((g: string) => g.trim()) || []
      });
      if (res.success) {
        message.success('创建成功');
        setCreateModalVisible(false);
        form.resetFields();
        fetchDesigns();
      }
    } catch (error) {
      message.error('创建失败');
    }
  };

  const handleDeleteDesign = async (id: string) => {
    try {
      await api.deleteDesign(id);
      message.success('删除成功');
      fetchDesigns();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleGenerateIdeas = async (design: PersonalDesign) => {
    setGeneratingIdeas(design._id);
    try {
      await api.generateDesignIdeas(design._id);
      message.success('AI 正在智能筛选维度并生成创意，请稍后刷新查看结果');
      // Poll for updates
      const pollInterval = setInterval(async () => {
        const res = await api.getDesign(design._id);
        if (res.success && res.data.status !== 'ideating') {
          clearInterval(pollInterval);
          fetchDesigns();
          setGeneratingIdeas(null);
          if (res.data.dimensionIdeas?.length > 0) {
            message.success(`创意发散完成！AI 从 ${res.data.dimensionIdeas.length} 个维度生成了创意`);
          }
        }
      }, 3000);
      // 超时保护
      setTimeout(() => {
        clearInterval(pollInterval);
        fetchDesigns();
        setGeneratingIdeas(null);
      }, 120000);
    } catch (error) {
      message.error('启动创意发散失败');
      setGeneratingIdeas(null);
    }
  };

  const handleGenerateProposal = async (design: PersonalDesign) => {
    if (!design.dimensionIdeas || design.dimensionIdeas.length === 0) {
      message.warning('请先进行创意发散');
      return;
    }
    setGeneratingProposal(design._id);
    try {
      await api.generateDesignProposal(design._id);
      message.success('综合方案生成已启动，请稍后刷新查看结果');
      setTimeout(() => {
        fetchDesigns();
        setGeneratingProposal(null);
      }, 5000);
    } catch (error) {
      message.error('生成方案失败');
      setGeneratingProposal(null);
    }
  };

  // 需求澄清相关处理
  const handleStartClarify = async (design: PersonalDesign) => {
    setLoadingClarify(true);
    setClarifyModalVisible(true);
    setClarifyingQuestions([]);
    setClarifyAnswers({});
    try {
      const res = await api.generateClarifyingQuestions(design._id);
      if (res.success && res.data.questions) {
        setClarifyingQuestions(res.data.questions);
        // 初始化答案对象
        const initialAnswers: Record<number, { answer: string[]; customAnswer: string }> = {};
        res.data.questions.forEach((_: any, index: number) => {
          initialAnswers[index] = { answer: [], customAnswer: '' };
        });
        setClarifyAnswers(initialAnswers);
      }
    } catch (error) {
      message.error('生成问题失败');
      setClarifyModalVisible(false);
    } finally {
      setLoadingClarify(false);
    }
  };

  const handleAnswerChange = (questionIndex: number, value: string | string[], isCustom: boolean = false) => {
    setClarifyAnswers(prev => ({
      ...prev,
      [questionIndex]: {
        ...prev[questionIndex],
        answer: isCustom ? prev[questionIndex]?.answer || [] : (Array.isArray(value) ? value : [value]),
        customAnswer: isCustom ? (value as string) : prev[questionIndex]?.customAnswer || ''
      }
    }));
  };

  const handleSubmitClarify = async () => {
    if (!selectedDesign) return;

    // 构建答案数组
    const answers = clarifyingQuestions.map((q, index) => ({
      question: q.question,
      questionType: q.questionType,
      options: q.options,
      answer: clarifyAnswers[index]?.answer || [],
      customAnswer: clarifyAnswers[index]?.customAnswer || '',
      category: q.category
    }));

    setSubmittingClarify(true);
    try {
      const res = await api.submitClarifyingAnswers(selectedDesign._id, answers);
      if (res.success) {
        message.success('需求澄清完成，已生成需求摘要');
        setClarifyModalVisible(false);
        setSelectedDesign(res.data);
        fetchDesigns();
      }
    } catch (error) {
      message.error('提交失败');
    } finally {
      setSubmittingClarify(false);
    }
  };

  const handleSkipClarify = async () => {
    if (!selectedDesign) return;
    try {
      const res = await api.skipClarification(selectedDesign._id);
      if (res.success) {
        message.info('已跳过需求澄清');
        setClarifyModalVisible(false);
        setSelectedDesign(res.data);
        fetchDesigns();
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleCreateDimension = async (values: any) => {
    try {
      const res = await api.createDimension({
        ...values,
        prompts: values.prompts?.split('\n').filter((p: string) => p.trim()) || [],
        examples: values.examples?.split('\n').filter((e: string) => e.trim()).map((e: string) => {
          const [title, description] = e.split(':');
          return { title: title?.trim() || e, description: description?.trim() || '' };
        }) || []
      });
      if (res.success) {
        message.success('创建成功');
        setDimensionModalVisible(false);
        dimensionForm.resetFields();
        fetchDimensions();
      }
    } catch (error) {
      message.error('创建失败');
    }
  };

  const handleDeleteDimension = async (id: string) => {
    try {
      await api.deleteDimension(id);
      message.success('删除成功');
      fetchDimensions();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const openEditDimension = (dimension: DesignDimension) => {
    setSelectedDimension(dimension);
    editDimensionForm.setFieldsValue({
      displayName: dimension.displayName,
      description: dimension.description,
      category: dimension.category,
      prompts: dimension.prompts?.join('\n') || '',
      examples: dimension.examples?.map(e => `${e.title}:${e.description}`).join('\n') || '',
      color: dimension.color,
      icon: dimension.icon
    });
    setEditDimensionModalVisible(true);
  };

  const handleEditDimension = async (values: any) => {
    if (!selectedDimension) return;
    try {
      const res = await api.updateDimension(selectedDimension._id, {
        displayName: values.displayName,
        description: values.description,
        prompts: values.prompts?.split('\n').filter((p: string) => p.trim()) || [],
        examples: values.examples?.split('\n').filter((e: string) => e.trim()).map((e: string) => {
          const [title, description] = e.split(':');
          return { title: title?.trim() || e, description: description?.trim() || '' };
        }) || [],
        color: values.color,
        icon: values.icon
      });
      if (res.success) {
        message.success('更新成功');
        setEditDimensionModalVisible(false);
        setSelectedDimension(null);
        fetchDimensions();
      }
    } catch (error) {
      message.error('更新失败');
    }
  };

  // 获取所有分类
  const allCategories = [...new Set(dimensions.map(d => d.category || '其他'))].sort();

  // 过滤后的维度
  const filteredDimensions = dimensions.filter(d => {
    const matchCategory = categoryFilter === 'all' || d.category === categoryFilter;
    const matchSearch = !dimensionSearch ||
      d.displayName.toLowerCase().includes(dimensionSearch.toLowerCase()) ||
      d.description?.toLowerCase().includes(dimensionSearch.toLowerCase());
    return matchCategory && matchSearch;
  });

  // 按分类分组
  const groupedDimensions = filteredDimensions.reduce((acc, dim) => {
    const cat = dim.category || '其他';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(dim);
    return acc;
  }, {} as Record<string, DesignDimension[]>);

  const viewDesignDetail = async (design: PersonalDesign) => {
    try {
      const res = await api.getDesign(design._id);
      if (res.success) {
        setSelectedDesign(res.data);
        setDetailModalVisible(true);
      }
    } catch (error) {
      message.error('获取详情失败');
    }
  };

  const renderFeasibilityTag = (level: string) => {
    const colors: Record<string, string> = { high: 'green', medium: 'orange', low: 'red' };
    const labels: Record<string, string> = { high: '高', medium: '中', low: '低' };
    return <Tag color={colors[level]}>可行性: {labels[level]}</Tag>;
  };

  const renderInnovationTag = (level: string) => {
    const colors: Record<string, string> = { high: 'purple', medium: 'blue', low: 'default' };
    const labels: Record<string, string> = { high: '高', medium: '中', low: '低' };
    return <Tag color={colors[level]}>创新度: {labels[level]}</Tag>;
  };

  const columns = [
    {
      title: '设计项目',
      dataIndex: 'title',
      key: 'title',
      render: (title: string, record: PersonalDesign) => (
        <div>
          <a onClick={() => viewDesignDetail(record)} style={{ fontWeight: 500 }}>{title}</a>
          <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
            {record.description?.substring(0, 60)}...
          </div>
        </div>
      )
    },
    {
      title: '类型',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      render: (cat: string) => categoryLabels[cat] || cat
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const s = statusLabels[status] || { label: status, color: 'default' };
        return <Badge status={s.color as any} text={s.label} />;
      }
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 100,
      render: (priority: string) => {
        const p = priorityLabels[priority] || { label: priority, color: 'default' };
        return <Tag color={p.color}>{p.label}</Tag>;
      }
    },
    {
      title: 'AI 筛选维度',
      key: 'dimensions',
      width: 150,
      render: (_: any, record: PersonalDesign) => (
        <Space wrap>
          {record.selectedDimensions?.map((dim) => (
            <Tooltip key={dim._id} title={dim.displayName}>
              <Avatar
                size="small"
                style={{ backgroundColor: dim.color }}
                icon={dimensionIcons[dim.icon] || <BulbOutlined />}
              />
            </Tooltip>
          ))}
          {(!record.selectedDimensions || record.selectedDimensions.length === 0) && (
            <span style={{ color: '#999', fontSize: 12 }}>待发散</span>
          )}
        </Space>
      )
    },
    {
      title: '创意数',
      key: 'ideasCount',
      width: 80,
      render: (_: any, record: PersonalDesign) => {
        const count = record.dimensionIdeas?.reduce((sum, di) => sum + (di.ideas?.length || 0), 0) || 0;
        return count > 0 ? <Tag color="blue">{count} 个</Tag> : '-';
      }
    },
    {
      title: '澄清',
      key: 'clarify',
      width: 80,
      render: (_: any, record: PersonalDesign) => {
        if (record.clarifyStatus === 'completed') {
          return <Tag color="success" icon={<CheckCircleOutlined />}>已完成</Tag>;
        }
        if (record.clarifyStatus === 'skipped') {
          return <Tag color="default">已跳过</Tag>;
        }
        return (
          <Tooltip title="需求澄清">
            <Button
              type="text"
              size="small"
              icon={<QuestionCircleOutlined />}
              onClick={() => {
                setSelectedDesign(record);
                handleStartClarify(record);
              }}
              style={{ color: '#faad14' }}
            />
          </Tooltip>
        );
      }
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      render: (_: any, record: PersonalDesign) => (
        <Space>
          <Tooltip title="AI 创意发散">
            <Button
              type="text"
              icon={<ThunderboltOutlined />}
              loading={generatingIdeas === record._id}
              onClick={() => handleGenerateIdeas(record)}
              style={{ color: '#667eea' }}
            />
          </Tooltip>
          <Tooltip title="生成综合方案">
            <Button
              type="text"
              icon={<RocketOutlined />}
              loading={generatingProposal === record._id}
              onClick={() => handleGenerateProposal(record)}
              style={{ color: '#38ef7d' }}
            />
          </Tooltip>
          <Popconfirm title="确定删除？" onConfirm={() => handleDeleteDesign(record._id)}>
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    }
  ];

  const renderDimensionIdeas = (ideas: DimensionIdeaResult[]) => {
    if (!ideas || ideas.length === 0) {
      return <Empty description="暂无创意，请点击发散按钮生成" />;
    }

    return (
      <Collapse defaultActiveKey={[ideas[0]?.dimensionName]}>
        {ideas.map((di) => (
          <Panel
            key={di.dimensionName}
            header={
              <Space>
                <Avatar
                  size="small"
                  style={{ backgroundColor: dimensions.find(d => d._id === di.dimensionId)?.color || '#667eea' }}
                  icon={dimensionIcons[dimensions.find(d => d._id === di.dimensionId)?.icon || 'bulb']}
                />
                <span style={{ fontWeight: 500 }}>{di.dimensionName}</span>
                <Tag>{di.ideas?.length || 0} 个创意</Tag>
              </Space>
            }
          >
            <List
              dataSource={di.ideas}
              renderItem={(idea, index) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={<Avatar style={{ backgroundColor: '#f0f5ff', color: '#667eea' }}>{index + 1}</Avatar>}
                    title={
                      <Space>
                        <span>{idea.title}</span>
                        {renderFeasibilityTag(idea.feasibility)}
                        {renderInnovationTag(idea.innovation)}
                      </Space>
                    }
                    description={idea.description}
                  />
                </List.Item>
              )}
            />
            {di.summary && (
              <div style={{ marginTop: 16, padding: 12, background: '#f6f8fa', borderRadius: 8 }}>
                <strong>维度总结：</strong> {di.summary}
              </div>
            )}
          </Panel>
        ))}
      </Collapse>
    );
  };

  const renderProposals = (proposals: CreativeProposal[]) => {
    if (!proposals || proposals.length === 0) {
      return <Empty description="暂无综合方案，请先进行创意发散后生成" />;
    }

    return proposals.map((proposal, index) => (
      <Card
        key={proposal._id || index}
        style={{ marginBottom: 16 }}
        className="proposal-card"
        title={
          <Space>
            <RocketOutlined style={{ color: '#667eea' }} />
            <span>{proposal.title}</span>
          </Space>
        }
      >
        <div className="proposal-section">
          <h4><BulbOutlined /> 核心创意</h4>
          <p>{proposal.coreIdea}</p>
        </div>

        <div className="proposal-section">
          <h4><StarOutlined /> 独特价值</h4>
          <p>{proposal.uniqueValue}</p>
        </div>

        <div className="proposal-section">
          <h4><ExperimentOutlined /> 目标受众</h4>
          <p>{proposal.targetAudience}</p>
        </div>

        <div className="proposal-section">
          <h4><CheckCircleOutlined /> 关键特性</h4>
          <Space wrap>
            {proposal.keyFeatures?.map((feature, i) => (
              <Tag key={i} color="blue">{feature}</Tag>
            ))}
          </Space>
        </div>

        <div className="proposal-section">
          <h4><ClockCircleOutlined /> 实现步骤</h4>
          <List
            size="small"
            dataSource={proposal.implementationSteps}
            renderItem={(step) => (
              <List.Item>
                <List.Item.Meta
                  avatar={<Avatar size="small" style={{ backgroundColor: '#667eea' }}>{step.step}</Avatar>}
                  title={step.title}
                  description={step.description}
                />
              </List.Item>
            )}
          />
        </div>

        {proposal.potentialChallenges && proposal.potentialChallenges.length > 0 && (
          <div className="proposal-section">
            <h4>潜在挑战</h4>
            <Space wrap>
              {proposal.potentialChallenges.map((challenge, i) => (
                <Tag key={i} color="orange">{challenge}</Tag>
              ))}
            </Space>
          </div>
        )}
      </Card>
    ));
  };

  return (
    <div className="personal-designs-page">
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane
          tab={
            <span>
              <BulbOutlined />
              设计项目
            </span>
          }
          key="designs"
        >
          <Card
            title={
              <Space>
                <BulbOutlined style={{ color: '#667eea' }} />
                <span>DJ 个人设计</span>
              </Space>
            }
            extra={
              <Space>
                <Button icon={<ReloadOutlined />} onClick={fetchDesigns}>
                  刷新
                </Button>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setCreateModalVisible(true)}
                  style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
                >
                  新建设计
                </Button>
              </Space>
            }
          >
            <Table
              columns={columns}
              dataSource={designs}
              rowKey="_id"
              loading={loading}
              pagination={{ pageSize: 10 }}
            />
          </Card>
        </TabPane>

        <TabPane
          tab={
            <span>
              <ExperimentOutlined />
              创意维度 ({dimensions.length})
            </span>
          }
          key="dimensions"
        >
          <Card
            title={
              <Space>
                <ExperimentOutlined style={{ color: '#667eea' }} />
                <span>创意维度库</span>
                <Tag color="blue">{dimensions.length} 个维度</Tag>
              </Space>
            }
            extra={
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setDimensionModalVisible(true)}
                style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
              >
                新建维度
              </Button>
            }
          >
            {/* 筛选栏 */}
            <div style={{ marginBottom: 16, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <Input
                placeholder="搜索维度名称或描述..."
                prefix={<SearchOutlined />}
                style={{ width: 250 }}
                value={dimensionSearch}
                onChange={e => setDimensionSearch(e.target.value)}
                allowClear
              />
              <Select
                style={{ width: 180 }}
                value={categoryFilter}
                onChange={setCategoryFilter}
              >
                <Option value="all">全部分类 ({dimensions.length})</Option>
                {allCategories.map(cat => (
                  <Option key={cat} value={cat}>
                    <Space>
                      <span style={{
                        display: 'inline-block',
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: categoryColors[cat] || '#667eea'
                      }} />
                      {cat} ({dimensions.filter(d => d.category === cat).length})
                    </Space>
                  </Option>
                ))}
              </Select>
            </div>

            {/* 按分类展示 */}
            {categoryFilter === 'all' ? (
              <Collapse defaultActiveKey={allCategories.slice(0, 2)}>
                {Object.entries(groupedDimensions).map(([category, dims]) => (
                  <Panel
                    key={category}
                    header={
                      <Space>
                        <span style={{
                          display: 'inline-block',
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          backgroundColor: categoryColors[category] || '#667eea'
                        }} />
                        <span style={{ fontWeight: 500 }}>{category}</span>
                        <Tag>{dims.length} 个</Tag>
                      </Space>
                    }
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                      {dims.map(dimension => (
                        <Card
                          key={dimension._id}
                          hoverable
                          size="small"
                          style={{ borderLeft: `4px solid ${dimension.color}` }}
                          onClick={() => openEditDimension(dimension)}
                        >
                          <Card.Meta
                            avatar={
                              <Avatar
                                size="small"
                                style={{ backgroundColor: dimension.color }}
                                icon={dimensionIcons[dimension.icon] || <BulbOutlined />}
                              />
                            }
                            title={<span style={{ fontSize: 14 }}>{dimension.displayName}</span>}
                            description={
                              <div style={{ fontSize: 12, color: '#666' }}>
                                {dimension.description?.substring(0, 60)}
                                {dimension.description?.length > 60 ? '...' : ''}
                              </div>
                            }
                          />
                        </Card>
                      ))}
                    </div>
                  </Panel>
                ))}
              </Collapse>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                {filteredDimensions.map(dimension => (
                  <Card
                    key={dimension._id}
                    hoverable
                    style={{ borderTop: `3px solid ${dimension.color}` }}
                    onClick={() => openEditDimension(dimension)}
                    actions={[
                      <EditOutlined key="edit" onClick={(e) => { e.stopPropagation(); openEditDimension(dimension); }} />,
                      <Popconfirm
                        key="delete"
                        title="确定删除该维度？"
                        onConfirm={(e) => { e?.stopPropagation(); handleDeleteDimension(dimension._id); }}
                        onCancel={(e) => e?.stopPropagation()}
                      >
                        <DeleteOutlined onClick={(e) => e.stopPropagation()} />
                      </Popconfirm>
                    ]}
                  >
                    <Card.Meta
                      avatar={
                        <Avatar
                          style={{ backgroundColor: dimension.color }}
                          icon={dimensionIcons[dimension.icon] || <BulbOutlined />}
                        />
                      }
                      title={dimension.displayName}
                      description={dimension.description?.substring(0, 100)}
                    />
                    {dimension.prompts && dimension.prompts.length > 0 && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>思考角度：</div>
                        {dimension.prompts.slice(0, 2).map((prompt, i) => (
                          <div key={i} style={{ fontSize: 12, color: '#666' }}>• {prompt}</div>
                        ))}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}

            {filteredDimensions.length === 0 && (
              <Empty description="没有找到匹配的维度" />
            )}
          </Card>
        </TabPane>
      </Tabs>

      {/* 创建设计 Modal */}
      <Modal
        title="新建设计项目"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateDesign}>
          <Form.Item
            name="title"
            label="项目名称"
            rules={[{ required: true, message: '请输入项目名称' }]}
          >
            <Input placeholder="给你的设计项目起个名字" />
          </Form.Item>

          <Form.Item
            name="description"
            label="项目描述"
            rules={[{ required: true, message: '请输入项目描述' }]}
          >
            <TextArea rows={4} placeholder="描述一下这个设计项目的背景和目标" />
          </Form.Item>

          <Form.Item name="category" label="项目类型" initialValue="other">
            <Select>
              {Object.entries(categoryLabels).map(([value, label]) => (
                <Option key={value} value={value}>{label}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="inspiration" label="灵感来源">
            <TextArea rows={2} placeholder="这个想法是怎么来的？" />
          </Form.Item>

          <Form.Item name="goals" label="期望目标（每行一个）">
            <TextArea rows={3} placeholder="希望通过这个设计达成什么目标？" />
          </Form.Item>

          <Form.Item
            name="selectedDimensions"
            label="创意维度（可选）"
            extra="留空则由 AI 智能筛选最适合的维度"
          >
            <Select mode="multiple" placeholder="可选：指定特定维度，或留空让 AI 自动筛选">
              {dimensions.map((dim) => (
                <Option key={dim._id} value={dim._id}>
                  <Space>
                    <Avatar
                      size="small"
                      style={{ backgroundColor: dim.color }}
                      icon={dimensionIcons[dim.icon] || <BulbOutlined />}
                    />
                    {dim.displayName}
                  </Space>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="priority" label="优先级" initialValue="medium">
            <Select>
              {Object.entries(priorityLabels).map(([value, { label }]) => (
                <Option key={value} value={value}>{label}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                创建
              </Button>
              <Button onClick={() => setCreateModalVisible(false)}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 设计详情 Modal */}
      <Modal
        title={
          <Space>
            <BulbOutlined style={{ color: '#667eea' }} />
            {selectedDesign?.title}
          </Space>
        }
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false);
          setSelectedDesign(null);
        }}
        footer={null}
        width={900}
      >
        {selectedDesign && (
          <Tabs defaultActiveKey="overview">
            <TabPane tab="概览" key="overview">
              <div style={{ marginBottom: 24 }}>
                <Space wrap style={{ marginBottom: 16 }}>
                  <Tag color={statusLabels[selectedDesign.status]?.color}>
                    {statusLabels[selectedDesign.status]?.label}
                  </Tag>
                  <Tag>{categoryLabels[selectedDesign.category]}</Tag>
                  <Tag color={priorityLabels[selectedDesign.priority]?.color}>
                    {priorityLabels[selectedDesign.priority]?.label}
                  </Tag>
                </Space>

                <Card size="small" title="项目描述" style={{ marginBottom: 16 }}>
                  <p>{selectedDesign.description}</p>
                </Card>

                {selectedDesign.inspiration && (
                  <Card size="small" title="灵感来源" style={{ marginBottom: 16 }}>
                    <p>{selectedDesign.inspiration}</p>
                  </Card>
                )}

                {selectedDesign.goals && selectedDesign.goals.length > 0 && (
                  <Card size="small" title="期望目标" style={{ marginBottom: 16 }}>
                    <ul>
                      {selectedDesign.goals.map((goal, i) => (
                        <li key={i}>{goal}</li>
                      ))}
                    </ul>
                  </Card>
                )}

                {/* 需求澄清状态 */}
                <Card
                  size="small"
                  title={
                    <Space>
                      <QuestionCircleOutlined />
                      需求澄清
                      {selectedDesign.clarifyStatus === 'completed' && (
                        <Tag color="success">已完成</Tag>
                      )}
                      {selectedDesign.clarifyStatus === 'skipped' && (
                        <Tag color="default">已跳过</Tag>
                      )}
                      {(!selectedDesign.clarifyStatus || selectedDesign.clarifyStatus === 'pending') && (
                        <Tag color="warning">待澄清</Tag>
                      )}
                    </Space>
                  }
                  style={{ marginBottom: 16 }}
                  extra={
                    (!selectedDesign.clarifyStatus || selectedDesign.clarifyStatus === 'pending') && (
                      <Button
                        type="primary"
                        size="small"
                        icon={<FormOutlined />}
                        onClick={() => handleStartClarify(selectedDesign)}
                      >
                        开始澄清
                      </Button>
                    )
                  }
                >
                  {selectedDesign.clarifyStatus === 'completed' && selectedDesign.requirementSummary ? (
                    <div>
                      <p style={{ color: '#333', lineHeight: 1.6 }}>{selectedDesign.requirementSummary}</p>
                      {selectedDesign.clarifyingQA && selectedDesign.clarifyingQA.length > 0 && (
                        <Collapse size="small" style={{ marginTop: 12 }}>
                          <Panel header="查看问答详情" key="qa">
                            {selectedDesign.clarifyingQA.map((qa, i) => (
                              <div key={i} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #f0f0f0' }}>
                                <div style={{ fontWeight: 500, marginBottom: 4 }}>
                                  <Tag color="blue">{qa.category}</Tag>
                                  {qa.question}
                                </div>
                                <div style={{ color: '#52c41a' }}>
                                  → {qa.answer?.join('、') || qa.customAnswer || '未回答'}
                                </div>
                              </div>
                            ))}
                          </Panel>
                        </Collapse>
                      )}
                    </div>
                  ) : selectedDesign.clarifyStatus === 'skipped' ? (
                    <p style={{ color: '#999' }}>您选择了跳过需求澄清步骤</p>
                  ) : (
                    <p style={{ color: '#999' }}>
                      通过回答几个问题，让AI更好地理解您的设计需求，生成更精准的创意方案
                    </p>
                  )}
                </Card>

                <Card size="small" title="AI 筛选的维度" style={{ marginBottom: 16 }}>
                  <Space wrap>
                    {selectedDesign.selectedDimensions?.map((dim) => (
                      <Tag key={dim._id} color={dim.color} icon={dimensionIcons[dim.icon]}>
                        {dim.displayName}
                      </Tag>
                    ))}
                    {(!selectedDesign.selectedDimensions || selectedDesign.selectedDimensions.length === 0) && (
                      <span style={{ color: '#999' }}>点击下方按钮，AI 将自动筛选适合的维度</span>
                    )}
                  </Space>
                </Card>

                <Space>
                  <Button
                    type="primary"
                    icon={<ThunderboltOutlined />}
                    loading={generatingIdeas === selectedDesign._id}
                    onClick={() => handleGenerateIdeas(selectedDesign)}
                  >
                    AI 创意发散
                  </Button>
                  <Button
                    icon={<RocketOutlined />}
                    loading={generatingProposal === selectedDesign._id}
                    onClick={() => handleGenerateProposal(selectedDesign)}
                    disabled={!selectedDesign.dimensionIdeas?.length}
                  >
                    生成综合方案
                  </Button>
                </Space>
              </div>
            </TabPane>

            <TabPane
              tab={
                <span>
                  创意发散
                  {selectedDesign.dimensionIdeas?.length > 0 && (
                    <Badge
                      count={selectedDesign.dimensionIdeas.reduce((sum, di) => sum + (di.ideas?.length || 0), 0)}
                      style={{ marginLeft: 8 }}
                    />
                  )}
                </span>
              }
              key="ideas"
            >
              {selectedDesign.status === 'ideating' ? (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <Spin size="large" />
                  <p style={{ marginTop: 16 }}>AI 正在发散创意中...</p>
                </div>
              ) : (
                renderDimensionIdeas(selectedDesign.dimensionIdeas)
              )}
            </TabPane>

            <TabPane
              tab={
                <span>
                  综合方案
                  {selectedDesign.creativeProposals?.length > 0 && (
                    <Badge count={selectedDesign.creativeProposals.length} style={{ marginLeft: 8 }} />
                  )}
                </span>
              }
              key="proposals"
            >
              {renderProposals(selectedDesign.creativeProposals)}
            </TabPane>

            <TabPane
              tab={
                <span>
                  <ThunderboltOutlined /> 创意发散
                </span>
              }
              key="mindmap"
            >
              <MindMapCanvas
                designId={selectedDesign._id}
                designTitle={selectedDesign.title}
              />
            </TabPane>
          </Tabs>
        )}
      </Modal>

      {/* 创建维度 Modal */}
      <Modal
        title="新建创意维度"
        open={dimensionModalVisible}
        onCancel={() => setDimensionModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form form={dimensionForm} layout="vertical" onFinish={handleCreateDimension}>
          <Form.Item
            name="name"
            label="维度标识（英文，唯一）"
            rules={[{ required: true, message: '请输入维度标识' }]}
          >
            <Input placeholder="如: gamification" />
          </Form.Item>

          <Form.Item
            name="displayName"
            label="显示名称"
            rules={[{ required: true, message: '请输入显示名称' }]}
          >
            <Input placeholder="如: 游戏化" />
          </Form.Item>

          <Form.Item
            name="description"
            label="维度描述"
            rules={[{ required: true, message: '请输入描述' }]}
          >
            <TextArea rows={2} placeholder="描述这个维度的思考方向" />
          </Form.Item>

          <Form.Item name="prompts" label="思考角度（每行一个）">
            <TextArea rows={4} placeholder="从这个维度可以问哪些问题？" />
          </Form.Item>

          <Form.Item name="examples" label="参考案例（格式: 标题:描述，每行一个）">
            <TextArea rows={3} placeholder="电子墨水屏日历:将传统纸质日历转化为低功耗电子墨水屏" />
          </Form.Item>

          <Form.Item name="color" label="颜色" initialValue="#667eea">
            <Input type="color" style={{ width: 100, height: 32 }} />
          </Form.Item>

          <Form.Item name="icon" label="图标" initialValue="bulb">
            <Select>
              <Option value="bulb"><BulbOutlined /> 灯泡</Option>
              <Option value="laptop"><LaptopOutlined /> 电脑</Option>
              <Option value="robot"><RobotOutlined /> 机器人</Option>
              <Option value="book"><BookOutlined /> 书本</Option>
              <Option value="star"><StarOutlined /> 星星</Option>
            </Select>
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                创建
              </Button>
              <Button onClick={() => setDimensionModalVisible(false)}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑维度 Modal */}
      <Modal
        title={
          <Space>
            <Avatar
              style={{ backgroundColor: selectedDimension?.color }}
              icon={dimensionIcons[selectedDimension?.icon || 'bulb']}
            />
            编辑维度：{selectedDimension?.displayName}
          </Space>
        }
        open={editDimensionModalVisible}
        onCancel={() => {
          setEditDimensionModalVisible(false);
          setSelectedDimension(null);
        }}
        footer={null}
        width={700}
      >
        {selectedDimension && (
          <Form form={editDimensionForm} layout="vertical" onFinish={handleEditDimension}>
            <div style={{ marginBottom: 16, padding: 12, background: '#f6f8fa', borderRadius: 8 }}>
              <Space>
                <Tag color={categoryColors[selectedDimension.category || ''] || '#667eea'}>
                  {selectedDimension.category || '其他'}
                </Tag>
                <span style={{ color: '#666', fontSize: 12 }}>
                  ID: {selectedDimension.name}
                </span>
              </Space>
            </div>

            <Form.Item
              name="displayName"
              label="显示名称"
              rules={[{ required: true, message: '请输入显示名称' }]}
            >
              <Input />
            </Form.Item>

            <Form.Item
              name="description"
              label="维度描述"
              rules={[{ required: true, message: '请输入描述' }]}
            >
              <TextArea rows={4} />
            </Form.Item>

            <Form.Item name="prompts" label="思考角度（每行一个）">
              <TextArea rows={4} placeholder="从这个维度可以问哪些问题？" />
            </Form.Item>

            <Form.Item name="examples" label="参考案例（格式: 标题:描述，每行一个）">
              <TextArea rows={3} placeholder="案例标题:案例描述" />
            </Form.Item>

            <div style={{ display: 'flex', gap: 16 }}>
              <Form.Item name="color" label="颜色" style={{ flex: 1 }}>
                <Input type="color" style={{ width: '100%', height: 32 }} />
              </Form.Item>

              <Form.Item name="icon" label="图标" style={{ flex: 2 }}>
                <Select>
                  <Option value="bulb"><BulbOutlined /> 灯泡</Option>
                  <Option value="laptop"><LaptopOutlined /> 电脑</Option>
                  <Option value="robot"><RobotOutlined /> 机器人</Option>
                  <Option value="book"><BookOutlined /> 书本</Option>
                  <Option value="star"><StarOutlined /> 星星</Option>
                  <Option value="rocket"><RocketOutlined /> 火箭</Option>
                  <Option value="global"><GlobalOutlined /> 全球</Option>
                  <Option value="tool"><ToolOutlined /> 工具</Option>
                  <Option value="user"><UserOutlined /> 用户</Option>
                  <Option value="crown"><CrownOutlined /> 皇冠</Option>
                  <Option value="picture"><PictureOutlined /> 图片</Option>
                  <Option value="file-text"><FileTextOutlined /> 文档</Option>
                </Select>
              </Form.Item>
            </div>

            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit">
                  保存修改
                </Button>
                <Button onClick={() => setEditDimensionModalVisible(false)}>
                  取消
                </Button>
                <Popconfirm
                  title="确定删除该维度？"
                  onConfirm={() => {
                    handleDeleteDimension(selectedDimension._id);
                    setEditDimensionModalVisible(false);
                    setSelectedDimension(null);
                  }}
                >
                  <Button danger>删除维度</Button>
                </Popconfirm>
              </Space>
            </Form.Item>
          </Form>
        )}
      </Modal>

      {/* 需求澄清 Modal */}
      <Modal
        title={
          <Space>
            <QuestionCircleOutlined style={{ color: '#667eea' }} />
            深度需求澄清
          </Space>
        }
        open={clarifyModalVisible}
        onCancel={() => {
          setClarifyModalVisible(false);
          setClarifyingQuestions([]);
          setClarifyAnswers({});
        }}
        footer={
          <Space>
            <Button onClick={handleSkipClarify}>
              跳过此步骤
            </Button>
            <Button
              type="primary"
              onClick={handleSubmitClarify}
              loading={submittingClarify}
              disabled={loadingClarify}
            >
              提交并生成洞察
            </Button>
          </Space>
        }
        width={800}
      >
        {loadingClarify ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <Spin size="large" />
            <p style={{ marginTop: 16, color: '#666', fontSize: 16 }}>
              AI 正在深度分析您的设计想法...
            </p>
            <p style={{ color: '#999', fontSize: 13 }}>
              识别隐藏假设、发现潜在盲点、生成针对性问题
            </p>
          </div>
        ) : (
          <div>
            <Alert
              message="通过回答这些深度问题，帮助AI理解您真正想要的"
              description="这些问题基于AI对您设计想法的深度分析，旨在揭示隐藏假设、发现盲点、明确关键取舍。您的回答将用于生成更精准的创意方案。"
              type="info"
              showIcon
              style={{ marginBottom: 24 }}
            />

            {clarifyingQuestions.map((q: any, index: number) => {
              const categoryConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
                emotion: { label: '情感定位', color: '#eb2f96', icon: <BulbOutlined /> },
                style: { label: '风格取向', color: '#722ed1', icon: <ExperimentOutlined /> },
                interaction: { label: '互动体验', color: '#1890ff', icon: <UserOutlined /> },
                value: { label: '核心价值', color: '#52c41a', icon: <StarOutlined /> },
                tradeoff: { label: '设计取舍', color: '#fa8c16', icon: <ThunderboltOutlined /> },
                context: { label: '使用情境', color: '#13c2c2', icon: <GlobalOutlined /> }
              };
              const config = categoryConfig[q.category] || { label: q.category, color: '#667eea', icon: <QuestionCircleOutlined /> };

              return (
                <Card
                  key={index}
                  size="small"
                  style={{ marginBottom: 20, borderLeft: `4px solid ${config.color}` }}
                  title={
                    <div>
                      <Space style={{ marginBottom: 8 }}>
                        <Tag color={config.color} icon={config.icon}>{config.label}</Tag>
                      </Space>
                      <div style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.5 }}>
                        {q.question}
                      </div>
                    </div>
                  }
                >
                  {/* 为什么问这个问题 */}
                  {q.whyAsk && (
                    <div style={{
                      marginBottom: 16,
                      padding: '10px 12px',
                      background: '#f6f8fa',
                      borderRadius: 6,
                      fontSize: 13,
                      color: '#666',
                      borderLeft: '3px solid #d9d9d9'
                    }}>
                      <strong style={{ color: '#333' }}>💡 </strong> {q.whyAsk}
                    </div>
                  )}

                  {q.questionType === 'single' ? (
                    <Radio.Group
                      value={clarifyAnswers[index]?.answer?.[0]}
                      onChange={(e) => handleAnswerChange(index, e.target.value)}
                      style={{ width: '100%' }}
                    >
                      <Space direction="vertical" style={{ width: '100%' }}>
                        {q.options?.map((option: string, optIndex: number) => (
                          <Radio
                            key={optIndex}
                            value={option}
                            style={{
                              display: 'block',
                              padding: '8px 12px',
                              margin: '4px 0',
                              background: clarifyAnswers[index]?.answer?.[0] === option ? '#f0f5ff' : '#fafafa',
                              borderRadius: 6,
                              border: clarifyAnswers[index]?.answer?.[0] === option ? '1px solid #d6e4ff' : '1px solid #f0f0f0'
                            }}
                          >
                            {option}
                          </Radio>
                        ))}
                      </Space>
                    </Radio.Group>
                  ) : q.questionType === 'multiple' ? (
                    <Checkbox.Group
                      value={clarifyAnswers[index]?.answer || []}
                      onChange={(values) => handleAnswerChange(index, values as string[])}
                      style={{ width: '100%' }}
                    >
                      <Space direction="vertical" style={{ width: '100%' }}>
                        {q.options?.map((option: string, optIndex: number) => (
                          <Checkbox
                            key={optIndex}
                            value={option}
                            style={{
                              display: 'block',
                              padding: '8px 12px',
                              margin: '4px 0',
                              background: '#fafafa',
                              borderRadius: 6
                            }}
                          >
                            {option}
                          </Checkbox>
                        ))}
                      </Space>
                    </Checkbox.Group>
                  ) : (
                    <TextArea
                      rows={3}
                      value={clarifyAnswers[index]?.customAnswer || ''}
                      onChange={(e) => handleAnswerChange(index, e.target.value, true)}
                      placeholder="请输入您的想法..."
                    />
                  )}

                  {q.questionType !== 'text' && (
                    <div style={{ marginTop: 12 }}>
                      <Input
                        placeholder="补充说明：如果以上选项都不完全符合，请在此补充..."
                        value={clarifyAnswers[index]?.customAnswer || ''}
                        onChange={(e) => handleAnswerChange(index, e.target.value, true)}
                        prefix={<FormOutlined style={{ color: '#999' }} />}
                      />
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </Modal>

      <style>{`
        .personal-designs-page {
          padding: 0;
        }
        .proposal-card {
          border-radius: 12px;
        }
        .proposal-section {
          margin-bottom: 20px;
        }
        .proposal-section h4 {
          color: #667eea;
          margin-bottom: 8px;
        }
        .proposal-section p {
          color: #333;
          line-height: 1.6;
        }
      `}</style>
    </div>
  );
};

export default PersonalDesignsPage;
