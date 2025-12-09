import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { TrendingUp } from 'lucide-react';
import AnimatedBackground from '../components/AnimatedBackground';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('=== LOGIN: Form submitted ===');
    console.log('LOGIN: Email:', email);
    setError(null);
    setLoading(true);

    console.log('LOGIN: Calling signIn...');
    const { error } = await signIn(email, password);

    console.log('LOGIN: signIn response received');
    console.log('LOGIN: Error?', error ? 'YES' : 'NO');

    if (error) {
      console.error('LOGIN: Sign in failed:', error);
      setError(error.message);
      setLoading(false);
    } else {
      console.log('LOGIN: Sign in successful!');
      console.log('LOGIN: Checking current session...');

      const { data: { session } } = await supabase.auth.getSession();
      console.log('LOGIN: Current session:', session ? 'EXISTS' : 'NULL');
      if (session) {
        console.log('LOGIN: Session user:', session.user?.email);
        console.log('LOGIN: Session expires at:', session.expires_at);
      }

      try {
        console.log('LOGIN: Checking platform admin status...');
        const { data: isPlatformAdmin, error: adminCheckError } = await supabase.rpc('is_platform_admin');

        console.log('LOGIN: Platform admin check result:', isPlatformAdmin);
        if (adminCheckError) {
          console.error('LOGIN: Platform admin check error:', adminCheckError);
        }

        if (!adminCheckError && isPlatformAdmin === true) {
          console.log('LOGIN: User is platform admin, checking organizations...');
          const { data: orgs } = await supabase
            .from('organizations')
            .select('id')
            .limit(1);

          console.log('LOGIN: Organizations found:', orgs?.length || 0);

          if (!orgs || orgs.length === 0) {
            console.log('LOGIN: No organizations, navigating to /platform-admin');
            navigate('/platform-admin');
            return;
          }
        }
      } catch (err) {
        console.error('LOGIN: Error checking platform admin status:', err);
      }

      console.log('LOGIN: Navigating to /dashboard');
      navigate('/dashboard');
    }
  };

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
            Welcome Back
          </h1>
          <p className="text-center text-theme-muted mb-8">
            Sign in to your sales analytics dashboard
          </p>

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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2.5 bg-white dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-theme-text placeholder-gray-400 dark:placeholder-gray-500"
                placeholder="you@company.com"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-sm font-medium text-theme-text">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition"
                >
                  Forgot password?
                </Link>
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-2.5 bg-white dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-theme-text placeholder-gray-400 dark:placeholder-gray-500"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-blue hover:shadow-glow-blue text-white font-medium py-2.5 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6">
            <p className="text-center text-sm text-theme-muted">
              Access is by invitation only. Contact your administrator for access.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
