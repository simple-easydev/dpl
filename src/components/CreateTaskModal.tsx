import { useState, useEffect } from 'react';
import { X, Calendar, Flag, User, AlertCircle } from 'lucide-react';
import { createTask, TaskInsert } from '../lib/taskService';
import { useAuth } from '../contexts/AuthContext';
import { useOrganization } from '../contexts/OrganizationContext';
import { Insight } from '../lib/insightGenerator';

interface CreateTaskModalProps {
  onClose: () => void;
  onTaskCreated: () => void;
  insight?: Insight;
  prefilledData?: Partial<TaskInsert>;
}

export default function CreateTaskModal({ onClose, onTaskCreated, insight, prefilledData }: CreateTaskModalProps) {
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();

  const [title, setTitle] = useState(prefilledData?.title || insight?.title || '');
  const [description, setDescription] = useState(prefilledData?.description || insight?.description || '');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>(
    prefilledData?.priority || (insight?.severity === 'high' ? 'high' : insight?.severity === 'medium' ? 'medium' : 'low')
  );
  const [dueDate, setDueDate] = useState(prefilledData?.due_date?.split('T')[0] || '');
  const [relatedAccount, setRelatedAccount] = useState(prefilledData?.related_account || '');
  const [relatedProduct, setRelatedProduct] = useState(prefilledData?.related_product || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (insight) {
      if (insight.metrics) {
        const accountName = Object.entries(insight.metrics).find(([key]) =>
          key.toLowerCase().includes('account')
        )?.[1];
        if (accountName && typeof accountName === 'string') {
          setRelatedAccount(accountName);
        }
      }

      if (insight.type === 'risk' || insight.type === 'decline') {
        const productMatch = insight.title.match(/^(.+?)\s*-/);
        if (productMatch) {
          setRelatedProduct(productMatch[1].trim());
        }
      }
    }
  }, [insight]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user || !currentOrganization) {
      setError('User or organization not found');
      return;
    }

    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const taskData: TaskInsert = {
        organization_id: currentOrganization.id,
        user_id: user.id,
        title: title.trim(),
        description: description.trim() || null,
        priority,
        status: 'pending',
        due_date: dueDate || null,
        related_account: relatedAccount.trim() || null,
        related_product: relatedProduct.trim() || null,
        insight_id: insight?.id || null,
        auto_generated: false,
        tags: insight ? [insight.type] : [],
        metadata: insight ? {
          insightType: insight.type,
          insightSeverity: insight.severity,
        } : {},
      };

      await createTask(taskData);
      onTaskCreated();
      onClose();
    } catch (err) {
      console.error('Error creating task:', err);
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  const priorityColors = {
    low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    urgent: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-card rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 glass-card border-b border-white/10 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-xl font-semibold text-theme-text">
            {insight ? 'Create Task from Insight' : 'Create New Task'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors text-theme-muted hover:text-theme-text"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {insight && (
            <div className="glass rounded-xl p-4 border border-blue-500/30 bg-blue-500/5">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-theme-text mb-1">Creating task from insight</p>
                  <p className="text-xs text-theme-muted">{insight.title}</p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="glass rounded-xl p-4 border border-red-500/30 bg-red-500/5">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-theme-text mb-2">
              Task Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2.5 glass rounded-xl border border-white/10 focus:border-accent-primary focus:outline-none text-theme-text placeholder-theme-muted/50"
              placeholder="Enter task title..."
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-theme-text mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full px-4 py-2.5 glass rounded-xl border border-white/10 focus:border-accent-primary focus:outline-none text-theme-text placeholder-theme-muted/50 resize-none"
              placeholder="Enter task description..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-theme-text mb-2">
                <Flag className="w-4 h-4 inline mr-1" />
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className={`w-full px-4 py-2.5 glass rounded-xl border focus:border-accent-primary focus:outline-none text-theme-text font-semibold ${priorityColors[priority]}`}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-theme-text mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-4 py-2.5 glass rounded-xl border border-white/10 focus:border-accent-primary focus:outline-none text-theme-text"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-theme-text mb-2">
                <User className="w-4 h-4 inline mr-1" />
                Related Account
              </label>
              <input
                type="text"
                value={relatedAccount}
                onChange={(e) => setRelatedAccount(e.target.value)}
                className="w-full px-4 py-2.5 glass rounded-xl border border-white/10 focus:border-accent-primary focus:outline-none text-theme-text placeholder-theme-muted/50"
                placeholder="Account name..."
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-theme-text mb-2">
                Related Product
              </label>
              <input
                type="text"
                value={relatedProduct}
                onChange={(e) => setRelatedProduct(e.target.value)}
                className="w-full px-4 py-2.5 glass rounded-xl border border-white/10 focus:border-accent-primary focus:outline-none text-theme-text placeholder-theme-muted/50"
                placeholder="Product name..."
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 glass rounded-xl text-theme-muted hover:bg-white/10 transition-all duration-300 font-semibold"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-gradient-blue text-white rounded-xl hover:shadow-glow-blue transition-all duration-300 font-semibold disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
