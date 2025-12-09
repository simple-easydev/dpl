import { useState, useEffect, useRef } from 'react';
import { useOrganization } from '../contexts/OrganizationContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  createInvitation,
  getOrganizationInvitations,
  revokeInvitation,
  resendInvitation,
} from '../lib/invitationService';
import { getAuditLogs, logAuditEvent } from '../lib/auditLog';
import {
  uploadOrganizationLogo,
  deleteOrganizationLogo,
} from '../lib/logoService';
import {
  Building2,
  Users,
  Mail,
  Shield,
  AlertTriangle,
  Key,
  FileText,
  Send,
  Trash2,
  XCircle,
  CheckCircle,
  Clock,
  RefreshCw,
  MailCheck,
  MailX,
  Code,
  Upload as UploadIcon,
  Image as ImageIcon,
} from 'lucide-react';

interface Member {
  id: string;
  user_id: string;
  role: 'admin' | 'member' | 'viewer';
  joined_at: string;
  email?: string;
}

export default function SettingsPage() {
  const { currentOrganization, refreshLogo } = useOrganization();
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'member' | 'viewer'>('member');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [savingApiKey, setSavingApiKey] = useState(false);
  const [testingApiKey, setTestingApiKey] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'organization' | 'team' | 'api' | 'security'>(
    'organization'
  );
  const [autoMergeThreshold, setAutoMergeThreshold] = useState(0.90);
  const [savingDuplicateSettings, setSavingDuplicateSettings] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [deletingLogo, setDeletingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentOrganization) {
      fetchMembers();
      fetchInvitations();
      fetchAuditLogs();
      loadApiKey();
      loadDuplicateSettings();
      loadLogo();
    }
  }, [currentOrganization]);

  const loadDuplicateSettings = async () => {
    if (!currentOrganization) return;

    const { data } = await supabase
      .from('organizations')
      .select('auto_merge_threshold')
      .eq('id', currentOrganization.id)
      .single();

    if (data?.auto_merge_threshold) {
      setAutoMergeThreshold(data.auto_merge_threshold);
    }
  };

  const saveDuplicateSettings = async () => {
    if (!currentOrganization || !user) return;

    setSavingDuplicateSettings(true);

    try {
      const { error } = await supabase
        .from('organizations')
        .update({ auto_merge_threshold: autoMergeThreshold })
        .eq('id', currentOrganization.id);

      if (error) throw error;

      await logAuditEvent(
        currentOrganization.id,
        user.id,
        'settings_updated',
        'duplicate_detection',
        { auto_merge_threshold: autoMergeThreshold }
      );

      setMessage({ type: 'success', text: 'Duplicate detection settings saved successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save settings. Please try again.' });
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setSavingDuplicateSettings(false);
    }
  };

  const fetchMembers = async () => {
    if (!currentOrganization) return;

    const { data, error } = await supabase
      .from('organization_members')
      .select('*')
      .eq('organization_id', currentOrganization.id);

    if (!error && data) {
      const userIds = data.map(m => m.user_id);

      const { data: userEmails, error: emailError } = await supabase
        .rpc('get_user_emails', { user_ids: userIds });

      if (!emailError && userEmails) {
        const emailMap = new Map(userEmails.map(u => [u.id, u.email]));
        const membersWithEmails = data.map(member => ({
          ...member,
          email: emailMap.get(member.user_id),
        }));
        setMembers(membersWithEmails);
      } else {
        setMembers(data);
      }
    }
  };

  const fetchInvitations = async () => {
    if (!currentOrganization) return;

    const { data } = await getOrganizationInvitations(currentOrganization.id);
    setInvitations(data);
  };

  const fetchAuditLogs = async () => {
    if (!currentOrganization) return;

    const logs = await getAuditLogs(currentOrganization.id, 20);
    setAuditLogs(logs);
  };

  const loadApiKey = async () => {
    if (!currentOrganization) return;

    const { data } = await supabase
      .from('organizations')
      .select('openai_api_key_encrypted')
      .eq('id', currentOrganization.id)
      .maybeSingle();

    if (data?.openai_api_key_encrypted) {
      setApiKey('********************');
    }
  };

  const loadLogo = async () => {
    if (!currentOrganization) return;

    const { data } = await supabase
      .from('organizations')
      .select('logo_url')
      .eq('id', currentOrganization.id)
      .maybeSingle();

    if (data?.logo_url) {
      setLogoUrl(data.logo_url);
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !currentOrganization || !user) return;

    setUploadingLogo(true);
    setMessage(null);

    const result = await uploadOrganizationLogo(currentOrganization.id, file);

    if (result.success && result.logoUrl) {
      setLogoUrl(result.logoUrl);
      setMessage({ type: 'success', text: 'Logo uploaded successfully!' });
      await logAuditEvent(
        currentOrganization.id,
        user.id,
        'upload_logo',
        'organization',
        { logo_url: result.logoUrl }
      );
      await refreshLogo();
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to upload logo' });
    }

    setUploadingLogo(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleLogoDelete = async () => {
    if (!currentOrganization || !user) return;

    setDeletingLogo(true);
    setMessage(null);

    const result = await deleteOrganizationLogo(currentOrganization.id);

    if (result.success) {
      setLogoUrl(null);
      setMessage({ type: 'success', text: 'Logo removed successfully!' });
      await logAuditEvent(
        currentOrganization.id,
        user.id,
        'delete_logo',
        'organization',
        {}
      );
      await refreshLogo();
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to remove logo' });
    }

    setDeletingLogo(false);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrganization) return;

    setLoading(true);
    setMessage(null);

    const { error } = await createInvitation({
      organizationId: currentOrganization.id,
      email: inviteEmail,
      role: inviteRole,
    });

    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setMessage({ type: 'success', text: 'Invitation sent successfully' });
      setInviteEmail('');
      fetchInvitations();
    }

    setLoading(false);
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    if (!currentOrganization) return;

    await revokeInvitation(invitationId, currentOrganization.id);
    fetchInvitations();
    setMessage({ type: 'success', text: 'Invitation revoked' });
  };

  const handleResendInvitation = async (invitationId: string) => {
    if (!currentOrganization) return;

    const { error } = await resendInvitation(invitationId, currentOrganization.id);

    if (error) {
      setMessage({ type: 'error', text: 'Failed to resend invitation' });
    } else {
      setMessage({ type: 'success', text: 'Invitation resent' });
      fetchInvitations();
    }
  };

  const handleSaveApiKey = async () => {
    if (!currentOrganization || !apiKey || apiKey === '********************') return;

    setSavingApiKey(true);
    setMessage(null);

    const { error } = await supabase
      .from('organizations')
      .update({ openai_api_key_encrypted: apiKey })
      .eq('id', currentOrganization.id);

    if (error) {
      setMessage({ type: 'error', text: 'Failed to save API key' });
    } else {
      setMessage({ type: 'success', text: 'API key saved successfully' });
      await logAuditEvent({
        organizationId: currentOrganization.id,
        action: 'update_api_key',
        resourceType: 'api_key',
        metadata: { action: 'saved' },
      });
      setApiKey('********************');
      setApiKeyVisible(false);
    }

    setSavingApiKey(false);
  };

  const handleDeleteApiKey = async () => {
    if (!currentOrganization) return;

    const { error } = await supabase
      .from('organizations')
      .update({ openai_api_key_encrypted: null })
      .eq('id', currentOrganization.id);

    if (error) {
      setMessage({ type: 'error', text: 'Failed to delete API key' });
    } else {
      setMessage({ type: 'success', text: 'API key deleted' });
      await logAuditEvent({
        organizationId: currentOrganization.id,
        action: 'delete_api_key',
        resourceType: 'api_key',
        metadata: { action: 'deleted' },
      });
      setApiKey('');
    }
  };

  const handleTestApiKey = async () => {
    if (!apiKey || apiKey === '********************') {
      setMessage({ type: 'error', text: 'Please enter a new API key to test' });
      return;
    }

    setTestingApiKey(true);
    setMessage(null);

    try {
      const OpenAI = (await import('openai')).default;
      const client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

      await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 5,
      });

      setMessage({ type: 'success', text: 'API key is valid' });
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: `API key test failed: ${err.message || 'Unknown error'}`,
      });
    }

    setTestingApiKey(false);
  };

  const handleDeleteAllData = async () => {
    if (deleteConfirmText !== 'DELETE' || !currentOrganization) {
      setMessage({ type: 'error', text: 'Please type DELETE to confirm' });
      return;
    }

    setDeleteLoading(true);
    setMessage(null);

    try {
      await supabase.from('sales_data').delete().eq('organization_id', currentOrganization.id);
      await supabase.from('accounts').delete().eq('organization_id', currentOrganization.id);
      await supabase.from('products').delete().eq('organization_id', currentOrganization.id);

      await logAuditEvent({
        organizationId: currentOrganization.id,
        action: 'delete_data',
        resourceType: 'sales_data',
        metadata: { action: 'deleted_all' },
      });

      setMessage({ type: 'success', text: 'All sales data deleted successfully' });
      setShowDeleteConfirm(false);
      setDeleteConfirmText('');
    } catch (error) {
      setMessage({ type: 'error', text: `Failed to delete data: ${(error as Error).message}` });
    } finally {
      setDeleteLoading(false);
    }
  };

  const userMember = members.find((m) => m.user_id === user?.id);
  const isAdmin = userMember?.role === 'admin';

  const inviteUrl = `${window.location.origin}/accept-invite?token=`;

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Settings</h1>

      <div className="mb-6 border-b border-gray-200 dark:border-white/10">
        <nav className="flex gap-6">
          {['organization', 'team', 'api', 'security'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`pb-3 px-1 border-b-2 font-medium transition capitalize ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
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

      <div className="space-y-6">
        {activeTab === 'organization' && (
          <>
            <div className="glass-card rounded-xl shadow-sm border border-gray-200 dark:border-white/10 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-blue-100 rounded-lg p-2">
                  <Building2 className="w-5 h-5 text-blue-600" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Organization</h2>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-600 dark:text-zinc-400">
                    Organization Name
                  </label>
                  <p className="text-gray-900 dark:text-white mt-1">{currentOrganization?.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 dark:text-zinc-400">Your Role</label>
                  <p className="text-gray-900 dark:text-white mt-1 capitalize">{userMember?.role}</p>
                </div>
              </div>
            </div>

            {isAdmin && (
              <div className="glass-card rounded-xl shadow-sm border border-gray-200 dark:border-white/10 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-green-100 rounded-lg p-2">
                    <ImageIcon className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Company Logo</h2>
                    <p className="text-sm text-gray-600 dark:text-zinc-400">Upload your company logo to personalize your experience</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-6">
                    <div className="w-24 h-24 rounded-xl border-2 border-gray-200 dark:border-white/10 flex items-center justify-center bg-gray-50 dark:bg-white/5 overflow-hidden">
                      {logoUrl ? (
                        <img
                          src={logoUrl}
                          alt="Organization logo"
                          className="w-full h-full object-contain p-2"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.parentElement!.innerHTML = `<div class="w-16 h-16 rounded-full bg-gradient-blue flex items-center justify-center"><span class="text-white font-semibold text-2xl">${currentOrganization?.name.charAt(0).toUpperCase()}</span></div>`;
                          }}
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-gradient-blue flex items-center justify-center">
                          <span className="text-white font-semibold text-2xl">
                            {currentOrganization?.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 space-y-3">
                      <div className="flex gap-3">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                          onChange={handleLogoUpload}
                          className="hidden"
                        />
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingLogo}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50"
                        >
                          <UploadIcon className="w-4 h-4" />
                          {uploadingLogo ? 'Uploading...' : logoUrl ? 'Change Logo' : 'Upload Logo'}
                        </button>
                        {logoUrl && (
                          <button
                            onClick={handleLogoDelete}
                            disabled={deletingLogo}
                            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition disabled:opacity-50"
                          >
                            <Trash2 className="w-4 h-4" />
                            {deletingLogo ? 'Removing...' : 'Remove Logo'}
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-zinc-500">
                        Accepted formats: PNG, JPG, SVG. Maximum size: 2MB.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {isAdmin && (
              <div className="glass-card rounded-xl shadow-sm border border-gray-200 dark:border-white/10 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-purple-100 rounded-lg p-2">
                    <Code className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Duplicate Detection</h2>
                    <p className="text-sm text-gray-600 dark:text-zinc-400">Configure AI-powered product duplicate detection</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600 dark:text-zinc-400 mb-2 block">
                      Auto-Merge Confidence Threshold
                    </label>
                    <p className="text-sm text-gray-500 dark:text-zinc-500 mb-3">
                      Products with similarity above this threshold will be automatically merged during upload.
                      Lower values increase automation but may merge incorrectly. Higher values are more conservative.
                    </p>
                    <div className="flex items-center gap-4">
                      <input
                        type="range"
                        min="0.80"
                        max="0.95"
                        step="0.01"
                        value={autoMergeThreshold}
                        onChange={(e) => setAutoMergeThreshold(parseFloat(e.target.value))}
                        className="flex-1 h-2 bg-gray-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer slider"
                      />
                      <div className="flex items-center gap-2">
                        <span className={`text-lg font-semibold px-3 py-1 rounded-lg ${
                          autoMergeThreshold >= 0.92 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                          autoMergeThreshold >= 0.87 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' :
                          'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
                        }`}>
                          {(autoMergeThreshold * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 dark:text-zinc-500 mt-2">
                      <span>80% - Aggressive</span>
                      <span>87% - Balanced</span>
                      <span>95% - Conservative</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-200 dark:border-white/10">
                    <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg mb-4">
                      <AlertTriangle className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-blue-800 dark:text-blue-300">
                        <p className="font-semibold mb-1">How it works:</p>
                        <ul className="list-disc list-inside space-y-1 text-blue-700 dark:text-blue-400">
                          <li>AI analyzes product names for duplicates during upload</li>
                          <li>High-confidence matches are automatically merged using this threshold</li>
                          <li>Lower-confidence matches require manual review</li>
                          <li>Previously confirmed matches are always auto-applied</li>
                        </ul>
                      </div>
                    </div>

                    <button
                      onClick={saveDuplicateSettings}
                      disabled={savingDuplicateSettings}
                      className="btn-primary"
                    >
                      {savingDuplicateSettings ? 'Saving...' : 'Save Settings'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'team' && isAdmin && (
          <>
            <div className="glass-card rounded-xl shadow-sm border border-gray-200 dark:border-white/10 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-green-100 rounded-lg p-2">
                  <Users className="w-5 h-5 text-green-600" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Invite Team Member
                </h2>
              </div>

              <form onSubmit={handleInvite} className="flex gap-3">
                <input
                  type="email"
                  placeholder="Email address"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                  className="flex-1 px-4 py-2 border border-slate-300 dark:border-white/20 rounded-lg bg-white dark:bg-white/5 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as 'member' | 'viewer')}
                  className="px-4 py-2 border border-slate-300 dark:border-white/20 rounded-lg bg-white dark:bg-white/5 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  <option value="member">Member</option>
                  <option value="viewer">Viewer</option>
                </select>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50 flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Invite
                </button>
              </form>
            </div>

            {invitations.length > 0 && (
              <div className="glass-card rounded-xl shadow-sm border border-gray-200 dark:border-white/10 p-6">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                  Pending Invitations
                </h3>
                <div className="space-y-3">
                  {invitations
                    .filter((inv) => inv.status === 'pending')
                    .map((invitation) => (
                      <div
                        key={invitation.id}
                        className="flex items-center justify-between p-3 glass-card dark:glass rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          {invitation.email_sent ? (
                            <MailCheck className="w-4 h-4 text-green-500" />
                          ) : (
                            <MailX className="w-4 h-4 text-orange-500" />
                          )}
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{invitation.email}</p>
                            <p className="text-sm text-gray-600 dark:text-zinc-400 capitalize">
                              {invitation.role} • {invitation.email_sent ? 'Email sent' : 'Email pending'}
                              {invitation.email_sent_at && (
                                <span> • {new Date(invitation.email_sent_at).toLocaleDateString()}</span>
                              )}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-zinc-500">
                              Expires {new Date(invitation.expires_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleResendInvitation(invitation.id)}
                            className="p-2 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 rounded-lg transition"
                            title="Resend"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleRevokeInvitation(invitation.id)}
                            className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 rounded-lg transition"
                            title="Revoke"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            <div className="glass-card rounded-xl shadow-sm border border-gray-200 dark:border-white/10 p-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Team Members</h3>
              <div className="space-y-3">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 glass-card dark:glass rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-100 rounded-full p-2">
                        <Mail className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{member.email || 'Unknown'}</p>
                        <p className="text-sm text-gray-600 dark:text-zinc-400 capitalize">{member.role}</p>
                      </div>
                    </div>
                    {member.user_id === user?.id && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">You</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {activeTab === 'api' && isAdmin && (
          <div className="glass-card rounded-xl shadow-sm border border-gray-200 dark:border-white/10 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-orange-100 rounded-lg p-2">
                <Key className="w-5 h-5 text-orange-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">OpenAI API Key</h2>
            </div>
            <p className="text-sm text-gray-600 dark:text-zinc-400 mb-4">
              Configure your OpenAI API key to enable AI features like column detection and insights.
            </p>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-zinc-400 block mb-2">
                  API Key
                </label>
                <input
                  type={apiKeyVisible ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full px-4 py-2 border border-slate-300 dark:border-white/20 rounded-lg bg-white dark:bg-white/5 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setApiKeyVisible(!apiKeyVisible)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-gray-700 dark:text-white rounded-lg transition"
                >
                  {apiKeyVisible ? 'Hide' : 'Show'}
                </button>
                <button
                  onClick={handleTestApiKey}
                  disabled={testingApiKey || !apiKey || apiKey === '********************'}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50"
                >
                  {testingApiKey ? 'Testing...' : 'Test Key'}
                </button>
                <button
                  onClick={handleSaveApiKey}
                  disabled={savingApiKey || !apiKey || apiKey === '********************'}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition disabled:opacity-50"
                >
                  {savingApiKey ? 'Saving...' : 'Save Key'}
                </button>
                {apiKey && apiKey !== '********************' && (
                  <button
                    onClick={handleDeleteApiKey}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
                  >
                    Delete Key
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'security' && isAdmin && (
          <>
            <div className="glass-card rounded-xl shadow-sm border border-gray-200 dark:border-white/10 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-blue-100 rounded-lg p-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Activity Log</h2>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {auditLogs.map((log) => (
                  <div key={log.id} className="p-3 glass-card dark:glass rounded-lg text-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-medium text-gray-900 dark:text-white capitalize">
                          {log.action.replace(/_/g, ' ')}
                        </span>
                        <span className="text-gray-600 dark:text-zinc-400"> • {log.resource_type}</span>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-zinc-500">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-card rounded-xl shadow-sm border border-red-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-red-100 rounded-lg p-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Danger Zone</h2>
              </div>
              <p className="text-sm text-gray-600 dark:text-zinc-400 mb-4">
                Delete all sales data, accounts, and products. This action cannot be undone.
              </p>

              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
                >
                  Delete All Sales Data
                </button>
              ) : (
                <div className="space-y-4 p-4 bg-red-50 rounded-lg border border-red-200">
                  <p className="text-sm font-medium text-red-900">
                    Are you sure? This will permanently delete all sales data.
                  </p>
                  <p className="text-sm text-red-700">
                    Type <span className="font-mono font-bold">DELETE</span> to confirm:
                  </p>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="Type DELETE"
                    className="w-full px-4 py-2 border border-red-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={handleDeleteAllData}
                      disabled={deleteLoading || deleteConfirmText !== 'DELETE'}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition disabled:opacity-50"
                    >
                      {deleteLoading ? 'Deleting...' : 'Confirm Delete'}
                    </button>
                    <button
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setDeleteConfirmText('');
                      }}
                      disabled={deleteLoading}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-gray-700 dark:text-white rounded-lg transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
