import { useState, useEffect } from 'react';
import { goalsAPI } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Target,
  Plus,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Calendar,
  Trash2,
  Award
} from 'lucide-react';
import { format, parseISO, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';

const GOAL_TYPES = {
  tasks_completed: { label: 'Tâches complétées', unit: 'tâches', type: 'quantitatif' },
  meetings_held: { label: 'Réunions tenues', unit: 'réunions', type: 'quantitatif' },
  tasks_on_time: { label: 'Tâches à temps', unit: 'tâches', type: 'quantitatif' },
  completion_rate: { label: 'Taux de complétion', unit: '%', type: 'quantitatif' },
  qualitative: { label: 'Objectif qualitatif', unit: '', type: 'qualitatif' }
};

export default function GoalTracker() {
  const [goals, setGoals] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('all'); // daily, weekly, monthly, all
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newGoal, setNewGoal] = useState({
    title: '',
    description: '',
    goal_type: 'tasks_completed',
    period: 'daily',
    target_value: 0,
    start_date: '',
    end_date: ''
  });

  useEffect(() => {
    fetchGoals();
    fetchAnalytics();
  }, [selectedPeriod]);

  const fetchGoals = async () => {
    try {
      const period = selectedPeriod === 'all' ? null : selectedPeriod;
      const data = await goalsAPI.getAll(period);
      setGoals(data);
    } catch (error) {
      console.error('Failed to fetch goals:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const data = await goalsAPI.getAnalytics();
      setAnalytics(data);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    }
  };

  const handleCreateGoal = async (e) => {
    e.preventDefault();

    // Auto-set dates based on period
    const now = new Date();
    let start_date, end_date;

    if (newGoal.period === 'daily') {
      start_date = startOfDay(now);
      end_date = endOfDay(now);
    } else if (newGoal.period === 'weekly') {
      start_date = startOfWeek(now, { locale: fr });
      end_date = endOfWeek(now, { locale: fr });
    } else if (newGoal.period === 'monthly') {
      start_date = startOfMonth(now);
      end_date = endOfMonth(now);
    }

    try {
      await goalsAPI.create({
        ...newGoal,
        start_date: start_date.toISOString(),
        end_date: end_date.toISOString(),
        target_value: parseFloat(newGoal.target_value)
      });

      toast.success('Objectif créé');
      setDialogOpen(false);
      setNewGoal({
        title: '',
        description: '',
        goal_type: 'tasks_completed',
        period: 'daily',
        target_value: 0,
        start_date: '',
        end_date: ''
      });
      fetchGoals();
      fetchAnalytics();
    } catch (error) {
      console.error('Failed to create goal:', error);
      toast.error('Erreur lors de la création');
    }
  };

  const handleValidateGoal = async (goalId) => {
    try {
      await goalsAPI.validate(goalId);
      toast.success('Objectif validé ✓');
      fetchGoals();
      fetchAnalytics();
    } catch (error) {
      console.error('Failed to validate goal:', error);
      toast.error('Erreur');
    }
  };

  const handleDeleteGoal = async (goalId) => {
    try {
      await goalsAPI.delete(goalId);
      toast.success('Objectif supprimé');
      fetchGoals();
      fetchAnalytics();
    } catch (error) {
      console.error('Failed to delete goal:', error);
      toast.error('Erreur');
    }
  };

  const getVarianceColor = (variance) => {
    if (variance >= 0) return 'text-green-500';
    if (variance >= -20) return 'text-orange-500';
    return 'text-red-500';
  };

  const getGoalStatus = (goal) => {
    if (goal.is_validated) return { label: 'Validé', color: 'bg-green-500' };
    if (goal.status === 'completed') return { label: 'Atteint', color: 'bg-blue-500' };
    if (goal.status === 'failed') return { label: 'Échoué', color: 'bg-red-500' };
    return { label: 'En cours', color: 'bg-orange-500' };
  };

  const filterGoalsByPeriod = (goals, period) => {
    if (period === 'all') return goals;
    return goals.filter(g => g.period === period);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="goal-tracker">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Target className="w-6 h-6 text-primary" />
            Mes Objectifs
          </h2>
          <p className="text-muted-foreground">Quantitatifs & Qualitatifs</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nouvel Objectif
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Créer un objectif</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateGoal} className="space-y-4">
              <div>
                <Label>Titre *</Label>
                <Input
                  value={newGoal.title}
                  onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })}
                  placeholder="Ex: Compléter 5 tâches"
                  required
                />
              </div>

              <div>
                <Label>Description</Label>
                <Textarea
                  value={newGoal.description}
                  onChange={(e) => setNewGoal({ ...newGoal, description: e.target.value })}
                  placeholder="Détails de l'objectif..."
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Type *</Label>
                  <Select
                    value={newGoal.goal_type}
                    onValueChange={(value) => setNewGoal({ ...newGoal, goal_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(GOAL_TYPES).map(([key, value]) => (
                        <SelectItem key={key} value={key}>
                          {value.label} ({value.type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Période *</Label>
                  <Select
                    value={newGoal.period}
                    onValueChange={(value) => setNewGoal({ ...newGoal, period: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Jour</SelectItem>
                      <SelectItem value="weekly">Semaine</SelectItem>
                      <SelectItem value="monthly">Mois</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Objectif chiffré *</Label>
                <Input
                  type="number"
                  value={newGoal.target_value}
                  onChange={(e) => setNewGoal({ ...newGoal, target_value: e.target.value })}
                  placeholder={`Ex: 5 ${GOAL_TYPES[newGoal.goal_type].unit}`}
                  required
                  min="0"
                  step="0.01"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Unité : {GOAL_TYPES[newGoal.goal_type].unit}
                </p>
              </div>

              <Button type="submit" className="w-full">
                Créer l'objectif
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Analytics Summary */}
      {analytics && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{analytics.total_goals}</div>
              <p className="text-xs text-muted-foreground">Total objectifs</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-500">
                {analytics.completed_goals}
              </div>
              <p className="text-xs text-muted-foreground">Atteints</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-orange-500">
                {analytics.in_progress_goals}
              </div>
              <p className="text-xs text-muted-foreground">En cours</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{analytics.success_rate}%</div>
              <p className="text-xs text-muted-foreground">Taux de réussite</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Goals by Period */}
      <Tabs value={selectedPeriod} onValueChange={setSelectedPeriod}>
        <TabsList>
          <TabsTrigger value="all">Tous</TabsTrigger>
          <TabsTrigger value="daily">Jour</TabsTrigger>
          <TabsTrigger value="weekly">Semaine</TabsTrigger>
          <TabsTrigger value="monthly">Mois</TabsTrigger>
        </TabsList>

        <TabsContent value={selectedPeriod} className="space-y-4 mt-6">
          {goals.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Target className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">Aucun objectif</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Créez votre premier objectif
                </p>
              </CardContent>
            </Card>
          ) : (
            goals.map((goal) => {
              const status = getGoalStatus(goal);
              const progress = (goal.current_value / goal.target_value) * 100;
              const variance = goal.current_value - goal.target_value;
              const variancePct = (variance / goal.target_value) * 100;
              const goalInfo = GOAL_TYPES[goal.goal_type] || GOAL_TYPES.tasks_completed;

              return (
                <Card key={goal.goal_id} className={goal.is_validated ? 'border-green-500' : ''}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <CardTitle className="text-lg">{goal.title}</CardTitle>
                          <Badge className={`${status.color}/20 text-${status.color} border-0`}>
                            {status.label}
                          </Badge>
                          {goal.is_validated && (
                            <Award className="w-5 h-5 text-green-500" />
                          )}
                        </div>
                        {goal.description && (
                          <p className="text-sm text-muted-foreground">{goal.description}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {goal.period === 'daily' && 'Jour'}
                            {goal.period === 'weekly' && 'Semaine'}
                            {goal.period === 'monthly' && 'Mois'}
                          </span>
                          <span>{goalInfo.label}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {!goal.is_validated && goal.status !== 'failed' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleValidateGoal(goal.goal_id)}
                            className="text-green-500 hover:text-green-600"
                          >
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            Valider
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDeleteGoal(goal.goal_id)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent>
                    {/* Progress Bar */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">
                          {goal.current_value} / {goal.target_value} {goalInfo.unit}
                        </span>
                        <span className={`font-bold ${getVarianceColor(variance)}`}>
                          {variance >= 0 ? '+' : ''}{variance.toFixed(1)} ({variancePct.toFixed(1)}%)
                        </span>
                      </div>
                      <Progress
                        value={Math.min(progress, 100)}
                        className={`h-2 ${progress >= 100 ? 'bg-green-100' : ''}`}
                      />
                    </div>

                    {/* Variance Indicator */}
                    <div className="mt-4 flex items-center gap-2">
                      {variance >= 0 ? (
                        <div className="flex items-center gap-2 text-green-500">
                          <TrendingUp className="w-4 h-4" />
                          <span className="text-sm font-medium">
                            Au-dessus de l'objectif
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-red-500">
                          <TrendingDown className="w-4 h-4" />
                          <span className="text-sm font-medium">
                            En-dessous de l'objectif ({Math.abs(variance).toFixed(1)} {goalInfo.unit} manquant)
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>

      {/* Variances Details */}
      {analytics && analytics.variances.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Analyse des Écarts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analytics.variances.map((v) => (
                <div key={v.goal_id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-sm font-medium">{v.title}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-muted-foreground">
                      {v.current} / {v.target}
                    </span>
                    <Badge variant={v.variance >= 0 ? "default" : "destructive"}>
                      {v.variance >= 0 ? '+' : ''}{v.variance.toFixed(1)} ({v.variance_pct}%)
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
