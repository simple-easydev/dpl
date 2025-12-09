import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { TrendingUp, Lock, CheckCircle } from 'lucide-react';
import AnimatedBackground from '../components/AnimatedBackground';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validSession, setValidSession] = useState<boolean | null>(null);
  const { updatePassword, session } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const checkSession = async () => {
      console.log('=== RESET PASSWORD: Checking session ===');
      console.log('RESET PASSWORD: Session from context:', session ? 'EXISTS' : 'NULL');
      if (session) {
        console.log('RESET PASSWORD: Session user:', session.user?.email);
      }
      console.log('RESET PASSWORD: Current URL:', window.location.href);
      console.log('RESET PASSWORD: Full hash:', window.location.hash);

      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const type = hashParams.get('type');
      const refreshToken = hashParams.get('refresh_token');

      console.log('RESET PASSWORD: Hash params parsed:', {
        accessToken: accessToken ? 'PRESENT' : 'MISSING',
        type: type || 'MISSING',
        refreshToken: refreshToken ? 'PRESENT' : 'MISSING'
      });

      if (type === 'recovery' && accessToken) {
        console.log('RESET PASSWORD: Password recovery token detected in URL!');
        console.log('RESET PASSWORD: Token type is "recovery" - valid reset link');
        setValidSession(true);
      } else if (session) {
        console.log('RESET PASSWORD: Valid session found in context');
        setValidSession(true);
      } else {
        console.log('RESET PASSWORD: No valid session or recovery token in URL');
        console.log('RESET PASSWORD: Fetching current session from Supabase...');

        const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('RESET PASSWORD: Error fetching session:', sessionError);
        }

        console.log('RESET PASSWORD: Fetched session from Supabase:', currentSession ? 'EXISTS' : 'NULL');
        if (currentSession) {
          console.log('RESET PASSWORD: Session user from Supabase:', currentSession.user?.email);
        }

        if (currentSession) {
          console.log('RESET PASSWORD: Session found, marking as valid');
          setValidSession(true);
        } else {
          console.log('RESET PASSWORD: No session found - invalid or expired link');
          setValidSession(false);
          setError('Invalid or expired password reset link. Please request a new one.');
        }
      }
    };

    checkSession();
  }, [session]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    const { error } = await updatePassword(password);

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    }
  };

  if (validSession === null) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
        <AnimatedBackground />
        <div className="w-full max-w-md relative z-10">
          <div className="glass-card rounded-2xl p-8">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
            <p className="text-center text-theme-muted mt-4">Verifying reset link...</p>
          </div>
        </div>
      </div>
    );
  }

  if (validSession === false) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
        <AnimatedBackground />
        <div className="w-full max-w-md relative z-10">
          <div className="glass-card rounded-2xl p-8">
            <div className="flex items-center justify-center mb-8">
              <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-3 shadow-lg">
                <Lock className="w-8 h-8 text-white" />
              </div>
            </div>

            <h1 className="text-2xl font-bold text-center text-theme-text mb-2">
              Invalid Reset Link
            </h1>
            <p className="text-center text-theme-muted mb-6">
              {error}
            </p>

            <button
              onClick={() => navigate('/forgot-password')}
              className="w-full bg-gradient-blue hover:shadow-glow-blue text-white font-medium py-2.5 px-4 rounded-lg transition"
            >
              Request New Reset Link
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
        <AnimatedBackground />
        <div className="w-full max-w-md relative z-10">
          <div className="glass-card rounded-2xl p-8">
            <div className="flex items-center justify-center mb-8">
              <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-3 shadow-lg">
                <CheckCircle className="w-8 h-8 text-white" />
              </div>
            </div>

            <h1 className="text-2xl font-bold text-center text-theme-text mb-2">
              Password Reset Successful
            </h1>
            <p className="text-center text-theme-muted mb-6">
              Your password has been updated successfully. Redirecting to login...
            </p>

            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <AnimatedBackground />
      <div className="w-full max-w-md relative z-10">
        <div className="glass-card rounded-2xl p-8">
          <div className="flex items-center justify-center mb-8">
            <div className="bg-gradient-blue rounded-xl p-3 shadow-glow-blue">
              <TrendingUp className="w-8 h-8 text-white" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-center text-theme-text mb-2">
            Set New Password
          </h1>
          <p className="text-center text-theme-muted mb-8">
            Choose a strong password for your account
          </p>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-500 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-theme-text mb-1.5">
                New Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-2.5 bg-white dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-theme-text placeholder-gray-400 dark:placeholder-gray-500"
                placeholder="••••••••"
              />
              <p className="mt-1.5 text-xs text-theme-muted">
                Must be at least 6 characters long
              </p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-theme-text mb-1.5">
                Confirm New Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-2.5 bg-white dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-theme-text placeholder-gray-400 dark:placeholder-gray-500"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-blue hover:shadow-glow-blue text-white font-medium py-2.5 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Updating Password...' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
