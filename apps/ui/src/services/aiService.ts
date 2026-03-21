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

export const aiService = {
  async createSession(testSuiteId: string, userStory: string): Promise<AiGenerationSession> {
    const { data } = await api.post<AiGenerationSession>("/ai/session", { testSuiteId, userStory });
    return data;
  },

  async getSession(id: string): Promise<AiGenerationSession> {
    const { data } = await api.get<AiGenerationSession>(`/ai/session/${id}`);
    return data;
  },

  async getFollowUpQuestions(sessionId: string): Promise<string[]> {
    const { data } = await api.post<{ questions: string[] }>(`/ai/session/${sessionId}/followup`);
    return data.questions;
  },

  async submitAnswers(sessionId: string, answers: FollowUpQA[]): Promise<AiGenerationSession> {
    const { data } = await api.post<AiGenerationSession>(`/ai/session/${sessionId}/answers`, { answers });
    return data;
  },

  async generateScenarios(sessionId: string): Promise<AiGenerationSession> {
    const { data } = await api.post<AiGenerationSession>(`/ai/session/${sessionId}/generate-scenarios`);
    return data;
  },

  async createTestCases(sessionId: string, selectedIndices: number[]): Promise<unknown[]> {
    const { data } = await api.post<unknown[]>(`/ai/session/${sessionId}/create-test-cases`, { selectedIndices });
    return data;
  },
};