import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { meetingsAPI, tasksAPI, statsAPI } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Calendar, 
  CheckCircle, 
  Clock, 
  Plus, 
  ArrowRight,
  Users,
  FileText,
  Timer,
  AlertCircle
} from 'lucide-react';
import { format, parseISO, isToday, isTomorrow, isPast } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [meetings, setMeetings] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsData, meetingsData, tasksData] = await Promise.all([
          statsAPI.get(),
          meetingsAPI.getAll(),
          tasksAPI.getAll()
        ]);
        setStats(statsData);
        setMeetings(meetingsData);
        setTasks(tasksData);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
        toast.error('Erreur lors du chargement des données');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const getDateLabel = (dateStr) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return "Aujourd'hui";
    if (isTomorrow(date)) return 'Demain';
    return format(date, 'dd MMM', { locale: fr });
  };

  const getStatusBadge = (status) => {
    const styles = {
      scheduled: 'bg-blue-500/20 text-blue-500',
      in_progress: 'bg-orange-500/20 text-orange-500',
      completed: 'bg-green-500/20 text-green-500',
      cancelled: 'bg-red-500/20 text-red-500'
    };
    const labels = {
      scheduled: 'Planifiée',
      in_progress: 'En cours',
      completed: 'Terminée',
      cancelled: 'Annulée'
    };
    return (
      <Badge className={`${styles[status]} border-0`}>
        {labels[status]}
      </Badge>
    );
  };

  const getPriorityColor = (priority) => {
    return {
      high: 'border-l-red-500',
      medium: 'border-l-orange-500',
      low: 'border-l-green-500'
    }[priority] || 'border-l-gray-500';
  };

  const upcomingMeetings = meetings
    .filter(m => m.status === 'scheduled' || m.status === 'in_progress')
    .slice(0, 5);

  const pendingTasks = tasks
    .filter(t => t.status !== 'completed')
    .slice(0, 5);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="dashboard">
      {/* Welcome & Quick Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Bienvenue ! Voici un aperçu de vos activités.</p>
        </div>
        <Link to="/meetings/new">
          <Button data-testid="new-meeting-btn">
            <Plus className="w-4 h-4 mr-2" />
            Nouvelle Réunion
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Réunions totales</p>
                <p className="text-3xl font-bold mt-1">{stats?.total_meetings || 0}</p>
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <Calendar className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">À venir</p>
                <p className="text-3xl font-bold mt-1">{stats?.upcoming_meetings || 0}</p>
              </div>
              <div className="w-12 h-12 bg-orange-500/10 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Tâches en attente</p>
                <p className="text-3xl font-bold mt-1">{stats?.pending_tasks || 0}</p>
              </div>
              <div className="w-12 h-12 bg-yellow-500/10 rounded-lg flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-yellow-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Tâches terminées</p>
                <p className="text-3xl font-bold mt-1">{stats?.completed_tasks || 0}</p>
              </div>
              <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Meetings */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Prochaines réunions
            </CardTitle>
            <Link to="/meetings/new" className="text-sm text-primary hover:underline">
              Voir tout
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingMeetings.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Aucune réunion planifiée</p>
                <Link to="/meetings/new">
                  <Button variant="outline" size="sm" className="mt-3">
                    <Plus className="w-4 h-4 mr-2" />
                    Créer une réunion
                  </Button>
                </Link>
              </div>
            ) : (
              upcomingMeetings.map((meeting) => (
                <Link
                  key={meeting.meeting_id}
                  to={meeting.status === 'in_progress' ? `/meetings/${meeting.meeting_id}/live` : `/meetings/${meeting.meeting_id}`}
                  className="block"
                  data-testid={`meeting-card-${meeting.meeting_id}`}
                >
                  <div className="flex items-center gap-4 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors">
                    <div className="flex-shrink-0 w-14 text-center">
                      <p className="text-xs text-muted-foreground uppercase">
                        {getDateLabel(meeting.scheduled_date)}
                      </p>
                      <p className="text-lg font-bold">
                        {format(parseISO(meeting.scheduled_date), 'HH:mm')}
                      </p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{meeting.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Users className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {meeting.participants?.length || 0} participants
                        </span>
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      {getStatusBadge(meeting.status)}
                    </div>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        {/* Pending Tasks */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-primary" />
              Tâches en attente
            </CardTitle>
            <Link to="/tasks" className="text-sm text-primary hover:underline">
              Voir tout
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingTasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Aucune tâche en attente</p>
              </div>
            ) : (
              pendingTasks.map((task) => (
                <div
                  key={task.task_id}
                  className={`p-3 rounded-lg border border-border border-l-4 ${getPriorityColor(task.priority)} hover:bg-accent/50 transition-colors`}
                  data-testid={`task-card-${task.task_id}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{task.title}</p>
                      {task.due_date && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Échéance: {format(parseISO(task.due_date), 'dd MMM yyyy', { locale: fr })}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline" className="flex-shrink-0">
                      {task.priority === 'high' ? 'Urgent' : task.priority === 'medium' ? 'Normal' : 'Faible'}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Actions rapides</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link to="/meetings/new">
              <Button variant="outline" className="w-full h-auto py-4 flex-col gap-2">
                <Timer className="w-6 h-6 text-primary" />
                <span>Nouvelle réunion</span>
              </Button>
            </Link>
            <Link to="/tasks">
              <Button variant="outline" className="w-full h-auto py-4 flex-col gap-2">
                <CheckCircle className="w-6 h-6 text-primary" />
                <span>Gérer les tâches</span>
              </Button>
            </Link>
            <Link to="/reports">
              <Button variant="outline" className="w-full h-auto py-4 flex-col gap-2">
                <FileText className="w-6 h-6 text-primary" />
                <span>Voir les rapports</span>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
