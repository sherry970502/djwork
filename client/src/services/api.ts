import axios from 'axios';
import type {
  ApiResponse,
  MeetingMinutes,
  Thought,
  Tag,
  DashboardStats,
  TagStats,
  OrganizationTask,
  KnowledgeQA,
  MonthlyInsight,
  DesignDimension,
  PersonalDesign
} from '../types';

// 生产环境使用环境变量，开发环境使用代理
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 300000, // 5 minutes for long AI operations
  headers: {
    'Content-Type': 'application/json'
  }
});

// Response interceptor for error handling
api.interceptors.response.use(
  response => response,
  error => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Dashboard
export const getStats = () =>
  api.get<ApiResponse<DashboardStats>>('/stats').then(res => res.data);

// Meetings API
export const getMeetings = (params?: {
  page?: number;
  limit?: number;
  status?: string;
}) =>
  api.get<ApiResponse<MeetingMinutes[]>>('/meetings', { params }).then(res => res.data);

export const getMeeting = (id: string) =>
  api.get<ApiResponse<MeetingMinutes & { thoughts: Thought[] }>>(`/meetings/${id}`)
    .then(res => res.data);

export const createMeeting = (data: {
  title: string;
  content: string;
  meetingDate?: string;
}) =>
  api.post<ApiResponse<MeetingMinutes>>('/meetings', data).then(res => res.data);

export const uploadMeeting = (formData: FormData) =>
  api.post<ApiResponse<MeetingMinutes>>('/meetings/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then(res => res.data);

export const processMeeting = (id: string) =>
  api.post<ApiResponse<MeetingMinutes>>(`/meetings/${id}/process`).then(res => res.data);

// 重新整理会议（使用改进的V2提取算法）
export const reprocessMeeting = (id: string, options?: {
  preserveManual?: boolean;
  preserveMerged?: boolean;
}) =>
  api.post<ApiResponse<any>>(`/meetings/${id}/reprocess`, options).then(res => res.data);

export const deleteMeeting = (id: string) =>
  api.delete<ApiResponse<void>>(`/meetings/${id}`).then(res => res.data);

// Thoughts API
export const getThoughts = (params?: {
  page?: number;
  limit?: number;
  tags?: string;
  meetingId?: string;
  isImportant?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}) =>
  api.get<ApiResponse<Thought[]>>('/thoughts', { params }).then(res => res.data);

export const getThought = (id: string) =>
  api.get<ApiResponse<Thought>>(`/thoughts/${id}`).then(res => res.data);

export const updateThought = (id: string, data: {
  content?: string;
  tags?: string[];
  isImportant?: boolean;
}) =>
  api.put<ApiResponse<Thought>>(`/thoughts/${id}`, data).then(res => res.data);

export const toggleImportant = (id: string) =>
  api.post<ApiResponse<Thought>>(`/thoughts/${id}/important`).then(res => res.data);

export const getSimilarThoughts = () =>
  api.get<ApiResponse<Thought[]> & { count: number }>('/thoughts/similar')
    .then(res => res.data);

export const mergeThoughts = (data: {
  primaryId: string;
  mergeIds: string[];
  mergedContent?: string;
}) =>
  api.post<ApiResponse<Thought>>('/thoughts/merge', data).then(res => res.data);

export const dismissSimilar = (data: {
  thoughtId: string;
  similarThoughtId: string;
}) =>
  api.post<ApiResponse<Thought>>('/thoughts/dismiss', data).then(res => res.data);

export const deleteThought = (id: string) =>
  api.delete<ApiResponse<void>>(`/thoughts/${id}`).then(res => res.data);

// Tags API
export const getTags = () =>
  api.get<ApiResponse<Tag[]>>('/tags').then(res => res.data);

export const getTag = (id: string) =>
  api.get<ApiResponse<Tag>>(`/tags/${id}`).then(res => res.data);

export const createTag = (data: {
  name: string;
  displayName: string;
  description?: string;
  color?: string;
  keywords?: string[];
}) =>
  api.post<ApiResponse<Tag>>('/tags', data).then(res => res.data);

export const updateTag = (id: string, data: {
  displayName?: string;
  description?: string;
  color?: string;
  keywords?: string[];
}) =>
  api.put<ApiResponse<Tag>>(`/tags/${id}`, data).then(res => res.data);

export const deleteTag = (id: string) =>
  api.delete<ApiResponse<void>>(`/tags/${id}`).then(res => res.data);

export const getTagStats = () =>
  api.get<ApiResponse<TagStats[]>>('/tags/stats').then(res => res.data);

// 查找标签匹配的历史内容
export const findTagMatches = (tagId: string, useAI?: boolean) =>
  api.get<ApiResponse<any>>(`/tags/${tagId}/find-matches`, {
    params: { useAI }
  }).then(res => res.data);

// 应用标签到历史内容
export const applyTagToHistory = (tagId: string, data: {
  meetingIds?: string[];
  thoughtIds?: string[];
  applyToMeetingThoughts?: boolean;
}) =>
  api.post<ApiResponse<any>>(`/tags/${tagId}/apply-to-history`, data).then(res => res.data);

// 获取应用了该标签的所有灵感
export const getAppliedThoughts = (tagId: string) =>
  api.get<ApiResponse<any>>(`/tags/${tagId}/applied-thoughts`).then(res => res.data);

// 批量移除标签
export const batchRemoveTag = (tagId: string, thoughtIds: string[]) =>
  api.post<ApiResponse<any>>(`/tags/${tagId}/batch-remove`, { thoughtIds }).then(res => res.data);

// Tasks API (组织事务)
export const getTasks = (params?: {
  page?: number;
  limit?: number;
  status?: string;
  category?: string;
  priority?: string;
}) =>
  api.get<ApiResponse<OrganizationTask[]>>('/tasks', { params }).then(res => res.data);

export const getTask = (id: string) =>
  api.get<ApiResponse<OrganizationTask>>(`/tasks/${id}`).then(res => res.data);

export const preCheckTask = (data: {
  title: string;
  description: string;
}) =>
  api.post<ApiResponse<{
    shouldDJHandle: '必须' | '建议' | '可选' | '不建议';
    confidence: number;
    reasoning: string;
    suggestedOwner?: string;
    criticalFactors: string[];
  }>>('/tasks/pre-check', data).then(res => res.data);

export const createTask = (data: {
  title: string;
  description: string;
  source?: string;
  priority?: string;
  dueDate?: string;
}) =>
  api.post<ApiResponse<OrganizationTask>>('/tasks', data).then(res => res.data);

export const updateTask = (id: string, data: {
  title?: string;
  description?: string;
  source?: string;
  priority?: string;
  status?: string;
  dueDate?: string;
}) =>
  api.put<ApiResponse<OrganizationTask>>(`/tasks/${id}`, data).then(res => res.data);

export const analyzeTask = (id: string) =>
  api.post<ApiResponse<OrganizationTask>>(`/tasks/${id}/analyze`).then(res => res.data);

export const deleteTask = (id: string) =>
  api.delete<ApiResponse<void>>(`/tasks/${id}`).then(res => res.data);

export const getTaskStats = () =>
  api.get<ApiResponse<{
    total: number;
    pending: number;
    analyzing: number;
    completed: number;
    byCategory: Record<string, number>;
    byPriority: Record<string, number>;
  }>>('/tasks/stats').then(res => res.data);

// Knowledge API (知识问答)
export const askKnowledge = (question: string) =>
  api.post<ApiResponse<KnowledgeQA>>('/knowledge/ask', { question }).then(res => res.data);

export const getQAHistory = (params?: {
  page?: number;
  limit?: number;
}) =>
  api.get<ApiResponse<KnowledgeQA[]>>('/knowledge/history', { params }).then(res => res.data);

export const rateQA = (id: string, helpful: boolean) =>
  api.put<ApiResponse<KnowledgeQA>>(`/knowledge/qa/${id}/rate`, { helpful }).then(res => res.data);

// Insights API (月度洞察)
export const generateMonthlyInsight = (month: string) =>
  api.post<ApiResponse<MonthlyInsight>>('/knowledge/insights/generate', { month }).then(res => res.data);

export const getMonthlyInsights = () =>
  api.get<ApiResponse<MonthlyInsight[]>>('/knowledge/insights').then(res => res.data);

export const getMonthlyInsight = (month: string) =>
  api.get<ApiResponse<MonthlyInsight>>(`/knowledge/insights/${month}`).then(res => res.data);

export const updateTopicStatus = (month: string, topicId: string, status: string) =>
  api.put<ApiResponse<MonthlyInsight>>(`/knowledge/insights/${month}/topics/${topicId}`, { status })
    .then(res => res.data);

// Design Dimensions API (设计维度)
export const getDimensions = () =>
  api.get<ApiResponse<DesignDimension[]>>('/designs/dimensions').then(res => res.data);

export const getDimension = (id: string) =>
  api.get<ApiResponse<DesignDimension>>(`/designs/dimensions/${id}`).then(res => res.data);

export const createDimension = (data: {
  name: string;
  displayName: string;
  description: string;
  prompts?: string[];
  examples?: { title: string; description: string }[];
  color?: string;
  icon?: string;
}) =>
  api.post<ApiResponse<DesignDimension>>('/designs/dimensions', data).then(res => res.data);

export const updateDimension = (id: string, data: {
  displayName?: string;
  description?: string;
  prompts?: string[];
  examples?: { title: string; description: string }[];
  color?: string;
  icon?: string;
  isActive?: boolean;
  sortOrder?: number;
}) =>
  api.put<ApiResponse<DesignDimension>>(`/designs/dimensions/${id}`, data).then(res => res.data);

export const deleteDimension = (id: string) =>
  api.delete<ApiResponse<void>>(`/designs/dimensions/${id}`).then(res => res.data);

// Personal Designs API (个人设计)
export const getDesigns = (params?: {
  page?: number;
  limit?: number;
  status?: string;
  category?: string;
}) =>
  api.get<ApiResponse<PersonalDesign[]>>('/designs', { params }).then(res => res.data);

export const getDesign = (id: string) =>
  api.get<ApiResponse<PersonalDesign>>(`/designs/${id}`).then(res => res.data);

export const createDesign = (data: {
  title: string;
  description: string;
  category?: string;
  inspiration?: string;
  goals?: string[];
  priority?: string;
  selectedDimensions?: string[];
  notes?: string;
}) =>
  api.post<ApiResponse<PersonalDesign>>('/designs', data).then(res => res.data);

export const updateDesign = (id: string, data: {
  title?: string;
  description?: string;
  category?: string;
  inspiration?: string;
  goals?: string[];
  status?: string;
  priority?: string;
  selectedDimensions?: string[];
  notes?: string;
}) =>
  api.put<ApiResponse<PersonalDesign>>(`/designs/${id}`, data).then(res => res.data);

export const deleteDesign = (id: string) =>
  api.delete<ApiResponse<void>>(`/designs/${id}`).then(res => res.data);

// 需求澄清
export const generateClarifyingQuestions = (id: string) =>
  api.post<ApiResponse<any>>(`/designs/${id}/clarify`).then(res => res.data);

export const submitClarifyingAnswers = (id: string, answers: any[]) =>
  api.post<ApiResponse<PersonalDesign>>(`/designs/${id}/clarify/submit`, { answers }).then(res => res.data);

export const skipClarification = (id: string) =>
  api.post<ApiResponse<PersonalDesign>>(`/designs/${id}/clarify/skip`).then(res => res.data);

export const generateDesignIdeas = (id: string) =>
  api.post<ApiResponse<PersonalDesign>>(`/designs/${id}/generate-ideas`).then(res => res.data);

export const generateDesignProposal = (id: string) =>
  api.post<ApiResponse<PersonalDesign>>(`/designs/${id}/generate-proposal`).then(res => res.data);

// Monthly Plans API (月度计划)
export const getMonthlyPlanList = () =>
  api.get<ApiResponse<any[]>>('/monthly-plans').then(res => res.data);

export const getMonthlyPlan = (month: string) =>
  api.get<ApiResponse<any>>(`/monthly-plans/${month}`).then(res => res.data);

export const syncMonthlyPlan = (month: string) =>
  api.post<ApiResponse<any>>(`/monthly-plans/${month}/sync`).then(res => res.data);

export const addPlanItem = (month: string, data: {
  title: string;
  description?: string;
  category?: string;
  priority?: string;
  sourceType?: string;
}) =>
  api.post<ApiResponse<any>>(`/monthly-plans/${month}/items`, data).then(res => res.data);

export const updatePlanItem = (month: string, itemId: string, data: {
  planStatus?: string;
  notes?: string;
}) =>
  api.put<ApiResponse<any>>(`/monthly-plans/${month}/items/${itemId}`, data).then(res => res.data);

export const removePlanItem = (month: string, itemId: string) =>
  api.delete<ApiResponse<any>>(`/monthly-plans/${month}/items/${itemId}`).then(res => res.data);

export const reviewPlanItem = (month: string, itemId: string) =>
  api.post<ApiResponse<any>>(`/monthly-plans/${month}/items/${itemId}/review`).then(res => res.data);

// 获取计划项目相关的会议（智能检索）
export const getRelatedMeetingsForItem = (month: string, itemId: string) =>
  api.get<ApiResponse<any>>(`/monthly-plans/${month}/items/${itemId}/related-meetings`).then(res => res.data);

// 使用选中的会议进行复盘
export const reviewPlanItemWithSelection = (month: string, itemId: string, selectedMeetingIds: string[]) =>
  api.post<ApiResponse<any>>(`/monthly-plans/${month}/items/${itemId}/review-with-selection`, { selectedMeetingIds }).then(res => res.data);

export const reviewMonthlyPlan = (month: string) =>
  api.post<ApiResponse<any>>(`/monthly-plans/${month}/review`).then(res => res.data);

// 迁移单个项目到下个月
export const migrateItem = (month: string, itemId: string, data: {
  upgradeToV2?: boolean;
  evolutionNotes?: string;
  newTitle?: string;
  newDescription?: string;
}) =>
  api.post<ApiResponse<any>>(`/monthly-plans/${month}/items/${itemId}/migrate`, data).then(res => res.data);

// 批量迁移项目到下个月
export const batchMigrateItems = (month: string, data: {
  itemIds: string[];
  upgradeToV2?: boolean;
}) =>
  api.post<ApiResponse<any>>(`/monthly-plans/${month}/migrate`, data).then(res => res.data);

// 更新项目分类
export const updateItemProject = (month: string, itemId: string, project: string) =>
  api.put<ApiResponse<any>>(`/monthly-plans/${month}/items/${itemId}/project`, { project }).then(res => res.data);

// ==================== Mind Map APIs ====================

// 创建思维导图
export const createMindMap = (data: { designId: string; title: string }) =>
  api.post<ApiResponse<any>>('/mindmaps', data).then(res => res.data);

// 获取思维导图
export const getMindMap = (id: string) =>
  api.get<ApiResponse<any>>(`/mindmaps/${id}`).then(res => res.data);

// 根据设计ID获取思维导图
export const getMindMapByDesignId = (designId: string) =>
  api.get<ApiResponse<any>>(`/mindmaps/design/${designId}`).then(res => res.data);

// AI 发散节点
export const divergeNode = (id: string, nodeId: string) =>
  api.post<ApiResponse<any>>(`/mindmaps/${id}/diverge`, { nodeId }).then(res => res.data);

// 更新节点
export const updateMindMapNode = (id: string, nodeId: string, updates: any) =>
  api.put<ApiResponse<any>>(`/mindmaps/${id}/nodes`, { nodeId, updates }).then(res => res.data);

// 删除节点
export const deleteMindMapNode = (id: string, nodeId: string) =>
  api.delete<ApiResponse<any>>(`/mindmaps/${id}/nodes`, { data: { nodeId } }).then(res => res.data);

// 添加手动节点
export const addManualNode = (id: string, data: { parentId: string; content: string; position?: { x: number; y: number } }) =>
  api.post<ApiResponse<any>>(`/mindmaps/${id}/nodes`, data).then(res => res.data);

// 删除思维导图
export const deleteMindMap = (id: string) =>
  api.delete<ApiResponse<any>>(`/mindmaps/${id}`).then(res => res.data);

// ==================== Wishlist APIs ====================

// 获取 Wishlist
export const getWishlist = () =>
  api.get<ApiResponse<any[]>>('/wishlist').then(res => res.data);

// 创建 Wishlist 项
export const createWishlistItem = (data: { content: string; category?: string }) =>
  api.post<ApiResponse<any>>('/wishlist', data).then(res => res.data);

// 更新 Wishlist 项
export const updateWishlistItem = (id: string, data: { content?: string; category?: string }) =>
  api.put<ApiResponse<any>>(`/wishlist/${id}`, data).then(res => res.data);

// 删除 Wishlist 项
export const deleteWishlistItem = (id: string) =>
  api.delete<ApiResponse<any>>(`/wishlist/${id}`).then(res => res.data);

// 移动 Wishlist 项
export const moveWishlistItem = (id: string, direction: 'up' | 'down') =>
  api.post<ApiResponse<any>>(`/wishlist/${id}/move`, { direction }).then(res => res.data);

// AI 自动分类
export const autoClassifyWishlist = () =>
  api.post<ApiResponse<any>>('/wishlist/auto-classify').then(res => res.data);

// AI 总结
export const summarizeWishlist = () =>
  api.post<ApiResponse<{ summary: string }>>('/wishlist/summarize').then(res => res.data);

// AI 发散单个项
export const divergeWishlistItem = (id: string) =>
  api.post<ApiResponse<{ suggestions: Array<{ content: string; reason: string }> }>>(`/wishlist/${id}/diverge`).then(res => res.data);

// AI 推荐
export const recommendWishlist = () =>
  api.post<ApiResponse<{ recommendations: Array<{ content: string; reason: string }> }>>('/wishlist/recommend').then(res => res.data);

export default api;
