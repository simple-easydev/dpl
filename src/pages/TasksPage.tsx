import { useState, useEffect } from 'react';
import { useOrganization } from '../contexts/OrganizationContext';
import { useAuth } from '../contexts/AuthContext';
import {
  getTasks,
  getTaskStats,
  updateTask,
  completeTask,
  deleteTask,
  Task,
  TaskFilters,
} from '../lib/taskService';
import {
  CheckCircle2,
  Clock,
  Flag,
  Calendar,
  Filter,
  Plus,
  AlertCircle,
  Trash2,
  Edit,
  User,
  TrendingUp,
  BarChart3,
} from 'lucide-react';
import CreateTaskModal from '../components/CreateTaskModal';
import { format, formatDistanceToNow, isPast } from 'date-fns';

type TaskView = 'all' | 'my-tasks' | 'pending' | 'in-progress' | 'completed' | 'overdue';

export default function TasksPage() {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedView, setSelectedView] = useState<TaskView>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0,
    overdue: 0,
    highPriority: 0,
  });

  useEffect(() => {
    if (currentOrganization) {
      loadTasks();
      loadStats();
    }
  }, [currentOrganization]);

  useEffect(() => {
    applyFilters();
  }, [tasks, selectedView, filterPriority]);

  const loadTasks = async () => {
    if (!currentOrganization) return;

    setLoading(true);
    setError(null);

    try {
      const allTasks = await getTasks(currentOrganization.id);
      setTasks(allTasks);
    } catch (err) {
      console.error('Error loading tasks:', err);
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    if (!currentOrganization) return;

    try {
      const taskStats = await getTaskStats(currentOrganization.id);
      setStats(taskStats);
    } catch (err) {
      console.error('Error loading task stats:', err);
    }
  };

  const applyFilters = () => {
    let filtered = [...tasks];

    switch (selectedView) {
      case 'my-tasks':
        filtered = filtered.filter(t => t.assigned_to === user?.id || t.user_id === user?.id);
        break;
      case 'pending':
        filtered = filtered.filter(t => t.status === 'pending');
        break;
      case 'in-progress':
        filtered = filtered.filter(t => t.status === 'in_progress');
        break;
      case 'completed':
        filtered = filtered.filter(t => t.status === 'completed');
        break;
      case 'overdue':
        filtered = filtered.filter(t => {
          if (t.status === 'completed' || t.status === 'cancelled') return false;
          return t.due_date && isPast(new Date(t.due_date));
        });
        break;
    }

    if (filterPriority !== 'all') {
      filtered = filtered.filter(t => t.priority === filterPriority);
    }

    setFilteredTasks(filtered);
  };

  const handleStatusChange = async (taskId: string, newStatus: Task['status']) => {
    try {
      if (newStatus === 'completed') {
        await completeTask(taskId);
      } else {
        await updateTask(taskId, { status: newStatus });
      }
      await loadTasks();
      await loadStats();
    } catch (err) {
      console.error('Error updating task status:', err);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;

    try {
      await deleteTask(taskId);
      await loadTasks();
      await loadStats();
    } catch (err) {
      console.error('Error deleting task:', err);
    }
  };

  const handleTaskCreated = () => {
    loadTasks();
    loadStats();
  };

  const priorityColors = {
    low: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
    medium: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/30' },
    high: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30' },
    urgent: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' },
  };

  const statusColors = {
    pending: { bg: 'bg-gray-500/10', text: 'text-gray-400' },
    in_progress: { bg: 'bg-blue-500/10', text: 'text-blue-400' },
    completed: { bg: 'bg-teal-500/10', text: 'text-teal-400' },
    cancelled: { bg: 'bg-red-500/10', text: 'text-red-400' },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary mx-auto mb-4"></div>
          <p className="text-theme-muted">Loading tasks...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="glass-card rounded-2xl p-8 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-theme-text mb-2">Error Loading Tasks</h2>
          <p className="text-theme-muted mb-6">{error}</p>
          <button
            onClick={loadTasks}
            className="px-6 py-2.5 bg-gradient-blue text-white rounded-xl hover:shadow-glow-blue transition-all duration-300 font-semibold"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-semibold text-theme-text mb-2">Tasks & Actions</h1>
          <p className="text-theme-muted">Manage AI-generated and manual tasks</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2.5 bg-gradient-blue text-white rounded-xl text-sm flex items-center gap-2 hover:shadow-glow-blue transition-all duration-300 font-semibold"
        >
          <Plus className="w-4 h-4" />
          <span>New Task</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          icon={BarChart3}
          label="Total Tasks"
          value={stats.total}
          color="blue"
        />
        <StatCard
          icon={Clock}
          label="Pending"
          value={stats.pending}
          color="gray"
        />
        <StatCard
          icon={TrendingUp}
          label="In Progress"
          value={stats.inProgress}
          color="blue"
        />
        <StatCard
          icon={CheckCircle2}
          label="Completed"
          value={stats.completed}
          color="teal"
        />
        <StatCard
          icon={AlertCircle}
          label="Overdue"
          value={stats.overdue}
          color="red"
          highlight={stats.overdue > 0}
        />
        <StatCard
          icon={Flag}
          label="High Priority"
          value={stats.highPriority}
          color="orange"
        />
      </div>

      <div className="glass-card rounded-2xl p-6">
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-theme-muted" />
            <span className="text-sm font-semibold text-theme-text">View:</span>
          </div>
          {(['all', 'my-tasks', 'pending', 'in-progress', 'completed', 'overdue'] as TaskView[]).map((view) => (
            <button
              key={view}
              onClick={() => setSelectedView(view)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-300 ${
                selectedView === view
                  ? 'bg-gradient-blue text-white shadow-glow-blue'
                  : 'glass text-theme-muted hover:text-theme-text hover:bg-white/10'
              }`}
            >
              {view.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <span className="text-sm font-semibold text-theme-text">Priority:</span>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="px-3 py-1.5 glass rounded-lg text-xs font-semibold text-theme-text border border-white/10 focus:border-accent-primary focus:outline-none"
            >
              <option value="all">All</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>

        {filteredTasks.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle2 className="w-16 h-16 text-theme-muted mx-auto mb-4 opacity-50" />
            <p className="text-theme-muted text-lg">No tasks found</p>
            <p className="text-sm text-theme-muted mt-2">
              {selectedView !== 'all' ? 'Try changing your filter' : 'Create a task to get started'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                priorityColors={priorityColors}
                statusColors={statusColors}
                onStatusChange={handleStatusChange}
                onDelete={handleDeleteTask}
              />
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateTaskModal
          onClose={() => setShowCreateModal(false)}
          onTaskCreated={handleTaskCreated}
        />
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  highlight = false,
}: {
  icon: any;
  label: string;
  value: number;
  color: string;
  highlight?: boolean;
}) {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600',
    gray: 'from-gray-500 to-gray-600',
    teal: 'from-teal-500 to-teal-600',
    red: 'from-red-500 to-red-600',
    orange: 'from-orange-500 to-orange-600',
  };

  return (
    <div className={`glass-card rounded-xl p-4 ${highlight ? 'ring-2 ring-red-500/50' : ''}`}>
      <div className="flex items-center gap-3">
        <div className={`bg-gradient-to-br ${colorClasses[color as keyof typeof colorClasses]} rounded-lg p-2.5`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-2xl font-bold text-theme-text">{value}</p>
          <p className="text-xs text-theme-muted">{label}</p>
        </div>
      </div>
    </div>
  );
}

function TaskCard({
  task,
  priorityColors,
  statusColors,
  onStatusChange,
  onDelete,
}: {
  task: Task;
  priorityColors: any;
  statusColors: any;
  onStatusChange: (id: string, status: Task['status']) => void;
  onDelete: (id: string) => void;
}) {
  const isOverdue = task.due_date && isPast(new Date(task.due_date)) && task.status !== 'completed' && task.status !== 'cancelled';

  return (
    <div className={`glass rounded-xl p-4 border ${isOverdue ? 'border-red-500/30 bg-red-500/5' : 'border-white/10'} hover:border-white/20 transition-all duration-300`}>
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex-1">
              <h3 className="font-semibold text-theme-text text-base mb-1">{task.title}</h3>
              {task.description && (
                <p className="text-sm text-theme-muted line-clamp-2">{task.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${priorityColors[task.priority].bg} ${priorityColors[task.priority].text} border ${priorityColors[task.priority].border}`}>
                {task.priority}
              </span>
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusColors[task.status].bg} ${statusColors[task.status].text}`}>
                {task.status.replace('_', ' ')}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-theme-muted mt-3">
            {task.due_date && (
              <div className={`flex items-center gap-1 ${isOverdue ? 'text-red-400 font-semibold' : ''}`}>
                <Calendar className="w-3.5 h-3.5" />
                <span>Due {formatDistanceToNow(new Date(task.due_date), { addSuffix: true })}</span>
              </div>
            )}
            {task.related_account && (
              <div className="flex items-center gap-1">
                <User className="w-3.5 h-3.5" />
                <span>{task.related_account}</span>
              </div>
            )}
            {task.related_revenue && (
              <div className="flex items-center gap-1 font-semibold">
                <span>${task.related_revenue.toLocaleString()}</span>
              </div>
            )}
            {task.auto_generated && (
              <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded-full text-xs font-semibold">
                AI Generated
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/10">
            {task.status !== 'completed' && task.status !== 'cancelled' && (
              <>
                <button
                  onClick={() => onStatusChange(task.id, task.status === 'pending' ? 'in_progress' : 'completed')}
                  className="px-3 py-1.5 glass rounded-lg text-xs font-semibold text-theme-text hover:bg-white/10 transition-all duration-300 flex items-center gap-1"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {task.status === 'pending' ? 'Start' : 'Complete'}
                </button>
              </>
            )}
            {task.status === 'completed' && (
              <span className="px-3 py-1.5 text-xs font-semibold text-teal-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Completed {task.completed_at && format(new Date(task.completed_at), 'MMM d')}
              </span>
            )}
            <button
              onClick={() => onDelete(task.id)}
              className="ml-auto px-3 py-1.5 glass rounded-lg text-xs font-semibold text-red-400 hover:bg-red-500/10 transition-all duration-300 flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
