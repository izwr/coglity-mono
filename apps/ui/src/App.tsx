import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Search } from "./pages/Search";
import { Dashboard } from "./pages/Dashboard";
import { TestCases } from "./pages/TestCases";
import { TestCaseDetail } from "./pages/TestCaseDetail";
import { TestSuites } from "./pages/TestSuites";
import { ScheduledTestSuites } from "./pages/ScheduledTestSuites";
import { Reporting } from "./pages/Reporting";
import { Tags } from "./pages/Tags";

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="search" element={<Search />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="test-cases" element={<TestCases />} />
              <Route path="test-cases/:id" element={<TestCaseDetail />} />
              <Route path="test-suites" element={<TestSuites />} />
              <Route path="scheduled-test-suites" element={<ScheduledTestSuites />} />
              <Route path="tags" element={<Tags />} />
              <Route path="reporting" element={<Reporting />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
