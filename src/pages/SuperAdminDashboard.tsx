import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getPlatformStats, getAllOrganizations, OrganizationWithStats } from '../lib/platformAdminService';
import { Building2, Users, DollarSign, Upload, TrendingUp, Calendar, Shield, Plus } from 'lucide-react';
import { format } from 'date-fns';
import CreateBrandModal from '../components/CreateBrandModal';

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const { isPlatformAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalOrganizations: 0,
    totalUsers: 0,
    totalRevenue: 0,
    recentUploads: 0,
  });
  const [organizations, setOrganizations] = useState<OrganizationWithStats[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    console.log('[SuperAdminDashboard] useEffect triggered');
    console.log('[SuperAdminDashboard] isPlatformAdmin:', isPlatformAdmin);

    if (!isPlatformAdmin) {
      console.log('[SuperAdminDashboard] User is not platform admin, redirecting to /dashboard');
      navigate('/dashboard');
      return;
    }

    const fetchData = async () => {
      console.log('[SuperAdminDashboard] Starting data fetch...');
      setLoading(true);
      try {
        console.log('[SuperAdminDashboard] Fetching platform stats and organizations...');
        const [platformStats, orgs] = await Promise.all([
          getPlatformStats(),
          getAllOrganizations(),
        ]);

        console.log('[SuperAdminDashboard] Platform stats received:', platformStats);
        console.log('[SuperAdminDashboard] Organizations received:', orgs.length, 'organizations');
        console.log('[SuperAdminDashboard] Organization names:', orgs.map(o => o.name));

        setStats(platformStats);
        setOrganizations(orgs.slice(0, 10));
      } catch (error) {
        console.error('[SuperAdminDashboard] Error fetching platform data:', error);
        console.error('[SuperAdminDashboard] Error details:', error instanceof Error ? error.message : String(error));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isPlatformAdmin, navigate]);

  const handleCreateSuccess = (organizationId: string) => {
    setShowCreateModal(false);
    setMessage({ type: 'success', text: 'Brand created successfully!' });
    setTimeout(() => {
      setMessage(null);
      navigate(`/platform-admin/clients/${organizationId}`);
    }, 1500);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-blue flex items-center justify-center shadow-glow-blue">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-3xl font-semibold text-theme-text">Platform Admin Dashboard</h1>
        </div>
        <p className="text-theme-muted">Overview of all client brands and platform activity</p>
      </div>

      {message && (
        <div
          className={`mb-6 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
              : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="glass-card rounded-2xl p-6 glow-hover-blue">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-theme-muted uppercase tracking-wide">Total Clients</span>
            <div className="rounded-xl p-2 bg-gradient-blue shadow-glow-blue">
              <Building2 className="w-5 h-5 text-white" />
            </div>
          </div>
          <span className="text-3xl font-semibold text-theme-text">{stats.totalOrganizations}</span>
          <p className="text-xs text-theme-muted mt-1">Active organizations</p>
        </div>

        <div className="glass-card rounded-2xl p-6 glow-hover-teal">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-theme-muted uppercase tracking-wide">Total Users</span>
            <div className="rounded-xl p-2 bg-gradient-teal shadow-glow-teal">
              <Users className="w-5 h-5 text-white" />
            </div>
          </div>
          <span className="text-3xl font-semibold text-theme-text">{stats.totalUsers}</span>
          <p className="text-xs text-theme-muted mt-1">Across all clients</p>
        </div>

        <div className="glass-card rounded-2xl p-6 glow-hover-purple">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-theme-muted uppercase tracking-wide">Platform Revenue</span>
            <div className="rounded-xl p-2 bg-gradient-orange">
              <DollarSign className="w-5 h-5 text-white" />
            </div>
          </div>
          <span className="text-3xl font-semibold text-theme-text">
            ${stats.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
          <p className="text-xs text-theme-muted mt-1">Total across all brands</p>
        </div>

        <div className="glass-card rounded-2xl p-6 glow-hover-blue">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-theme-muted uppercase tracking-wide">Recent Activity</span>
            <div className="rounded-xl p-2 bg-gradient-blue shadow-glow-blue">
              <Upload className="w-5 h-5 text-white" />
            </div>
          </div>
          <span className="text-3xl font-semibold text-theme-text">{stats.recentUploads}</span>
          <p className="text-xs text-theme-muted mt-1">Uploads last 30 days</p>
        </div>
      </div>

      <div className="glass-card rounded-2xl glow-hover-blue mb-8">
        <div className="p-6 border-b table-border flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-theme-text mb-1">Recent Clients</h2>
            <p className="text-sm text-theme-muted">Top 10 most recently active organizations</p>
          </div>
          <button
            onClick={() => navigate('/platform-admin/clients')}
            className="btn-primary"
          >
            View All Clients
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b table-border">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-theme-muted uppercase tracking-wider">
                  Organization
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-theme-muted uppercase tracking-wider">
                  Members
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-theme-muted uppercase tracking-wider">
                  Revenue
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-theme-muted uppercase tracking-wider">
                  Last Upload
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-theme-muted uppercase tracking-wider">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="table-divide">
              {organizations.map((org) => (
                <tr
                  key={org.id}
                  onClick={() => navigate(`/platform-admin/clients/${org.id}`)}
                  className="hover:bg-white/5 transition cursor-pointer"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-blue flex items-center justify-center text-white font-semibold">
                        {org.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <span className="font-semibold text-theme-text">{org.name}</span>
                        {org.created_by_platform_admin && (
                          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-md bg-gradient-teal text-white text-xs font-semibold">
                            Platform
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-theme-text">
                    {org.member_count}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-theme-text font-semibold">
                    ${org.total_revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-theme-muted text-sm">
                    {org.last_upload_date ? format(new Date(org.last_upload_date), 'MMM dd, yyyy') : 'Never'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-theme-muted text-sm">
                    {format(new Date(org.created_at), 'MMM dd, yyyy')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-card rounded-2xl p-6 glow-hover-teal">
          <div className="flex items-center gap-3 mb-4">
            <div className="rounded-xl p-2 bg-gradient-teal shadow-glow-teal">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-theme-text">Quick Actions</h3>
          </div>
          <div className="space-y-3">
            <button
              onClick={() => setShowCreateModal(true)}
              className="w-full px-4 py-3 bg-gradient-blue text-white rounded-xl font-semibold hover:shadow-glow-blue transition text-left flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Create New Brand
            </button>
            <button
              onClick={() => navigate('/platform-admin/invite-brand')}
              className="w-full px-4 py-3 glass hover:bg-white/10 text-theme-text rounded-xl font-semibold transition text-left"
            >
              Invite New Brand
            </button>
            <button
              onClick={() => navigate('/platform-admin/clients')}
              className="w-full px-4 py-3 glass hover:bg-white/10 text-theme-text rounded-xl font-semibold transition text-left"
            >
              Manage All Clients
            </button>
            <button
              onClick={() => navigate('/platform-admin/global-distributors')}
              className="w-full px-4 py-3 glass hover:bg-white/10 text-theme-text rounded-xl font-semibold transition text-left"
            >
              Manage Global Distributors
            </button>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-6 glow-hover-purple">
          <div className="flex items-center gap-3 mb-4">
            <div className="rounded-xl p-2 bg-gradient-orange">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-theme-text">Platform Health</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-theme-muted">Active Clients</span>
              <span className="text-lg font-semibold text-theme-text">{stats.totalOrganizations}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-theme-muted">Total Users</span>
              <span className="text-lg font-semibold text-theme-text">{stats.totalUsers}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-theme-muted">Recent Uploads</span>
              <span className="text-lg font-semibold text-theme-text">{stats.recentUploads}</span>
            </div>
          </div>
        </div>
      </div>

      <CreateBrandModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleCreateSuccess}
      />
    </div>
  );
}
