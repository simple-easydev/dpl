import { useState } from 'react';
import { X, Save } from 'lucide-react';
import StateIcon from './StateIcon';

interface EditDistributorInventoryModalProps {
  item: {
    id: string;
    product_id: string;
    distributor_id: string;
    current_quantity: number;
    products?: {
      product_name: string;
    };
    distributors?: {
      name: string;
    };
  };
  distributorState?: string | null;
  onSave: (quantity: number, notes: string) => Promise<void>;
  onClose: () => void;
}

export default function EditDistributorInventoryModal({
  item,
  distributorState,
  onSave,
  onClose,
}: EditDistributorInventoryModalProps) {
  const [quantity, setQuantity] = useState(item.current_quantity.toString());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const qty = parseFloat(quantity);
    if (isNaN(qty)) {
      alert('Please enter a valid quantity');
      return;
    }

    setSaving(true);
    try {
      await onSave(qty, notes);
      onClose();
    } catch (error) {
      console.error('Error saving inventory:', error);
      alert('Failed to update inventory');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="glass-card rounded-2xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Adjust Inventory
            </h2>
            <p className="text-sm text-gray-600 dark:text-zinc-400 mt-1">
              Update the current quantity for this distributor
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg glass hover:bg-gray-100 dark:hover:bg-white/10 transition"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-zinc-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-4 glass rounded-xl">
            <div className="text-sm font-medium text-gray-600 dark:text-zinc-400 mb-1">
              Product
            </div>
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              {item.products?.product_name || 'Unknown Product'}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <StateIcon stateName={distributorState} className="w-4 h-4" />
              <span className="text-sm font-medium text-gray-700 dark:text-zinc-300">
                {item.distributors?.name || 'Unknown Distributor'}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">
              New Quantity
            </label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              step="0.01"
              required
              autoFocus
              className="w-full px-4 py-3 glass rounded-xl text-gray-900 dark:text-white focus-ring text-lg font-semibold"
              placeholder="Enter quantity"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 glass rounded-xl text-gray-900 dark:text-white focus-ring resize-none"
              placeholder="Add any notes about this adjustment..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 px-4 py-3 glass rounded-xl text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-white/10 transition font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-3 bg-gradient-blue text-white rounded-xl hover:shadow-glow-blue transition font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
