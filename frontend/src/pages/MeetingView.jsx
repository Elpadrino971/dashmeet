import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { meetingsAPI, tasksAPI, reportsAPI } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  ArrowLeft, 
  Play, 
  Calendar, 
  Clock, 
  Users,
  Plus,
  Trash2,
  FileText,
  Sparkles,
  Edit,
  CheckCircle
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function MeetingView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [generatingReports, setGeneratingReports] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    assignee_email: '',
    assignee_name: '',
    due_date: '',
    priority: 'medium'
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [meetingData, tasksData] = await Promise.all([
          meetingsAPI.getById(id),
          tasksAPI.getAll(id)
        ]);
        setMeeting(meetingData);
        setTasks(tasksData);
      } catch (error) {
        console.error('Failed to fetch meeting:', error);
        toast.error('Erreur lors du chargement de la réunion');
        navigate('/dashboard');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, navigate]);

  const handleStartMeeting = async () => {
    try {
      await meetingsAPI.start(id);
      toast.success('Réunion démarrée');
      navigate(`/meetings/${id}/live`);
    } catch (error) {
      console.error('Failed to start meeting:', error);
      toast.error('Erreur lors du démarrage');
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    try {
      await tasksAPI.create({
        ...newTask,
        meeting_id: id,
        due_date: newTask.due_date ? new Date(newTask.due_date).toISOString() : null
      });
      toast.success('Tâche créée');
      setTaskDialogOpen(false);
      setNewTask({
        title: '',
        description: '',
        assignee_email: '',
        assignee_name: '',
        due_date: '',
        priority: 'medium'
      });
      // Refresh tasks
      const tasksData = await tasksAPI.getAll(id);
      setTasks(tasksData);
    } catch (error) {
      console.error('Failed to create task:', error);
      toast.error('Erreur lors de la création de la tâche');
    }
  };

  const handleGenerateReports = async () => {
    setGeneratingReports(true);
    try {
      await reportsAPI.generate(id);
      toast.success('Génération des rapports en cours. Vérifiez la page Rapports dans quelques instants.');
    } catch (error) {
      console.error('Failed to generate reports:', error);
      toast.error('Erreur lors de la génération des rapports');
    } finally {
      setGeneratingReports(false);
    }
  };

  const handleDeleteMeeting = async () => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette réunion ?')) return;
    try {
      await meetingsAPI.delete(id);
      toast.success('Réunion supprimée');
      navigate('/dashboard');
    } catch (error) {
      console.error('Failed to delete meeting:', error);
      toast.error('Erreur lors de la suppression');
    }
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
    return <Badge className={`${styles[status]} border-0`}>{labels[status]}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!meeting) return null;

  const totalDuration = meeting.agenda?.reduce((sum, item) => sum + (item.duration_minutes || 0), 0) || 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6" data-testid="meeting-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')} data-testid="back-btn">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{meeting.title}</h1>
              {getStatusBadge(meeting.status)}
            </div>
            <p className="text-muted-foreground mt-1">{meeting.description}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {meeting.status === 'scheduled' && (
            <Button onClick={handleStartMeeting} data-testid="start-meeting-btn">
              <Play className="w-4 h-4 mr-2" />
              Démarrer
            </Button>
          )}
          {meeting.status === 'in_progress' && (
            <Link to={`/meetings/${id}/live`}>
              <Button data-testid="join-meeting-btn">
                <Play className="w-4 h-4 mr-2" />
                Rejoindre
              </Button>
            </Link>
          )}
          {meeting.status === 'completed' && (
            <Button onClick={handleGenerateReports} disabled={generatingReports} data-testid="generate-reports-btn">
              <Sparkles className="w-4 h-4 mr-2" />
              {generatingReports ? 'Génération...' : 'Générer rapports IA'}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Meeting details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                Détails
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Date</p>
                  <p className="font-medium">
                    {format(parseISO(meeting.scheduled_date), 'EEEE d MMMM yyyy', { locale: fr })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Heure</p>
                  <p className="font-medium">
                    {format(parseISO(meeting.scheduled_date), 'HH:mm', { locale: fr })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Organisateur</p>
                  <p className="font-medium">{meeting.organizer_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Durée estimée</p>
                  <p className="font-medium">{totalDuration} minutes</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Agenda */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Ordre du jour
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {meeting.agenda?.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">Aucun sujet défini</p>
              ) : (
                meeting.agenda?.map((item, index) => (
                  <div 
                    key={item.item_id || index}
                    className={`flex items-start gap-4 p-4 rounded-lg border border-border ${
                      item.status === 'completed' ? 'opacity-60 bg-muted/30' : ''
                    }`}
                    data-testid={`agenda-item-${index}`}
                  >
                    <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-sm font-bold text-primary">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{item.title}</p>
                        {item.status === 'completed' && (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        )}
                      </div>
                      {item.speaker && (
                        <p className="text-sm text-muted-foreground">Intervenant: {item.speaker}</p>
                      )}
                      {item.description && (
                        <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                      )}
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <span className="font-mono text-sm bg-muted px-2 py-1 rounded">
                        {item.duration_minutes} min
                      </span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Participants */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Participants ({meeting.participants?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {meeting.participants?.length === 0 ? (
                <p className="text-muted-foreground text-sm">Aucun participant</p>
              ) : (
                <div className="space-y-2">
                  {meeting.participants?.map((email, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-medium">
                        {email.charAt(0).toUpperCase()}
                      </div>
                      <span className="truncate">{email}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tasks */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-primary" />
                Tâches ({tasks.length})
              </CardTitle>
              <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" data-testid="add-task-btn">
                    <Plus className="w-4 h-4" />
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
                        data-testid="task-title-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Assigné à (email) *</Label>
                      <Input
                        type="email"
                        value={newTask.assignee_email}
                        onChange={(e) => setNewTask({ ...newTask, assignee_email: e.target.value })}
                        placeholder="email@example.com"
                        required
                        data-testid="task-assignee-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Échéance</Label>
                      <Input
                        type="date"
                        value={newTask.due_date}
                        onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                        data-testid="task-due-date-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Priorité</Label>
                      <select
                        className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={newTask.priority}
                        onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                        data-testid="task-priority-select"
                      >
                        <option value="low">Faible</option>
                        <option value="medium">Normal</option>
                        <option value="high">Urgent</option>
                      </select>
                    </div>
                    <Button type="submit" className="w-full" data-testid="create-task-btn">
                      Créer la tâche
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {tasks.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-4">Aucune tâche</p>
              ) : (
                <div className="space-y-2">
                  {tasks.map((task) => (
                    <div 
                      key={task.task_id}
                      className={`p-3 rounded-lg border text-sm ${
                        task.status === 'completed' ? 'opacity-60 line-through' : ''
                      }`}
                    >
                      <p className="font-medium">{task.title}</p>
                      <p className="text-muted-foreground text-xs">{task.assignee_email}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardContent className="pt-6 space-y-2">
              <Link to="/reports" className="block">
                <Button variant="outline" className="w-full justify-start" data-testid="view-reports-btn">
                  <FileText className="w-4 h-4 mr-2" />
                  Voir les rapports
                </Button>
              </Link>
              <Button 
                variant="outline" 
                className="w-full justify-start text-destructive hover:text-destructive"
                onClick={handleDeleteMeeting}
                data-testid="delete-meeting-btn"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Supprimer la réunion
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
