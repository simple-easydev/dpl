import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

interface Organization {
  id: string;
  name: string;
  role: 'admin' | 'member' | 'viewer';
  logo_url?: string | null;
}

interface OrganizationContextType {
  organizations: Organization[];
  currentOrganization: Organization | null;
  setCurrentOrganization: (org: Organization | null) => void;
  loading: boolean;
  refetch: () => Promise<void>;
  refreshLogo: () => Promise<void>;
  isViewingAllBrands: boolean;
  isPlatformAdmin: boolean;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [isViewingAllBrands, setIsViewingAllBrands] = useState(false);
  const [retryScheduled, setRetryScheduled] = useState(false);

  const fetchOrganizations = async () => {
    if (!user) {
      console.log('[OrganizationContext] No user, clearing organizations');
      setOrganizations([]);
      setCurrentOrganization(null);
      setLoading(false);
      return;
    }

    console.log('[OrganizationContext] Fetching organizations for user:', user.id);
    console.log('[OrganizationContext] User email:', user.email);
    setLoading(true);

    try {
      const { data: isPlatformAdminData } = await supabase.rpc('is_platform_admin');
      const isPlatformAdminStatus = isPlatformAdminData === true;
      setIsPlatformAdmin(isPlatformAdminStatus);

      if (isPlatformAdminStatus) {
        console.log('[OrganizationContext] User is platform admin, fetching all active organizations');

        const { data: orgsData, error: orgsError } = await supabase
          .from('organizations')
          .select('id, name, logo_url')
          .is('deleted_at', null)
          .order('name');

        if (orgsError) {
          console.error('[OrganizationContext] Error fetching organizations:', orgsError);
          console.error('[OrganizationContext] Error details:', JSON.stringify(orgsError, null, 2));
          setOrganizations([]);
          setCurrentOrganization(null);
          setLoading(false);
          return;
        }

        const orgs = (orgsData || []).map(org => ({
          id: org.id,
          name: org.name,
          role: 'admin' as 'admin' | 'member' | 'viewer',
          logo_url: org.logo_url,
        }));

        console.log('[OrganizationContext] Found', orgs.length, 'organizations for platform admin');
        setOrganizations(orgs);

        if (orgs.length > 0) {
          const savedOrgId = localStorage.getItem('currentOrganizationId');
          const savedViewMode = localStorage.getItem('platformAdminViewMode');

          if (savedViewMode === 'all-brands') {
            console.log('[OrganizationContext] Restoring all brands view for platform admin');
            setCurrentOrganization(null);
            setIsViewingAllBrands(true);
          } else if (savedOrgId) {
            const savedOrg = orgs.find(o => o.id === savedOrgId);
            if (savedOrg) {
              console.log('[OrganizationContext] Restoring saved organization:', savedOrg);
              setCurrentOrganization(savedOrg);
              setIsViewingAllBrands(false);
            } else {
              console.log('[OrganizationContext] Saved org not found, defaulting to all brands view');
              setCurrentOrganization(null);
              setIsViewingAllBrands(true);
            }
          } else {
            console.log('[OrganizationContext] No saved preference, defaulting to all brands view');
            setCurrentOrganization(null);
            setIsViewingAllBrands(true);
          }
        } else {
          console.log('[OrganizationContext] Platform admin has zero organizations, continuing without org context');
          setCurrentOrganization(null);
          setIsViewingAllBrands(false);
        }

        setLoading(false);
        return;
      }

      const { data: members, error: membersError } = await supabase
        .from('organization_members')
        .select('role, organization_id')
        .eq('user_id', user.id);

      if (membersError) {
        console.error('[OrganizationContext] Error fetching organization members:', membersError);
        console.error('[OrganizationContext] Error details:', JSON.stringify(membersError, null, 2));
        console.error('[OrganizationContext] Error code:', membersError.code);
        console.error('[OrganizationContext] Error hint:', membersError.hint);
        console.error('[OrganizationContext] User ID:', user.id);
        setOrganizations([]);
        setCurrentOrganization(null);
        setLoading(false);
        return;
      }

      console.log('[OrganizationContext] Found', members?.length || 0, 'organization memberships');
      console.log('[OrganizationContext] Membership details:', JSON.stringify(members, null, 2));

      if (!members || members.length === 0) {
        console.warn('[OrganizationContext] No organization memberships found for user');
        console.warn('[OrganizationContext] User may need to accept an invitation or create an organization');
        console.warn('[OrganizationContext] User ID:', user.id);
        console.warn('[OrganizationContext] User email:', user.email);

        const userMetadata = user.user_metadata;
        const isNewBrandUser = userMetadata?.invited_via_brand_invitation === true;

        if (isNewBrandUser && !retryScheduled) {
          console.log('[OrganizationContext] New brand user detected, scheduling retry');
          setRetryScheduled(true);
          setLoading(false);

          setTimeout(() => {
            console.log('[OrganizationContext] Retrying organization fetch for new brand user');
            setRetryScheduled(false);
            fetchOrganizations();
          }, 2000);
          return;
        }

        setOrganizations([]);
        setCurrentOrganization(null);
        setLoading(false);
        return;
      }

      const orgIds = members.map(m => m.organization_id);
      console.log('[OrganizationContext] Fetching organizations with IDs:', orgIds);

      const { data: orgsData, error: orgsError } = await supabase
        .from('organizations')
        .select('id, name, logo_url')
        .in('id', orgIds)
        .is('deleted_at', null);

      if (orgsError) {
        console.error('[OrganizationContext] Error fetching organizations:', orgsError);
        console.error('[OrganizationContext] Error details:', JSON.stringify(orgsError, null, 2));
        console.error('[OrganizationContext] Org IDs attempted:', orgIds);
        setOrganizations([]);
        setCurrentOrganization(null);
        setLoading(false);
        return;
      }

      console.log('[OrganizationContext] Found', orgsData?.length || 0, 'organizations');
      console.log('[OrganizationContext] Organizations:', JSON.stringify(orgsData, null, 2));

      if (!orgsData || orgsData.length === 0) {
        console.warn('[OrganizationContext] No active organizations found for member records');
        console.warn('[OrganizationContext] User has memberships to:', members.length, 'organizations');
        console.warn('[OrganizationContext] Organization IDs (may be deleted):', orgIds);
        console.warn('[OrganizationContext] This likely means all organizations for this user have been deleted');

        setOrganizations([]);
        setCurrentOrganization(null);
        setLoading(false);
        return;
      }

      const orgs = orgsData.map(org => {
        const membership = members.find(m => m.organization_id === org.id);
        return {
          id: org.id,
          name: org.name,
          role: membership?.role || 'viewer' as 'admin' | 'member' | 'viewer',
          logo_url: org.logo_url,
        };
      });

      console.log('[OrganizationContext] Processed organizations:', orgs);
      setOrganizations(orgs);

      if (orgs.length > 0) {
        const savedOrgId = localStorage.getItem('currentOrganizationId');
        const savedOrg = orgs.find(o => o.id === savedOrgId);
        const selectedOrg = savedOrg || orgs[0];
        console.log('[OrganizationContext] Setting current organization:', selectedOrg);
        console.log('[OrganizationContext] Organization ID:', selectedOrg.id);
        console.log('[OrganizationContext] Organization Name:', selectedOrg.name);
        setCurrentOrganization(selectedOrg);
        setIsViewingAllBrands(false);
      } else {
        console.log('[OrganizationContext] No organizations available, clearing current');
        setCurrentOrganization(null);
        setIsViewingAllBrands(false);
      }

      setLoading(false);
    } catch (err) {
      console.error('[OrganizationContext] Unexpected error fetching organizations:', err);
      setOrganizations([]);
      setCurrentOrganization(null);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchOrganizations();
    } else {
      setOrganizations([]);
      setCurrentOrganization(null);
      localStorage.removeItem('currentOrganizationId');
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (isPlatformAdmin) {
      if (isViewingAllBrands) {
        localStorage.setItem('platformAdminViewMode', 'all-brands');
        localStorage.removeItem('currentOrganizationId');
      } else if (currentOrganization) {
        localStorage.setItem('currentOrganizationId', currentOrganization.id);
        localStorage.removeItem('platformAdminViewMode');
      }
    } else if (currentOrganization) {
      localStorage.setItem('currentOrganizationId', currentOrganization.id);
    }
  }, [currentOrganization, isViewingAllBrands, isPlatformAdmin]);

  const handleSetCurrentOrganization = (org: Organization | null) => {
    setCurrentOrganization(org);
    if (isPlatformAdmin) {
      setIsViewingAllBrands(org === null);
    }
  };

  const refreshLogo = async () => {
    if (!currentOrganization) return;

    const { data } = await supabase
      .from('organizations')
      .select('logo_url')
      .eq('id', currentOrganization.id)
      .maybeSingle();

    if (data) {
      setCurrentOrganization({
        ...currentOrganization,
        logo_url: data.logo_url,
      });
    }
  };

  return (
    <OrganizationContext.Provider
      value={{
        organizations,
        currentOrganization,
        setCurrentOrganization: handleSetCurrentOrganization,
        loading,
        refetch: fetchOrganizations,
        refreshLogo,
        isViewingAllBrands,
        isPlatformAdmin,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
}
