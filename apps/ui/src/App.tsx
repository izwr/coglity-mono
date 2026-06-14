import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { OrgProvider } from './context/OrgContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { RouteGate } from './components/RouteGate';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';

// Route-level code splitting: pages are named exports, so each lazy import
// maps the module onto a default export. Login/Layout/guards stay eager.
const Onboarding = lazy(() => import('./pages/Onboarding').then((m) => ({ default: m.Onboarding })));
const Search = lazy(() => import('./pages/Search').then((m) => ({ default: m.Search })));
const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const TestCases = lazy(() => import('./pages/TestCases').then((m) => ({ default: m.TestCases })));
const TestCaseDetail = lazy(() =>
  import('./pages/TestCaseDetail').then((m) => ({ default: m.TestCaseDetail })),
);
const TestSuites = lazy(() => import('./pages/TestSuites').then((m) => ({ default: m.TestSuites })));
const ScheduledTestSuites = lazy(() =>
  import('./pages/ScheduledTestSuites').then((m) => ({ default: m.ScheduledTestSuites })),
);
const ScheduledTestSuiteDetail = lazy(() =>
  import('./pages/ScheduledTestSuiteDetail').then((m) => ({ default: m.ScheduledTestSuiteDetail })),
);
const ScheduledTestCaseDetail = lazy(() =>
  import('./pages/ScheduledTestCaseDetail').then((m) => ({ default: m.ScheduledTestCaseDetail })),
);
const Reporting = lazy(() => import('./pages/Reporting').then((m) => ({ default: m.Reporting })));
const ReportDetail = lazy(() =>
  import('./pages/ReportDetail').then((m) => ({ default: m.ReportDetail })),
);
const Tags = lazy(() => import('./pages/Tags').then((m) => ({ default: m.Tags })));
const GenerateTestCases = lazy(() =>
  import('./pages/GenerateTestCases').then((m) => ({ default: m.GenerateTestCases })),
);
const Bugs = lazy(() => import('./pages/Bugs').then((m) => ({ default: m.Bugs })));
const BugDetail = lazy(() => import('./pages/BugDetail').then((m) => ({ default: m.BugDetail })));
const BotConnections = lazy(() =>
  import('./pages/BotConnections').then((m) => ({ default: m.BotConnections })),
);
const KnowledgeSources = lazy(() =>
  import('./pages/KnowledgeSources').then((m) => ({ default: m.KnowledgeSources })),
);
const OrgMembers = lazy(() =>
  import('./pages/org/OrgMembers').then((m) => ({ default: m.OrgMembers })),
);
const OrgInvites = lazy(() =>
  import('./pages/org/OrgInvites').then((m) => ({ default: m.OrgInvites })),
);
const OrgSettings = lazy(() =>
  import('./pages/org/OrgSettings').then((m) => ({ default: m.OrgSettings })),
);
const OrgTeams = lazy(() => import('./pages/org/OrgTeams').then((m) => ({ default: m.OrgTeams })));
const ProjectsList = lazy(() =>
  import('./pages/project/ProjectsList').then((m) => ({ default: m.ProjectsList })),
);
const ProjectCreate = lazy(() =>
  import('./pages/project/ProjectCreate').then((m) => ({ default: m.ProjectCreate })),
);
const ProjectDetails = lazy(() =>
  import('./pages/project/ProjectDetails').then((m) => ({ default: m.ProjectDetails })),
);
const ProjectSettings = lazy(() =>
  import('./pages/project/ProjectSettings').then((m) => ({ default: m.ProjectSettings })),
);
const PreferencesProfile = lazy(() =>
  import('./pages/preferences/PreferencesProfile').then((m) => ({ default: m.PreferencesProfile })),
);
const PreferencesPrompts = lazy(() =>
  import('./pages/preferences/PreferencesPrompts').then((m) => ({ default: m.PreferencesPrompts })),
);

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <OrgProvider>
          <Suspense
            fallback={
              <div className="page">
                <p className="ts-empty">Loading…</p>
              </div>
            }
          >
          <Routes>
            <Route path="login" element={<Login />} />
            <Route element={<ProtectedRoute />}>
              <Route path="onboarding" element={<Onboarding />} />
              <Route element={<Layout />}>
                <Route index element={<Navigate to="/dashboard" replace />} />

                {/* Org-scoped admin (needs :orgId) */}
                <Route
                  path="orgs/:orgId/projects/new"
                  element={<RouteGate action="project.create" />}
                >
                  <Route index element={<ProjectCreate />} />
                </Route>
                <Route path="orgs/:orgId/projects" element={<ProjectsList />} />
                <Route path="orgs/:orgId/projects/:projectId" element={<ProjectDetails />} />
                <Route path="orgs/:orgId/teams" element={<OrgTeams />} />
                <Route
                  path="orgs/:orgId/members"
                  element={<RouteGate action="org.members.manage" />}
                >
                  <Route index element={<OrgMembers />} />
                </Route>
                <Route
                  path="orgs/:orgId/invites"
                  element={<RouteGate action="org.invites.manage" />}
                >
                  <Route index element={<OrgInvites />} />
                </Route>
                <Route path="orgs/:orgId/settings" element={<RouteGate action="org.edit" />}>
                  <Route index element={<OrgSettings />} />
                </Route>

                {/* Project admin pages filter-driven, flat URLs */}
                <Route path="project-settings" element={<ProjectSettings />} />

                {/* Personal preferences */}
                <Route
                  path="preferences"
                  element={<Navigate to="/preferences/profile" replace />}
                />
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
                <Route
                  path="scheduled-test-suites/:projectId/:id"
                  element={<ScheduledTestSuiteDetail />}
                />
                <Route
                  path="scheduled-test-suites/:projectId/:id/cases/:caseId"
                  element={<ScheduledTestCaseDetail />}
                />
                <Route path="bugs" element={<Bugs />} />
                <Route path="bugs/:projectId/:id" element={<BugDetail />} />
                <Route path="bot-connections" element={<BotConnections />} />
                <Route path="knowledge-sources" element={<KnowledgeSources />} />
                <Route path="tags" element={<Tags />} />
                <Route path="reporting" element={<Reporting />} />
                <Route path="reporting/:projectId/:id" element={<ReportDetail />} />
              </Route>
            </Route>
          </Routes>
          </Suspense>
        </OrgProvider>
      </BrowserRouter>
    </AuthProvider>
  );
}
