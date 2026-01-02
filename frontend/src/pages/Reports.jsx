import { useState, useEffect } from 'react';
import { reportsAPI, meetingsAPI } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  FileText, 
  Sparkles, 
  Calendar,
  Download,
  RefreshCw
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function Reports() {
  const [reports, setReports] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMeeting, setSelectedMeeting] = useState('all');
  const [expandedReport, setExpandedReport] = useState(null);

  const fetchData = async () => {
    try {
      const [reportsData, meetingsData] = await Promise.all([
        reportsAPI.getAll(),
        meetingsAPI.getAll()
      ]);
      setReports(reportsData);
      setMeetings(meetingsData.filter(m => m.status === 'completed'));
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleGenerateReport = async (meetingId) => {
    try {
      await reportsAPI.generate(meetingId);
      toast.success('Génération des rapports en cours...');
      // Refresh after a delay
      setTimeout(fetchData, 3000);
    } catch (error) {
      console.error('Failed to generate reports:', error);
      toast.error('Erreur lors de la génération');
    }
  };

  const filteredReports = selectedMeeting === 'all'
    ? reports
    : reports.filter(r => r.meeting_id === selectedMeeting);

  const downloadReport = (report) => {
    const content = `
RAPPORT DE RÉUNION
==================
Réunion: ${report.meeting_title}
Date de génération: ${format(parseISO(report.generated_at), 'PPP à HH:mm', { locale: fr })}

${report.content}

TÂCHES ASSIGNÉES
----------------
${report.tasks?.map(t => `- ${t.title} (${t.priority})`).join('\n') || 'Aucune tâche'}
    `.trim();

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rapport-${report.meeting_title.replace(/\s+/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="reports-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rapports IA</h1>
          <p className="text-muted-foreground">Comptes-rendus générés par Claude Sonnet</p>
        </div>
        <Button onClick={fetchData} variant="outline" data-testid="refresh-reports-btn">
          <RefreshCw className="w-4 h-4 mr-2" />
          Actualiser
        </Button>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">Filtrer par réunion:</span>
        <Select value={selectedMeeting} onValueChange={setSelectedMeeting}>
          <SelectTrigger className="w-[300px]" data-testid="meeting-filter">
            <SelectValue placeholder="Toutes les réunions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les réunions</SelectItem>
            {meetings.map((meeting) => (
              <SelectItem key={meeting.meeting_id} value={meeting.meeting_id}>
                {meeting.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Generate section */}
      {meetings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Générer un rapport
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {meetings.slice(0, 5).map((meeting) => (
                <Button
                  key={meeting.meeting_id}
                  variant="outline"
                  size="sm"
                  onClick={() => handleGenerateReport(meeting.meeting_id)}
                  data-testid={`generate-report-${meeting.meeting_id}`}
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  {meeting.title}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reports List */}
      {filteredReports.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">Aucun rapport disponible</p>
            <p className="text-sm text-muted-foreground mt-1">
              Terminez une réunion et générez un rapport IA
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredReports.map((report) => (
            <Card key={report.report_id} data-testid={`report-card-${report.report_id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{report.meeting_title}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Généré le {format(parseISO(report.generated_at), 'PPP à HH:mm', { locale: fr })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-primary/20 text-primary border-0">
                      <Sparkles className="w-3 h-3 mr-1" />
                      IA
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => downloadReport(report)}
                      data-testid={`download-report-${report.report_id}`}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div 
                  className={`prose prose-sm dark:prose-invert max-w-none ${
                    expandedReport === report.report_id ? '' : 'line-clamp-6'
                  }`}
                >
                  <div className="glass p-4 rounded-lg whitespace-pre-wrap">
                    {report.content}
                  </div>
                </div>
                {report.content?.length > 500 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={() => setExpandedReport(
                      expandedReport === report.report_id ? null : report.report_id
                    )}
                    data-testid={`expand-report-${report.report_id}`}
                  >
                    {expandedReport === report.report_id ? 'Réduire' : 'Voir plus'}
                  </Button>
                )}

                {report.tasks?.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <p className="text-sm font-medium mb-2">Tâches assignées:</p>
                    <div className="flex flex-wrap gap-2">
                      {report.tasks.map((task, index) => (
                        <Badge key={index} variant="outline">
                          {task.title}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
