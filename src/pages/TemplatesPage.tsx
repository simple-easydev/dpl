import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrganization } from '../contexts/OrganizationContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Plus, Edit2, FileText, CheckCircle, XCircle, Download, Upload as UploadIcon, Trash2, TestTube, Globe, Building2, Search } from 'lucide-react';
import { format } from 'date-fns';
import TestConfigurationModal from '../components/TestConfigurationModal';

interface AITrainingConfig {
  id: string;
  distributor_id: string;
  configuration_name: string;
  field_mappings: Record<string, any>;
  parsing_instructions: string;
  orientation: string;
  is_active: boolean;
  extraction_stats: {
    total_extractions: number;
    successful_extractions: number;
    last_used: string | null;
  };
  created_at: string;
  updated_at: string;
  success_count: number;
  failure_count: number;
  last_successful_use: string | null;
}

interface Distributor {
  id: string;
  name: string;
  state: string | null;
  supports_pdf: boolean;
  is_global?: boolean;
  organization_id?: string | null;
  organization_name?: string;
}

export default function TemplatesPage() {
  const navigate = useNavigate();
  const { currentOrganization } = useOrganization();
  const { user, isPlatformAdmin, loading: authLoading } = useAuth();
  const [configs, setConfigs] = useState<AITrainingConfig[]>([]);
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState<AITrainingConfig | null>(null);
  const [showTestModal, setShowTestModal] = useState(false);
  const [testingConfig, setTestingConfig] = useState<AITrainingConfig | null>(null);
  const [formData, setFormData] = useState({
    distributor_id: '',
    configuration_name: '',
    parsing_instructions: '',
    field_mappings: '{}',
    orientation: 'auto',
  });
  const [error, setError] = useState<string | null>(null);
  const [selectedDistributorFilter, setSelectedDistributorFilter] = useState<string>('');
  const [distributorSearchTerm, setDistributorSearchTerm] = useState<string>('');

  const fetchConfigs = async () => {
    // Configs are global - fetch all active configurations
    const { data, error } = await supabase
      .from('ai_training_configurations')
      .select('*')
      .order('is_active', { ascending: false })
      .order('last_successful_use', { ascending: false, nullsFirst: false })
      .order('success_count', { ascending: false });

    if (!error && data) {
      setConfigs(data);
    }
    setLoading(false);
  };

  const fetchDistributors = async () => {
    console.log('fetchDistributors called, isPlatformAdmin:', isPlatformAdmin);

    try {
      // Platform admin needs access to ALL distributors
      if (isPlatformAdmin) {
        // Fetch all active distributors in a single query
        const { data: allDistributors, error: distributorsError } = await supabase
          .from('distributors')
          .select('id, name, state, supports_pdf, is_global, organization_id')
          .eq('active', true)
          .order('is_global', { ascending: false })
          .order('name', { ascending: true });

        if (distributorsError) {
          console.error('Error fetching distributors for AI training:', distributorsError);
          setError(`Failed to load distributors: ${distributorsError.message}`);
          setDistributors([]);
          return;
        }

        console.log('Fetched distributors for platform admin:', allDistributors?.length || 0);

        const distributorList: Distributor[] = (allDistributors || []).map((dist: any) => ({
          id: dist.id,
          name: dist.name,
          state: dist.state,
          supports_pdf: dist.supports_pdf,
          is_global: dist.is_global,
          organization_id: dist.organization_id,
        }));

        setDistributors(distributorList);
        return;
      }

      // Regular organization members - original logic
      if (!currentOrganization) return;

      // Fetch added global distributors via junction table
      const { data: addedGlobalData } = await supabase
        .from('organization_distributors')
        .select('distributor_id, state, distributors(id, name, state, supports_pdf)')
        .eq('organization_id', currentOrganization.id);

      // Fetch organization-specific custom distributors
      const { data: customData } = await supabase
        .from('distributors')
        .select('id, name, state, supports_pdf')
        .eq('organization_id', currentOrganization.id)
        .eq('is_global', false)
        .order('name', { ascending: true });

      // Fetch all active global distributors
      const { data: allGlobalData } = await supabase
        .from('distributors')
        .select('id, name, state, supports_pdf')
        .eq('is_global', true)
        .eq('active', true)
        .order('name', { ascending: true });

      const distributorMap = new Map<string, Distributor>();

      // Add custom distributors first
      (customData || []).forEach(dist => {
        distributorMap.set(dist.id, dist);
      });

      // Add added global distributors with org-specific state if available
      (addedGlobalData || []).forEach(item => {
        if (item.distributors) {
          const dist = item.distributors as any;
          distributorMap.set(dist.id, {
            id: dist.id,
            name: dist.name,
            state: item.state || dist.state,
            supports_pdf: dist.supports_pdf,
          });
        }
      });

      // Add all global distributors (both added and not yet added)
      (allGlobalData || []).forEach(dist => {
        if (!distributorMap.has(dist.id)) {
          distributorMap.set(dist.id, dist);
        }
      });

      setDistributors(Array.from(distributorMap.values()));
    } catch (err) {
      console.error('Unexpected error fetching distributors:', err);
      setError('Failed to load distributors. Please try again.');
      setDistributors([]);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!isPlatformAdmin) {
      navigate('/dashboard');
      return;
    }
  }, [isPlatformAdmin, navigate, authLoading]);

  useEffect(() => {
    if (authLoading) return;
    if (!isPlatformAdmin) return;
    fetchConfigs();
    fetchDistributors();
  }, [isPlatformAdmin, authLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setError(null);

    if (!formData.parsing_instructions.trim()) {
      setError('AI Training Instructions are required. Please provide instructions on how to extract data from this distributor\'s files.');
      return;
    }

    let parsedMappings;
    try {
      parsedMappings = JSON.parse(formData.field_mappings);
    } catch {
      setError('Invalid JSON format for field mappings');
      return;
    }

    if (!editingConfig && formData.distributor_id) {
      const existingActiveConfig = configs.find(
        c => c.distributor_id === formData.distributor_id && c.is_active
      );

      if (existingActiveConfig) {
        const distributorName = distributors.find(d => d.id === formData.distributor_id)?.name;
        const confirmMessage = `The distributor "${distributorName}" already has an active AI training configuration named "${existingActiveConfig.configuration_name}".\n\nYou can still create this new configuration, but it will be created as inactive. You can activate it later from the list, which will automatically deactivate the current one.\n\nDo you want to continue?`;

        if (!confirm(confirmMessage)) {
          return;
        }
      }
    }

    try {
      if (editingConfig) {
        const { error: updateError } = await supabase
          .from('ai_training_configurations')
          .update({
            configuration_name: formData.configuration_name.trim(),
            parsing_instructions: formData.parsing_instructions.trim(),
            field_mappings: parsedMappings,
            orientation: formData.orientation,
          })
          .eq('id', editingConfig.id);

        if (updateError) {
          setError(updateError.message);
          return;
        }
      } else {
        const { error: insertError } = await supabase
          .from('ai_training_configurations')
          .insert({
            organization_id: null,
            distributor_id: formData.distributor_id,
            configuration_name: formData.configuration_name.trim(),
            parsing_instructions: formData.parsing_instructions.trim(),
            field_mappings: parsedMappings,
            orientation: formData.orientation,
            created_by: user.id,
            is_active: false,
          });

        if (insertError) {
          if (insertError.message.includes('unique_active_config_per_distributor')) {
            setError('An active configuration already exists for this distributor. Please deactivate it first or edit the existing one.');
          } else {
            setError(insertError.message);
          }
          return;
        }
      }

      setShowModal(false);
      setEditingConfig(null);
      setFormData({
        distributor_id: '',
        configuration_name: '',
        parsing_instructions: '',
        field_mappings: '{}',
        orientation: 'auto',
      });
      fetchConfigs();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleEdit = (config: AITrainingConfig) => {
    setEditingConfig(config);
    setFormData({
      distributor_id: config.distributor_id,
      configuration_name: config.configuration_name,
      parsing_instructions: config.parsing_instructions,
      field_mappings: JSON.stringify(config.field_mappings, null, 2),
      orientation: config.orientation,
    });
    setShowModal(true);
    setError(null);
  };

  const handleToggleActive = async (config: AITrainingConfig) => {
    const newActiveState = !config.is_active;

    if (newActiveState) {
      const otherActiveConfig = configs.find(
        c => c.distributor_id === config.distributor_id && c.is_active && c.id !== config.id
      );

      if (otherActiveConfig) {
        const distributorName = distributors.find(d => d.id === config.distributor_id)?.name;
        const confirmMessage = `Activating "${config.configuration_name}" will automatically deactivate the currently active configuration "${otherActiveConfig.configuration_name}" for ${distributorName}.\n\nOnly one configuration can be active per distributor. Do you want to continue?`;

        if (!confirm(confirmMessage)) {
          return;
        }
      }
    }

    await supabase
      .from('ai_training_configurations')
      .update({ is_active: newActiveState })
      .eq('id', config.id);

    fetchConfigs();
  };

  const handleTest = (config: AITrainingConfig) => {
    setTestingConfig(config);
    setShowTestModal(true);
  };

  const handleTestSuccess = async () => {
    if (!testingConfig) return;

    await supabase
      .from('ai_training_configurations')
      .update({
        is_active: true,
        tested_successfully: true,
      })
      .eq('id', testingConfig.id);

    setShowTestModal(false);
    setTestingConfig(null);
    fetchConfigs();
  };

  const handleDelete = async (config: AITrainingConfig) => {
    if (!confirm(`Are you sure you want to delete the AI training configuration "${config.configuration_name}"?`)) {
      return;
    }

    const { error } = await supabase
      .from('ai_training_configurations')
      .delete()
      .eq('id', config.id);

    if (!error) {
      fetchConfigs();
    }
  };

  const handleExport = (config: AITrainingConfig) => {
    const exportData = {
      configuration_name: config.configuration_name,
      parsing_instructions: config.parsing_instructions,
      field_mappings: config.field_mappings,
      orientation: config.orientation,
      distributor_name: distributors.find(d => d.id === config.distributor_id)?.name,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${config.configuration_name.replace(/\s+/g, '_')}_ai_training.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const imported = JSON.parse(text);

      setFormData({
        distributor_id: '',
        configuration_name: imported.configuration_name || imported.template_name || '',
        parsing_instructions: imported.parsing_instructions || '',
        field_mappings: JSON.stringify(imported.field_mappings || {}, null, 2),
        orientation: imported.orientation || 'auto',
      });
      setShowModal(true);
      setError(null);
    } catch (err) {
      alert('Failed to import AI training configuration: Invalid file format');
    }
  };

  const filteredConfigs = selectedDistributorFilter
    ? configs.filter(t => t.distributor_id === selectedDistributorFilter)
    : configs;

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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">AI Training</h1>
          <p className="text-gray-600 dark:text-zinc-400 mt-1">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded text-xs font-medium mr-2">PLATFORM ADMIN</span>
            Train the AI on how to extract data from distributor files. Configure intelligent data extraction for all brands.
          </p>
        </div>
        <div className="flex gap-3">
          <label className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-white/10 text-gray-700 dark:text-zinc-300 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-700 transition cursor-pointer">
            <UploadIcon className="w-4 h-4" />
            Import Configuration
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
          </label>
          <button
            onClick={() => {
              setEditingConfig(null);
              setFormData({
                distributor_id: '',
                configuration_name: '',
                parsing_instructions: '',
                field_mappings: '{}',
                orientation: 'auto',
              });
              setShowModal(true);
              setError(null);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
          >
            <Plus className="w-4 h-4" />
            New AI Training
          </button>
        </div>
      </div>

      <div className="mb-6 flex gap-3 items-center">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <select
            value={selectedDistributorFilter}
            onChange={(e) => setSelectedDistributorFilter(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white border border-slate-300 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          >
            <option value="">All Distributors ({configs.length})</option>
            {Array.from(new Set(configs.map(c => c.distributor_id)))
              .map(distId => {
                const dist = distributors.find(d => d.id === distId);
                const count = configs.filter(c => c.distributor_id === distId).length;
                return dist ? (
                  <option key={distId} value={distId}>
                    {dist.name} {dist.state && `(${dist.state})`} • {count} config{count !== 1 ? 's' : ''}
                  </option>
                ) : null;
              })
              .filter(Boolean)}
          </select>
        </div>
        {selectedDistributorFilter && (
          <button
            onClick={() => setSelectedDistributorFilter('')}
            className="px-4 py-2 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 rounded-lg transition text-sm font-medium"
          >
            Clear Filter
          </button>
        )}
      </div>

      {configs.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center">
          <FileText className="w-16 h-16 text-gray-400 dark:text-zinc-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No AI training configurations yet</h3>
          <p className="text-gray-600 dark:text-zinc-400 mb-6 max-w-2xl mx-auto">
            Create AI training configurations to teach the system how to extract data from distributor files. Each configuration is specific to one distributor and will be used by all brands when they upload data from that distributor.
          </p>
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-700 dark:text-blue-300">
              <Globe className="w-4 h-4" />
              <span>Available Distributors: {distributors.length}</span>
            </div>
          </div>
          <button
            onClick={() => {
              setEditingConfig(null);
              setFormData({
                distributor_id: '',
                configuration_name: '',
                parsing_instructions: '',
                field_mappings: '{}',
                orientation: 'auto',
              });
              setShowModal(true);
              setError(null);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
          >
            <Plus className="w-4 h-4" />
            Create First Configuration
          </button>
        </div>
      ) : (
        <div className="glass-card rounded-xl">
          <div className="divide-y divide-gray-200 dark:divide-white/10">
            {filteredConfigs.map((config) => {
              const distributor = distributors.find(d => d.id === config.distributor_id);
              const totalUses = config.success_count + config.failure_count;
              const successRate = totalUses > 0
                ? ((config.success_count / totalUses) * 100).toFixed(0)
                : 'N/A';

              return (
                <div key={config.id} className="p-6 hover:bg-gray-50 dark:hover:bg-white/5 transition">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {config.configuration_name}
                        </h3>
                        <button
                          onClick={() => handleToggleActive(config)}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                            config.is_active
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-slate-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400'
                          }`}
                        >
                          {config.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </div>

                      {distributor ? (
                        <div className="flex items-center gap-2 mb-3">
                          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-zinc-800 rounded-lg">
                            <Globe className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            <span className="text-sm font-medium text-gray-900 dark:text-white">{distributor.name}</span>
                            {distributor.state && (
                              <span className="text-sm text-gray-500 dark:text-zinc-400">• {distributor.state}</span>
                            )}
                            {distributor.supports_pdf && (
                              <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">PDF Support</span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 mb-3">
                          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                            <span className="text-sm text-red-700 dark:text-red-400">⚠ Distributor not found</span>
                          </div>
                        </div>
                      )}

                      {config.parsing_instructions && (
                        <div className="text-sm text-gray-700 dark:text-zinc-300 mb-3 p-3 bg-slate-50 dark:bg-zinc-800/50 rounded-lg">
                          <div className="font-medium text-gray-900 dark:text-white mb-1">AI Training Instructions:</div>
                          <div className="whitespace-pre-wrap">{config.parsing_instructions}</div>
                        </div>
                      )}

                      <div className="flex items-center gap-6 text-sm text-gray-600 dark:text-zinc-400">
                        <div>
                          Orientation: <span className="font-medium">{config.orientation}</span>
                        </div>
                        <div>
                          Total Uses: <span className="font-medium">{totalUses}</span>
                        </div>
                        <div>
                          Success Rate: <span className="font-medium">{successRate}%</span>
                        </div>
                        <div>
                          Successful Extractions: <span className="font-medium text-green-600 dark:text-green-400">{config.success_count}</span>
                        </div>
                        {config.last_successful_use && (
                          <div>
                            Last Success: <span className="font-medium">{format(new Date(config.last_successful_use), 'MMM dd, yyyy')}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => handleTest(config)}
                        className="p-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition"
                        title="Test with sample file"
                      >
                        <TestTube className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleExport(config)}
                        className="p-2 text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg transition"
                        title="Export configuration"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(config)}
                        className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition"
                        title="Edit AI training"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(config)}
                        className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                        title="Delete configuration"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="glass-card rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-white/10">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {editingConfig ? 'Edit AI Training Configuration' : 'New AI Training Configuration'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 rounded-lg text-sm text-red-700 dark:text-red-400">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
                  Configuration Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.configuration_name}
                  onChange={(e) => setFormData({ ...formData, configuration_name: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white border border-slate-300 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="e.g., RNDC California Format"
                />
              </div>

              {!editingConfig && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
                    Distributor <span className="text-red-500">*</span>
                  </label>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 mb-2">
                    Select the distributor this AI training configuration will apply to. Each distributor can only have one active configuration.
                  </p>
                  {authLoading ? (
                    <div className="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 border border-slate-300 dark:border-white/10 rounded-lg">
                      Loading distributors...
                    </div>
                  ) : (
                    <select
                      value={formData.distributor_id}
                      onChange={(e) => setFormData({ ...formData, distributor_id: e.target.value })}
                      required
                      className="w-full px-3 py-2 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white border border-slate-300 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    >
                      <option value="">Select a distributor...</option>
                      {distributors.length === 0 && (
                        <option disabled>No distributors available - Check console for errors</option>
                      )}
                      {distributors.map((distributor) => {
                      let label = '';
                      if (distributor.is_global) {
                        label = `🌐 ${distributor.name}`;
                      } else if (distributor.organization_name) {
                        label = `🏢 ${distributor.name} (${distributor.organization_name})`;
                      } else {
                        label = `🏢 ${distributor.name}`;
                      }

                      if (distributor.state) {
                        label += ` • ${distributor.state}`;
                      }

                      return (
                        <option key={distributor.id} value={distributor.id}>
                          {label}
                        </option>
                      );
                    })}
                    </select>
                  )}
                  {formData.distributor_id && (
                    <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-xs text-blue-700 dark:text-blue-300">
                      <p className="font-medium">Selected Distributor Details:</p>
                      <p className="mt-1">
                        {distributors.find(d => d.id === formData.distributor_id)?.name}
                        {distributors.find(d => d.id === formData.distributor_id)?.state &&
                          ` • ${distributors.find(d => d.id === formData.distributor_id)?.state}`
                        }
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
                  Orientation
                </label>
                <select
                  value={formData.orientation}
                  onChange={(e) => setFormData({ ...formData, orientation: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white border border-slate-300 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  <option value="auto">Auto-detect</option>
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
                  AI Training Instructions
                </label>
                <textarea
                  value={formData.parsing_instructions}
                  onChange={(e) => setFormData({ ...formData, parsing_instructions: e.target.value })}
                  rows={6}
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white border border-slate-300 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-mono text-sm"
                  placeholder="Teach the AI how to map depletion data from this distributor's files. For example:&#10;- Account names are in the first column&#10;- Product names are in column 2&#10;- Quantities are always followed by 'CS' for cases&#10;- The sales representative name is in the header"
                />
                <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
                  Provide clear instructions to train the AI on extracting and mapping data correctly
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
                  Field Mapping Hints (JSON)
                </label>
                <textarea
                  value={formData.field_mappings}
                  onChange={(e) => setFormData({ ...formData, field_mappings: e.target.value })}
                  rows={8}
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white border border-slate-300 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-mono text-sm"
                  placeholder='{\n  "account_pattern": "Account:.*",\n  "product_column": 2,\n  "date_format": "MM/DD/YYYY"\n}'
                />
                <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
                  Optional: Provide specific hints to help the AI learn field patterns and column locations
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingConfig(null);
                    setError(null);
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 dark:border-white/10 text-gray-700 dark:text-zinc-300 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
                >
                  {editingConfig ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTestModal && testingConfig && currentOrganization && (
        <TestConfigurationModal
          distributorName={distributors.find(d => d.id === testingConfig.distributor_id)?.name || 'Unknown'}
          aiConfig={{
            configuration_name: testingConfig.configuration_name,
            parsing_instructions: testingConfig.parsing_instructions,
            field_mappings: testingConfig.field_mappings as Record<string, any>,
            orientation: testingConfig.orientation,
          }}
          organizationId={currentOrganization.id}
          onClose={() => {
            setShowTestModal(false);
            setTestingConfig(null);
          }}
          onSuccess={handleTestSuccess}
        />
      )}
    </div>
  );
}
