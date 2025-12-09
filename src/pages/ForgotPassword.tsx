import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { TrendingUp, Mail, ArrowLeft, AlertCircle } from 'lucide-react';
import AnimatedBackground from '../components/AnimatedBackground';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { requestPasswordReset } = useAuth();

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('=== FORGOT PASSWORD: Form submitted ===');
    setError(null);

    if (!validateEmail(email)) {
      console.log('FORGOT PASSWORD: Email validation failed:', email);
      setError('Please enter a valid email address');
      return;
    }

    console.log('FORGOT PASSWORD: Email validation passed:', email);
    setLoading(true);

    try {
      const trimmedEmail = email.trim().toLowerCase();
      console.log('FORGOT PASSWORD: Requesting password reset for:', trimmedEmail);
      console.log('FORGOT PASSWORD: Current URL:', window.location.href);

      const { error: resetError } = await requestPasswordReset(trimmedEmail);

      console.log('FORGOT PASSWORD: Response received');
      console.log('FORGOT PASSWORD: Error?', resetError ? 'YES' : 'NO');

      if (resetError) {
        console.error('FORGOT PASSWORD: Reset error details:', {
          message: resetError.message,
          name: resetError.name,
          status: resetError.status,
          fullError: resetError
        });
        const errorMessage = resetError.message || 'Failed to send password reset email. Please try again.';
        setError(errorMessage);
        setLoading(false);
      } else {
        console.log('FORGOT PASSWORD: Success! Email should be sent to:', trimmedEmail);
        setSuccess(true);
        setLoading(false);
      }
    } catch (err) {
      console.error('FORGOT PASSWORD: Unexpected error caught:', err);
      console.error('FORGOT PASSWORD: Error type:', typeof err);
      console.error('FORGOT PASSWORD: Error details:', JSON.stringify(err, null, 2));
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
        <AnimatedBackground />
        <div className="w-full max-w-md relative z-10">
          <div className="glass-card rounded-2xl p-8">
            <div className="flex items-center justify-center mb-8">
              <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-3 shadow-lg">
                <Mail className="w-8 h-8 text-white" />
              </div>
            </div>

            <h1 className="text-2xl font-bold text-center text-theme-text mb-2">
              Check Your Email
            </h1>
            <p className="text-center text-theme-muted mb-6">
              We've sent a password reset link to <strong className="text-theme-text">{email}</strong>
            </p>

            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-4">
              <p className="text-sm text-blue-600 dark:text-blue-400">
                The link will expire in 60 minutes. If you don't see the email, check your spam folder.
              </p>
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-700 dark:text-yellow-300">
                  <p className="font-medium mb-2">Didn't receive the email?</p>
                  <ul className="space-y-1 text-xs">
                    <li>• Check your spam or junk folder</li>
                    <li>• Verify the email address is correct</li>
                    <li>• Wait a few minutes for delivery</li>
                    <li>• Try requesting a new reset link</li>
                  </ul>
                </div>
              </div>
            </div>

            <Link
              to="/login"
              className="w-full bg-gradient-blue hover:shadow-glow-blue text-white font-medium py-2.5 px-4 rounded-lg transition inline-flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Login
            </Link>
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
            Reset Your Password
          </h1>
          <p className="text-center text-theme-muted mb-8">
            Enter your email address and we'll send you a link to reset your password
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

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-blue hover:shadow-glow-blue text-white font-medium py-2.5 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>

          <div className="mt-6">
            <Link
              to="/login"
              className="text-center text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition inline-flex items-center justify-center w-full gap-1"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
