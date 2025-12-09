import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getAllOrganizations, restoreOrganization, OrganizationWithStats } from '../lib/platformAdminService';
import { Building2, Search, TrendingUp, Users, DollarSign, Calendar, Plus, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import CreateBrandModal from '../components/CreateBrandModal';

export default function ClientsListPage() {
  const navigate = useNavigate();
  const { isPlatformAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [organizations, setOrganizations] = useState<OrganizationWithStats[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!isPlatformAdmin) {
      navigate('/dashboard');
      return;
    }

    fetchOrganizations();
  }, [isPlatformAdmin, navigate, showDeleted]);

  const fetchOrganizations = async () => {
    setLoading(true);
    try {
      const orgs = await getAllOrganizations(showDeleted);
      setOrganizations(orgs);
    } catch (error) {
      console.error('Error fetching organizations:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredOrganizations = organizations.filter((org) =>
    org.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateSuccess = (organizationId: string) => {
    setShowCreateModal(false);
    setMessage({ type: 'success', text: 'Brand created successfully!' });
    setTimeout(() => {
      setMessage(null);
      navigate(`/platform-admin/clients/${organizationId}`);
    }, 1500);
  };

  const handleRestore = async (e: React.MouseEvent, orgId: string) => {
    e.stopPropagation();
    const { error } = await restoreOrganization(orgId);
    if (error) {
      setMessage({ type: 'error', text: 'Failed to restore brand' });
    } else {
      setMessage({ type: 'success', text: 'Brand restored successfully' });
      fetchOrganizations();
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const totalRevenue = filteredOrganizations.reduce((sum, org) => sum + org.total_revenue, 0);
  const totalMembers = filteredOrganizations.reduce((sum, org) => sum + org.member_count, 0);

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
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-semibold text-theme-text">All Clients</h1>
            <p className="text-theme-muted mt-1">Manage and view all client organizations</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create Brand
            </button>
            <button
              onClick={() => navigate('/platform-admin/invite-brand')}
              className="px-4 py-2 glass hover:bg-white/10 text-theme-text rounded-xl font-semibold transition"
            >
              Invite Brand
            </button>
          </div>
        </div>
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="glass-card rounded-2xl p-6 glow-hover-blue">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-theme-muted uppercase tracking-wide">Total Clients</span>
            <div className="rounded-xl p-2 bg-gradient-blue shadow-glow-blue">
              <Building2 className="w-5 h-5 text-white" />
            </div>
          </div>
          <span className="text-3xl font-semibold text-theme-text">{filteredOrganizations.length}</span>
          <p className="text-xs text-theme-muted mt-1">Active organizations</p>
        </div>

        <div className="glass-card rounded-2xl p-6 glow-hover-teal">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-theme-muted uppercase tracking-wide">Total Members</span>
            <div className="rounded-xl p-2 bg-gradient-teal shadow-glow-teal">
              <Users className="w-5 h-5 text-white" />
            </div>
          </div>
          <span className="text-3xl font-semibold text-theme-text">{totalMembers}</span>
          <p className="text-xs text-theme-muted mt-1">Across all clients</p>
        </div>

        <div className="glass-card rounded-2xl p-6 glow-hover-purple">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-theme-muted uppercase tracking-wide">Combined Revenue</span>
            <div className="rounded-xl p-2 bg-gradient-orange">
              <DollarSign className="w-5 h-5 text-white" />
            </div>
          </div>
          <span className="text-3xl font-semibold text-theme-text">
            ${totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
          <p className="text-xs text-theme-muted mt-1">Total platform revenue</p>
        </div>
      </div>

      <div className="glass-card rounded-2xl glow-hover-blue">
        <div className="p-6 border-b table-border space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-theme-muted w-5 h-5" />
            <input
              type="text"
              placeholder="Search clients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 glass rounded-xl text-theme-text placeholder:text-theme-muted/60 focus-ring"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showDeleted}
                onChange={(e) => setShowDeleted(e.target.checked)}
                className="w-4 h-4 rounded border-2 border-theme-muted/30 bg-transparent checked:bg-gradient-blue checked:border-transparent focus:ring-2 focus:ring-accent-primary/50 cursor-pointer"
              />
              <span className="text-sm font-medium text-theme-text">Show deleted brands</span>
            </label>
          </div>
        </div>

        {filteredOrganizations.length === 0 ? (
          <div className="p-8 text-center text-theme-muted">
            {searchTerm ? 'No clients found matching your search.' : 'No clients available.'}
          </div>
        ) : (
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
                    Total Revenue
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-theme-muted uppercase tracking-wider">
                    Uploads
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-theme-muted uppercase tracking-wider">
                    Last Upload
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-theme-muted uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-theme-muted uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="table-divide">
                {filteredOrganizations.map((org) => (
                  <tr
                    key={org.id}
                    onClick={() => !org.deleted_at && navigate(`/platform-admin/clients/${org.id}`)}
                    className={`hover:bg-white/5 transition ${
                      org.deleted_at ? 'opacity-60' : 'cursor-pointer'
                    }`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-blue flex items-center justify-center text-white font-semibold shadow-glow-blue">
                          {org.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-theme-text">{org.name}</div>
                          <div className="flex items-center gap-2 mt-1">
                            {org.created_by_platform_admin && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gradient-teal text-white text-xs font-semibold">
                                Platform Created
                              </span>
                            )}
                            {org.deleted_at && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-semibold">
                                Deleted
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-theme-text">
                      <div className="flex items-center justify-end gap-1">
                        <Users className="w-4 h-4 text-theme-muted" />
                        {org.member_count}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-theme-text font-semibold">
                      ${org.total_revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-theme-text">
                      {org.upload_count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-theme-muted text-sm">
                      {org.last_upload_date ? format(new Date(org.last_upload_date), 'MMM dd, yyyy') : 'Never'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-theme-muted text-sm">
                      <div className="flex items-center justify-end gap-1">
                        <Calendar className="w-4 h-4" />
                        {format(new Date(org.created_at), 'MMM dd, yyyy')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {org.deleted_at && (
                        <button
                          onClick={(e) => handleRestore(e, org.id)}
                          className="px-3 py-1.5 bg-gradient-blue text-white rounded-lg text-xs font-semibold hover:shadow-glow-blue transition flex items-center gap-1.5 ml-auto"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Restore
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateBrandModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleCreateSuccess}
      />
    </div>
  );
}
