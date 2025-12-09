import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  console.log('=== PROTECTED ROUTE: Checking authentication ===');
  console.log('PROTECTED ROUTE: Loading?', loading);
  console.log('PROTECTED ROUTE: User?', user ? 'EXISTS' : 'NULL');
  if (user) {
    console.log('PROTECTED ROUTE: User email:', user.email);
    console.log('PROTECTED ROUTE: User ID:', user.id);
  }
  console.log('PROTECTED ROUTE: Current path:', window.location.pathname);

  if (loading) {
    console.log('PROTECTED ROUTE: Still loading, showing spinner...');
    return (
      <div className="min-h-screen bg-theme-bg flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary"></div>
      </div>
    );
  }

  if (!user) {
    console.log('PROTECTED ROUTE: No user found, redirecting to /login');
    return <Navigate to="/login" replace />;
  }

  console.log('PROTECTED ROUTE: User authenticated, rendering protected content');
  return <>{children}</>;
}
