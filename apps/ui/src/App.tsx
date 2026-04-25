import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { OrgProvider } from "./context/OrgContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { RouteGate } from "./components/RouteGate";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Onboarding } from "./pages/Onboarding";
import { Search } from "./pages/Search";
import { Dashboard } from "./pages/Dashboard";
import { TestCases } from "./pages/TestCases";
import { TestCaseDetail } from "./pages/TestCaseDetail";
import { TestSuites } from "./pages/TestSuites";
import { ScheduledTestSuites } from "./pages/ScheduledTestSuites";
import { ScheduledTestSuiteDetail } from "./pages/ScheduledTestSuiteDetail";
import { ScheduledTestCaseDetail } from "./pages/ScheduledTestCaseDetail";
import { Reporting } from "./pages/Reporting";
import { Tags } from "./pages/Tags";
import { GenerateTestCases } from "./pages/GenerateTestCases";
import { Bugs } from "./pages/Bugs";
import { BugDetail } from "./pages/BugDetail";
import { BotConnections } from "./pages/BotConnections";
import { KnowledgeSources } from "./pages/KnowledgeSources";
import { OrgMembers } from "./pages/org/OrgMembers";
import { OrgInvites } from "./pages/org/OrgInvites";
import { OrgSettings } from "./pages/org/OrgSettings";
import { OrgTeams } from "./pages/org/OrgTeams";
import { ProjectsList } from "./pages/project/ProjectsList";
import { ProjectCreate } from "./pages/project/ProjectCreate";
import { ProjectDetails } from "./pages/project/ProjectDetails";
import { ProjectSettings } from "./pages/project/ProjectSettings";
import { PreferencesProfile } from "./pages/preferences/PreferencesProfile";
import { PreferencesPrompts } from "./pages/preferences/PreferencesPrompts";

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <OrgProvider>
          <Routes>
            <Route path="login" element={<Login />} />
            <Route element={<ProtectedRoute />}>
              <Route path="onboarding" element={<Onboarding />} />
              <Route element={<Layout />}>
                <Route index element={<Navigate to="/dashboard" replace />} />

                {/* Org-scoped admin (needs :orgId) */}
                <Route path="orgs/:orgId/projects/new" element={<RouteGate action="project.create" />}>
                  <Route index element={<ProjectCreate />} />
                </Route>
                <Route path="orgs/:orgId/projects" element={<ProjectsList />} />
                <Route path="orgs/:orgId/projects/:projectId" element={<ProjectDetails />} />
                <Route path="orgs/:orgId/teams" element={<OrgTeams />} />
                <Route path="orgs/:orgId/members" element={<RouteGate action="org.members.manage" />}>
                  <Route index element={<OrgMembers />} />
                </Route>
                <Route path="orgs/:orgId/invites" element={<RouteGate action="org.invites.manage" />}>
                  <Route index element={<OrgInvites />} />
                </Route>
                <Route path="orgs/:orgId/settings" element={<RouteGate action="org.edit" />}>
                  <Route index element={<OrgSettings />} />
                </Route>

                {/* Project admin pages filter-driven, flat URLs */}
                <Route path="project-settings" element={<ProjectSettings />} />

                {/* Personal preferences */}
                <Route path="preferences" element={<Navigate to="/preferences/profile" replace />} />
                <Route path="preferences/profile" element={<PreferencesProfile />} />
                <Route path="preferences/prompts" element={<PreferencesPrompts />} />

                {/* Content pages project via ?projects= filter or URL */}
                <Route path="search" element={<Search />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="test-cases" element={<TestCases />} />
                <Route path="test-cases/generate" element={<GenerateTestCases />} />
                <Route path="test-cases/:projectId/:id" element={<TestCaseDetail />} />
                <Route path="test-suites" element={<TestSuites />} />
                <Route path="scheduled-test-suites" element={<ScheduledTestSuites />} />
                <Route path="scheduled-test-suites/:projectId/:id" element={<ScheduledTestSuiteDetail />} />
                <Route path="scheduled-test-suites/:projectId/:id/cases/:caseId" element={<ScheduledTestCaseDetail />} />
                <Route path="bugs" element={<Bugs />} />
                <Route path="bugs/:projectId/:id" element={<BugDetail />} />
                <Route path="bot-connections" element={<BotConnections />} />
                <Route path="knowledge-sources" element={<KnowledgeSources />} />
                <Route path="tags" element={<Tags />} />
                <Route path="reporting" element={<Reporting />} />
              </Route>
            </Route>
          </Routes>
        </OrgProvider>
      </BrowserRouter>
    </AuthProvider>
  );
}
