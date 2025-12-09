import { useState, useEffect } from 'react';
import { Building2, Search, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Organization {
  id: string;
  name: string;
  created_at: string;
}

interface BrandSelectorProps {
  selectedBrandId: string | null;
  onSelectBrand: (brandId: string, brandName: string) => void;
  label: string;
  excludeBrandId?: string;
}

export default function BrandSelector({
  selectedBrandId,
  onSelectBrand,
  label,
  excludeBrandId,
}: BrandSelectorProps) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [filteredOrgs, setFilteredOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrandName, setSelectedBrandName] = useState('');

  useEffect(() => {
    fetchOrganizations();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredOrgs(organizations.filter(org => org.id !== excludeBrandId));
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredOrgs(
        organizations.filter(
          org =>
            org.id !== excludeBrandId &&
            org.name.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, organizations, excludeBrandId]);

  const fetchOrganizations = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('organizations')
      .select('id, name, created_at')
      .order('name', { ascending: true });

    if (!error && data) {
      setOrganizations(data);
      setFilteredOrgs(data.filter(org => org.id !== excludeBrandId));
    }
    setLoading(false);
  };

  const handleSelectBrand = (brand: Organization) => {
    setSelectedBrandName(brand.name);
    onSelectBrand(brand.id, brand.name);
    setShowDropdown(false);
    setSearchQuery('');
  };

  const handleClearSelection = () => {
    setSelectedBrandName('');
    onSelectBrand('', '');
    setSearchQuery('');
  };

  const selectedOrg = organizations.find(org => org.id === selectedBrandId);

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">
        {label}
      </label>

      <div className="relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="w-full px-4 py-3 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-white/10 rounded-lg text-left flex items-center justify-between hover:border-blue-400 dark:hover:border-accent-primary transition"
        >
          {selectedOrg ? (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold text-sm">
                {selectedOrg.name.charAt(0).toUpperCase()}
              </div>
              <span className="font-medium text-gray-900 dark:text-white">
                {selectedOrg.name}
              </span>
            </div>
          ) : (
            <span className="text-gray-500 dark:text-zinc-400">Select a brand...</span>
          )}
          <Building2 className="w-5 h-5 text-gray-400" />
        </button>

        {showDropdown && (
          <div className="absolute z-50 mt-2 w-full glass-card rounded-xl shadow-xl border border-gray-200 dark:border-white/10 max-h-96 overflow-hidden">
            <div className="p-3 border-b border-gray-200 dark:border-white/10">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search brands..."
                  className="w-full pl-10 pr-3 py-2 bg-white dark:bg-zinc-900 border border-slate-300 dark:border-white/10 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 dark:text-white"
                  autoFocus
                />
              </div>
            </div>

            <div className="overflow-y-auto max-h-80">
              {loading ? (
                <div className="p-4 text-center text-gray-500 dark:text-zinc-400">
                  Loading brands...
                </div>
              ) : filteredOrgs.length === 0 ? (
                <div className="p-4 text-center text-gray-500 dark:text-zinc-400">
                  No brands found
                </div>
              ) : (
                filteredOrgs.map((org) => (
                  <button
                    key={org.id}
                    onClick={() => handleSelectBrand(org)}
                    className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-white/5 transition ${
                      selectedBrandId === org.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                      {org.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-medium text-gray-900 dark:text-white">{org.name}</p>
                      <p className="text-xs text-gray-500 dark:text-zinc-400">
                        {new Date(org.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {selectedOrg && (
        <button
          onClick={handleClearSelection}
          className="absolute right-12 top-11 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 transition"
          title="Clear selection"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
