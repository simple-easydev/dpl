import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Edit2, MapPin, Mail, Phone, Search, Trash2, Building2 } from 'lucide-react';

interface GlobalDistributor {
  id: string;
  name: string;
  state: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  active: boolean;
  is_global: boolean;
  created_at: string;
  updated_at: string;
}

interface DistributorUsage {
  distributor_id: string;
  organization_count: number;
}

export default function GlobalDistributorsPage() {
  const [distributors, setDistributors] = useState<GlobalDistributor[]>([]);
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingDistributor, setEditingDistributor] = useState<GlobalDistributor | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    state: '',
    contact_email: '',
    contact_phone: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchDistributors = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch all global distributors
      const { data: distributorsData, error: distributorsError } = await supabase
        .from('distributors')
        .select('*')
        .eq('is_global', true)
        .order('name', { ascending: true });

      if (distributorsError) {
        console.error('Error fetching distributors:', distributorsError);
        setError('Failed to load distributors: ' + distributorsError.message);
        setLoading(false);
        return;
      }

      setDistributors(distributorsData || []);

      // Fetch usage statistics
      const { data: usageData } = await supabase
        .from('organization_distributors')
        .select('distributor_id')
        .in('distributor_id', (distributorsData || []).map(d => d.id));

      if (usageData) {
        const usageMap: Record<string, number> = {};
        usageData.forEach(item => {
          usageMap[item.distributor_id] = (usageMap[item.distributor_id] || 0) + 1;
        });
        setUsage(usageMap);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDistributors();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!formData.name.trim()) {
      setError('Distributor name is required');
      return;
    }

    try {
      if (editingDistributor) {
        // Update existing distributor
        const { error: updateError } = await supabase
          .from('distributors')
          .update({
            name: formData.name.trim(),
            state: formData.state.trim() || null,
            contact_email: formData.contact_email.trim() || null,
            contact_phone: formData.contact_phone.trim() || null,
          })
          .eq('id', editingDistributor.id);

        if (updateError) {
          if (updateError.code === '23505') {
            setError('A global distributor with this name already exists');
          } else {
            setError(updateError.message);
          }
          return;
        }

        setSuccessMessage('Distributor updated successfully');
      } else {
        // Create new global distributor
        const { error: insertError } = await supabase
          .from('distributors')
          .insert({
            name: formData.name.trim(),
            state: formData.state.trim() || null,
            contact_email: formData.contact_email.trim() || null,
            contact_phone: formData.contact_phone.trim() || null,
            is_global: true,
            organization_id: null,
            active: true,
          });

        if (insertError) {
          if (insertError.code === '23505') {
            setError('A global distributor with this name already exists');
          } else {
            setError(insertError.message);
          }
          return;
        }

        setSuccessMessage('Global distributor created successfully');
      }

      setShowModal(false);
      setEditingDistributor(null);
      setFormData({ name: '', state: '', contact_email: '', contact_phone: '' });
      fetchDistributors();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleEdit = (distributor: GlobalDistributor) => {
    setEditingDistributor(distributor);
    setFormData({
      name: distributor.name,
      state: distributor.state || '',
      contact_email: distributor.contact_email || '',
      contact_phone: distributor.contact_phone || '',
    });
    setShowModal(true);
    setError(null);
    setSuccessMessage(null);
  };

  const handleToggleActive = async (distributor: GlobalDistributor) => {
    const { error: updateError } = await supabase
      .from('distributors')
      .update({ active: !distributor.active })
      .eq('id', distributor.id);

    if (!updateError) {
      setSuccessMessage(`Distributor ${!distributor.active ? 'activated' : 'deactivated'} successfully`);
      fetchDistributors();
    } else {
      setError('Failed to update distributor status: ' + updateError.message);
    }
  };

  const handleDelete = async (distributor: GlobalDistributor) => {
    const usageCount = usage[distributor.id] || 0;

    if (usageCount > 0) {
      setError(`Cannot delete ${distributor.name} - it is currently used by ${usageCount} brand(s). Please have brands remove it first.`);
      return;
    }

    if (!confirm(`Are you sure you want to delete "${distributor.name}"? This action cannot be undone.`)) {
      return;
    }

    const { error: deleteError } = await supabase
      .from('distributors')
      .delete()
      .eq('id', distributor.id);

    if (!deleteError) {
      setSuccessMessage('Distributor deleted successfully');
      fetchDistributors();
    } else {
      setError('Failed to delete distributor: ' + deleteError.message);
    }
  };

  const handleOpenModal = () => {
    setEditingDistributor(null);
    setFormData({ name: '', state: '', contact_email: '', contact_phone: '' });
    setShowModal(true);
    setError(null);
    setSuccessMessage(null);
  };

  const filteredDistributors = distributors.filter((d) =>
    d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.state?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Global Distributors</h1>
          <p className="text-gray-600 dark:text-zinc-400 mt-1">
            Manage global distributors available to all brands on the platform
          </p>
        </div>
        <button
          onClick={handleOpenModal}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
        >
          <Plus className="w-4 h-4" />
          Add Global Distributor
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          {successMessage}
        </div>
      )}

      <div className="glass-card rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
        <div className="p-6 border-b border-gray-200 dark:border-white/10">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-zinc-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by name or state..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>
        </div>

        {filteredDistributors.length === 0 ? (
          <div className="p-8 text-center text-gray-600 dark:text-zinc-400">
            {searchTerm
              ? 'No distributors found matching your search.'
              : 'No global distributors yet. Add your first global distributor to get started.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="glass-card dark:glass border-b border-gray-200 dark:border-white/10">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-zinc-400 uppercase tracking-wider">
                    Distributor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-zinc-400 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-600 dark:text-zinc-400 uppercase tracking-wider">
                    Brands Using
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-600 dark:text-zinc-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-600 dark:text-zinc-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                {filteredDistributors.map((distributor) => (
                  <tr key={distributor.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition">
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {distributor.name}
                        </div>
                        {distributor.state && (
                          <div className="flex items-center gap-1 mt-1 text-sm text-gray-600 dark:text-zinc-400">
                            <MapPin className="w-3 h-3" />
                            {distributor.state}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        {distributor.contact_email && (
                          <div className="flex items-center gap-1 text-gray-700 dark:text-zinc-300">
                            <Mail className="w-3 h-3 text-gray-400 dark:text-zinc-400" />
                            {distributor.contact_email}
                          </div>
                        )}
                        {distributor.contact_phone && (
                          <div className="flex items-center gap-1 text-gray-700 dark:text-zinc-300 mt-1">
                            <Phone className="w-3 h-3 text-gray-400 dark:text-zinc-400" />
                            {distributor.contact_phone}
                          </div>
                        )}
                        {!distributor.contact_email && !distributor.contact_phone && (
                          <span className="text-gray-400 dark:text-zinc-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Building2 className="w-4 h-4 text-gray-400 dark:text-zinc-400" />
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {usage[distributor.id] || 0}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleToggleActive(distributor)}
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          distributor.active
                            ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-slate-100 text-gray-700 dark:text-zinc-300 hover:bg-slate-200 dark:bg-white/5'
                        } transition`}
                      >
                        {distributor.active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(distributor)}
                          className="text-blue-600 hover:text-blue-700 transition"
                          title="Edit distributor"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(distributor)}
                          className="text-red-600 hover:text-red-700 transition"
                          title="Delete distributor"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="glass-card rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-white/10">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {editingDistributor ? 'Edit Global Distributor' : 'Add Global Distributor'}
              </h2>
              <p className="text-sm text-gray-600 dark:text-zinc-400 mt-1">
                {editingDistributor
                  ? 'Update this global distributor available to all brands'
                  : 'Create a new global distributor available to all brands'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
                  Distributor Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="Enter distributor name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
                  State / Region
                </label>
                <input
                  type="text"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="e.g., California, CA, National"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
                  Contact Email
                </label>
                <input
                  type="email"
                  value={formData.contact_email}
                  onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="distributor@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
                  Contact Phone
                </label>
                <input
                  type="tel"
                  value={formData.contact_phone}
                  onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="(555) 123-4567"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingDistributor(null);
                    setError(null);
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 text-gray-700 dark:text-zinc-300 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
                >
                  {editingDistributor ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
