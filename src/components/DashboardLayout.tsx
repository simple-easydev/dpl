import { ReactNode, useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Sparkles,
  LayoutDashboard,
  Users,
  Package,
  GitCompare,
  Database,
  Settings,
  LogOut,
  Upload,
  Truck,
  Sun,
  Moon,
  Map,
  CheckSquare,
  FileText,
  DollarSign,
  Target,
  Box,
  Shield,
  Building2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useOrganization } from '../contexts/OrganizationContext';
import { useTheme } from '../contexts/ThemeContext';
import CreateOrganization from './CreateOrganization';
import { supabase } from '../lib/supabase';

interface DashboardLayoutProps {
  children: ReactNode;
}

const isPlatformAdminRoute = (pathname: string): boolean => {
  return pathname.startsWith('/platform-admin');
};

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, isPlatformAdmin: authIsPlatformAdmin } = useAuth();
  const { currentOrganization, organizations, loading: orgLoading, refetch, refreshLogo, setCurrentOrganization, isViewingAllBrands, isPlatformAdmin } = useOrganization();
  const { theme, toggleTheme } = useTheme();
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [showOrgDropdown, setShowOrgDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isOnPlatformAdminRoute = isPlatformAdminRoute(location.pathname);
  const canBypassOrgRequirement = (isPlatformAdmin && isViewingAllBrands) || isOnPlatformAdminRoute;

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const handleOrganizationCreated = async () => {
    setShowCreateOrg(false);
    await refetch();
  };

  useEffect(() => {
    const loadLogo = async () => {
      if (!currentOrganization) {
        setLogoUrl(null);
        return;
      }

      setLogoUrl(currentOrganization.logo_url || null);

      const { data } = await supabase
        .from('organizations')
        .select('logo_url')
        .eq('id', currentOrganization.id)
        .maybeSingle();

      if (data && data.logo_url !== currentOrganization.logo_url) {
        setLogoUrl(data.logo_url || null);
      }
    };

    loadLogo();

    const channel = supabase
      .channel('logo-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'organizations',
          filter: `id=eq.${currentOrganization?.id}`,
        },
        (payload: any) => {
          if (payload.new?.logo_url !== logoUrl) {
            setLogoUrl(payload.new?.logo_url || null);
            refreshLogo();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentOrganization, refreshLogo]);

  useEffect(() => {
    if (!currentOrganization && !canBypassOrgRequirement && isPlatformAdmin && !isOnPlatformAdminRoute) {
      navigate('/platform-admin');
    }
  }, [currentOrganization, canBypassOrgRequirement, isPlatformAdmin, isOnPlatformAdminRoute, navigate]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowOrgDropdown(false);
      }
    };

    if (showOrgDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showOrgDropdown]);

  const allMenuItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/dashboard/tasks', icon: CheckSquare, label: 'Tasks', hiddenForPlatformAdmin: true },
    { path: '/dashboard/data', icon: Database, label: 'Month Over Month' },
    { path: '/dashboard/accounts', icon: Users, label: 'Accounts' },
    { path: '/dashboard/sales-blitz', icon: Target, label: 'Sales Blitz', hiddenForPlatformAdmin: true },
    { path: '/dashboard/products', icon: Package, label: 'Products' },
    { path: '/dashboard/distributors', icon: Truck, label: 'Distributors' },
    { path: '/dashboard/fob-pricing', icon: DollarSign, label: 'FOB Pricing', hiddenForPlatformAdmin: true },
    { path: '/dashboard/map', icon: Map, label: 'Geographic Map' },
    { path: '/dashboard/compare', icon: GitCompare, label: 'Compare' },
  ];

  const menuItems = allMenuItems.filter(item => {
    if (isPlatformAdmin && item.hiddenForPlatformAdmin) {
      return false;
    }
    return true;
  });

  const generalItems = [
    { path: '/dashboard/upload', icon: Upload, label: 'Upload Data' },
    ...(isPlatformAdmin ? [{ path: '/dashboard/templates', icon: FileText, label: 'AI Training' }] : []),
    { path: '/dashboard/settings', icon: Settings, label: 'Settings' },
  ];

  if (orgLoading) {
    return (
      <div className="min-h-screen bg-theme-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary mx-auto mb-4"></div>
          <p className="text-theme-muted">Loading your organization...</p>
          <p className="text-theme-muted text-sm mt-2">This may take a moment for new accounts</p>
        </div>
      </div>
    );
  }

  if (!currentOrganization && !canBypassOrgRequirement) {
    if (showCreateOrg) {
      return (
        <CreateOrganization
          onSuccess={handleOrganizationCreated}
          onCancel={() => setShowCreateOrg(false)}
        />
      );
    }

    return (
      <div className="min-h-screen bg-theme-bg flex items-center justify-center p-6">
        <div className="glass-card rounded-2xl p-8 max-w-lg">
          <h2 className="text-xl font-semibold text-theme-text mb-4">No Active Organization Found</h2>
          <div className="space-y-4 mb-6">
            <p className="text-theme-muted">
              You don't have access to any active organizations. This could mean:
            </p>
            <ul className="list-disc list-inside space-y-2 text-theme-muted text-sm ml-2">
              <li>You're a new user and need to create an organization</li>
              <li>You were invited to join but haven't accepted the invitation yet</li>
              <li>Your organization access may have been removed or the organization was deleted</li>
              <li>There may be a temporary connection issue</li>
            </ul>
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mt-4">
              <p className="text-sm text-theme-text">
                <strong>Need help?</strong> Check your email for invitation links or contact your administrator.
              </p>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
              <p className="text-sm text-theme-text">
                <strong>Tip:</strong> Try clicking "Refresh Organizations" below to reload your organization access.
              </p>
            </div>
          </div>
          <div className="space-y-3">
            <button
              onClick={() => refetch()}
              className="w-full bg-gradient-blue text-white px-4 py-2.5 rounded-xl hover:shadow-glow-blue transition-all duration-300 font-semibold"
            >
              Refresh Organizations
            </button>
            <button
              onClick={() => setShowCreateOrg(true)}
              className="w-full glass text-theme-text px-4 py-2.5 rounded-xl hover:bg-white/10 transition-all duration-300 font-medium"
            >
              Create New Organization
            </button>
            <button
              onClick={handleSignOut}
              className="w-full glass text-theme-muted px-4 py-2.5 rounded-xl hover:bg-white/10 transition-all duration-300"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-theme-bg">
      <aside className="fixed left-4 top-4 bottom-4 w-64 glass-sidebar rounded-2xl flex flex-col shadow-glass">
        <div className="p-6 flex-shrink-0">
          <Link to="/dashboard" className="flex items-center gap-3 group">
            <div className="bg-gradient-blue rounded-xl p-2.5 group-hover:shadow-glow-blue transition-all duration-300 overflow-hidden">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={currentOrganization?.name || 'Logo'}
                  className="w-6 h-6 object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const parent = e.currentTarget.parentElement;
                    if (parent) {
                      parent.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6 text-white"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/></svg>';
                    }
                  }}
                />
              ) : (
                <Sparkles className="w-6 h-6 text-white" />
              )}
            </div>
            <div>
              <h1 className="font-semibold text-theme-text text-xl tracking-tight">
                {currentOrganization?.name || 'DPL'}
              </h1>
            </div>
          </Link>
        </div>

        <nav className="flex-1 px-4 py-2 overflow-y-auto">
          <div className="mb-6">
            <p className="text-xs font-semibold text-theme-muted px-4 mb-3 tracking-wider uppercase">Menu</p>
            <ul className="space-y-1">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;

                return (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group relative btn-hover-gradient ${
                        isActive
                          ? 'bg-gradient-blue text-white font-semibold shadow-glow-blue'
                          : 'text-theme-muted hover:text-theme-text hover:bg-white/5'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="flex-1">{item.label}</span>
                      {item.badge && (
                        <span className="bg-accent-primary text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold text-theme-muted px-4 mb-3 tracking-wider uppercase">General</p>
            <ul className="space-y-1">
              {generalItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;

                return (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 btn-hover-gradient ${
                        isActive
                          ? 'bg-gradient-blue text-white font-semibold shadow-glow-blue'
                          : 'text-theme-muted hover:text-theme-text hover:bg-white/5'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>

        <div className="p-4 flex-shrink-0">
          {currentOrganization ? (
            <div className="flex items-center gap-3 px-3 py-3 glass-card rounded-xl mb-2">
              <div className="w-10 h-10 rounded-full bg-gradient-blue flex items-center justify-center shadow-glow-blue overflow-hidden">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={currentOrganization.name}
                    className="w-full h-full object-contain p-1"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const parent = e.currentTarget.parentElement;
                      if (parent) {
                        parent.innerHTML = `<span class="text-white font-semibold text-sm">${currentOrganization.name.charAt(0).toUpperCase()}</span>`;
                      }
                    }}
                  />
                ) : (
                  <span className="text-white font-semibold text-sm">
                    {currentOrganization.name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-theme-text text-sm font-semibold truncate">{currentOrganization.name}</p>
                <p className="text-theme-muted text-xs truncate">Admin Account</p>
              </div>
            </div>
          ) : isPlatformAdmin && isViewingAllBrands ? (
            <div className="flex items-center gap-3 px-3 py-3 glass-card rounded-xl mb-2">
              <div className="w-10 h-10 rounded-full bg-gradient-blue flex items-center justify-center shadow-glow-blue">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-theme-text text-sm font-semibold truncate">All Brands</p>
                <p className="text-theme-muted text-xs truncate">Platform Admin View</p>
              </div>
            </div>
          ) : null}
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-theme-muted hover:text-theme-text hover:bg-white/5 transition-all duration-300 w-full btn-hover-gradient"
          >
            <LogOut className="w-5 h-5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      <main className="ml-72 overflow-auto">
        <div className="glass-nav sticky top-4 z-10 mx-4 mt-4 rounded-2xl">
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold text-theme-text">
                {menuItems.find(item => item.path === location.pathname)?.label ||
                 generalItems.find(item => item.path === location.pathname)?.label || 'Dashboard'}
              </h2>
            </div>
            <div className="flex items-center gap-4">
              {isPlatformAdmin && (
                <button
                  onClick={() => navigate('/platform-admin')}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-blue text-white rounded-xl hover:shadow-glow-blue transition-all duration-300 font-semibold"
                >
                  <Shield className="w-4 h-4" />
                  Platform Admin
                </button>
              )}
              {isPlatformAdmin && organizations.length > 0 && (
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setShowOrgDropdown(!showOrgDropdown)}
                    className="flex items-center gap-2 px-4 py-2 glass rounded-xl hover:bg-white/10 transition-all duration-300 min-w-[200px]"
                  >
                    <Building2 className="w-4 h-4 text-theme-text flex-shrink-0" />
                    <span className="text-theme-text font-medium truncate">
                      {isViewingAllBrands ? 'All Brands' : currentOrganization?.name || 'Select Organization'}
                    </span>
                  </button>
                  {showOrgDropdown && (
                    <div className="absolute right-0 top-full mt-2 w-64 glass-card rounded-xl shadow-lg p-2 z-50">
                      <div className="max-h-80 overflow-y-auto space-y-1">
                        <button
                          onClick={() => {
                            setCurrentOrganization(null);
                            setShowOrgDropdown(false);
                            if (isOnPlatformAdminRoute) {
                              navigate('/platform-admin');
                            } else {
                              navigate('/dashboard');
                            }
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg transition mb-2 border-b border-white/10 ${
                            isViewingAllBrands
                              ? 'bg-gradient-blue text-white'
                              : 'text-theme-muted hover:bg-white/10'
                          }`}
                        >
                          All Brands
                        </button>
                        {organizations.map((org) => (
                          <button
                            key={org.id}
                            onClick={() => {
                              setCurrentOrganization(org);
                              setShowOrgDropdown(false);
                            }}
                            className={`w-full text-left px-3 py-2 rounded-lg transition ${
                              org.id === currentOrganization?.id
                                ? 'bg-gradient-blue text-white'
                                : 'text-theme-text hover:bg-white/10'
                            }`}
                          >
                            {org.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-xl glass hover:bg-white/10 transition-all duration-300 text-theme-text group"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? (
                  <Sun className="w-5 h-5 transition-transform group-hover:rotate-12" />
                ) : (
                  <Moon className="w-5 h-5 transition-transform group-hover:-rotate-12" />
                )}
              </button>
              <div className="w-8 h-8 rounded-full bg-gradient-blue flex items-center justify-center cursor-pointer hover:shadow-glow-blue transition-all duration-300 overflow-hidden">
                {currentOrganization ? (
                  logoUrl ? (
                    <img
                      src={logoUrl}
                      alt={currentOrganization.name}
                      className="w-full h-full object-contain p-0.5"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const parent = e.currentTarget.parentElement;
                        if (parent) {
                          parent.innerHTML = `<span class="text-white font-semibold text-sm">${currentOrganization.name.charAt(0).toUpperCase()}</span>`;
                        }
                      }}
                    />
                  ) : (
                    <span className="text-white font-semibold text-sm">
                      {currentOrganization.name.charAt(0).toUpperCase()}
                    </span>
                  )
                ) : isPlatformAdmin && isViewingAllBrands ? (
                  <Shield className="w-4 h-4 text-white" />
                ) : (
                  <span className="text-white font-semibold text-sm">U</span>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="px-6 py-5">
          {children}
        </div>
      </main>
    </div>
  );
}
