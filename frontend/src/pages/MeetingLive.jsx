import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { meetingsAPI, tasksAPI } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Play,
  Pause,
  SkipForward,
  CheckCircle,
  Clock,
  AlertTriangle,
  Users,
  FileText,
  Timer,
  Mic,
  Sparkles
} from 'lucide-react';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import LiveTranscription from '@/components/LiveTranscription';
import MeetingAssistant from '@/components/MeetingAssistant';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function MeetingLive() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [transcript, setTranscript] = useState('');
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef(null);

  const currentItem = meeting?.agenda?.[meeting?.current_item_index || 0];
  const itemDurationSeconds = (currentItem?.duration_minutes || 10) * 60;
  const progress = Math.min((timerSeconds / itemDurationSeconds) * 100, 100);
  const isOvertime = timerSeconds > itemDurationSeconds;
  const remainingSeconds = Math.max(itemDurationSeconds - timerSeconds, 0);

  const formatTime = (seconds) => {
    const mins = Math.floor(Math.abs(seconds) / 60);
    const secs = Math.abs(seconds) % 60;
    const sign = seconds < 0 ? '-' : '';
    return `${sign}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const fetchMeeting = async () => {
      try {
        const data = await meetingsAPI.getById(id);
        setMeeting(data);
        setNotes(data.meeting_notes || '');
        
        // Calculate elapsed time if timer was started
        if (data.timer_started_at) {
          const started = new Date(data.timer_started_at);
          const elapsed = Math.floor((Date.now() - started.getTime()) / 1000);
          setTimerSeconds(elapsed);
        }
      } catch (error) {
        console.error('Failed to fetch meeting:', error);
        toast.error('Erreur lors du chargement');
        navigate('/dashboard');
      } finally {
        setLoading(false);
      }
    };
    fetchMeeting();
  }, [id, navigate]);

  // Timer effect
  useEffect(() => {
    if (!isPaused && meeting?.status === 'in_progress') {
      timerRef.current = setInterval(() => {
        setTimerSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPaused, meeting?.status]);

  const handleNextItem = async () => {
    try {
      const result = await meetingsAPI.nextItem(id);
      setTimerSeconds(0);
      
      // Refresh meeting data
      const updatedMeeting = await meetingsAPI.getById(id);
      setMeeting(updatedMeeting);
      
      toast.success('Sujet suivant');
    } catch (error) {
      console.error('Failed to move to next item:', error);
      toast.error('Erreur');
    }
  };

  const handleCompleteMeeting = async () => {
    try {
      // Save notes first
      await meetingsAPI.updateNotes(id, notes);
      await meetingsAPI.complete(id);
      toast.success('Réunion terminée');
      navigate(`/meetings/${id}`);
    } catch (error) {
      console.error('Failed to complete meeting:', error);
      toast.error('Erreur');
    }
  };

  const handleSaveNotes = useCallback(async () => {
    try {
      await meetingsAPI.updateNotes(id, notes);
    } catch (error) {
      console.error('Failed to save notes:', error);
    }
  }, [id, notes]);

  // Auto-save notes every 30 seconds
  useEffect(() => {
    const interval = setInterval(handleSaveNotes, 30000);
    return () => clearInterval(interval);
  }, [handleSaveNotes]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!meeting) return null;

  const completedItems = meeting.agenda?.filter(item => item.status === 'completed').length || 0;
  const totalItems = meeting.agenda?.length || 0;
  const meetingProgress = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col" data-testid="meeting-live">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/meetings/${id}`)} data-testid="back-btn">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight">{meeting.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge className="bg-orange-500/20 text-orange-500 border-0">En cours</Badge>
              <span className="text-sm text-muted-foreground">
                {completedItems}/{totalItems} sujets
              </span>
            </div>
          </div>
        </div>
        <Button onClick={handleCompleteMeeting} variant="outline" data-testid="complete-meeting-btn">
          <CheckCircle className="w-4 h-4 mr-2" />
          Terminer la réunion
        </Button>
      </div>

      {/* Main content */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-hidden">
        {/* Left Panel - Timer & Agenda */}
        <div className="lg:col-span-1 space-y-6 overflow-y-auto">
          {/* Timer */}
          <Card className={`${isOvertime ? 'border-red-500 timer-glow' : ''}`}>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center">
                <div className="w-48 h-48 relative">
                  <CircularProgressbar
                    value={isOvertime ? 100 : progress}
                    styles={buildStyles({
                      pathColor: isOvertime ? '#ef4444' : '#f97316',
                      trailColor: 'hsl(var(--muted))',
                      strokeLinecap: 'round',
                    })}
                  />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-4xl font-mono font-bold ${isOvertime ? 'text-red-500' : ''}`}>
                      {isOvertime ? '+' : ''}{formatTime(isOvertime ? timerSeconds - itemDurationSeconds : remainingSeconds)}
                    </span>
                    <span className="text-sm text-muted-foreground mt-1">
                      {isOvertime ? 'Dépassement' : 'Restant'}
                    </span>
                  </div>
                </div>

                {isOvertime && (
                  <div className="flex items-center gap-2 mt-4 text-red-500">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-sm font-medium">Temps dépassé !</span>
                  </div>
                )}

                <div className="flex items-center gap-2 mt-6">
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => setIsPaused(!isPaused)}
                    data-testid="pause-timer-btn"
                  >
                    {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                  </Button>
                  <Button onClick={handleNextItem} data-testid="next-item-btn">
                    <SkipForward className="w-4 h-4 mr-2" />
                    Sujet suivant
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Agenda */}
          <Card className="flex-1 overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Ordre du jour
              </CardTitle>
              <Progress value={meetingProgress} className="h-1.5" />
            </CardHeader>
            <CardContent className="space-y-2 max-h-[300px] overflow-y-auto">
              {meeting.agenda?.map((item, index) => {
                const isActive = index === meeting.current_item_index;
                const isCompleted = item.status === 'completed';
                
                return (
                  <div 
                    key={item.item_id || index}
                    className={`
                      flex items-center gap-3 p-3 rounded-lg border transition-all
                      ${isActive ? 'border-orange-500 bg-orange-500/10 border-l-4' : 'border-border'}
                      ${isCompleted ? 'opacity-50' : ''}
                    `}
                    data-testid={`agenda-live-item-${index}`}
                  >
                    <div className={`
                      w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                      ${isCompleted ? 'bg-green-500 text-white' : isActive ? 'bg-orange-500 text-white' : 'bg-muted text-muted-foreground'}
                    `}>
                      {isCompleted ? <CheckCircle className="w-3 h-3" /> : index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${isCompleted ? 'line-through' : ''}`}>
                        {item.title}
                      </p>
                      {item.speaker && (
                        <p className="text-xs text-muted-foreground">{item.speaker}</p>
                      )}
                    </div>
                    <span className="text-xs font-mono text-muted-foreground">
                      {item.duration_minutes}m
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Current Item & Notes */}
        <div className="lg:col-span-2 space-y-6 overflow-y-auto">
          {/* Current Item Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Timer className="w-5 h-5 text-orange-500" />
                Sujet en cours
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h2 className="text-2xl font-bold">{currentItem?.title || 'Aucun sujet'}</h2>
                  {currentItem?.speaker && (
                    <p className="text-muted-foreground mt-1">
                      <Users className="w-4 h-4 inline mr-2" />
                      {currentItem.speaker}
                    </p>
                  )}
                </div>
                {currentItem?.description && (
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm">{currentItem.description}</p>
                  </div>
                )}
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>
                    <Clock className="w-4 h-4 inline mr-1" />
                    Durée prévue: {currentItem?.duration_minutes || 0} min
                  </span>
                  <span>
                    Temps écoulé: {formatTime(timerSeconds)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabs: Notes | Transcription | Assistant IA */}
          <Card className="flex-1 flex flex-col">
            <Tabs defaultValue="notes" className="flex-1 flex flex-col">
              <CardHeader className="pb-3">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="notes" className="text-xs sm:text-sm">
                    <FileText className="w-4 h-4 mr-2" />
                    Notes
                  </TabsTrigger>
                  <TabsTrigger value="transcription" className="text-xs sm:text-sm">
                    <Mic className="w-4 h-4 mr-2" />
                    Transcription
                  </TabsTrigger>
                  <TabsTrigger value="assistant" className="text-xs sm:text-sm">
                    <Sparkles className="w-4 h-4 mr-2" />
                    Assistant IA
                  </TabsTrigger>
                </TabsList>
              </CardHeader>

              <CardContent className="flex-1 overflow-hidden">
                <TabsContent value="notes" className="h-full mt-0">
                  <div className="h-full flex flex-col">
                    <Textarea
                      placeholder="Prenez des notes pendant la réunion... Les décisions, actions et points clés seront utilisés pour générer les rapports IA."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="min-h-[400px] resize-none flex-1"
                      data-testid="meeting-notes-textarea"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      Sauvegarde automatique toutes les 30 secondes
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="transcription" className="h-full mt-0">
                  <LiveTranscription
                    meetingId={id}
                    onTranscriptUpdate={(newTranscript) => {
                      setTranscript(newTranscript);
                      // Optionally update meeting notes with transcript
                      setNotes(prev => prev ? `${prev}\n\n--- TRANSCRIPTION ---\n${newTranscript}` : newTranscript);
                    }}
                  />
                </TabsContent>

                <TabsContent value="assistant" className="h-full mt-0">
                  <MeetingAssistant meeting={meeting} transcript={transcript} />
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>
        </div>
      </div>
    </div>
  );
}
