import { useState, useEffect } from 'react';
import { tasksAPI } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  CheckCircle, 
  Clock, 
  Plus,
  Trash2,
  Filter,
  AlertTriangle,
  Calendar
} from 'lucide-react';
import { format, parseISO, isPast, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TaskAnalytics from '@/components/TaskAnalytics';
import { BarChart3, ListTodo } from 'lucide-react';

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, pending, completed
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    assignee_email: '',
    due_date: '',
    priority: 'medium'
  });

  const fetchTasks = async () => {
    try {
      const data = await tasksAPI.getAll();
      setTasks(data);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
      toast.error('Erreur lors du chargement des tâches');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleCreateTask = async (e) => {
    e.preventDefault();
    try {
      await tasksAPI.create({
        ...newTask,
        assignee_email: newTask.assignee_email || 'self@example.com',
        due_date: newTask.due_date ? new Date(newTask.due_date).toISOString() : null
      });
      toast.success('Tâche créée');
      setDialogOpen(false);
      setNewTask({
        title: '',
        description: '',
        assignee_email: '',
        due_date: '',
        priority: 'medium'
      });
      fetchTasks();
    } catch (error) {
      console.error('Failed to create task:', error);
      toast.error('Erreur lors de la création');
    }
  };

  const handleToggleComplete = async (task) => {
    try {
      const newStatus = task.status === 'completed' ? 'pending' : 'completed';
      await tasksAPI.update(task.task_id, { status: newStatus });
      toast.success(newStatus === 'completed' ? 'Tâche terminée' : 'Tâche rouverte');
      fetchTasks();
    } catch (error) {
      console.error('Failed to update task:', error);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Supprimer cette tâche ?')) return;
    try {
      await tasksAPI.delete(taskId);
      toast.success('Tâche supprimée');
      fetchTasks();
    } catch (error) {
      console.error('Failed to delete task:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const getPriorityBadge = (priority) => {
    const styles = {
      high: 'bg-red-500/20 text-red-500',
      medium: 'bg-orange-500/20 text-orange-500',
      low: 'bg-green-500/20 text-green-500'
    };
    const labels = {
      high: 'Urgent',
      medium: 'Normal',
      low: 'Faible'
    };
    return <Badge className={`${styles[priority]} border-0`}>{labels[priority]}</Badge>;
  };

  const isOverdue = (dueDate) => {
    if (!dueDate) return false;
    const date = parseISO(dueDate);
    return isPast(date) && !isToday(date);
  };

  const filteredTasks = tasks.filter(task => {
    if (filter === 'pending') return task.status !== 'completed';
    if (filter === 'completed') return task.status === 'completed';
    return true;
  });

  const sortedTasks = [...filteredTasks].sort((a, b) => {
    // Sort by status (pending first), then by priority, then by due date
    if (a.status !== b.status) {
      return a.status === 'completed' ? 1 : -1;
    }
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    if (a.due_date && b.due_date) {
      return new Date(a.due_date) - new Date(b.due_date);
    }
    return 0;
  });

  const pendingCount = tasks.filter(t => t.status !== 'completed').length;
  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const overdueCount = tasks.filter(t => t.status !== 'completed' && isOverdue(t.due_date)).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="tasks-page">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tâches & Analytics</h1>
        <p className="text-muted-foreground">Gérez vos tâches et suivez votre efficacité</p>
      </div>

      <Tabs defaultValue="tasks" className="space-y-6">
        <TabsList>
          <TabsTrigger value="tasks">
            <ListTodo className="w-4 h-4 mr-2" />
            Mes Tâches
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <BarChart3 className="w-4 h-4 mr-2" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="space-y-6">
          <div className="flex items-center justify-end gap-4">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="new-task-btn">
              <Plus className="w-4 h-4 mr-2" />
              Nouvelle Tâche
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouvelle tâche</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateTask} className="space-y-4">
              <div className="space-y-2">
                <Label>Titre *</Label>
                <Input
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  placeholder="Titre de la tâche"
                  required
                  data-testid="new-task-title"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  placeholder="Description optionnelle"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Échéance</Label>
                  <Input
                    type="date"
                    value={newTask.due_date}
                    onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                    data-testid="new-task-due-date"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Priorité</Label>
                  <Select
                    value={newTask.priority}
                    onValueChange={(value) => setNewTask({ ...newTask, priority: value })}
                  >
                    <SelectTrigger data-testid="new-task-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Faible</SelectItem>
                      <SelectItem value="medium">Normal</SelectItem>
                      <SelectItem value="high">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button type="submit" className="w-full" data-testid="submit-new-task">
                Créer la tâche
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="hover-card">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-orange-500/10 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pendingCount}</p>
              <p className="text-sm text-muted-foreground">En attente</p>
            </div>
          </CardContent>
        </Card>
        <Card className="hover-card">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{completedCount}</p>
              <p className="text-sm text-muted-foreground">Terminées</p>
            </div>
          </CardContent>
        </Card>
        <Card className="hover-card">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-red-500/10 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{overdueCount}</p>
              <p className="text-sm text-muted-foreground">En retard</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <Button
          variant={filter === 'all' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setFilter('all')}
          data-testid="filter-all"
        >
          Toutes ({tasks.length})
        </Button>
        <Button
          variant={filter === 'pending' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setFilter('pending')}
          data-testid="filter-pending"
        >
          En attente ({pendingCount})
        </Button>
        <Button
          variant={filter === 'completed' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setFilter('completed')}
          data-testid="filter-completed"
        >
          Terminées ({completedCount})
        </Button>
      </div>

      {/* Tasks List */}
      <Card>
        <CardContent className="p-0">
          {sortedTasks.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Aucune tâche</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {sortedTasks.map((task) => (
                <div
                  key={task.task_id}
                  className={`flex items-start gap-4 p-4 hover:bg-accent/50 transition-colors ${
                    task.status === 'completed' ? 'opacity-60' : ''
                  }`}
                  data-testid={`task-item-${task.task_id}`}
                >
                  <Checkbox
                    checked={task.status === 'completed'}
                    onCheckedChange={() => handleToggleComplete(task)}
                    className="mt-1"
                    data-testid={`task-checkbox-${task.task_id}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`font-medium ${task.status === 'completed' ? 'line-through' : ''}`}>
                        {task.title}
                      </p>
                      {getPriorityBadge(task.priority)}
                      {isOverdue(task.due_date) && task.status !== 'completed' && (
                        <Badge variant="destructive" className="text-xs">En retard</Badge>
                      )}
                    </div>
                    {task.description && (
                      <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      {task.due_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(parseISO(task.due_date), 'dd MMM yyyy', { locale: fr })}
                        </span>
                      )}
                      {task.meeting_id && (
                        <span className="text-primary">Lié à une réunion</span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteTask(task.task_id)}
                    className="text-muted-foreground hover:text-destructive flex-shrink-0"
                    data-testid={`delete-task-${task.task_id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <TaskAnalytics />
        </TabsContent>
      </Tabs>
    </div>
  );
}
