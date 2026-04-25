import { api } from "./api";

export interface GeneratedScenario {
  title: string;
  description: string;
}

export interface FollowUpQA {
  question: string;
  answer: string;
}

export interface AiGenerationSession {
  id: string;
  projectId?: string;
  testSuiteId: string;
  userStory: string;
  followUpQA: FollowUpQA[];
  generatedScenarios: GeneratedScenario[];
  selectedScenarioIndices: number[];
  status: "gathering_info" | "scenarios_generated" | "test_cases_created";
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

const base = (orgId: string, projectId: string) => `/organizations/${orgId}/projects/${projectId}/ai`;

export const aiService = {
  async createSession(orgId: string, projectId: string, testSuiteId: string, userStory: string): Promise<AiGenerationSession> {
    const { data } = await api.post<AiGenerationSession>(`${base(orgId, projectId)}/session`, { testSuiteId, userStory });
    return data;
  },

  async getSession(orgId: string, projectId: string, id: string): Promise<AiGenerationSession> {
    const { data } = await api.get<AiGenerationSession>(`${base(orgId, projectId)}/session/${id}`);
    return data;
  },

  async getFollowUpQuestions(orgId: string, projectId: string, sessionId: string): Promise<string[]> {
    const { data } = await api.post<{ questions: string[] }>(`${base(orgId, projectId)}/session/${sessionId}/followup`);
    return data.questions;
  },

  async submitAnswers(orgId: string, projectId: string, sessionId: string, answers: FollowUpQA[]): Promise<AiGenerationSession> {
    const { data } = await api.post<AiGenerationSession>(`${base(orgId, projectId)}/session/${sessionId}/answers`, { answers });
    return data;
  },

  async generateScenarios(orgId: string, projectId: string, sessionId: string): Promise<AiGenerationSession> {
    const { data } = await api.post<AiGenerationSession>(`${base(orgId, projectId)}/session/${sessionId}/generate-scenarios`);
    return data;
  },

  async createTestCases(orgId: string, projectId: string, sessionId: string, selectedIndices: number[]): Promise<unknown[]> {
    const { data } = await api.post<unknown[]>(`${base(orgId, projectId)}/session/${sessionId}/create-test-cases`, { selectedIndices });
    return data;
  },
};
