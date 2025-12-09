import { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Target,
  Zap,
  Calendar,
  UserCheck,
  UserPlus,
  MapPin,
  Package,
  Award,
  Sparkles,
  LucideIcon,
  Plus,
  CheckCircle2,
  Users,
  Clock
} from 'lucide-react';
import { Insight } from '../lib/insightGenerator';
import { getTasksByInsight } from '../lib/taskService';
import { useOrganization } from '../contexts/OrganizationContext';
import CreateTaskModal from './CreateTaskModal';

interface InsightCardsProps {
  insights: Insight[];
  onTaskCreated?: () => void;
}

const iconMap: Record<string, LucideIcon> = {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Target,
  Zap,
  Calendar,
  UserCheck,
  UserPlus,
  MapPin,
  Package,
  PackageMinus: Package,
  Award,
  Sparkles,
  Users,
  Clock,
};

const severityColors = {
  high: {
    badgeBg: 'bg-accent-orange-500/20',
    badgeText: 'text-accent-orange-400',
    accentColor: 'border-l-accent-orange-500',
  },
  medium: {
    badgeBg: 'bg-accent-orange-400/20',
    badgeText: 'text-accent-orange-300',
    accentColor: 'border-l-accent-orange-400',
  },
  low: {
    badgeBg: 'bg-accent-blue-500/20',
    badgeText: 'text-accent-blue-400',
    accentColor: 'border-l-accent-blue-500',
  },
};

const typeColors = {
  growth: {
    iconBg: 'bg-gradient-teal',
  },
  opportunity: {
    iconBg: 'bg-gradient-blue',
  },
  risk: {
    iconBg: 'bg-gradient-orange',
  },
  decline: {
    iconBg: 'bg-gradient-orange',
  },
  anomaly: {
    iconBg: 'bg-gradient-orange',
  },
  seasonal: {
    iconBg: 'bg-gradient-blue-light',
  },
  forecast: {
    iconBg: 'bg-gradient-blue',
  },
  account_lapse: {
    iconBg: 'bg-gradient-orange',
  },
  account_visit: {
    iconBg: 'bg-gradient-orange',
  },
  account_engagement: {
    iconBg: 'bg-gradient-teal',
  },
};

export default function InsightCards({ insights, onTaskCreated }: InsightCardsProps) {
  if (!insights || insights.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-theme-text">AI-Powered Insights</h2>
        <div className="flex items-center gap-2 text-sm text-theme-muted">
          <Sparkles className="w-4 h-4 text-accent-purple-400" />
          <span>Auto-generated analysis</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {insights.map((insight) => (
          <InsightCard key={insight.id} insight={insight} onTaskCreated={onTaskCreated} />
        ))}
      </div>
    </div>
  );
}

function InsightCard({ insight, onTaskCreated }: { insight: Insight; onTaskCreated?: () => void }) {
  const Icon = iconMap[insight.icon] || Sparkles;
  const colors = typeColors[insight.type];
  const severityColor = severityColors[insight.severity];
  const { currentOrganization } = useOrganization();

  const [hasTask, setHasTask] = useState(false);
  const [taskCount, setTaskCount] = useState(0);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(true);

  useEffect(() => {
    if (currentOrganization) {
      loadTasks();
    }
  }, [currentOrganization, insight.id]);

  const loadTasks = async () => {
    if (!currentOrganization) return;

    setLoadingTasks(true);
    try {
      const tasks = await getTasksByInsight(currentOrganization.id, insight.id);
      setHasTask(tasks.length > 0);
      setTaskCount(tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled').length);
    } catch (error) {
      console.error('Error loading tasks for insight:', error);
    } finally {
      setLoadingTasks(false);
    }
  };

  const handleTaskCreated = () => {
    loadTasks();
    if (onTaskCreated) {
      onTaskCreated();
    }
  };

  return (
    <>
      <div
        className={`glass-card rounded-2xl p-5 hover:scale-[1.02] transition-all duration-300 glow-hover-purple border-l-4 ${severityColor.accentColor}`}
      >
        <div className="flex items-start gap-4">
          <div className={`${colors.iconBg} rounded-xl p-3 flex-shrink-0 shadow-glass`}>
            <Icon className="w-5 h-5 text-white" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="font-semibold text-theme-text text-base leading-tight">
                {insight.title}
              </h3>
              <span
                className={`${
                  severityColor.badgeBg
                } ${
                  severityColor.badgeText
                } text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 uppercase tracking-wide`}
              >
                {insight.severity}
              </span>
            </div>

            {insight.accountName && (
              <div className="flex items-center gap-2 mb-2 px-3 py-1.5 bg-white/5 rounded-lg border border-white/10 w-fit">
                <UserCheck className="w-3.5 h-3.5 text-accent-teal-400" />
                <span className="text-xs font-semibold text-theme-text">{insight.accountName}</span>
              </div>
            )}

            <p className="text-sm text-theme-muted leading-relaxed mb-3">
              {insight.description}
            </p>

            {insight.actionItems && insight.actionItems.length > 0 && (
              <div className="bg-white/5 rounded-lg p-3 mb-3 border border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-3.5 h-3.5 text-accent-teal-400" />
                  <span className="text-xs font-semibold text-theme-text uppercase tracking-wide">Action Items</span>
                </div>
                <ul className="space-y-1.5">
                  {insight.actionItems.map((action, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs text-theme-muted">
                      <span className="text-accent-teal-400 mt-0.5">•</span>
                      <span className="leading-relaxed">{action}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {insight.topProducts && insight.topProducts.length > 0 && (
              <div className="bg-white/5 rounded-lg p-2.5 mb-3 border border-white/10">
                <div className="flex items-center gap-2 mb-1.5">
                  <Package className="w-3.5 h-3.5 text-accent-blue-400" />
                  <span className="text-xs font-semibold text-theme-text uppercase tracking-wide">Top Products</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {insight.topProducts.slice(0, 3).map((product, idx) => (
                    <span key={idx} className="text-xs px-2 py-1 bg-white/5 rounded-md text-theme-muted border border-white/10">
                      {product}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {insight.representativeName && (
              <div className="bg-white/5 rounded-lg p-2.5 mb-3 border border-white/10">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-3.5 h-3.5 text-accent-purple-400" />
                  <span className="text-xs font-semibold text-theme-text uppercase tracking-wide">Assigned Rep</span>
                  <span className="text-xs text-theme-muted ml-auto">{insight.representativeName}</span>
                </div>
              </div>
            )}

            {insight.metrics && Object.keys(insight.metrics).length > 0 && (
              <div className="flex flex-wrap gap-4 pt-3 border-t border-white/10 mb-3">
                {Object.entries(insight.metrics).map(([key, value]) => (
                  <div key={key} className="flex flex-col">
                    <span className="text-xs text-theme-muted mb-1 uppercase tracking-wide">{key}</span>
                    <span className="text-sm font-semibold text-theme-text">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2 pt-3 border-t border-white/10">
              {!loadingTasks && hasTask ? (
                <div className="flex items-center gap-2 text-xs font-semibold text-teal-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{taskCount} active {taskCount === 1 ? 'task' : 'tasks'}</span>
                </div>
              ) : (
                <button
                  onClick={() => setShowCreateTask(true)}
                  className="flex items-center gap-2 px-3 py-1.5 glass rounded-lg text-xs font-semibold text-theme-text hover:bg-white/10 transition-all duration-300 border border-white/10 hover:border-accent-primary"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Create Task
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {showCreateTask && (
        <CreateTaskModal
          insight={insight}
          onClose={() => setShowCreateTask(false)}
          onTaskCreated={handleTaskCreated}
        />
      )}
    </>
  );
}
