import React, { useState, useEffect } from 'react';
import {
  Card,
  Tree,
  Button,
  Modal,
  Form,
  Input,
  Select,
  message,
  Space,
  Tag,
  Spin,
  Empty,
  Popconfirm,
  Progress,
  Divider
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  FolderOutlined,
  FolderOpenOutlined,
  RocketOutlined,
  SyncOutlined
} from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';
import {
  getProjectTree,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  syncProjectFromDesign,
  getDesigns,
  getAllProjects
} from '../services/api';

const { TextArea } = Input;
const { Option } = Select;

interface Project {
  _id: string;
  name: string;
  purpose?: string;
  description?: string;
  parentId?: string;
  level: number;
  status: string;
  progress: number;
  priority: string;
  coverImage?: string;
  content?: string;
  images?: string[];
  links?: Array<{ url: string; title: string }>;
  relatedThoughts?: any[];
  relatedDesigns?: any[];
  syncedFromDesign?: any;
  order: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  children?: Project[];
}

type StatusType = 'conception' | 'planning' | 'active' | 'paused' | 'completed' | 'archived';
type PriorityType = 'high' | 'medium' | 'low';

const statusConfig: Record<StatusType, { label: string; color: string }> = {
  conception: { label: '构思阶段', color: 'blue' },
  planning: { label: '规划阶段', color: 'cyan' },
  active: { label: '正式执行', color: 'green' },
  paused: { label: '暂缓考虑', color: 'orange' },
  completed: { label: '已完成', color: 'purple' },
  archived: { label: '已归档', color: 'default' }
};

const priorityConfig: Record<PriorityType, { label: string; color: string }> = {
  high: { label: '高', color: 'red' },
  medium: { label: '中', color: 'orange' },
  low: { label: '低', color: 'green' }
};

const ProjectsPage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [parentProject, setParentProject] = useState<string | null>(null);
  const [availableDesigns, setAvailableDesigns] = useState<any[]>([]);
  const [syncedDesignIds, setSyncedDesignIds] = useState<Set<string>>(new Set());
  const [selectedDesignId, setSelectedDesignId] = useState<string>('');
  const [syncParentId, setSyncParentId] = useState<string | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const response = await getProjectTree();
      setProjects(response.data || []);
    } catch (error: any) {
      message.error('加载项目失败: ' + (error.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  // 转换为 Tree 组件的数据格式
  const convertToTreeData = (projects: Project[]): DataNode[] => {
    return projects.map(project => ({
      key: project._id,
      title: (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>{project.name}</span>
          <Tag color={statusConfig[project.status as StatusType]?.color}>
            {statusConfig[project.status as StatusType]?.label}
          </Tag>
          {project.progress > 0 && (
            <span style={{ fontSize: 12, color: '#999' }}>{project.progress}%</span>
          )}
        </div>
      ),
      icon: project.children && project.children.length > 0 ? <FolderOpenOutlined /> : <FolderOutlined />,
      children: project.children ? convertToTreeData(project.children) : undefined,
      project
    }));
  };

  const handleAddProject = (parentId?: string) => {
    setEditingProject(null);
    setParentProject(parentId || null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEditProject = async (projectId: string) => {
    try {
      const response = await getProject(projectId);
      setEditingProject(response.data);
      form.setFieldsValue(response.data);
      setModalOpen(true);
    } catch (error: any) {
      message.error('加载项目详情失败');
    }
  };

  const handleViewDetails = async (projectId: string) => {
    try {
      const response = await getProject(projectId);
      setSelectedProject(response.data);
      setDetailModalOpen(true);
    } catch (error: any) {
      message.error('加载项目详情失败');
    }
  };

  const handleSaveProject = async () => {
    try {
      const values = await form.validateFields();

      if (editingProject) {
        await updateProject(editingProject._id, values);
        message.success('项目更新成功');
      } else {
        await createProject({
          ...values,
          parentId: parentProject
        });
        message.success('项目创建成功');
      }

      setModalOpen(false);
      loadProjects();
    } catch (error: any) {
      message.error('保存失败: ' + (error.message || '未知错误'));
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      await deleteProject(projectId);
      message.success('项目删除成功');
      loadProjects();
    } catch (error: any) {
      message.error('删除失败: ' + (error.message || '未知错误'));
    }
  };

  // 打开同步 Modal
  const handleOpenSyncModal = async () => {
    try {
      setLoading(true);

      // 获取所有个人设计
      const designsResponse = await getDesigns({});
      const allDesigns = designsResponse.data || [];

      // 获取所有项目（扁平列表，用于查找已同步的设计）
      const projectsResponse = await getAllProjects();
      const allProjects = projectsResponse.data || [];

      // 找出已经同步过的设计ID
      const syncedIds = new Set(
        allProjects
          .filter((p: any) => p.syncedFromDesign)
          .map((p: any) => p.syncedFromDesign._id || p.syncedFromDesign)
      );

      setSyncedDesignIds(syncedIds);
      setAvailableDesigns(allDesigns);
      setSyncModalOpen(true);
    } catch (error: any) {
      message.error('加载设计列表失败: ' + (error.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  // 执行同步
  const handleSyncFromDesign = async () => {
    if (!selectedDesignId) {
      message.warning('请选择要同步的设计');
      return;
    }

    try {
      await syncProjectFromDesign({
        designId: selectedDesignId,
        parentId: syncParentId || undefined
      });
      message.success('同步成功');
      setSyncModalOpen(false);
      setSelectedDesignId('');
      setSyncParentId(null);
      loadProjects();
    } catch (error: any) {
      message.error('同步失败: ' + (error.message || '未知错误'));
    }
  };

  // 获取项目选项（用于选择父项目）
  const getProjectOptions = (projectList: Project[], level = 0): any[] => {
    const options: any[] = [];
    projectList.forEach(project => {
      options.push({
        label: '　'.repeat(level) + project.name,
        value: project._id
      });
      if (project.children && project.children.length > 0) {
        options.push(...getProjectOptions(project.children, level + 1));
      }
    });
    return options;
  };

  const renderProjectActions = (project: Project) => (
    <Space size="small">
      <Button
        type="link"
        size="small"
        icon={<PlusOutlined />}
        onClick={() => handleAddProject(project._id)}
      >
        添加子项目
      </Button>
      <Button
        type="link"
        size="small"
        icon={<EditOutlined />}
        onClick={() => handleEditProject(project._id)}
      >
        编辑
      </Button>
      <Button
        type="link"
        size="small"
        onClick={() => handleViewDetails(project._id)}
      >
        详情
      </Button>
      <Popconfirm
        title="确定删除此项目吗？"
        description="将同时删除所有子项目"
        onConfirm={() => handleDeleteProject(project._id)}
        okText="确定"
        cancelText="取消"
      >
        <Button
          type="link"
          size="small"
          danger
          icon={<DeleteOutlined />}
        >
          删除
        </Button>
      </Popconfirm>
    </Space>
  );

  const treeData = convertToTreeData(projects);

  return (
    <div style={{ padding: 24 }}>
      <Card
        title="个人项目管理"
        extra={
          <Space>
            <Button
              icon={<RocketOutlined />}
              onClick={() => message.info('AI 建议功能开发中')}
            >
              AI 建议项目
            </Button>
            <Button
              icon={<SyncOutlined />}
              onClick={handleOpenSyncModal}
            >
              从设计同步
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => handleAddProject()}
            >
              新建根项目
            </Button>
          </Space>
        }
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <Spin size="large" tip="加载项目..." />
          </div>
        ) : treeData.length === 0 ? (
          <Empty
            description="还没有项目，开始创建第一个吧"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Button type="primary" onClick={() => handleAddProject()}>
              创建项目
            </Button>
          </Empty>
        ) : (
          <Tree
            showLine
            showIcon
            defaultExpandAll
            treeData={treeData}
            titleRender={(node: any) => {
              const project = node.project;
              return (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 500 }}>{project.name}</span>
                    <Tag color={statusConfig[project.status as StatusType]?.color}>
                      {statusConfig[project.status as StatusType]?.label}
                    </Tag>
                    <Tag color={priorityConfig[project.priority as PriorityType]?.color}>
                      {priorityConfig[project.priority as PriorityType]?.label}
                    </Tag>
                    {project.progress > 0 && (
                      <Progress
                        percent={project.progress}
                        size="small"
                        style={{ width: 80 }}
                      />
                    )}
                    {project.purpose && (
                      <span style={{ fontSize: 12, color: '#999' }}>
                        {project.purpose.substring(0, 30)}...
                      </span>
                    )}
                  </div>
                  <div>{renderProjectActions(project)}</div>
                </div>
              );
            }}
          />
        )}
      </Card>

      {/* 创建/编辑项目 Modal */}
      <Modal
        title={editingProject ? '编辑项目' : '创建项目'}
        open={modalOpen}
        onOk={handleSaveProject}
        onCancel={() => setModalOpen(false)}
        width={600}
        okText="保存"
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Form.Item
            label="项目名称"
            name="name"
            rules={[{ required: true, message: '请输入项目名称' }]}
          >
            <Input placeholder="输入项目名称" />
          </Form.Item>

          <Form.Item
            label="项目目的"
            name="purpose"
          >
            <TextArea
              rows={2}
              placeholder="简要说明项目的目的和意义"
            />
          </Form.Item>

          <Form.Item
            label="项目描述"
            name="description"
          >
            <TextArea
              rows={4}
              placeholder="详细描述项目内容"
            />
          </Form.Item>

          <Space style={{ width: '100%' }} size="large">
            <Form.Item
              label="项目状态"
              name="status"
              style={{ flex: 1 }}
            >
              <Select placeholder="选择状态">
                {Object.entries(statusConfig).map(([key, config]) => (
                  <Option key={key} value={key}>
                    <Tag color={config.color}>{config.label}</Tag>
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              label="优先级"
              name="priority"
              style={{ flex: 1 }}
            >
              <Select placeholder="选择优先级">
                {Object.entries(priorityConfig).map(([key, config]) => (
                  <Option key={key} value={key}>
                    <Tag color={config.color}>{config.label}</Tag>
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              label="进度 (%)"
              name="progress"
              style={{ flex: 1 }}
            >
              <Input type="number" min={0} max={100} placeholder="0-100" />
            </Form.Item>
          </Space>

          <Form.Item
            label="备注"
            name="notes"
          >
            <TextArea
              rows={2}
              placeholder="其他备注信息"
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 项目详情 Modal */}
      <Modal
        title="项目详情"
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalOpen(false)}>
            关闭
          </Button>,
          <Button
            key="edit"
            type="primary"
            onClick={() => {
              setDetailModalOpen(false);
              if (selectedProject) {
                handleEditProject(selectedProject._id);
              }
            }}
          >
            编辑
          </Button>
        ]}
        width={800}
      >
        {selectedProject && (
          <div>
            <h3>{selectedProject.name}</h3>
            <Divider />

            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div>
                <strong>状态：</strong>
                <Tag color={statusConfig[selectedProject.status as StatusType]?.color}>
                  {statusConfig[selectedProject.status as StatusType]?.label}
                </Tag>
                <strong style={{ marginLeft: 16 }}>优先级：</strong>
                <Tag color={priorityConfig[selectedProject.priority as PriorityType]?.color}>
                  {priorityConfig[selectedProject.priority as PriorityType]?.label}
                </Tag>
                {selectedProject.progress > 0 && (
                  <>
                    <strong style={{ marginLeft: 16 }}>进度：</strong>
                    <Progress
                      percent={selectedProject.progress}
                      style={{ width: 200, display: 'inline-block' }}
                    />
                  </>
                )}
              </div>

              {selectedProject.purpose && (
                <div>
                  <strong>项目目的：</strong>
                  <p>{selectedProject.purpose}</p>
                </div>
              )}

              {selectedProject.description && (
                <div>
                  <strong>项目描述：</strong>
                  <p style={{ whiteSpace: 'pre-wrap' }}>{selectedProject.description}</p>
                </div>
              )}

              {selectedProject.notes && (
                <div>
                  <strong>备注：</strong>
                  <p>{selectedProject.notes}</p>
                </div>
              )}

              {selectedProject.children && selectedProject.children.length > 0 && (
                <div>
                  <strong>子项目（{selectedProject.children.length}个）：</strong>
                  <ul>
                    {selectedProject.children.map((child: any) => (
                      <li key={child._id}>
                        {child.name}
                        <Tag color={statusConfig[child.status as StatusType]?.color} style={{ marginLeft: 8 }}>
                          {statusConfig[child.status as StatusType]?.label}
                        </Tag>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div style={{ fontSize: 12, color: '#999' }}>
                <div>创建时间：{new Date(selectedProject.createdAt).toLocaleString()}</div>
                <div>更新时间：{new Date(selectedProject.updatedAt).toLocaleString()}</div>
              </div>
            </Space>
          </div>
        )}
      </Modal>

      {/* 从设计同步 Modal */}
      <Modal
        title="从个人设计同步创建项目"
        open={syncModalOpen}
        onOk={handleSyncFromDesign}
        onCancel={() => {
          setSyncModalOpen(false);
          setSelectedDesignId('');
          setSyncParentId(null);
        }}
        okText="同步"
        cancelText="取消"
        width={600}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div>
            <div style={{ marginBottom: 8 }}>选择要同步的设计：</div>
            <Select
              style={{ width: '100%' }}
              placeholder="选择一个个人设计"
              value={selectedDesignId || undefined}
              onChange={setSelectedDesignId}
              showSearch
              optionFilterProp="children"
            >
              {availableDesigns.map(design => {
                const isSynced = syncedDesignIds.has(design._id);
                return (
                  <Option
                    key={design._id}
                    value={design._id}
                    disabled={isSynced}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{design.title}</span>
                      {isSynced && <Tag color="default">已同步</Tag>}
                    </div>
                  </Option>
                );
              })}
            </Select>
          </div>

          <div>
            <div style={{ marginBottom: 8 }}>选择父项目（可选）：</div>
            <Select
              style={{ width: '100%' }}
              placeholder="不选择则作为根项目"
              value={syncParentId || undefined}
              onChange={setSyncParentId}
              allowClear
            >
              {getProjectOptions(projects).map(option => (
                <Option key={option.value} value={option.value}>
                  {option.label}
                </Option>
              ))}
            </Select>
          </div>

          {selectedDesignId && (
            <div style={{ padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
              <div style={{ fontSize: 12, color: '#666' }}>
                {(() => {
                  const selectedDesign = availableDesigns.find(d => d._id === selectedDesignId);
                  if (!selectedDesign) return null;
                  return (
                    <>
                      <div><strong>设计名称：</strong>{selectedDesign.title}</div>
                      {selectedDesign.description && (
                        <div style={{ marginTop: 4 }}>
                          <strong>描述：</strong>
                          {selectedDesign.description.substring(0, 100)}
                          {selectedDesign.description.length > 100 ? '...' : ''}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          )}
        </Space>
      </Modal>
    </div>
  );
};

export default ProjectsPage;
