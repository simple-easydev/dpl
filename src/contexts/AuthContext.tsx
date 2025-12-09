import { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isPlatformAdmin: boolean;
  signUp: (email: string, password: string, companyName: string) => Promise<{ error: AuthError | null }>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<{ error: AuthError | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: AuthError | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const previousUserIdRef = useRef<string | null>(null);

  const checkPlatformAdmin = async (userId: string) => {
    try {
      const { data, error } = await supabase.rpc('is_platform_admin');
      if (!error && data === true) {
        setIsPlatformAdmin(true);
      } else {
        setIsPlatformAdmin(false);
      }
    } catch (err) {
      console.error('Error checking platform admin status:', err);
      setIsPlatformAdmin(false);
    }
  };

  useEffect(() => {
    console.log('=== AUTH CONTEXT: Initial setup ===');
    console.log('AUTH CONTEXT: Fetching initial session...');

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      console.log('AUTH CONTEXT: Initial session fetched');
      console.log('AUTH CONTEXT: Session exists?', session ? 'YES' : 'NO');
      if (session) {
        console.log('AUTH CONTEXT: Session user:', session.user?.email);
        console.log('AUTH CONTEXT: Session expires at:', session.expires_at);
      }

      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        console.log('AUTH CONTEXT: Checking platform admin for user:', session.user.id);
        await checkPlatformAdmin(session.user.id);
      }
      console.log('AUTH CONTEXT: Setting loading to false');
      setLoading(false);
    });

    console.log('AUTH CONTEXT: Setting up auth state change listener...');
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('=== AUTH STATE CHANGE ===');
      console.log('AUTH STATE CHANGE: Event:', event);
      console.log('AUTH STATE CHANGE: Session exists?', session ? 'YES' : 'NO');
      if (session) {
        console.log('AUTH STATE CHANGE: Session user:', session.user?.email);
        console.log('AUTH STATE CHANGE: Session expires at:', session.expires_at);
      }
      console.log('AUTH STATE CHANGE: Current URL:', window.location.href);
      console.log('AUTH STATE CHANGE: URL hash:', window.location.hash);

      // Skip redundant updates for same user (prevents re-loading on tab switch)
      const newUserId = session?.user?.id ?? null;
      if (newUserId === previousUserIdRef.current && event !== 'SIGNED_OUT' && event !== 'SIGNED_IN') {
        console.log('AUTH STATE CHANGE: Same user, skipping redundant update');
        return;
      }

      (async () => {
        previousUserIdRef.current = newUserId;
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          console.log('AUTH STATE CHANGE: User authenticated, checking platform admin...');
          await checkPlatformAdmin(session.user.id);
        } else {
          console.log('AUTH STATE CHANGE: No user, clearing platform admin flag');
          setIsPlatformAdmin(false);
        }
        console.log('AUTH STATE CHANGE: State update complete');
      })();
    });

    console.log('AUTH CONTEXT: Auth state listener setup complete');
    return () => {
      console.log('AUTH CONTEXT: Unsubscribing from auth state changes');
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, companyName: string) => {
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        console.error('Auth signup error:', authError);
        return { error: authError };
      }

      if (!authData.user) {
        console.error('No user returned from signup');
        return { error: new Error('No user returned') as AuthError };
      }

      console.log('User created successfully:', authData.user.id);

      const { data: org, error: orgError } = await supabase
        .rpc('create_organization_with_owner', {
          org_name: companyName.trim()
        });

      if (orgError) {
        console.error('Organization creation error:', orgError);
        console.error('Organization error details:', JSON.stringify(orgError, null, 2));
        await supabase.auth.signOut();
        return {
          error: {
            ...orgError,
            message: `Failed to create organization: ${orgError.message}`
          } as any
        };
      }

      if (!org || org.length === 0) {
        console.error('No organization returned from function');
        await supabase.auth.signOut();
        return { error: new Error('Failed to create organization') as AuthError };
      }

      console.log('Organization created successfully:', org[0].id);
      return { error: null };
    } catch (err) {
      console.error('Unexpected signup error:', err);
      await supabase.auth.signOut();
      return { error: err as AuthError };
    }
  };

  const signIn = async (email: string, password: string) => {
    console.log('=== AUTH CONTEXT: signIn called ===');
    console.log('AUTH CONTEXT signIn: Email:', email);

    const { error, data } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    console.log('AUTH CONTEXT signIn: Response received');
    console.log('AUTH CONTEXT signIn: Error?', error ? 'YES' : 'NO');
    if (error) {
      console.error('AUTH CONTEXT signIn: Error details:', error);
    }
    if (data?.session) {
      console.log('AUTH CONTEXT signIn: Session created:', {
        user: data.session.user?.email,
        expiresAt: data.session.expires_at
      });
    } else {
      console.log('AUTH CONTEXT signIn: No session in response');
    }

    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const requestPasswordReset = async (email: string) => {
    console.log('=== AUTH CONTEXT: requestPasswordReset called ===');
    console.log('AUTH CONTEXT: Email received:', email);
    console.log('AUTH CONTEXT: Current hostname:', window.location.hostname);
    console.log('AUTH CONTEXT: Current origin:', window.location.origin);

    try {
      const isLocalhost = window.location.hostname === 'localhost' ||
                         window.location.hostname === '127.0.0.1' ||
                         window.location.hostname.includes('local');

      const redirectUrl = isLocalhost
        ? 'http://localhost:5173/reset-password'
        : `${window.location.origin}/reset-password`;

      console.log('AUTH CONTEXT: Is localhost?', isLocalhost);
      console.log('AUTH CONTEXT: Redirect URL constructed:', redirectUrl);
      console.log('AUTH CONTEXT: Calling supabase.auth.resetPasswordForEmail...');

      const { error, data } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      console.log('AUTH CONTEXT: Supabase response received');
      console.log('AUTH CONTEXT: Data:', data);
      console.log('AUTH CONTEXT: Error:', error);

      if (error) {
        console.error('AUTH CONTEXT: Password reset error details:', {
          message: error.message,
          name: error.name,
          status: error.status,
          fullError: error
        });

        if (error.message.includes('Email rate limit exceeded')) {
          console.log('AUTH CONTEXT: Rate limit detected');
          return {
            error: {
              ...error,
              message: 'Too many password reset attempts. Please try again in a few minutes.'
            } as AuthError
          };
        } else if (error.message.includes('Invalid email')) {
          console.log('AUTH CONTEXT: Invalid email detected');
          return {
            error: {
              ...error,
              message: 'Please enter a valid email address.'
            } as AuthError
          };
        }
        console.log('AUTH CONTEXT: Returning generic error');
        return { error };
      }

      console.log('AUTH CONTEXT: Password reset request successful! Email should be sent.');
      return { error: null };
    } catch (err) {
      console.error('AUTH CONTEXT: Unexpected error in requestPasswordReset:', err);
      console.error('AUTH CONTEXT: Error type:', typeof err);
      console.error('AUTH CONTEXT: Error stringified:', JSON.stringify(err, null, 2));
      return {
        error: {
          message: 'An unexpected error occurred. Please try again.',
          name: 'UnexpectedError',
          status: 500
        } as AuthError
      };
    }
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    return { error };
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isPlatformAdmin, signUp, signIn, signOut, requestPasswordReset, updatePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
