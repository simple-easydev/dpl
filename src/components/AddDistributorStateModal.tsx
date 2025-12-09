import { useState } from 'react';
import { MapPin, X } from 'lucide-react';

interface AddDistributorStateModalProps {
  distributorName: string;
  onConfirm: (state: string) => void;
  onCancel: () => void;
}

const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado',
  'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho',
  'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana',
  'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota',
  'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada',
  'New Hampshire', 'New Jersey', 'New Mexico', 'New York',
  'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon',
  'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
  'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington',
  'West Virginia', 'Wisconsin', 'Wyoming'
];

export default function AddDistributorStateModal({
  distributorName,
  onConfirm,
  onCancel,
}: AddDistributorStateModalProps) {
  const [state, setState] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!state.trim()) {
      setError('Please select a state');
      return;
    }

    onConfirm(state.trim());
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="glass-card rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Add Distributor
            </h2>
            <p className="text-sm text-gray-600 dark:text-zinc-400 mt-1">
              Select the state for {distributorName}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                State <span className="text-red-500">*</span>
              </div>
            </label>
            <select
              value={state}
              onChange={(e) => {
                setState(e.target.value);
                setError('');
              }}
              className="w-full px-3 py-2 border border-slate-300 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none glass-card dark:glass"
              required
            >
              <option value="">Select a state...</option>
              {US_STATES.map((stateName) => (
                <option key={stateName} value={stateName}>
                  {stateName}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
              This determines which state this distributor will serve for your organization
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 border border-slate-300 dark:border-white/10 text-gray-700 dark:text-zinc-300 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
            >
              Add Distributor
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
