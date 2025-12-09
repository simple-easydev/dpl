import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { OrganizationProvider } from './contexts/OrganizationContext';
import { ThemeProvider } from './contexts/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import BlockPlatformAdminRoute from './components/BlockPlatformAdminRoute';
import DashboardLayout from './components/DashboardLayout';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './pages/Login';
import Signup from './pages/Signup';
import AcceptInvite from './pages/AcceptInvite';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import UploadPage from './pages/UploadPage';
import AccountsPage from './pages/AccountsPage';
import AccountDetail from './pages/AccountDetail';
import ProductsPage from './pages/ProductsPage';
import DistributorsPage from './pages/DistributorsPage';
import FOBPricingPage from './pages/FOBPricingPage';
import TemplatesPage from './pages/TemplatesPage';
import ComparePage from './pages/ComparePage';
import DataPage from './pages/DataPage';
import SettingsPage from './pages/SettingsPage';
import MapPage from './pages/MapPage';
import TasksPage from './pages/TasksPage';
import SalesBlitzPage from './pages/SalesBlitzPage';
import InventoryPage from './pages/InventoryPage';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import ClientsListPage from './pages/ClientsListPage';
import ClientDetailPage from './pages/ClientDetailPage';
import InviteBrandPage from './pages/InviteBrandPage';
import GlobalDistributorsPage from './pages/GlobalDistributorsPage';
import DiagnosticPage from './pages/DiagnosticPage';

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <OrganizationProvider>
                <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/accept-invite" element={<AcceptInvite />} />
            <Route path="/diagnostics" element={<DiagnosticPage />} />

            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <ErrorBoundary>
                      <Dashboard />
                    </ErrorBoundary>
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/dashboard/tasks"
              element={
                <ProtectedRoute>
                  <BlockPlatformAdminRoute>
                    <DashboardLayout>
                      <TasksPage />
                    </DashboardLayout>
                  </BlockPlatformAdminRoute>
                </ProtectedRoute>
              }
            />

            <Route
              path="/dashboard/upload"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <UploadPage />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/dashboard/accounts"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <AccountsPage />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/dashboard/accounts/:accountId"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <AccountDetail />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/dashboard/products"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <ProductsPage />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/dashboard/distributors"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <DistributorsPage />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/dashboard/fob-pricing"
              element={
                <ProtectedRoute>
                  <BlockPlatformAdminRoute>
                    <DashboardLayout>
                      <FOBPricingPage />
                    </DashboardLayout>
                  </BlockPlatformAdminRoute>
                </ProtectedRoute>
              }
            />

            <Route
              path="/dashboard/templates"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <TemplatesPage />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/dashboard/compare"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <ComparePage />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/dashboard/map"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <MapPage />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/dashboard/data"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <DataPage />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/dashboard/sales-blitz"
              element={
                <ProtectedRoute>
                  <BlockPlatformAdminRoute>
                    <DashboardLayout>
                      <SalesBlitzPage />
                    </DashboardLayout>
                  </BlockPlatformAdminRoute>
                </ProtectedRoute>
              }
            />

            <Route
              path="/dashboard/inventory"
              element={
                <ProtectedRoute>
                  <BlockPlatformAdminRoute>
                    <DashboardLayout>
                      <InventoryPage />
                    </DashboardLayout>
                  </BlockPlatformAdminRoute>
                </ProtectedRoute>
              }
            />

            <Route
              path="/dashboard/settings"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <SettingsPage />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/platform-admin"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <SuperAdminDashboard />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/platform-admin/clients"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <ClientsListPage />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/platform-admin/clients/:clientId"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <ClientDetailPage />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/platform-admin/invite-brand"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <InviteBrandPage />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/platform-admin/global-distributors"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <GlobalDistributorsPage />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />

            <Route path="/" element={<Navigate to="/dashboard" replace />} />
                </Routes>
            </OrganizationProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
