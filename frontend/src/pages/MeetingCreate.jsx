import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { meetingsAPI } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { 
  CalendarIcon, 
  Plus, 
  Trash2, 
  Clock, 
  Users,
  GripVertical,
  ArrowLeft
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function MeetingCreate() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState(new Date());
  const [time, setTime] = useState('10:00');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    participants: ''
  });
  const [agenda, setAgenda] = useState([
    { title: '', duration_minutes: 10, speaker: '', description: '' }
  ]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      toast.error('Le titre est requis');
      return;
    }

    if (agenda.filter(item => item.title.trim()).length === 0) {
      toast.error('Ajoutez au moins un sujet à l\'ordre du jour');
      return;
    }

    setLoading(true);
    try {
      // Combine date and time
      const [hours, minutes] = time.split(':');
      const scheduledDate = new Date(date);
      scheduledDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

      // Parse participants
      const participants = formData.participants
        .split(',')
        .map(p => p.trim())
        .filter(p => p && p.includes('@'));

      // Filter valid agenda items
      const validAgenda = agenda
        .filter(item => item.title.trim())
        .map(item => ({
          title: item.title.trim(),
          duration_minutes: parseInt(item.duration_minutes) || 10,
          speaker: item.speaker.trim() || null,
          description: item.description.trim() || null
        }));

      const result = await meetingsAPI.create({
        title: formData.title,
        description: formData.description,
        scheduled_date: scheduledDate.toISOString(),
        participants,
        agenda: validAgenda
      });

      toast.success('Réunion créée avec succès');
      navigate(`/meetings/${result.meeting_id}`);
    } catch (error) {
      console.error('Failed to create meeting:', error);
      toast.error('Erreur lors de la création de la réunion');
    } finally {
      setLoading(false);
    }
  };

  const addAgendaItem = () => {
    setAgenda([...agenda, { title: '', duration_minutes: 10, speaker: '', description: '' }]);
  };

  const removeAgendaItem = (index) => {
    if (agenda.length > 1) {
      setAgenda(agenda.filter((_, i) => i !== index));
    }
  };

  const updateAgendaItem = (index, field, value) => {
    const newAgenda = [...agenda];
    newAgenda[index][field] = value;
    setAgenda(newAgenda);
  };

  const totalDuration = agenda.reduce((sum, item) => sum + (parseInt(item.duration_minutes) || 0), 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6" data-testid="meeting-create">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} data-testid="back-btn">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nouvelle Réunion</h1>
          <p className="text-muted-foreground">Planifiez votre prochaine réunion de pilotage</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Informations générales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Titre de la réunion *</Label>
              <Input
                id="title"
                placeholder="Ex: COPIL Projet Alpha - Revue mensuelle"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                data-testid="meeting-title-input"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Objectifs et contexte de la réunion..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                data-testid="meeting-description-input"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                      data-testid="date-picker-btn"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(date, 'PPP', { locale: fr })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={(d) => d && setDate(d)}
                      locale={fr}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="time">Heure</Label>
                <Input
                  id="time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  data-testid="time-input"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="participants">
                <Users className="w-4 h-4 inline mr-2" />
                Participants (emails séparés par des virgules)
              </Label>
              <Textarea
                id="participants"
                placeholder="jean@example.com, marie@example.com, pierre@example.com"
                value={formData.participants}
                onChange={(e) => setFormData({ ...formData, participants: e.target.value })}
                rows={2}
                data-testid="participants-input"
              />
            </div>
          </CardContent>
        </Card>

        {/* Agenda */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Ordre du jour</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Durée totale estimée: <span className="font-mono font-semibold">{totalDuration} min</span>
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addAgendaItem} data-testid="add-agenda-item-btn">
              <Plus className="w-4 h-4 mr-2" />
              Ajouter
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {agenda.map((item, index) => (
              <div 
                key={index} 
                className="flex gap-4 p-4 border border-border rounded-lg bg-muted/30"
                data-testid={`agenda-item-${index}`}
              >
                <div className="flex-shrink-0 pt-2 text-muted-foreground cursor-grab">
                  <GripVertical className="w-5 h-5" />
                </div>
                <div className="flex-1 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="sm:col-span-2">
                      <Input
                        placeholder="Titre du sujet *"
                        value={item.title}
                        onChange={(e) => updateAgendaItem(index, 'title', e.target.value)}
                        data-testid={`agenda-title-${index}`}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <Input
                          type="number"
                          min="1"
                          max="180"
                          placeholder="min"
                          value={item.duration_minutes}
                          onChange={(e) => updateAgendaItem(index, 'duration_minutes', e.target.value)}
                          data-testid={`agenda-duration-${index}`}
                        />
                      </div>
                    </div>
                    <div>
                      <Input
                        placeholder="Intervenant"
                        value={item.speaker}
                        onChange={(e) => updateAgendaItem(index, 'speaker', e.target.value)}
                        data-testid={`agenda-speaker-${index}`}
                      />
                    </div>
                  </div>
                  <Textarea
                    placeholder="Notes / Description du sujet (optionnel)"
                    value={item.description}
                    onChange={(e) => updateAgendaItem(index, 'description', e.target.value)}
                    rows={2}
                    className="text-sm"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeAgendaItem(index)}
                  className="flex-shrink-0 text-muted-foreground hover:text-destructive"
                  disabled={agenda.length === 1}
                  data-testid={`remove-agenda-${index}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Annuler
          </Button>
          <Button type="submit" disabled={loading} data-testid="create-meeting-btn">
            {loading ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Création...
              </>
            ) : (
              <>
                <CalendarIcon className="w-4 h-4 mr-2" />
                Créer la réunion
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
