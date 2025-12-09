import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface BlockPlatformAdminRouteProps {
  children: ReactNode;
}

export default function BlockPlatformAdminRoute({ children }: BlockPlatformAdminRouteProps) {
  const { user, loading, isPlatformAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-theme-bg flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (isPlatformAdmin) {
    return <Navigate to="/platform-admin" replace />;
  }

  return <>{children}</>;
}
