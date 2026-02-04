export interface Tag {
  _id: string;
  name: string;
  displayName: string;
  description: string;
  color: string;
  keywords: string[];
  thoughtCount: number;
  isPreset: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SimilarThought {
  thoughtId: string | Thought;
  similarity: number;
  status: 'pending' | 'merged' | 'dismissed';
}

export interface Thought {
  _id: string;
  meetingMinutesId: string | MeetingMinutes;
  content: string;
  contentType?: 'TODO' | 'CONCLUSION' | 'QUESTION' | 'IDEA' | 'DECISION' | 'OBSERVATION' | 'REFERENCE';
  speaker?: string;
  originalQuote?: string;
  context?: string;
  originalSegment: string;
  tags: Tag[];
  confidence: number;
  extractionVersion?: number;
  embedding: number[];
  similarThoughts: SimilarThought[];
  isImportant: boolean;
  mergedFrom: string[];
  isMerged: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MeetingMinutes {
  _id: string;
  title: string;
  meetingDate: string;
  content: string;
  sourceType: 'paste' | 'word' | 'pdf' | 'txt';
  originalFileName?: string;
  processStatus: 'pending' | 'processing' | 'completed' | 'failed';
  processError?: string;
  thoughtCount: number;
  processedAt?: string;
  createdAt: string;
  updatedAt: string;
  thoughts?: Thought[];
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  pagination?: Pagination;
}

export interface DashboardStats {
  totalMeetings: number;
  totalThoughts: number;
  importantThoughts: number;
  pendingProcessing: number;
  pendingSimilar: number;
  topTags: Tag[];
  pendingTasks: number;
  completedTasks: number;
  totalDesigns: number;
  activeDesigns: number;
}

// 组织事务任务
export interface TaskAnalysis {
  categoryPrediction: 'business' | 'organization' | 'strategy' | 'brand';
  categoryLabel: string;
  step1_falsification: {
    firstPrinciple: string;
    coreCapabilityFit: string;
    alternativePaths: string[];
  };
  step2_external: {
    marketFit: string;
    competitiveAnalysis: string;
  };
  step3_frameworks: {
    porterFiveForces: string;
    scalabilityTest: string;
    ansoffMatrix: string;
  };
  step4_execution: {
    optimalPath: string;
    roiAnalysis: string;
    leveragePoint: string;
  };
  step5_userContext: {
    happinessLogic: string;
    sceneValue: string;
  };
  step6_risk: {
    swot: {
      strengths: string[];
      weaknesses: string[];
      opportunities: string[];
      threats: string[];
    };
    criticalQuestions: string[];
  };
  recommendation: {
    summary: string;
    whatToDo: string;
    whyToDo: string;
    whereToFocus: string;
    costAndReturn: string;
  };
  relatedThoughts: Thought[];
  referenceSources?: {
    totalThoughts: number;
    meetings: {
      _id: string;
      title: string;
      meetingDate: string;
      thoughts: {
        _id: string;
        content: string;
        tags: string[];
      }[];
    }[];
    thoughtDetails: {
      _id: string;
      content: string;
      tags: string[];
      isImportant: boolean;
      createdAt: string;
    }[];
  };
  createdAt: string;
}

export interface OrganizationTask {
  _id: string;
  title: string;
  description: string;
  source: string;
  category: 'business' | 'organization' | 'strategy' | 'brand' | 'unknown';
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'analyzing' | 'completed' | 'archived';
  dueDate?: string;
  // DJ 角色
  djRole?: 'manager' | 'lead_designer' | 'mentor' | 'expert' | 'unknown';
  djRoleLabel?: string;
  djRoleReason?: string;
  analysis?: TaskAnalysis;
  createdAt: string;
  updatedAt: string;
}

// 知识问答
export interface KnowledgeQA {
  _id: string;
  question: string;
  answer: string;
  relatedThoughts: Thought[];
  confidence: number;
  helpful?: boolean;
  createdAt: string;
}

// 月度洞察
export interface SuggestedTopic {
  _id: string;
  title: string;
  description: string;
  category: 'business' | 'organization' | 'strategy' | 'brand';
  reasoning: string;
  priority: 'high' | 'medium' | 'low';
  status: 'suggested' | 'accepted' | 'dismissed';
}

export interface MonthlyInsight {
  _id: string;
  month: string;
  recentThoughts: Thought[];
  pendingTasks: OrganizationTask[];
  thoughtsSummary: string;
  tasksSummary: string;
  suggestedTopics: SuggestedTopic[];
  generatedAt: string;
}

export interface TagStats {
  _id: string;
  name: string;
  displayName: string;
  color: string;
  thoughtCount: number;
  importantCount: number;
}

// 设计维度
export interface DesignDimension {
  _id: string;
  name: string;
  displayName: string;
  description: string;
  category?: string;
  prompts: string[];
  examples: { title: string; description: string }[];
  color: string;
  icon: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

// 维度创意
export interface DimensionIdea {
  title: string;
  description: string;
  feasibility: 'high' | 'medium' | 'low';
  innovation: 'high' | 'medium' | 'low';
}

// 维度创意结果
export interface DimensionIdeaResult {
  dimensionId: string;
  dimensionName: string;
  ideas: DimensionIdea[];
  summary: string;
  generatedAt: string;
}

// 实现步骤
export interface ImplementationStep {
  step: number;
  title: string;
  description: string;
}

// 综合创意方案
export interface CreativeProposal {
  _id: string;
  title: string;
  coreIdea: string;
  uniqueValue: string;
  targetAudience: string;
  keyFeatures: string[];
  implementationSteps: ImplementationStep[];
  potentialChallenges: string[];
  inspirationSources: string[];
  generatedAt: string;
}

// 需求澄清问答
export interface ClarifyingQA {
  question: string;
  questionType: 'single' | 'multiple' | 'text';
  options: string[];
  answer: string[];
  customAnswer?: string;
  category: string;
}

// 个人设计
export interface PersonalDesign {
  _id: string;
  title: string;
  description: string;
  category: 'product' | 'experience' | 'content' | 'service' | 'other';
  inspiration?: string;
  goals: string[];
  status: 'draft' | 'ideating' | 'designing' | 'prototyping' | 'completed' | 'archived';
  priority: 'high' | 'medium' | 'low';
  // 需求澄清
  clarifyingQA?: ClarifyingQA[];
  clarifyStatus?: 'pending' | 'questioning' | 'completed' | 'skipped';
  requirementSummary?: string;
  // 维度和创意
  selectedDimensions: DesignDimension[];
  dimensionIdeas: DimensionIdeaResult[];
  creativeProposals: CreativeProposal[];
  notes?: string;
  relatedThoughts: Thought[];
  createdAt: string;
  updatedAt: string;
}
