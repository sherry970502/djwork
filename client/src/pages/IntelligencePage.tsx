import { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Input,
  Select,
  Space,
  Typography,
  message,
  Tag,
  Modal,
  Form,
  Statistic,
  Row,
  Col,
  Empty,
  Spin,
  Tooltip,
  Badge
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  StarOutlined,
  StarFilled,
  FireOutlined,
  ClockCircleOutlined,
  ThunderboltOutlined,
  BulbOutlined,
  LinkOutlined,
  SearchOutlined
} from '@ant-design/icons';
import {
  getIntelligenceKeywords,
  createIntelligenceKeyword,
  updateIntelligenceKeyword,
  deleteIntelligenceKeyword,
  getIntelligenceReports,
  toggleIntelligenceBookmark,
  fetchIntelligenceForKeyword,
  fetchAllIntelligence,
  analyzeIntelligenceReport,
  getIntelligenceStats,
  type IntelligenceKeyword,
  type IntelligenceReport
} from '../services/api';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

export default function IntelligencePage() {
  const [keywords, setKeywords] = useState<IntelligenceKeyword[]>([]);
  const [reports, setReports] = useState<IntelligenceReport[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [selectedKeyword, setSelectedKeyword] = useState<string>('');
  const [sortBy, setSortBy] = useState<'hot' | 'latest' | 'relevant'>('hot');
  const [showBookmarked, setShowBookmarked] = useState(false);
  const [keywordModalVisible, setKeywordModalVisible] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');

  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadReports();
  }, [selectedKeyword, sortBy, showBookmarked, searchText]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [keywordsRes, statsRes] = await Promise.all([
        getIntelligenceKeywords(),
        getIntelligenceStats()
      ]);
      setKeywords(keywordsRes.data);
      setStats(statsRes.data);
    } catch (error: any) {
      message.error('加载数据失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const loadReports = async () => {
    try {
      setReportsLoading(true);
      const params: any = {
        sortBy,
        limit: 50
      };
      if (selectedKeyword) params.keyword = selectedKeyword;
      if (showBookmarked) params.isBookmarked = true;
      if (searchText) params.search = searchText;

      const response = await getIntelligenceReports(params);
      setReports(response.data);
    } catch (error: any) {
      message.error('加载情报失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setReportsLoading(false);
    }
  };

  const handleCreateKeyword = async (values: any) => {
    try {
      await createIntelligenceKeyword(values);
      message.success('关键词创建成功');
      setKeywordModalVisible(false);
      form.resetFields();
      loadData();
    } catch (error: any) {
      message.error('创建失败: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleToggleKeyword = async (id: string, isActive: boolean) => {
    try {
      await updateIntelligenceKeyword(id, { isActive: !isActive });
      message.success(isActive ? '已停用' : '已激活');
      loadData();
    } catch (error: any) {
      message.error('操作失败: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleDeleteKeyword = async (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除关键词将同时删除所有相关情报，确定继续？',
      okText: '确定',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteIntelligenceKeyword(id);
          message.success('删除成功');
          loadData();
          loadReports();
        } catch (error: any) {
          message.error('删除失败: ' + (error.response?.data?.message || error.message));
        }
      }
    });
  };

  const handleFetchAll = async () => {
    try {
      setFetching(true);
      await fetchAllIntelligence({ timeRange: 'd', limit: 10 });
      message.success('已开始获取最新情报，请稍后刷新查看');
      setTimeout(() => {
        loadData();
        loadReports();
      }, 10000);
    } catch (error: any) {
      message.error('获取失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setFetching(false);
    }
  };

  const handleFetchKeyword = async (keywordId: string) => {
    try {
      setFetching(true);
      await fetchIntelligenceForKeyword(keywordId, { timeRange: 'd', limit: 10 });
      message.success('已开始获取该关键词的最新情报');
      setTimeout(() => {
        loadData();
        loadReports();
      }, 5000);
    } catch (error: any) {
      message.error('获取失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setFetching(false);
    }
  };

  const handleToggleBookmark = async (reportId: string) => {
    try {
      await toggleIntelligenceBookmark(reportId);
      loadReports();
    } catch (error: any) {
      message.error('操作失败: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleAnalyze = async (reportId: string) => {
    try {
      setAnalyzing(reportId);
      await analyzeIntelligenceReport(reportId);
      message.success('AI 分析完成');
      loadReports();
    } catch (error: any) {
      message.error('分析失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setAnalyzing(null);
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: any = {
      '技术': 'blue',
      '市场': 'green',
      '竞品': 'orange',
      '行业': 'purple',
      '政策': 'red',
      '其他': 'default'
    };
    return colors[category] || 'default';
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <Title level={2}>🎯 AI 情报</Title>
        <Paragraph type="secondary">
          追踪关键词，AI 每日自动搜集最新行业情报，分析对业务的价值和启发
        </Paragraph>
      </div>

      {/* 统计信息 */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="追踪关键词"
              value={stats.activeKeywords || 0}
              suffix={`/ ${stats.totalKeywords || 0}`}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="今日新情报"
              value={stats.todayReports || 0}
              prefix={<FireOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总情报数"
              value={stats.totalReports || 0}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已关注"
              value={stats.bookmarkedReports || 0}
              prefix={<StarFilled style={{ color: '#faad14' }} />}
            />
          </Card>
        </Col>
      </Row>

      {/* 关键词管理 */}
      <Card
        title="🔍 关键词管理"
        extra={
          <Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setKeywordModalVisible(true)}
            >
              添加关键词
            </Button>
            <Button
              icon={fetching ? <Spin size="small" /> : <ReloadOutlined />}
              onClick={handleFetchAll}
              disabled={fetching}
              loading={fetching}
            >
              {fetching ? '获取中...' : '获取全部最新情报'}
            </Button>
          </Space>
        }
        style={{ marginBottom: '24px' }}
      >
        {loading ? (
          <Spin />
        ) : keywords.length === 0 ? (
          <Empty description="还没有添加关键词，点击右上角添加" />
        ) : (
          <Space wrap size="middle">
            {keywords.map(keyword => (
              <Tag
                key={keyword._id}
                color={keyword.isActive ? getCategoryColor(keyword.category) : 'default'}
                style={{
                  padding: '8px 12px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  border: selectedKeyword === keyword._id ? '2px solid #1890ff' : undefined
                }}
                closable
                onClose={(e) => {
                  e.preventDefault();
                  handleDeleteKeyword(keyword._id);
                }}
              >
                <Space size="small">
                  <span onClick={() => setSelectedKeyword(selectedKeyword === keyword._id ? '' : keyword._id)}>
                    {keyword.keyword}
                  </span>
                  <Badge count={keyword.reportCount} showZero={false} />
                  {keyword.isActive ? (
                    <Tooltip title="点击停用">
                      <ThunderboltOutlined
                        style={{ color: '#52c41a' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleKeyword(keyword._id, keyword.isActive);
                        }}
                      />
                    </Tooltip>
                  ) : (
                    <Tooltip title="点击激活">
                      <ThunderboltOutlined
                        style={{ color: '#999' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleKeyword(keyword._id, keyword.isActive);
                        }}
                      />
                    </Tooltip>
                  )}
                  <Tooltip title="立即获取最新情报">
                    <ReloadOutlined
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFetchKeyword(keyword._id);
                      }}
                    />
                  </Tooltip>
                </Space>
              </Tag>
            ))}
          </Space>
        )}
      </Card>

      {/* 情报列表 */}
      <Card
        title={
          <Space>
            <span>📰 情报列表</span>
            {selectedKeyword && (
              <Tag color="blue">
                {keywords.find(k => k._id === selectedKeyword)?.keyword}
              </Tag>
            )}
          </Space>
        }
        extra={
          <Space>
            <Input
              placeholder="搜索情报..."
              prefix={<SearchOutlined />}
              style={{ width: 200 }}
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              allowClear
            />
            <Select
              value={sortBy}
              onChange={setSortBy}
              style={{ width: 120 }}
            >
              <Select.Option value="hot">🔥 最热</Select.Option>
              <Select.Option value="latest">⏰ 最新</Select.Option>
              <Select.Option value="relevant">🎯 最相关</Select.Option>
            </Select>
            <Button
              type={showBookmarked ? 'primary' : 'default'}
              icon={<StarFilled />}
              onClick={() => setShowBookmarked(!showBookmarked)}
            >
              {showBookmarked ? '显示全部' : '仅关注'}
            </Button>
          </Space>
        }
      >
        {reportsLoading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Spin size="large" />
          </div>
        ) : reports.length === 0 ? (
          <Empty
            description={
              selectedKeyword
                ? '该关键词还没有情报，点击关键词旁的刷新按钮获取'
                : '还没有任何情报，请先添加关键词并获取情报'
            }
          />
        ) : (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            {reports.map(report => {
              const keyword = typeof report.keyword === 'object' ? report.keyword : null;
              return (
                <Card
                  key={report._id}
                  size="small"
                  hoverable
                  actions={[
                    <Button
                      type="text"
                      icon={report.isBookmarked ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />}
                      onClick={() => handleToggleBookmark(report._id)}
                    >
                      {report.isBookmarked ? '已关注' : '关注'}
                    </Button>,
                    <Button
                      type="text"
                      icon={<LinkOutlined />}
                      onClick={() => window.open(report.sourceUrl, '_blank')}
                    >
                      查看原文
                    </Button>,
                    report.aiAnalysis?.analyzedAt ? (
                      <Tooltip title="已分析">
                        <Button type="text" icon={<BulbOutlined />} style={{ color: '#52c41a' }}>
                          已分析
                        </Button>
                      </Tooltip>
                    ) : (
                      <Button
                        type="text"
                        icon={<BulbOutlined />}
                        loading={analyzing === report._id}
                        onClick={() => handleAnalyze(report._id)}
                      >
                        AI 分析
                      </Button>
                    )
                  ]}
                >
                  <div style={{ marginBottom: '12px' }}>
                    <Space>
                      <Tag color={getCategoryColor(keyword?.category || '其他')}>
                        {keyword?.keyword || '未知关键词'}
                      </Tag>
                      <Tag icon={<FireOutlined />} color="red">
                        热度 {report.hotScore}
                      </Tag>
                      <Tag icon={<ClockCircleOutlined />}>
                        {report.publishedAt
                          ? new Date(report.publishedAt).toLocaleDateString('zh-CN')
                          : new Date(report.fetchedAt).toLocaleDateString('zh-CN')}
                      </Tag>
                      <Text type="secondary">{report.sourceName}</Text>
                    </Space>
                  </div>

                  <Title level={5} style={{ marginBottom: '8px' }}>
                    {report.title}
                  </Title>

                  <Paragraph
                    type="secondary"
                    ellipsis={{ rows: 2 }}
                    style={{ marginBottom: '12px' }}
                  >
                    {report.summary || report.content}
                  </Paragraph>

                  {report.aiAnalysis?.analyzedAt && (
                    <div
                      style={{
                        background: '#f6ffed',
                        border: '1px solid #b7eb8f',
                        borderRadius: '4px',
                        padding: '12px',
                        marginTop: '12px'
                      }}
                    >
                      <div style={{ marginBottom: '8px' }}>
                        <Text strong>💡 AI 分析</Text>
                      </div>

                      {report.aiAnalysis.businessValue && (
                        <div style={{ marginBottom: '8px' }}>
                          <Text strong>业务价值：</Text>
                          <Text>{report.aiAnalysis.businessValue}</Text>
                        </div>
                      )}

                      {report.aiAnalysis.insights && report.aiAnalysis.insights.length > 0 && (
                        <div style={{ marginBottom: '8px' }}>
                          <Text strong>关键洞察：</Text>
                          <ul style={{ margin: '4px 0', paddingLeft: '20px' }}>
                            {report.aiAnalysis.insights.map((insight, idx) => (
                              <li key={idx}><Text>{insight}</Text></li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {report.aiAnalysis.actionItems && report.aiAnalysis.actionItems.length > 0 && (
                        <div style={{ marginBottom: '8px' }}>
                          <Text strong>建议行动：</Text>
                          <ul style={{ margin: '4px 0', paddingLeft: '20px' }}>
                            {report.aiAnalysis.actionItems.map((item, idx) => (
                              <li key={idx}><Text>{item}</Text></li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {report.aiAnalysis.potentialIssues && report.aiAnalysis.potentialIssues.length > 0 && (
                        <div>
                          <Text strong>潜在议题：</Text>
                          <ul style={{ margin: '4px 0', paddingLeft: '20px' }}>
                            {report.aiAnalysis.potentialIssues.map((issue, idx) => (
                              <li key={idx}><Text type="warning">{issue}</Text></li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </Space>
        )}
      </Card>

      {/* 添加关键词弹窗 */}
      <Modal
        title="添加追踪关键词"
        open={keywordModalVisible}
        onCancel={() => {
          setKeywordModalVisible(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        okText="添加"
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateKeyword}
        >
          <Form.Item
            name="keyword"
            label="关键词"
            rules={[{ required: true, message: '请输入关键词' }]}
          >
            <Input placeholder="例如：AI教育、GPT-4、元宇宙" />
          </Form.Item>

          <Form.Item
            name="description"
            label="追踪原因"
          >
            <TextArea
              rows={3}
              placeholder="为什么要追踪这个关键词？（可选）"
            />
          </Form.Item>

          <Form.Item
            name="category"
            label="分类"
            initialValue="其他"
          >
            <Select>
              <Select.Option value="技术">技术</Select.Option>
              <Select.Option value="市场">市场</Select.Option>
              <Select.Option value="竞品">竞品</Select.Option>
              <Select.Option value="行业">行业</Select.Option>
              <Select.Option value="政策">政策</Select.Option>
              <Select.Option value="其他">其他</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="priority"
            label="优先级"
            initialValue="medium"
          >
            <Select>
              <Select.Option value="high">高</Select.Option>
              <Select.Option value="medium">中</Select.Option>
              <Select.Option value="low">低</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="searchQuery"
            label="搜索词优化"
            tooltip="如果需要更精确的搜索，可以自定义搜索词"
          >
            <Input placeholder="留空则使用关键词本身" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
