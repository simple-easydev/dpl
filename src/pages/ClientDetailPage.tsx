import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useOrganization } from '../contexts/OrganizationContext';
import { getOrganizationDetails, updateOrganizationNotes } from '../lib/platformAdminService';
import {
  Building2,
  Users,
  DollarSign,
  Package,
  ShoppingCart,
  Upload,
  ArrowLeft,
  Save,
  Eye,
  FileText,
  Trash2,
} from 'lucide-react';
import { format } from 'date-fns';
import DeleteBrandModal from '../components/DeleteBrandModal';

export default function ClientDetailPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { isPlatformAdmin } = useAuth();
  const { setCurrentOrganization, organizations } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [details, setDetails] = useState<any>(null);
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    if (!isPlatformAdmin || !clientId) {
      navigate('/dashboard');
      return;
    }

    const fetchDetails = async () => {
      setLoading(true);
      try {
        const data = await getOrganizationDetails(clientId);
        setDetails(data);
        setNotes(data.organization.platform_admin_notes || '');
      } catch (error) {
        console.error('Error fetching client details:', error);
        setMessage({ type: 'error', text: 'Failed to load client details' });
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [isPlatformAdmin, clientId, navigate]);

  const handleSaveNotes = async () => {
    if (!clientId) return;

    setSaving(true);
    setMessage(null);

    const { error } = await updateOrganizationNotes(clientId, notes);

    if (error) {
      setMessage({ type: 'error', text: 'Failed to save notes' });
    } else {
      setMessage({ type: 'success', text: 'Notes saved successfully' });
      setTimeout(() => setMessage(null), 3000);
    }

    setSaving(false);
  };

  const handleViewAsClient = () => {
    const org = organizations.find((o) => o.id === clientId);
    if (org) {
      setCurrentOrganization(org);
      navigate('/dashboard');
    }
  };

  const handleDeleteSuccess = () => {
    setShowDeleteModal(false);
    setMessage({ type: 'success', text: 'Brand deleted successfully' });
    setTimeout(() => {
      navigate('/platform-admin/clients');
    }, 1500);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary"></div>
      </div>
    );
  }

  if (!details) {
    return (
      <div className="text-center text-theme-muted py-12">
        Client not found
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <button
          onClick={() => navigate('/platform-admin/clients')}
          className="flex items-center gap-2 text-theme-muted hover:text-theme-text transition mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Clients
        </button>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-blue flex items-center justify-center text-white font-semibold text-2xl shadow-glow-blue">
              {details.organization.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-3xl font-semibold text-theme-text">{details.organization.name}</h1>
              <p className="text-theme-muted">
                Created {format(new Date(details.organization.created_at), 'MMMM dd, yyyy')}
              </p>
            </div>
          </div>
          <button onClick={handleViewAsClient} className="btn-primary flex items-center gap-2">
            <Eye className="w-4 h-4" />
            View as Client
          </button>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div className="glass-card rounded-2xl p-6 glow-hover-blue">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-theme-muted uppercase tracking-wide">Team Members</span>
            <div className="rounded-xl p-2 bg-gradient-blue shadow-glow-blue">
              <Users className="w-5 h-5 text-white" />
            </div>
          </div>
          <span className="text-3xl font-semibold text-theme-text">{details.memberCount}</span>
          <p className="text-xs text-theme-muted mt-1">Active users</p>
        </div>

        <div className="glass-card rounded-2xl p-6 glow-hover-teal">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-theme-muted uppercase tracking-wide">Total Revenue</span>
            <div className="rounded-xl p-2 bg-gradient-teal shadow-glow-teal">
              <DollarSign className="w-5 h-5 text-white" />
            </div>
          </div>
          <span className="text-3xl font-semibold text-theme-text">
            ${details.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
          <p className="text-xs text-theme-muted mt-1">From {details.salesCount} sales</p>
        </div>

        <div className="glass-card rounded-2xl p-6 glow-hover-purple">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-theme-muted uppercase tracking-wide">Data Uploads</span>
            <div className="rounded-xl p-2 bg-gradient-orange">
              <Upload className="w-5 h-5 text-white" />
            </div>
          </div>
          <span className="text-3xl font-semibold text-theme-text">{details.uploadCount}</span>
          <p className="text-xs text-theme-muted mt-1">Total uploads</p>
        </div>

        <div className="glass-card rounded-2xl p-6 glow-hover-blue">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-theme-muted uppercase tracking-wide">Accounts</span>
            <div className="rounded-xl p-2 bg-gradient-blue shadow-glow-blue">
              <ShoppingCart className="w-5 h-5 text-white" />
            </div>
          </div>
          <span className="text-3xl font-semibold text-theme-text">{details.accountCount}</span>
          <p className="text-xs text-theme-muted mt-1">Unique customers</p>
        </div>

        <div className="glass-card rounded-2xl p-6 glow-hover-teal">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-theme-muted uppercase tracking-wide">Products</span>
            <div className="rounded-xl p-2 bg-gradient-teal shadow-glow-teal">
              <Package className="w-5 h-5 text-white" />
            </div>
          </div>
          <span className="text-3xl font-semibold text-theme-text">{details.productCount}</span>
          <p className="text-xs text-theme-muted mt-1">SKUs tracked</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="glass-card rounded-2xl p-6 glow-hover-blue">
          <div className="flex items-center gap-3 mb-4">
            <div className="rounded-xl p-2 bg-gradient-blue shadow-glow-blue">
              <Users className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-lg font-semibold text-theme-text">Team Members</h2>
          </div>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {details.members.map((member: any) => (
              <div key={member.id} className="flex items-center justify-between p-3 glass rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-teal flex items-center justify-center text-white text-sm font-semibold">
                    {member.user_id.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-theme-text">{member.user_id}</p>
                    <p className="text-xs text-theme-muted capitalize">{member.role}</p>
                  </div>
                </div>
                <span className="text-xs text-theme-muted">
                  Joined {format(new Date(member.joined_at), 'MMM yyyy')}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card rounded-2xl p-6 glow-hover-teal">
          <div className="flex items-center gap-3 mb-4">
            <div className="rounded-xl p-2 bg-gradient-teal shadow-glow-teal">
              <Upload className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-lg font-semibold text-theme-text">Recent Uploads</h2>
          </div>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {details.recentUploads.map((upload: any) => (
              <div key={upload.id} className="p-3 glass rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium text-theme-text truncate">{upload.filename}</p>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      upload.status === 'completed'
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                        : upload.status === 'failed'
                        ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                        : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                    }`}
                  >
                    {upload.status}
                  </span>
                </div>
                <p className="text-xs text-theme-muted">
                  {format(new Date(upload.created_at), 'MMM dd, yyyy h:mm a')}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="glass-card rounded-2xl p-6 glow-hover-purple mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="rounded-xl p-2 bg-gradient-orange">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-lg font-semibold text-theme-text">Platform Admin Notes</h2>
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add internal notes about this client..."
          rows={6}
          className="w-full px-4 py-3 glass rounded-xl text-theme-text placeholder:text-theme-muted/60 focus-ring resize-none mb-3"
        />
        <button
          onClick={handleSaveNotes}
          disabled={saving}
          className="btn-primary flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Notes'}
        </button>
      </div>

      <div className="glass-card rounded-2xl p-6 border-2 border-red-500/20">
        <div className="flex items-center gap-3 mb-4">
          <div className="rounded-xl p-2 bg-red-500/10 border border-red-500/20">
            <Trash2 className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-theme-text">Danger Zone</h2>
            <p className="text-sm text-theme-muted">Irreversible actions for this brand</p>
          </div>
        </div>

        <div className="p-4 glass rounded-xl flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-theme-text mb-1">Delete this brand</h3>
            <p className="text-xs text-theme-muted">
              Soft delete this brand. All data will be preserved and can be restored later.
            </p>
          </div>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold transition flex items-center gap-2 ml-4"
          >
            <Trash2 className="w-4 h-4" />
            Delete Brand
          </button>
        </div>
      </div>

      {clientId && (
        <DeleteBrandModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onSuccess={handleDeleteSuccess}
          brandId={clientId}
          brandName={details.organization.name}
          stats={{
            memberCount: details.memberCount,
            totalRevenue: details.totalRevenue,
            salesCount: details.salesCount,
            uploadCount: details.uploadCount,
            accountCount: details.accountCount,
            productCount: details.productCount,
          }}
        />
      )}
    </div>
  );
}
