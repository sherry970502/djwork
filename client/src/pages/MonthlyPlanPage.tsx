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
  DatePicker,
  Empty,
  Spin,
  List,
  Tooltip,
  Popconfirm,
  Alert,
  Divider,
  Row,
  Col,
  Statistic,
  Tabs,
  Checkbox,
  Radio,
  Dropdown
} from 'antd';
import {
  PlusOutlined,
  SyncOutlined,
  RobotOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  CalendarOutlined,
  FileTextOutlined,
  BulbOutlined,
  DeleteOutlined,
  ReloadOutlined,
  RocketOutlined,
  WarningOutlined,
  TrophyOutlined,
  AimOutlined,
  SwapOutlined,
  ArrowRightOutlined,
  HistoryOutlined,
  UpCircleOutlined,
  BankOutlined,
  BookOutlined,
  ThunderboltOutlined,
  QuestionCircleOutlined,
  AppstoreOutlined,
  DownOutlined,
  SearchOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import * as api from '../services/api';

const { TextArea } = Input;
const { Option } = Select;

// 四大项目分类
const projectLabels: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  company_management: { label: '公司管理', color: '#722ed1', icon: <BankOutlined /> },
  education: { label: '教育', color: '#1890ff', icon: <BookOutlined /> },
  gaming: { label: '游戏', color: '#52c41a', icon: <ThunderboltOutlined /> },
  other: { label: '其他', color: '#8c8c8c', icon: <QuestionCircleOutlined /> }
};

const categoryLabels: Record<string, string> = {
  business: '业务/产品',
  organization: '组织/管理',
  strategy: '战略/资本',
  brand: '品牌/生态',
  unknown: '未分类'
};

const priorityLabels: Record<string, { label: string; color: string }> = {
  high: { label: '高', color: 'red' },
  medium: { label: '中', color: 'orange' },
  low: { label: '低', color: 'default' }
};

const planStatusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: '待处理', color: 'default', icon: <ClockCircleOutlined /> },
  in_progress: { label: '进行中', color: 'processing', icon: <SyncOutlined spin /> },
  completed: { label: '已完成', color: 'success', icon: <CheckCircleOutlined /> },
  deferred: { label: '已推迟', color: 'warning', icon: <ExclamationCircleOutlined /> },
  migrated: { label: '已迁移', color: 'purple', icon: <SwapOutlined /> }
};

const completionStatusConfig: Record<string, { label: string; color: string }> = {
  completed: { label: '已完成', color: 'success' },
  partial: { label: '部分完成', color: 'warning' },
  in_progress: { label: '进行中', color: 'processing' },
  not_started: { label: '未开始', color: 'error' },
  unclear: { label: '待评估', color: 'default' }
};

const actionLabels: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  carry_over: { label: '迁移下月', color: 'blue', icon: <ArrowRightOutlined /> },
  close: { label: '可以关闭', color: 'green', icon: <CheckCircleOutlined /> },
  upgrade: { label: '升级迭代', color: 'purple', icon: <UpCircleOutlined /> },
  split: { label: '拆分任务', color: 'orange', icon: <AppstoreOutlined /> },
  merge: { label: '合并处理', color: 'cyan', icon: <SyncOutlined /> }
};

const MonthlyPlanPage: React.FC = () => {
  const [currentMonth, setCurrentMonth] = useState(dayjs().format('YYYY-MM'));
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [reviewingItem, setReviewingItem] = useState<string | null>(null);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [migrateModalVisible, setMigrateModalVisible] = useState(false);
  const [batchMigrateModalVisible, setBatchMigrateModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [activeProject, setActiveProject] = useState<string>('all');
  // 会议选择复盘相关状态
  const [meetingSelectModalVisible, setMeetingSelectModalVisible] = useState(false);
  const [relatedMeetings, setRelatedMeetings] = useState<any[]>([]);
  const [selectedMeetingIds, setSelectedMeetingIds] = useState<string[]>([]);
  const [loadingMeetings, setLoadingMeetings] = useState(false);
  const [reviewingWithSelection, setReviewingWithSelection] = useState(false);
  const [reviewTargetItem, setReviewTargetItem] = useState<any>(null);
  const [form] = Form.useForm();
  const [migrateForm] = Form.useForm();

  const fetchPlan = async () => {
    setLoading(true);
    try {
      const res = await api.getMonthlyPlan(currentMonth);
      if (res.success) {
        setPlan(res.data);
      }
    } catch (error) {
      message.error('获取月度计划失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlan();
    setSelectedItems([]);
  }, [currentMonth]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await api.syncMonthlyPlan(currentMonth);
      if (res.success) {
        message.success(res.message || '同步成功');
        setPlan(res.data);
      }
    } catch (error) {
      message.error('同步失败');
    } finally {
      setSyncing(false);
    }
  };

  const handleAddItem = async (values: any) => {
    try {
      const res = await api.addPlanItem(currentMonth, values);
      if (res.success) {
        message.success('添加成功');
        setAddModalVisible(false);
        form.resetFields();
        setPlan(res.data);
      }
    } catch (error) {
      message.error('添加失败');
    }
  };

  const handleUpdateStatus = async (itemId: string, planStatus: string) => {
    try {
      const res = await api.updatePlanItem(currentMonth, itemId, { planStatus });
      if (res.success) {
        message.success('状态更新成功');
        setPlan(res.data);
      }
    } catch (error) {
      message.error('更新失败');
    }
  };

  const handleUpdateProject = async (itemId: string, project: string) => {
    try {
      const res = await api.updateItemProject(currentMonth, itemId, project);
      if (res.success) {
        message.success('项目分类更新成功');
        setPlan(res.data);
      }
    } catch (error) {
      message.error('更新失败');
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    try {
      const res = await api.removePlanItem(currentMonth, itemId);
      if (res.success) {
        message.success('删除成功');
        setPlan(res.data);
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleReviewItem = async (itemId: string) => {
    setReviewingItem(itemId);
    try {
      const res = await api.reviewPlanItem(currentMonth, itemId);
      if (res.success) {
        message.success('复盘完成');
        fetchPlan();
      }
    } catch (error) {
      message.error('复盘失败');
    } finally {
      setReviewingItem(null);
    }
  };

  // 打开会议选择复盘 Modal
  const openMeetingSelectModal = async (item: any) => {
    setReviewTargetItem(item);
    setSelectedMeetingIds([]);
    setMeetingSelectModalVisible(true);
    setDetailModalVisible(false); // 关闭详情对话框
    setLoadingMeetings(true);

    try {
      const res = await api.getRelatedMeetingsForItem(currentMonth, item._id);
      if (res.success) {
        setRelatedMeetings(res.data.meetings || []);
        // 默认选中得分最高的会议（如果有）
        const topMeetings = (res.data.meetings || [])
          .filter((m: any) => m.score >= 2)
          .map((m: any) => m._id);
        setSelectedMeetingIds(topMeetings);
      }
    } catch (error) {
      message.error('获取相关会议失败');
      setRelatedMeetings([]);
    } finally {
      setLoadingMeetings(false);
    }
  };

  // 使用选中的会议进行复盘
  const handleReviewWithSelection = async () => {
    if (!reviewTargetItem) return;

    if (selectedMeetingIds.length === 0) {
      message.warning('请至少选择一个会议');
      return;
    }

    setReviewingWithSelection(true);
    try {
      const res = await api.reviewPlanItemWithSelection(
        currentMonth,
        reviewTargetItem._id,
        selectedMeetingIds
      );
      if (res.success) {
        message.success('复盘完成');
        setMeetingSelectModalVisible(false);
        setReviewTargetItem(null);
        fetchPlan();
      } else {
        message.error(res.message || '复盘失败');
      }
    } catch (error: any) {
      console.error('复盘失败:', error);
      const errorMsg = error.response?.data?.message || error.message || '复盘失败';
      message.error(`复盘失败: ${errorMsg}`);
    } finally {
      setReviewingWithSelection(false);
    }
  };

  const handleReviewAll = async () => {
    setReviewing(true);
    try {
      const res = await api.reviewMonthlyPlan(currentMonth);
      if (res.success) {
        message.success(res.message || '月度复盘完成');
        setPlan(res.data);
      }
    } catch (error) {
      message.error('复盘失败');
    } finally {
      setReviewing(false);
    }
  };

  const handleMigrateItem = async (values: any) => {
    if (!selectedItem) return;
    try {
      const res = await api.migrateItem(currentMonth, selectedItem._id, values);
      if (res.success) {
        message.success(res.message);
        setMigrateModalVisible(false);
        migrateForm.resetFields();
        fetchPlan();
      }
    } catch (error) {
      message.error('迁移失败');
    }
  };

  const handleBatchMigrate = async (values: any) => {
    if (selectedItems.length === 0) {
      message.warning('请先选择要迁移的项目');
      return;
    }
    try {
      const res = await api.batchMigrateItems(currentMonth, {
        itemIds: selectedItems,
        upgradeToV2: values.upgradeToV2
      });
      if (res.success) {
        message.success(res.message);
        setBatchMigrateModalVisible(false);
        setSelectedItems([]);
        fetchPlan();
      }
    } catch (error) {
      message.error('批量迁移失败');
    }
  };

  const openItemDetail = (item: any) => {
    setSelectedItem(item);
    setDetailModalVisible(true);
  };

  const openMigrateModal = (item: any) => {
    setSelectedItem(item);
    migrateForm.setFieldsValue({
      upgradeToV2: false,
      newTitle: item.title,
      newDescription: item.description
    });
    setMigrateModalVisible(true);
  };

  // 按项目分类过滤
  const filteredItems = plan?.items?.filter((item: any) => {
    if (activeProject === 'all') return true;
    return (item.project || 'other') === activeProject;
  }) || [];

  // 计算下个月
  const getNextMonth = () => {
    const [year, monthNum] = currentMonth.split('-').map(Number);
    const nextMonthDate = new Date(year, monthNum, 1);
    return `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`;
  };

  const columns = [
    {
      title: (
        <Checkbox
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedItems(filteredItems.filter((i: any) => i.planStatus !== 'completed' && i.planStatus !== 'migrated').map((i: any) => i._id));
            } else {
              setSelectedItems([]);
            }
          }}
          checked={selectedItems.length > 0 && selectedItems.length === filteredItems.filter((i: any) => i.planStatus !== 'completed' && i.planStatus !== 'migrated').length}
        />
      ),
      width: 40,
      render: (_: any, record: any) => (
        record.planStatus !== 'completed' && record.planStatus !== 'migrated' ? (
          <Checkbox
            checked={selectedItems.includes(record._id)}
            onChange={(e) => {
              if (e.target.checked) {
                setSelectedItems([...selectedItems, record._id]);
              } else {
                setSelectedItems(selectedItems.filter(id => id !== record._id));
              }
            }}
          />
        ) : null
      )
    },
    {
      title: '计划项目',
      dataIndex: 'title',
      key: 'title',
      render: (title: string, record: any) => (
        <div>
          <a onClick={() => openItemDetail(record)} style={{ fontWeight: 500 }}>
            {title}
            {record.migration?.version > 1 && (
              <Tag color="purple" style={{ marginLeft: 8 }}>v{record.migration.version}.0</Tag>
            )}
          </a>
          <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
            <Space size={4} wrap>
              {record.sourceType === 'migrated' && (
                <Tooltip title={`从 ${record.migration?.fromMonth} 迁移`}>
                  <Tag color="purple" icon={<HistoryOutlined />}>迁移</Tag>
                </Tooltip>
              )}
              {record.sourceType === 'task' && <Tag color="blue">组织事务</Tag>}
              {record.sourceType === 'topic' && <Tag color="green">推荐议题</Tag>}
              <Tag color={categoryLabels[record.category] ? 'default' : 'default'}>
                {categoryLabels[record.category] || record.category}
              </Tag>
            </Space>
          </div>
        </div>
      )
    },
    {
      title: '项目',
      dataIndex: 'project',
      key: 'project',
      width: 120,
      render: (project: string, record: any) => {
        return (
          <Select
            value={project || 'other'}
            size="small"
            style={{ width: 110 }}
            onChange={(val) => handleUpdateProject(record._id, val)}
          >
            {Object.entries(projectLabels).map(([key, cfg]) => (
              <Option key={key} value={key}>
                <Space>
                  {cfg.icon}
                  {cfg.label}
                </Space>
              </Option>
            ))}
          </Select>
        );
      }
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 80,
      render: (priority: string) => {
        const p = priorityLabels[priority] || { label: priority, color: 'default' };
        return <Tag color={p.color}>{p.label}</Tag>;
      }
    },
    {
      title: '执行状态',
      dataIndex: 'planStatus',
      key: 'planStatus',
      width: 120,
      render: (status: string, record: any) => {
        if (status === 'migrated') {
          return (
            <Tag color="purple" icon={<SwapOutlined />}>
              已迁移
            </Tag>
          );
        }
        return (
          <Select
            value={status}
            size="small"
            style={{ width: 110 }}
            onChange={(val) => handleUpdateStatus(record._id, val)}
          >
            {Object.entries(planStatusConfig).filter(([key]) => key !== 'migrated').map(([key, cfg]) => (
              <Option key={key} value={key}>
                <Space>
                  {cfg.icon}
                  {cfg.label}
                </Space>
              </Option>
            ))}
          </Select>
        );
      }
    },
    {
      title: 'AI 复盘',
      key: 'review',
      width: 140,
      render: (_: any, record: any) => {
        if (record.review?.completionStatus) {
          const config = completionStatusConfig[record.review.completionStatus];
          return (
            <Tooltip title="点击查看详情">
              <Tag
                color={config.color}
                style={{ cursor: 'pointer' }}
                onClick={() => openItemDetail(record)}
              >
                {config.label}
              </Tag>
            </Tooltip>
          );
        }
        return (
          <Dropdown
            menu={{
              items: [
                { key: 'auto', label: '自动复盘', icon: <RobotOutlined /> },
                { key: 'select', label: '选择会议复盘', icon: <SearchOutlined /> }
              ],
              onClick: ({ key }) => {
                if (key === 'auto') handleReviewItem(record._id);
                if (key === 'select') openMeetingSelectModal(record);
              }
            }}
            trigger={['click']}
          >
            <Button
              size="small"
              icon={<RobotOutlined />}
              loading={reviewingItem === record._id}
            >
              复盘 <DownOutlined />
            </Button>
          </Dropdown>
        );
      }
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_: any, record: any) => (
        <Space>
          {record.planStatus !== 'completed' && record.planStatus !== 'migrated' && (
            <Tooltip title="迁移到下月">
              <Button
                type="text"
                icon={<ArrowRightOutlined />}
                size="small"
                onClick={() => openMigrateModal(record)}
              />
            </Tooltip>
          )}
          <Popconfirm title="确定删除？" onConfirm={() => handleRemoveItem(record._id)}>
            <Button type="text" danger icon={<DeleteOutlined />} size="small" />
          </Popconfirm>
        </Space>
      )
    }
  ];

  const renderMonthlySummary = () => {
    if (!plan?.monthlySummary?.overallAssessment) return null;

    const summary = plan.monthlySummary;
    return (
      <Card
        style={{ marginBottom: 24 }}
        title={
          <Space>
            <TrophyOutlined style={{ color: '#faad14' }} />
            月度复盘总结
          </Space>
        }
      >
        <Row gutter={24}>
          <Col span={6}>
            <Statistic
              title="总计划项"
              value={summary.totalItems || 0}
              prefix={<AimOutlined />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="已完成"
              value={summary.completedItems || 0}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="部分完成"
              value={summary.partialItems || 0}
              valueStyle={{ color: '#faad14' }}
              prefix={<ExclamationCircleOutlined />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="完成率"
              value={summary.totalItems > 0 ? Math.round((summary.completedItems / summary.totalItems) * 100) : 0}
              suffix="%"
              prefix={<RocketOutlined />}
            />
          </Col>
        </Row>

        <Divider />

        <div style={{ marginBottom: 16 }}>
          <h4>整体评价</h4>
          <p style={{ color: '#333', lineHeight: 1.8 }}>{summary.overallAssessment}</p>
        </div>

        {summary.keyAchievements?.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <h4><CheckCircleOutlined style={{ color: '#52c41a' }} /> 主要成果</h4>
            <ul>
              {summary.keyAchievements.map((item: string, i: number) => (
                <li key={i} style={{ marginBottom: 4 }}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {summary.areasForImprovement?.length > 0 && (
          <div>
            <h4><WarningOutlined style={{ color: '#faad14' }} /> 待改进领域</h4>
            <ul>
              {summary.areasForImprovement.map((item: string, i: number) => (
                <li key={i} style={{ marginBottom: 4 }}>{item}</li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    );
  };

  const renderItemReviewDetail = (item: any) => {
    if (!item?.review) return <Empty description="暂未复盘" />;

    const review = item.review;
    return (
      <div>
        {/* 完成状态 */}
        <Alert
          message={
            <Space>
              <span>完成状态：</span>
              <Tag color={completionStatusConfig[review.completionStatus]?.color}>
                {completionStatusConfig[review.completionStatus]?.label}
              </Tag>
            </Space>
          }
          description={review.completionReason}
          type={review.completionStatus === 'completed' ? 'success' : review.completionStatus === 'partial' ? 'warning' : 'info'}
          style={{ marginBottom: 16 }}
        />

        {/* 操作建议 */}
        {review.actionRecommendations?.length > 0 && (
          <Card
            size="small"
            title={<><RocketOutlined style={{ color: '#1890ff' }} /> 操作建议</>}
            style={{ marginBottom: 16, borderColor: '#1890ff' }}
          >
            <List
              size="small"
              dataSource={review.actionRecommendations}
              renderItem={(rec: any) => {
                const actionConfig = actionLabels[rec.action] || { label: rec.action, color: 'default', icon: null };
                return (
                  <List.Item
                    actions={[
                      rec.action === 'carry_over' || rec.action === 'upgrade' ? (
                        <Button
                          size="small"
                          type="primary"
                          icon={<ArrowRightOutlined />}
                          onClick={() => {
                            setDetailModalVisible(false);
                            migrateForm.setFieldsValue({
                              upgradeToV2: rec.action === 'upgrade',
                              newTitle: item.title,
                              newDescription: item.description,
                              evolutionNotes: review.nextMonthFocus
                            });
                            setMigrateModalVisible(true);
                          }}
                        >
                          执行迁移
                        </Button>
                      ) : null
                    ]}
                  >
                    <List.Item.Meta
                      avatar={
                        <Tag color={actionConfig.color} icon={actionConfig.icon}>
                          {actionConfig.label}
                        </Tag>
                      }
                      title={
                        <Space>
                          <Tag color={priorityLabels[rec.priority]?.color}>
                            {priorityLabels[rec.priority]?.label}优先级
                          </Tag>
                        </Space>
                      }
                      description={rec.reason}
                    />
                  </List.Item>
                );
              }}
            />
            {review.nextMonthFocus && (
              <Alert
                message="下月建议重点"
                description={review.nextMonthFocus}
                type="info"
                showIcon
                style={{ marginTop: 12 }}
              />
            )}
          </Card>
        )}

        {/* AI 综合评价 */}
        {review.summary && (
          <Card size="small" title="AI 综合评价" style={{ marginBottom: 16 }}>
            <p>{review.summary}</p>
          </Card>
        )}

        {/* 会议成果 */}
        {review.meetingOutcomes?.length > 0 && (
          <Card size="small" title={<><FileTextOutlined /> 相关会议讨论</>} style={{ marginBottom: 16 }}>
            <List
              size="small"
              dataSource={review.meetingOutcomes}
              renderItem={(outcome: any) => (
                <List.Item>
                  <List.Item.Meta
                    title={
                      <Space>
                        <CalendarOutlined />
                        {outcome.meetingTitle}
                      </Space>
                    }
                    description={
                      <div>
                        <p style={{ color: '#666' }}>{outcome.relatedContent}</p>
                        {outcome.conclusions?.length > 0 && (
                          <div style={{ marginTop: 8 }}>
                            <strong>会议结论：</strong>
                            <ul style={{ margin: '4px 0 0 0', paddingLeft: 20 }}>
                              {outcome.conclusions.map((c: string, i: number) => (
                                <li key={i} style={{ color: '#333' }}>{c}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        )}

        {/* 相关灵感 */}
        {review.relatedThoughts?.length > 0 && (
          <Card size="small" title={<><BulbOutlined /> 相关灵感</>} style={{ marginBottom: 16 }}>
            <List
              size="small"
              dataSource={review.relatedThoughts}
              renderItem={(thought: any) => (
                <List.Item>
                  <List.Item.Meta
                    description={
                      <div>
                        <p>{thought.content}</p>
                        <Tag color="blue">{thought.relevance}</Tag>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        )}

        {/* 缺漏提示 */}
        {review.gaps?.length > 0 && (
          <Card
            size="small"
            title={<><WarningOutlined style={{ color: '#faad14' }} /> 缺漏分析</>}
            style={{ marginBottom: 16, borderColor: '#faad14' }}
          >
            <List
              size="small"
              dataSource={review.gaps}
              renderItem={(gap: any) => (
                <List.Item>
                  <List.Item.Meta
                    title={<Tag color="warning">{gap.dimension}</Tag>}
                    description={
                      <div>
                        <p><strong>问题：</strong>{gap.description}</p>
                        <p><strong>建议：</strong>{gap.suggestion}</p>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        )}

        {/* 迁移历史 */}
        {item.migration?.fromMonth && (
          <Card size="small" title={<><HistoryOutlined /> 迁移历史</>} style={{ marginBottom: 16 }}>
            <p><strong>来源：</strong>从 {item.migration.fromMonth} 迁移</p>
            <p><strong>版本：</strong>v{item.migration.version}.0</p>
            {item.migration.evolutionNotes && (
              <p><strong>演进说明：</strong>{item.migration.evolutionNotes}</p>
            )}
            {item.migration.inheritedContext && (
              <div style={{ marginTop: 8, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
                <strong>继承的上下文：</strong>
                <pre style={{ whiteSpace: 'pre-wrap', margin: '8px 0 0 0', fontSize: 12 }}>
                  {item.migration.inheritedContext}
                </pre>
              </div>
            )}
          </Card>
        )}
      </div>
    );
  };

  // 项目分类 Tab
  const projectTabs = [
    { key: 'all', label: '全部', icon: <AppstoreOutlined /> },
    ...Object.entries(projectLabels).map(([key, cfg]) => ({
      key,
      label: cfg.label,
      icon: cfg.icon
    }))
  ];

  return (
    <div className="monthly-plan-page">
      <Card
        title={
          <Space>
            <CalendarOutlined style={{ color: '#667eea' }} />
            <span>DJ 工作月度计划</span>
            <DatePicker
              picker="month"
              value={dayjs(currentMonth)}
              onChange={(date) => date && setCurrentMonth(date.format('YYYY-MM'))}
              allowClear={false}
              style={{ marginLeft: 16 }}
            />
          </Space>
        }
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchPlan} loading={loading}>
              刷新
            </Button>
            <Button icon={<SyncOutlined />} onClick={handleSync} loading={syncing}>
              同步数据
            </Button>
            {selectedItems.length > 0 && (
              <Button
                icon={<SwapOutlined />}
                onClick={() => setBatchMigrateModalVisible(true)}
              >
                批量迁移 ({selectedItems.length})
              </Button>
            )}
            <Button
              type="primary"
              icon={<RobotOutlined />}
              onClick={handleReviewAll}
              loading={reviewing}
              disabled={!plan?.items?.length}
            >
              AI 月度复盘
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setAddModalVisible(true)}
              style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
            >
              添加计划
            </Button>
          </Space>
        }
      >
        <Alert
          message="数据来源与操作说明"
          description={
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              <li><Tag color="blue">组织事务</Tag> 来自战略决策中已完成分析的事务</li>
              <li><Tag color="green">推荐议题</Tag> 来自月度洞察中已接受的 AI 推荐议题</li>
              <li><Tag color="purple">迁移</Tag> 从上月迁移过来的未完成项目</li>
              <li>复盘后可查看详细分析报告，并根据 AI 建议决定是否迁移到下月（{getNextMonth()}）</li>
            </ul>
          }
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        {renderMonthlySummary()}

        {/* 事务统计看板 */}
        {plan?.items?.length > 0 && (
          <Card style={{ marginBottom: 24 }}>
            <Row gutter={[24, 16]}>
              {/* 按项目分类统计 */}
              <Col span={12}>
                <div style={{ marginBottom: 12 }}>
                  <strong style={{ fontSize: 14, color: '#333' }}>按项目分类</strong>
                </div>
                <Row gutter={16}>
                  {Object.entries(projectLabels).map(([key, cfg]) => {
                    const count = plan.items.filter((i: any) => (i.project || 'other') === key).length;
                    return (
                      <Col span={6} key={key}>
                        <Card
                          size="small"
                          hoverable
                          onClick={() => setActiveProject(key)}
                          style={{
                            borderColor: activeProject === key ? cfg.color : undefined,
                            background: activeProject === key ? `${cfg.color}10` : undefined
                          }}
                        >
                          <Statistic
                            title={<Space>{cfg.icon}<span style={{ fontSize: 12 }}>{cfg.label}</span></Space>}
                            value={count}
                            valueStyle={{ color: cfg.color, fontSize: 24 }}
                          />
                        </Card>
                      </Col>
                    );
                  })}
                </Row>
              </Col>

              {/* 按执行状态统计 */}
              <Col span={12}>
                <div style={{ marginBottom: 12 }}>
                  <strong style={{ fontSize: 14, color: '#333' }}>按执行状态</strong>
                </div>
                <Row gutter={16}>
                  <Col span={6}>
                    <Card size="small">
                      <Statistic
                        title={<span style={{ fontSize: 12 }}>待处理</span>}
                        value={plan.items.filter((i: any) => i.planStatus === 'pending').length}
                        valueStyle={{ color: '#8c8c8c', fontSize: 24 }}
                        prefix={<ClockCircleOutlined />}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card size="small">
                      <Statistic
                        title={<span style={{ fontSize: 12 }}>进行中</span>}
                        value={plan.items.filter((i: any) => i.planStatus === 'in_progress').length}
                        valueStyle={{ color: '#1890ff', fontSize: 24 }}
                        prefix={<SyncOutlined />}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card size="small">
                      <Statistic
                        title={<span style={{ fontSize: 12 }}>已完成</span>}
                        value={plan.items.filter((i: any) => i.planStatus === 'completed').length}
                        valueStyle={{ color: '#52c41a', fontSize: 24 }}
                        prefix={<CheckCircleOutlined />}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card size="small">
                      <Statistic
                        title={<span style={{ fontSize: 12 }}>已迁移</span>}
                        value={plan.items.filter((i: any) => i.planStatus === 'migrated').length}
                        valueStyle={{ color: '#722ed1', fontSize: 24 }}
                        prefix={<SwapOutlined />}
                      />
                    </Card>
                  </Col>
                </Row>
              </Col>
            </Row>

            {/* AI 复盘状态统计 */}
            <Divider style={{ margin: '16px 0' }} />
            <Row gutter={16}>
              <Col span={24}>
                <div style={{ marginBottom: 12 }}>
                  <strong style={{ fontSize: 14, color: '#333' }}>AI 复盘结论</strong>
                </div>
                <Space size={16} wrap>
                  <Tag color="success" style={{ padding: '4px 12px', fontSize: 14 }}>
                    <CheckCircleOutlined /> 已完成 {plan.items.filter((i: any) => i.review?.completionStatus === 'completed').length}
                  </Tag>
                  <Tag color="warning" style={{ padding: '4px 12px', fontSize: 14 }}>
                    <ExclamationCircleOutlined /> 部分完成 {plan.items.filter((i: any) => i.review?.completionStatus === 'partial').length}
                  </Tag>
                  <Tag color="error" style={{ padding: '4px 12px', fontSize: 14 }}>
                    <ClockCircleOutlined /> 未开始 {plan.items.filter((i: any) => i.review?.completionStatus === 'not_started').length}
                  </Tag>
                  <Tag color="default" style={{ padding: '4px 12px', fontSize: 14 }}>
                    <QuestionCircleOutlined /> 待复盘 {plan.items.filter((i: any) => !i.review?.completionStatus).length}
                  </Tag>
                </Space>
              </Col>
            </Row>
          </Card>
        )}

        {/* 项目分类 Tab */}
        <Tabs
          activeKey={activeProject}
          onChange={setActiveProject}
          style={{ marginBottom: 16 }}
          items={projectTabs.map(tab => ({
            key: tab.key,
            label: (
              <Space>
                {tab.icon}
                {tab.label}
                <Tag>{plan?.items?.filter((i: any) => tab.key === 'all' || (i.project || 'other') === tab.key).length || 0}</Tag>
              </Space>
            )
          }))}
        />

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin size="large" />
          </div>
        ) : filteredItems.length > 0 ? (
          <Table
            columns={columns}
            dataSource={filteredItems}
            rowKey="_id"
            pagination={false}
            rowClassName={(record: any) =>
              record.planStatus === 'migrated' ? 'migrated-row' : ''
            }
          />
        ) : (
          <Empty
            description="暂无计划项目"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Space>
              <Button onClick={handleSync} icon={<SyncOutlined />}>
                同步数据
              </Button>
              <Button type="primary" onClick={() => setAddModalVisible(true)} icon={<PlusOutlined />}>
                手动添加
              </Button>
            </Space>
          </Empty>
        )}
      </Card>

      {/* 添加计划项目 Modal */}
      <Modal
        title="添加计划项目"
        open={addModalVisible}
        onCancel={() => setAddModalVisible(false)}
        footer={null}
        width={500}
      >
        <Form form={form} layout="vertical" onFinish={handleAddItem}>
          <Form.Item
            name="title"
            label="项目标题"
            rules={[{ required: true, message: '请输入标题' }]}
          >
            <Input placeholder="本月要完成的事项" />
          </Form.Item>

          <Form.Item name="description" label="描述">
            <TextArea rows={3} placeholder="详细描述" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="project" label="所属项目" initialValue="other">
                <Select>
                  {Object.entries(projectLabels).map(([key, cfg]) => (
                    <Option key={key} value={key}>
                      <Space>{cfg.icon}{cfg.label}</Space>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="priority" label="优先级" initialValue="medium">
                <Select>
                  {Object.entries(priorityLabels).map(([key, { label }]) => (
                    <Option key={key} value={key}>{label}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">添加</Button>
              <Button onClick={() => setAddModalVisible(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 项目详情 Modal */}
      <Modal
        title={
          <Space>
            <FileTextOutlined />
            {selectedItem?.title}
            {selectedItem?.migration?.version > 1 && (
              <Tag color="purple">v{selectedItem.migration.version}.0</Tag>
            )}
          </Space>
        }
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false);
          setSelectedItem(null);
        }}
        footer={
          <Space>
            {selectedItem?.planStatus !== 'completed' && selectedItem?.planStatus !== 'migrated' && (
              <Button
                icon={<ArrowRightOutlined />}
                onClick={() => {
                  setDetailModalVisible(false);
                  openMigrateModal(selectedItem);
                }}
              >
                迁移到 {getNextMonth()}
              </Button>
            )}
            <Dropdown
              menu={{
                items: [
                  { key: 'auto', label: '自动复盘', icon: <RobotOutlined /> },
                  { key: 'select', label: '选择会议复盘', icon: <SearchOutlined /> }
                ],
                onClick: ({ key }) => {
                  if (key === 'auto' && selectedItem) {
                    handleReviewItem(selectedItem._id);
                  }
                  if (key === 'select' && selectedItem) {
                    openMeetingSelectModal(selectedItem);
                  }
                }
              }}
              trigger={['click']}
            >
              <Button
                icon={<RobotOutlined />}
                loading={reviewingItem === selectedItem?._id}
              >
                重新复盘 <DownOutlined />
              </Button>
            </Dropdown>
            <Button onClick={() => setDetailModalVisible(false)}>关闭</Button>
          </Space>
        }
        width={800}
      >
        {selectedItem && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <Space wrap>
                {selectedItem.sourceType === 'migrated' && (
                  <Tag color="purple" icon={<HistoryOutlined />}>
                    从 {selectedItem.migration?.fromMonth} 迁移
                  </Tag>
                )}
                {selectedItem.sourceType === 'task' && <Tag color="blue">组织事务</Tag>}
                {selectedItem.sourceType === 'topic' && <Tag color="green">推荐议题</Tag>}
                <Tag color={projectLabels[selectedItem.project]?.color}>
                  {projectLabels[selectedItem.project]?.icon}
                  {' '}{projectLabels[selectedItem.project]?.label || '其他'}
                </Tag>
                <Tag color={priorityLabels[selectedItem.priority]?.color}>
                  优先级：{priorityLabels[selectedItem.priority]?.label}
                </Tag>
                <Tag color={planStatusConfig[selectedItem.planStatus]?.color}>
                  {planStatusConfig[selectedItem.planStatus]?.icon}
                  {' '}{planStatusConfig[selectedItem.planStatus]?.label}
                </Tag>
              </Space>
            </div>

            {selectedItem.description && (
              <Card size="small" title="描述" style={{ marginBottom: 16 }}>
                <p>{selectedItem.description}</p>
              </Card>
            )}

            {/* 组织事务的 AI 分析建议 */}
            {selectedItem.sourceType === 'task' && selectedItem.taskDetail?.analysis && (
              <Card
                size="small"
                title={
                  <Space>
                    <ThunderboltOutlined style={{ color: '#722ed1' }} />
                    组织事务 AI 分析建议
                  </Space>
                }
                style={{ marginBottom: 16 }}
              >
                <div style={{ background: '#f6f8fa', padding: 12, borderRadius: 6, marginBottom: 12 }}>
                  <Text strong style={{ fontSize: 15, color: '#1890ff' }}>
                    💡 {selectedItem.taskDetail.analysis.recommendation.summary}
                  </Text>
                </div>

                <div style={{ marginBottom: 8 }}>
                  <Text strong>What - 做什么：</Text>
                  <div style={{ marginTop: 4, paddingLeft: 12 }}>
                    <Text>{selectedItem.taskDetail.analysis.recommendation.whatToDo}</Text>
                  </div>
                </div>

                <div style={{ marginBottom: 8 }}>
                  <Text strong>Why - 为什么做：</Text>
                  <div style={{ marginTop: 4, paddingLeft: 12 }}>
                    <Text>{selectedItem.taskDetail.analysis.recommendation.whyToDo}</Text>
                  </div>
                </div>

                <div style={{ marginBottom: 8 }}>
                  <Text strong>Where - 核心抓手：</Text>
                  <div style={{ marginTop: 4, paddingLeft: 12 }}>
                    <Text>{selectedItem.taskDetail.analysis.recommendation.whereToFocus}</Text>
                  </div>
                </div>

                <div>
                  <Text strong>How Much - 代价与回报：</Text>
                  <div style={{ marginTop: 4, paddingLeft: 12 }}>
                    <Text>{selectedItem.taskDetail.analysis.recommendation.costAndReturn}</Text>
                  </div>
                </div>

                <div style={{ marginTop: 12, padding: 8, background: '#fff7e6', borderRadius: 4, borderLeft: '3px solid #faad14' }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    💼 推荐角色：{selectedItem.taskDetail.djRoleLabel || '未分类'}
                    {selectedItem.taskDetail.djRoleReason && ` · ${selectedItem.taskDetail.djRoleReason}`}
                  </Text>
                </div>
              </Card>
            )}

            <Divider>AI 复盘报告</Divider>
            {renderItemReviewDetail(selectedItem)}
          </div>
        )}
      </Modal>

      {/* 迁移 Modal */}
      <Modal
        title={
          <Space>
            <SwapOutlined />
            迁移到 {getNextMonth()}
          </Space>
        }
        open={migrateModalVisible}
        onCancel={() => {
          setMigrateModalVisible(false);
          migrateForm.resetFields();
        }}
        footer={null}
        width={500}
      >
        <Form form={migrateForm} layout="vertical" onFinish={handleMigrateItem}>
          <Alert
            message={`将 "${selectedItem?.title}" 迁移到 ${getNextMonth()} 月度计划`}
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Form.Item name="upgradeToV2" valuePropName="checked">
            <Checkbox>
              <Space>
                <UpCircleOutlined style={{ color: '#722ed1' }} />
                升级为新版本（当前 v{selectedItem?.migration?.version || 1}.0 → v{(selectedItem?.migration?.version || 1) + 1}.0）
              </Space>
            </Checkbox>
          </Form.Item>

          <Form.Item name="newTitle" label="标题（可修改）">
            <Input />
          </Form.Item>

          <Form.Item name="newDescription" label="描述（可补充）">
            <TextArea rows={3} />
          </Form.Item>

          <Form.Item name="evolutionNotes" label="演进说明">
            <TextArea
              rows={2}
              placeholder="说明为什么要迁移，下月重点关注什么"
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" icon={<ArrowRightOutlined />}>
                确认迁移
              </Button>
              <Button onClick={() => setMigrateModalVisible(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 批量迁移 Modal */}
      <Modal
        title={
          <Space>
            <SwapOutlined />
            批量迁移到 {getNextMonth()}
          </Space>
        }
        open={batchMigrateModalVisible}
        onCancel={() => setBatchMigrateModalVisible(false)}
        onOk={() => {
          handleBatchMigrate({ upgradeToV2: false });
        }}
        okText="确认迁移"
      >
        <Alert
          message={`将选中的 ${selectedItems.length} 个项目迁移到 ${getNextMonth()} 月度计划`}
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Form layout="vertical">
          <Form.Item>
            <Radio.Group defaultValue={false} onChange={() => {
              // 可以在这里处理升级选项
            }}>
              <Space direction="vertical">
                <Radio value={false}>直接迁移（保持当前版本）</Radio>
                <Radio value={true}>升级迁移（版本号 +1）</Radio>
              </Space>
            </Radio.Group>
          </Form.Item>
        </Form>

        <div style={{ marginTop: 16 }}>
          <strong>将迁移以下项目：</strong>
          <ul style={{ marginTop: 8 }}>
            {selectedItems.map(id => {
              const item = plan?.items?.find((i: any) => i._id === id);
              return item ? <li key={id}>{item.title}</li> : null;
            })}
          </ul>
        </div>
      </Modal>

      {/* 会议选择复盘 Modal */}
      <Modal
        title={
          <Space>
            <SearchOutlined />
            选择会议进行复盘
          </Space>
        }
        open={meetingSelectModalVisible}
        onCancel={() => {
          setMeetingSelectModalVisible(false);
          setReviewTargetItem(null);
          setRelatedMeetings([]);
          setSelectedMeetingIds([]);
        }}
        footer={[
          <Button key="cancel" onClick={() => setMeetingSelectModalVisible(false)}>
            取消
          </Button>,
          <Button
            key="auto"
            icon={<RobotOutlined />}
            onClick={() => {
              setMeetingSelectModalVisible(false);
              if (reviewTargetItem) {
                handleReviewItem(reviewTargetItem._id);
              }
            }}
          >
            自动复盘
          </Button>,
          <Button
            key="submit"
            type="primary"
            icon={<RobotOutlined />}
            loading={reviewingWithSelection}
            disabled={selectedMeetingIds.length === 0}
            onClick={handleReviewWithSelection}
          >
            使用选中会议复盘 ({selectedMeetingIds.length})
          </Button>
        ]}
        width={700}
      >
        {reviewTargetItem && (
          <Alert
            message={`复盘项目: ${reviewTargetItem.title}`}
            description={reviewTargetItem.description}
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        <div style={{ marginBottom: 12 }}>
          <strong>请选择与此项目相关的会议：</strong>
          <span style={{ color: '#666', marginLeft: 8 }}>
            系统已根据关键词匹配度为您排序，匹配度越高越相关
          </span>
        </div>

        {loadingMeetings ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin tip="正在检索相关会议..." />
          </div>
        ) : relatedMeetings.length > 0 ? (
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            <Checkbox.Group
              value={selectedMeetingIds}
              onChange={(values) => setSelectedMeetingIds(values as string[])}
              style={{ width: '100%' }}
            >
              <List
                dataSource={relatedMeetings}
                renderItem={(meeting: any) => (
                  <List.Item
                    style={{
                      padding: '12px',
                      background: selectedMeetingIds.includes(meeting._id) ? '#e6f7ff' : '#fafafa',
                      marginBottom: 8,
                      borderRadius: 4,
                      border: selectedMeetingIds.includes(meeting._id) ? '1px solid #1890ff' : '1px solid #f0f0f0'
                    }}
                  >
                    <div style={{ width: '100%' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <Checkbox value={meeting._id} />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 500 }}>
                              <CalendarOutlined style={{ marginRight: 8 }} />
                              {meeting.title}
                            </span>
                            <Space>
                              <Tag color={meeting.score >= 3 ? 'success' : meeting.score >= 2 ? 'warning' : 'default'}>
                                匹配度: {meeting.score}
                              </Tag>
                              <span style={{ color: '#999', fontSize: 12 }}>
                                {new Date(meeting.meetingDate).toLocaleDateString('zh-CN')}
                              </span>
                            </Space>
                          </div>
                          {meeting.matchedKeywords?.length > 0 && (
                            <div style={{ marginTop: 8 }}>
                              <span style={{ color: '#666', fontSize: 12 }}>匹配关键词: </span>
                              {meeting.matchedKeywords.map((kw: any, i: number) => (
                                <Tag key={i} color="blue" style={{ fontSize: 11 }}>
                                  {typeof kw === 'string' ? kw : kw.keyword}
                                </Tag>
                              ))}
                            </div>
                          )}
                          {meeting.thoughtCount > 0 && (
                            <div style={{ marginTop: 4, color: '#666', fontSize: 12 }}>
                              <BulbOutlined style={{ marginRight: 4 }} />
                              包含 {meeting.thoughtCount} 条灵感记录
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </List.Item>
                )}
              />
            </Checkbox.Group>
          </div>
        ) : (
          <Empty
            description="未找到相关会议"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <p style={{ color: '#666' }}>
              可以尝试使用「自动复盘」功能，AI 会自动分析所有会议
            </p>
          </Empty>
        )}
      </Modal>

      <style>{`
        .monthly-plan-page {
          padding: 0;
        }
        .migrated-row {
          opacity: 0.6;
          background: #f9f9f9;
        }
      `}</style>
    </div>
  );
};

export default MonthlyPlanPage;
