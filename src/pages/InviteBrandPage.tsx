import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  createBrandInvitation,
  createBulkBrandInvitations,
  getBrandInvitations,
  revokeBrandInvitation,
  BrandInvitation,
} from '../lib/platformAdminService';
import { Mail, Send, ArrowLeft, XCircle, CheckCircle, Clock, AlertCircle, Users, Upload, Download, FileText, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import Papa from 'papaparse';

interface BulkInviteEntry {
  email: string;
  companyName: string;
  id: string;
}

export default function InviteBrandPage() {
  const navigate = useNavigate();
  const { isPlatformAdmin } = useAuth();
  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  const [email, setEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [bulkEntries, setBulkEntries] = useState<BulkInviteEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [invitations, setInvitations] = useState<BrandInvitation[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isPlatformAdmin) {
      navigate('/dashboard');
      return;
    }

    fetchInvitations();
  }, [isPlatformAdmin, navigate]);

  const fetchInvitations = async () => {
    const data = await getBrandInvitations();
    setInvitations(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const { data, error } = await createBrandInvitation({
      email,
      companyName,
      welcomeMessage: welcomeMessage || undefined,
    });

    if (error) {
      setMessage({ type: 'error', text: error.message || 'Failed to send invitation' });
    } else {
      setMessage({ type: 'success', text: 'Brand invitation sent successfully!' });
      setEmail('');
      setCompanyName('');
      setWelcomeMessage('');
      fetchInvitations();
    }

    setLoading(false);
  };

  const parseBulkText = () => {
    const lines = bulkText.split('\n').filter(line => line.trim());
    const entries: BulkInviteEntry[] = [];

    for (const line of lines) {
      const parts = line.split(',').map(p => p.trim());
      if (parts.length >= 2) {
        const email = parts[0];
        const companyName = parts[1];

        if (email && companyName && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          entries.push({
            id: Math.random().toString(36).substr(2, 9),
            email,
            companyName,
          });
        }
      }
    }

    setBulkEntries(entries);
    if (entries.length === 0) {
      setMessage({ type: 'error', text: 'No valid entries found. Format: email, Company Name' });
    } else {
      setMessage({ type: 'success', text: `Parsed ${entries.length} valid entries` });
    }
  };

  const handleCSVUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      complete: (results: any) => {
        const entries: BulkInviteEntry[] = [];

        for (const row of results.data) {
          const email = row.email || row.Email;
          const companyName = row.company_name || row.companyName || row['Company Name'];

          if (email && companyName && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            entries.push({
              id: Math.random().toString(36).substr(2, 9),
              email: email.trim(),
              companyName: companyName.trim(),
            });
          }
        }

        setBulkEntries(entries);
        if (entries.length === 0) {
          setMessage({ type: 'error', text: 'No valid entries found in CSV' });
        } else {
          setMessage({ type: 'success', text: `Loaded ${entries.length} entries from CSV` });
        }
      },
      error: (error: any) => {
        setMessage({ type: 'error', text: `CSV parsing error: ${error.message}` });
      },
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const downloadCSVTemplate = () => {
    const csv = 'email,company_name\nadmin@example.com,Example Corp\nuser@company.com,Another Company';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'brand-invitations-template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const removeBulkEntry = (id: string) => {
    setBulkEntries(bulkEntries.filter(entry => entry.id !== id));
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (bulkEntries.length === 0) {
      setMessage({ type: 'error', text: 'No entries to send. Please add invitations first.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    const { data, error } = await createBulkBrandInvitations({
      invitations: bulkEntries,
      welcomeMessage: welcomeMessage || undefined,
    });

    if (error) {
      setMessage({ type: 'error', text: error.message || 'Failed to send invitations' });
    } else {
      const successCount = data?.successCount || 0;
      const failCount = data?.failCount || 0;

      if (failCount > 0) {
        setMessage({
          type: 'error',
          text: `Sent ${successCount} invitations successfully. ${failCount} failed.`
        });
      } else {
        setMessage({ type: 'success', text: `Successfully sent ${successCount} invitations!` });
      }

      setBulkText('');
      setBulkEntries([]);
      fetchInvitations();
    }

    setLoading(false);
  };

  const handleRevoke = async (invitationId: string) => {
    const { error } = await revokeBrandInvitation(invitationId);

    if (error) {
      setMessage({ type: 'error', text: 'Failed to revoke invitation' });
    } else {
      setMessage({ type: 'success', text: 'Invitation revoked successfully' });
      fetchInvitations();
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'accepted':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'expired':
        return <Clock className="w-4 h-4 text-gray-400" />;
      case 'revoked':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted':
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
      case 'expired':
        return 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-400';
      case 'revoked':
        return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
      default:
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400';
    }
  };

  const filteredInvitations = invitations.filter(invitation => {
    const matchesSearch =
      invitation.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invitation.company_name.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || invitation.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const invitationStats = {
    pending: invitations.filter(i => i.status === 'pending').length,
    accepted: invitations.filter(i => i.status === 'accepted').length,
    expired: invitations.filter(i => i.status === 'expired').length,
    revoked: invitations.filter(i => i.status === 'revoked').length,
  };

  return (
    <div>
      <div className="mb-8">
        <button
          onClick={() => navigate('/platform-admin')}
          className="flex items-center gap-2 text-theme-muted hover:text-theme-text transition mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>

        <h1 className="text-3xl font-semibold text-theme-text">Invite Brands</h1>
        <p className="text-theme-muted mt-1">Send invitations to onboard new client organizations</p>
      </div>

      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => setMode('single')}
          className={`px-6 py-3 rounded-xl font-semibold transition flex items-center gap-2 ${
            mode === 'single'
              ? 'bg-gradient-blue text-white shadow-glow-blue'
              : 'glass text-theme-text hover:bg-white/10'
          }`}
        >
          <Mail className="w-4 h-4" />
          Single Invite
        </button>
        <button
          onClick={() => setMode('bulk')}
          className={`px-6 py-3 rounded-xl font-semibold transition flex items-center gap-2 ${
            mode === 'bulk'
              ? 'bg-gradient-blue text-white shadow-glow-blue'
              : 'glass text-theme-text hover:bg-white/10'
          }`}
        >
          <Users className="w-4 h-4" />
          Bulk Invite
        </button>
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

      {mode === 'single' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="glass-card rounded-2xl p-6 glow-hover-blue">
            <div className="flex items-center gap-3 mb-6">
              <div className="rounded-xl p-2 bg-gradient-blue shadow-glow-blue">
                <Mail className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-lg font-semibold text-theme-text">Create Invitation</h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-theme-text mb-2">
                Company Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
                placeholder="Acme Corporation"
                className="w-full px-4 py-2.5 glass rounded-xl text-theme-text placeholder:text-theme-muted/60 focus-ring"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-theme-text mb-2">
                Admin Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="admin@company.com"
                className="w-full px-4 py-2.5 glass rounded-xl text-theme-text placeholder:text-theme-muted/60 focus-ring"
              />
              <p className="text-xs text-theme-muted mt-1">
                This person will become the organization admin
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-theme-text mb-2">
                Welcome Message (Optional)
              </label>
              <textarea
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                placeholder="Welcome to our platform! We're excited to have you on board..."
                rows={4}
                className="w-full px-4 py-2.5 glass rounded-xl text-theme-text placeholder:text-theme-muted/60 focus-ring resize-none"
              />
              <p className="text-xs text-theme-muted mt-1">
                Optional personalized message included in the invitation email
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              {loading ? 'Sending...' : 'Send Invitation'}
            </button>
          </form>
        </div>

          <div className="glass-card rounded-2xl p-6 glow-hover-teal">
          <h2 className="text-lg font-semibold text-theme-text mb-4">Invitation Instructions</h2>
          <div className="space-y-4 text-sm text-theme-muted">
            <div className="p-3 glass rounded-lg">
              <h3 className="font-semibold text-theme-text mb-2">1. Enter Company Details</h3>
              <p>Provide the brand name and admin email address</p>
            </div>

            <div className="p-3 glass rounded-lg">
              <h3 className="font-semibold text-theme-text mb-2">2. Invitation Sent</h3>
              <p>The recipient will receive an email with a unique invitation link</p>
            </div>

            <div className="p-3 glass rounded-lg">
              <h3 className="font-semibold text-theme-text mb-2">3. Account Creation</h3>
              <p>They'll create their account and automatically become the organization admin</p>
            </div>

            <div className="p-3 glass rounded-lg">
              <h3 className="font-semibold text-theme-text mb-2">4. Organization Ready</h3>
              <p>The new organization is created and ready to use</p>
            </div>

            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-blue-800 dark:text-blue-300">
                <strong>Note:</strong> Invitations expire after 7 days and can be revoked at any time.
              </p>
            </div>
          </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6 mb-8">
          <div className="glass-card rounded-2xl p-6 glow-hover-blue">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="rounded-xl p-2 bg-gradient-blue shadow-glow-blue">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-lg font-semibold text-theme-text">Bulk Invitations</h2>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={downloadCSVTemplate}
                  className="flex items-center gap-2 px-4 py-2 glass hover:bg-white/10 text-theme-text rounded-xl transition font-medium"
                >
                  <Download className="w-4 h-4" />
                  CSV Template
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleCSVUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 glass hover:bg-white/10 text-theme-text rounded-xl transition font-medium"
                >
                  <Upload className="w-4 h-4" />
                  Upload CSV
                </button>
              </div>
            </div>

            <form onSubmit={handleBulkSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-theme-text mb-2">
                  Enter Invitations
                </label>
                <textarea
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder="Format: email, Company Name&#10;Example:&#10;admin@company1.com, Company One&#10;user@company2.com, Company Two"
                  rows={6}
                  className="w-full px-4 py-2.5 glass rounded-xl text-theme-text placeholder:text-theme-muted/60 focus-ring resize-none font-mono text-sm"
                />
                <p className="text-xs text-theme-muted mt-1">
                  Enter one invitation per line in format: email, Company Name
                </p>
              </div>

              <button
                type="button"
                onClick={parseBulkText}
                className="w-full px-4 py-2.5 glass hover:bg-white/10 text-theme-text rounded-xl transition font-medium"
              >
                <FileText className="w-4 h-4 inline mr-2" />
                Parse Entries
              </button>

              {bulkEntries.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-theme-text mb-2">
                    Preview ({bulkEntries.length} entries)
                  </label>
                  <div className="glass rounded-xl p-4 max-h-64 overflow-y-auto space-y-2">
                    {bulkEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between p-3 glass-card rounded-lg"
                      >
                        <div className="flex-1">
                          <p className="text-theme-text font-medium">{entry.companyName}</p>
                          <p className="text-theme-muted text-sm">{entry.email}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeBulkEntry(entry.id)}
                          className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 rounded-lg transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-theme-text mb-2">
                  Welcome Message (Optional)
                </label>
                <textarea
                  value={welcomeMessage}
                  onChange={(e) => setWelcomeMessage(e.target.value)}
                  placeholder="This message will be sent to all invited brands..."
                  rows={4}
                  className="w-full px-4 py-2.5 glass rounded-xl text-theme-text placeholder:text-theme-muted/60 focus-ring resize-none"
                />
                <p className="text-xs text-theme-muted mt-1">
                  This welcome message will be included in all invitation emails
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || bulkEntries.length === 0}
                className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {loading ? 'Sending...' : `Send ${bulkEntries.length} Invitations`}
              </button>
            </form>
          </div>

          <div className="glass-card rounded-2xl p-6 glow-hover-teal">
            <h2 className="text-lg font-semibold text-theme-text mb-4">Bulk Import Instructions</h2>
            <div className="space-y-4 text-sm text-theme-muted">
              <div className="p-3 glass rounded-lg">
                <h3 className="font-semibold text-theme-text mb-2">1. Prepare Your Data</h3>
                <p>Format: email, Company Name (one per line) or use CSV upload</p>
              </div>

              <div className="p-3 glass rounded-lg">
                <h3 className="font-semibold text-theme-text mb-2">2. CSV Upload</h3>
                <p>Download the template, fill it out, and upload. Required columns: email, company_name</p>
              </div>

              <div className="p-3 glass rounded-lg">
                <h3 className="font-semibold text-theme-text mb-2">3. Preview & Edit</h3>
                <p>Review all entries before sending. Remove any incorrect entries.</p>
              </div>

              <div className="p-3 glass rounded-lg">
                <h3 className="font-semibold text-theme-text mb-2">4. Send Invitations</h3>
                <p>All invitations will include the same welcome message</p>
              </div>

              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-blue-800 dark:text-blue-300">
                  <strong>Tip:</strong> Each invitation is validated before sending. Invalid emails are automatically skipped.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="glass-card rounded-2xl glow-hover-purple">
        <div className="p-6 border-b table-border">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-theme-text">All Brand Invitations</h2>
              <p className="text-sm text-theme-muted mt-1">Track and manage sent invitations</p>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by email or company..."
                className="px-4 py-2 glass rounded-xl text-theme-text placeholder:text-theme-muted/60 focus-ring"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 glass rounded-xl text-theme-text focus-ring"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="accepted">Accepted</option>
                <option value="expired">Expired</option>
                <option value="revoked">Revoked</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div className="glass-card p-4 rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-yellow-500" />
                <span className="text-sm text-theme-muted">Pending</span>
              </div>
              <span className="text-2xl font-semibold text-theme-text">{invitationStats.pending}</span>
            </div>
            <div className="glass-card p-4 rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-sm text-theme-muted">Accepted</span>
              </div>
              <span className="text-2xl font-semibold text-theme-text">{invitationStats.accepted}</span>
            </div>
            <div className="glass-card p-4 rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-theme-muted">Expired</span>
              </div>
              <span className="text-2xl font-semibold text-theme-text">{invitationStats.expired}</span>
            </div>
            <div className="glass-card p-4 rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <XCircle className="w-4 h-4 text-red-500" />
                <span className="text-sm text-theme-muted">Revoked</span>
              </div>
              <span className="text-2xl font-semibold text-theme-text">{invitationStats.revoked}</span>
            </div>
          </div>
        </div>

        {filteredInvitations.length === 0 ? (
          <div className="p-8 text-center text-theme-muted">
            {invitations.length === 0 ? 'No invitations sent yet' : 'No invitations match your search'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b table-border">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-theme-muted uppercase tracking-wider">
                    Company
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-theme-muted uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-theme-muted uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-theme-muted uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-theme-muted uppercase tracking-wider">
                    Expires
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-theme-muted uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="table-divide">
                {filteredInvitations.map((invitation) => (
                  <tr key={invitation.id} className="hover:bg-white/5 transition">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-semibold text-theme-text">{invitation.company_name}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-theme-text">
                      {invitation.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(invitation.status)}
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-semibold capitalize ${getStatusColor(
                            invitation.status
                          )}`}
                        >
                          {invitation.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-theme-muted text-sm">
                      {format(new Date(invitation.created_at), 'MMM dd, yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-theme-muted text-sm">
                      {format(new Date(invitation.expires_at), 'MMM dd, yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {invitation.status === 'pending' && (
                        <button
                          onClick={() => handleRevoke(invitation.id)}
                          className="text-red-600 hover:text-red-700 text-sm font-medium"
                        >
                          Revoke
                        </button>
                      )}
                      {invitation.status === 'accepted' && invitation.organization_id && (
                        <button
                          onClick={() => navigate(`/platform-admin/clients/${invitation.organization_id}`)}
                          className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                        >
                          View Org
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
    </div>
  );
}
