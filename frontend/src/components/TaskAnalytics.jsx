import { useState, useEffect } from 'react';
import { tasksAPI } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  Target
} from 'lucide-react';
import { toast } from 'sonner';

export default function TaskAnalytics({ meetingId = null }) {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const data = await tasksAPI.getAnalytics(meetingId);
        setAnalytics(data);
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
        toast.error('Erreur lors du chargement des analytics');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [meetingId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!analytics) return null;

  return (
    <div className="space-y-6" data-testid="task-analytics">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Analytics des Tâches</h2>
        <p className="text-muted-foreground">Suivi de votre efficacité et performance</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Tasks */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tâches</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.total_tasks}</div>
            <p className="text-xs text-muted-foreground">
              {analytics.in_progress_tasks} en cours
            </p>
          </CardContent>
        </Card>

        {/* Completion Rate */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taux de Complétion</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.completion_rate}%</div>
            <Progress value={analytics.completion_rate} className="mt-2" />
          </CardContent>
        </Card>

        {/* Average Time */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Temps Moyen</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.avg_completion_time_hours.toFixed(1)}h
            </div>
            <p className="text-xs text-muted-foreground">
              Pour compléter une tâche
            </p>
          </CardContent>
        </Card>

        {/* Overdue */}
        <Card className={analytics.overdue_tasks > 0 ? 'border-red-500' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En Retard</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{analytics.overdue_tasks}</div>
            <p className="text-xs text-muted-foreground">
              Tâches en retard
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Status Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Répartition des Tâches
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Completed */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-medium">Complétées</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {analytics.completed_tasks} / {analytics.total_tasks}
                </span>
              </div>
              <Progress
                value={(analytics.completed_tasks / analytics.total_tasks) * 100}
                className="h-2 bg-green-100"
              />
            </div>

            {/* In Progress */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-orange-500" />
                  <span className="text-sm font-medium">En Cours</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {analytics.in_progress_tasks} / {analytics.total_tasks}
                </span>
              </div>
              <Progress
                value={(analytics.in_progress_tasks / analytics.total_tasks) * 100}
                className="h-2 bg-orange-100"
              />
            </div>

            {/* Pending */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="w-4 h-4 rounded-full" />
                  <span className="text-sm font-medium">En Attente</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {analytics.pending_tasks} / {analytics.total_tasks}
                </span>
              </div>
              <Progress
                value={(analytics.pending_tasks / analytics.total_tasks) * 100}
                className="h-2"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Priority Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Répartition par Priorité</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1 text-center p-4 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {analytics.priority_breakdown.high}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Haute</div>
            </div>
            <div className="flex-1 text-center p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {analytics.priority_breakdown.medium}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Moyenne</div>
            </div>
            <div className="flex-1 text-center p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {analytics.priority_breakdown.low}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Basse</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Estimated vs Actual */}
      {analytics.estimated_vs_actual.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Estimations vs Réalité</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.estimated_vs_actual.slice(0, 5).map((item) => (
                <div key={item.task_id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex-1">
                    <p className="text-sm font-medium truncate">{item.title}</p>
                    <div className="flex gap-4 mt-1">
                      <span className="text-xs text-muted-foreground">
                        Estimé: {item.estimated}h
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Réel: {item.actual}h
                      </span>
                    </div>
                  </div>
                  <Badge variant={item.variance > 0 ? "destructive" : "default"}>
                    {item.variance > 0 ? '+' : ''}{item.variance.toFixed(1)}h
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overdue Tasks */}
      {analytics.overdue_task_details.length > 0 && (
        <Card className="border-red-500">
          <CardHeader>
            <CardTitle className="text-lg text-red-500 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Tâches en Retard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analytics.overdue_task_details.map((task) => (
                <div
                  key={task.task_id}
                  className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800"
                >
                  <div>
                    <p className="text-sm font-medium">{task.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Échéance dépassée
                    </p>
                  </div>
                  <Badge variant="destructive">{task.priority}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
