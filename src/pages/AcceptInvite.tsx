import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Building2, CheckCircle, XCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import AnimatedBackground from '../components/AnimatedBackground';

export default function AcceptInvite() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [invitationEmail, setInvitationEmail] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [invitedRole, setInvitedRole] = useState('');
  const [invitedBy, setInvitedBy] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [needsPasswordSetup, setNeedsPasswordSetup] = useState(false);
  const [authenticatedUserId, setAuthenticatedUserId] = useState<string | null>(null);

  useEffect(() => {
    handleInvitation();
  }, []);

  const parseUrlParameters = () => {
    const urlParams = new URLSearchParams(location.search);
    const hashParams = new URLSearchParams(location.hash.substring(1));

    console.log('[AcceptInvite] Parsing URL parameters');
    console.log('[AcceptInvite] Query params:', Object.fromEntries(urlParams.entries()));
    console.log('[AcceptInvite] Hash params:', Object.fromEntries(hashParams.entries()));

    const tokenHash = urlParams.get('token_hash') || hashParams.get('token_hash');
    const type = urlParams.get('type') || hashParams.get('type');
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');

    return { tokenHash, type, accessToken, refreshToken };
  };

  const handleInvitation = async () => {
    console.log('[AcceptInvite] Starting invitation handling');

    try {
      const { tokenHash, type, accessToken, refreshToken } = parseUrlParameters();

      console.log('[AcceptInvite] Parsed parameters:', {
        hasTokenHash: !!tokenHash,
        type,
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken
      });

      if (accessToken && refreshToken && type === 'invite') {
        console.log('[AcceptInvite] Found access token in URL hash, user was auto-authenticated by Supabase');

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('[AcceptInvite] Error getting session:', sessionError);
          setError('Failed to retrieve authentication session. Please try again.');
          setLoading(false);
          return;
        }

        if (!session || !session.user) {
          console.error('[AcceptInvite] No session found after auto-authentication');
          setError('Authentication failed. Please try clicking the invitation link again.');
          setLoading(false);
          return;
        }

        console.log('[AcceptInvite] Session found, user authenticated:', session.user.id);
        await processAuthenticatedUser(session.user);
        return;
      }

      if (type === 'invite' && tokenHash) {
        console.log('[AcceptInvite] Found token_hash in query params, attempting verifyOtp');

        const { data, error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: 'invite',
        });

        if (verifyError) {
          console.error('[AcceptInvite] verifyOtp error:', verifyError);

          if (verifyError.message.includes('expired')) {
            setError('This invitation link has expired. Please request a new invitation from your organization admin.');
          } else if (verifyError.message.includes('already been used')) {
            setError('This invitation has already been accepted. Please log in to access your account.');
          } else {
            setError(verifyError.message || 'Invalid or expired invitation link.');
          }
          setLoading(false);
          return;
        }

        if (!data.user) {
          console.error('[AcceptInvite] No user returned from verifyOtp');
          setError('Unable to process invitation. Please try again or contact support.');
          setLoading(false);
          return;
        }

        console.log('[AcceptInvite] verifyOtp successful, user:', data.user.id);
        await processAuthenticatedUser(data.user);
        return;
      }

      console.error('[AcceptInvite] Invalid URL parameters - no valid invitation tokens found');
      setError('Invalid invitation link. Please check the URL and try again.');
      setLoading(false);
    } catch (err: any) {
      console.error('[AcceptInvite] Unexpected error processing invitation:', err);
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  const processAuthenticatedUser = async (authenticatedUser: any) => {
    console.log('[AcceptInvite] Processing authenticated user:', authenticatedUser.id);
    console.log('[AcceptInvite] User metadata:', authenticatedUser.user_metadata);

    const metadata = authenticatedUser.user_metadata || {};
    const email = authenticatedUser.email || '';
    const orgId = metadata.organization_id || '';
    const orgName = metadata.organization_name || 'Unknown Organization';
    const role = metadata.role || 'member';
    const invitedByUserId = metadata.invited_by || '';

    setInvitationEmail(email);
    setOrganizationName(orgName);
    setOrganizationId(orgId);
    setInvitedRole(role);
    setInvitedBy(invitedByUserId);
    setAuthenticatedUserId(authenticatedUser.id);

    if (!orgId) {
      console.error('[AcceptInvite] No organization_id in user metadata');
      setError('Invitation is missing organization information. Please contact support.');
      setLoading(false);
      return;
    }

    const { data: existingMember } = await supabase
      .from('organization_members')
      .select('id')
      .eq('organization_id', orgId)
      .eq('user_id', authenticatedUser.id)
      .maybeSingle();

    if (existingMember) {
      console.log('[AcceptInvite] User is already a member of this organization');
      setError(`You are already a member of ${orgName}. Please log in to access your account.`);
      setLoading(false);
      return;
    }

    const isNewUser = !authenticatedUser.last_sign_in_at ||
                      authenticatedUser.created_at === authenticatedUser.last_sign_in_at;

    console.log('[AcceptInvite] Is new user:', isNewUser);

    if (isNewUser) {
      console.log('[AcceptInvite] New user - showing password setup form');
      setNeedsPasswordSetup(true);
      setLoading(false);
    } else {
      console.log('[AcceptInvite] Existing user - adding to organization directly');
      await addUserToOrganization(orgId, authenticatedUser.id, role, invitedByUserId, email);
    }
  };

  const addUserToOrganization = async (
    orgId: string,
    userId: string,
    role: string,
    invitedByUserId: string,
    email: string
  ) => {
    console.log('[AcceptInvite] Adding user to organization:', { orgId, userId, role });

    try {
      const { error: insertError } = await supabase
        .from('organization_members')
        .insert({
          organization_id: orgId,
          user_id: userId,
          role: role,
          invited_by: invitedByUserId,
        });

      if (insertError) {
        console.error('[AcceptInvite] Error inserting organization member:', insertError);
        setError('Failed to add you to the organization. Please contact support.');
        setLoading(false);
        return;
      }

      console.log('[AcceptInvite] Successfully added user to organization');

      const { data: invitationRecord } = await supabase
        .from('invitations')
        .select('id')
        .eq('organization_id', orgId)
        .eq('email', email)
        .eq('status', 'pending')
        .maybeSingle();

      if (invitationRecord) {
        console.log('[AcceptInvite] Updating invitation status to accepted');
        await supabase
          .from('invitations')
          .update({
            status: 'accepted',
            accepted_at: new Date().toISOString(),
            supabase_user_id: userId
          })
          .eq('id', invitationRecord.id);
      }

      setSuccess(true);
      setLoading(false);
      setTimeout(() => {
        console.log('[AcceptInvite] Redirecting to dashboard');
        navigate('/dashboard');
      }, 2000);
    } catch (err: any) {
      console.error('[AcceptInvite] Error in addUserToOrganization:', err);
      setError('Failed to process invitation. Please try again.');
      setLoading(false);
    }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!authenticatedUserId) {
      setError('Authentication session lost. Please try clicking the invitation link again.');
      return;
    }

    setSubmitting(true);

    try {
      console.log('[AcceptInvite] Setting password for user');

      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        console.error('[AcceptInvite] Error updating password:', updateError);
        setError(updateError.message || 'Failed to set password. Please try again.');
        setSubmitting(false);
        return;
      }

      console.log('[AcceptInvite] Password set successfully, adding user to organization');

      await addUserToOrganization(
        organizationId,
        authenticatedUserId,
        invitedRole,
        invitedBy,
        invitationEmail
      );

      setSubmitting(false);
    } catch (err: any) {
      console.error('[AcceptInvite] Unexpected error setting password:', err);
      setError('An unexpected error occurred. Please try again.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-zinc-900 dark:to-zinc-800 flex items-center justify-center p-4 relative overflow-hidden">
        <AnimatedBackground />
        <div className="glass-card p-8 rounded-2xl max-w-md w-full text-center relative z-10">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
          <p className="mt-4 text-gray-600 dark:text-zinc-400">Verifying invitation...</p>
        </div>
      </div>
    );
  }

  if (error && !needsPasswordSetup) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-zinc-900 dark:to-zinc-800 flex items-center justify-center p-4 relative overflow-hidden">
        <AnimatedBackground />
        <div className="glass-card p-8 rounded-2xl max-w-md w-full text-center relative z-10">
          <XCircle className="w-16 h-16 mx-auto text-red-500" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-4">
            {error.includes('already a member') ? 'Already a Member' : 'Invalid Invitation'}
          </h1>
          <p className="mt-2 text-gray-600 dark:text-zinc-400">{error}</p>
          <button
            onClick={() => navigate('/login')}
            className="mt-6 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition font-medium"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-zinc-900 dark:to-zinc-800 flex items-center justify-center p-4 relative overflow-hidden">
        <AnimatedBackground />
        <div className="glass-card p-8 rounded-2xl max-w-md w-full text-center relative z-10">
          <CheckCircle className="w-16 h-16 mx-auto text-green-500" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-4">
            Welcome to {organizationName}!
          </h1>
          <p className="mt-2 text-gray-600 dark:text-zinc-400">
            You've successfully joined the organization as a <strong>{invitedRole}</strong>
          </p>
          <p className="mt-4 text-sm text-gray-500 dark:text-zinc-500">
            Redirecting to dashboard...
          </p>
        </div>
      </div>
    );
  }

  if (needsPasswordSetup) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-zinc-900 dark:to-zinc-800 flex items-center justify-center p-4 relative overflow-hidden">
        <AnimatedBackground />
        <div className="glass-card p-8 rounded-2xl max-w-md w-full relative z-10">
          <div className="flex items-center justify-center mb-6">
            <div className="bg-blue-600 rounded-xl p-3 shadow-lg">
              <Building2 className="w-8 h-8 text-white" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-2">
            Set Your Password
          </h1>
          <p className="text-center text-gray-600 dark:text-zinc-400 mb-2">
            You're joining <strong className="text-gray-900 dark:text-white">{organizationName}</strong>
          </p>
          <p className="text-center text-sm text-gray-500 dark:text-zinc-500 mb-6">
            Create a password to complete your account setup
          </p>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSetPassword} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={invitationEmail}
                disabled
                className="w-full px-4 py-2.5 bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-gray-900 dark:text-white cursor-not-allowed"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="At least 8 characters"
                  disabled={submitting}
                  className="w-full px-4 py-2.5 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 pr-12 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Re-enter password"
                  disabled={submitting}
                  className="w-full px-4 py-2.5 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 pr-12 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Setting Password...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Complete Setup & Join
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return null;
}
