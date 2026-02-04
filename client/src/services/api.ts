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

export default api;
