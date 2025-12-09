import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Building2, CheckCircle, XCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import AnimatedBackground from '../components/AnimatedBackground';

export default function Signup() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [invitation, setInvitation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setError('Invalid invitation link. Missing token.');
      setLoading(false);
      return;
    }

    fetchInvitation();
  }, [token]);

  const fetchInvitation = async () => {
    try {
      const { data, error: inviteError } = await supabase
        .from('brand_invitations')
        .select('*')
        .eq('token', token)
        .eq('status', 'pending')
        .maybeSingle();

      if (inviteError) {
        console.error('Error fetching invitation:', inviteError);
        setError('Failed to load invitation. Please try again.');
        setLoading(false);
        return;
      }

      if (!data) {
        setError('Invalid or expired invitation link.');
        setLoading(false);
        return;
      }

      const expiresAt = new Date(data.expires_at);
      if (expiresAt < new Date()) {
        setError('This invitation has expired.');
        setLoading(false);
        return;
      }

      setInvitation(data);
      setLoading(false);
    } catch (err: any) {
      console.error('Unexpected error:', err);
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
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

    setSubmitting(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: invitation.email,
        password: password,
        options: {
          data: {
            company_name: invitation.company_name,
            invited_via_brand_invitation: true,
          },
        },
      });

      if (authError) {
        console.error('Auth signup error:', authError);
        setError(authError.message || 'Failed to create account');
        setSubmitting(false);
        return;
      }

      if (!authData.user) {
        setError('Failed to create account. Please try again.');
        setSubmitting(false);
        return;
      }

      const { data: org, error: orgError } = await supabase
        .rpc('create_organization_with_owner', {
          org_name: invitation.company_name.trim()
        });

      if (orgError) {
        console.error('Organization creation error:', orgError);
        setError(`Failed to create organization: ${orgError.message}`);
        setSubmitting(false);
        return;
      }

      if (!org || org.length === 0) {
        setError('Failed to create organization. Please contact support.');
        setSubmitting(false);
        return;
      }

      const organizationId = org[0].id;

      await supabase
        .from('brand_invitations')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString(),
          organization_id: organizationId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', invitation.id);

      await supabase
        .from('organizations')
        .update({
          created_by_platform_admin: true,
        })
        .eq('id', organizationId);

      const maxRetries = 5;
      let retryCount = 0;
      let membershipVerified = false;

      while (retryCount < maxRetries && !membershipVerified) {
        await new Promise(resolve => setTimeout(resolve, retryCount * 200));

        const { data: membership, error: membershipError } = await supabase
          .from('organization_members')
          .select('id, role')
          .eq('organization_id', organizationId)
          .eq('user_id', authData.user.id)
          .maybeSingle();

        if (!membershipError && membership) {
          console.log('Membership verified:', membership);
          membershipVerified = true;
        } else {
          console.log(`Membership verification attempt ${retryCount + 1} failed`);
          retryCount++;
        }
      }

      if (!membershipVerified) {
        console.error('Failed to verify organization membership after signup');
        setError('Account created but organization setup incomplete. Please contact support.');
        setSubmitting(false);
        return;
      }

      console.log('Account setup complete, navigating to dashboard');
      navigate('/dashboard');
    } catch (err: any) {
      console.error('Unexpected signup error:', err);
      setError('An unexpected error occurred. Please try again.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-theme-bg flex items-center justify-center p-4 relative overflow-hidden">
        <AnimatedBackground />
        <div className="glass-card p-8 rounded-2xl max-w-md w-full text-center relative z-10">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-accent-primary" />
          <p className="mt-4 text-theme-muted">Loading invitation...</p>
        </div>
      </div>
    );
  }

  if (error && !invitation) {
    return (
      <div className="min-h-screen bg-theme-bg flex items-center justify-center p-4 relative overflow-hidden">
        <AnimatedBackground />
        <div className="glass-card p-8 rounded-2xl max-w-md w-full text-center relative z-10">
          <XCircle className="w-16 h-16 mx-auto text-red-500" />
          <h1 className="text-2xl font-bold text-theme-text mt-4">
            Invalid Invitation
          </h1>
          <p className="mt-2 text-theme-muted">{error}</p>
          <button
            onClick={() => navigate('/login')}
            className="mt-6 px-6 py-2 bg-gradient-blue text-white rounded-xl hover:shadow-glow-blue transition"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-theme-bg flex items-center justify-center p-4 relative overflow-hidden">
      <AnimatedBackground />
      <div className="glass-card p-8 rounded-2xl max-w-md w-full relative z-10">
        <div className="flex items-center justify-center mb-6">
          <div className="bg-gradient-blue rounded-xl p-3 shadow-glow-blue">
            <Building2 className="w-8 h-8 text-white" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-center text-theme-text mb-2">
          Welcome to DPL!
        </h1>
        <p className="text-center text-theme-muted mb-2">
          You've been invited to join as <strong>{invitation?.company_name}</strong>
        </p>
        <p className="text-center text-sm text-theme-muted mb-6">
          Create your account to get started
        </p>

        {invitation?.welcome_message && (
          <div className="mb-6 p-4 glass rounded-xl">
            <p className="text-sm text-theme-text italic">"{invitation.welcome_message}"</p>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-500 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-theme-text mb-1.5">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={invitation?.email || ''}
              disabled
              className="w-full px-4 py-2.5 glass rounded-xl text-theme-text bg-white/5 cursor-not-allowed"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-theme-text mb-1.5">
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
                className="w-full px-4 py-2.5 glass rounded-xl text-theme-text placeholder:text-theme-muted/60 focus-ring pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-muted hover:text-theme-text transition"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-theme-text mb-1.5">
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
                className="w-full px-4 py-2.5 glass rounded-xl text-theme-text placeholder:text-theme-muted/60 focus-ring pr-12"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-muted hover:text-theme-text transition"
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-gradient-blue hover:shadow-glow-blue text-white font-medium py-2.5 px-4 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating Account...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Create Account
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-theme-muted">
            Already have an account?{' '}
            <button
              onClick={() => navigate('/login')}
              className="text-accent-primary hover:underline font-medium"
            >
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
