import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mic, MicOff, Radio } from 'lucide-react';
import { toast } from 'sonner';

export default function LiveTranscription({ onTranscriptUpdate, meetingId }) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const recognitionRef = useRef(null);

  useEffect(() => {
    // Check if browser supports Web Speech API
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast.error('Votre navigateur ne supporte pas la transcription audio. Utilisez Chrome ou Edge.');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'fr-FR';
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      console.log('Transcription started');
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;

        if (event.results[i].isFinal) {
          final += transcript + ' ';
        } else {
          interim += transcript;
        }
      }

      if (final) {
        setTranscript(prev => {
          const newTranscript = prev + final;
          // Call callback to update parent component
          if (onTranscriptUpdate) {
            onTranscriptUpdate(newTranscript);
          }
          return newTranscript;
        });
      }

      setInterimTranscript(interim);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'no-speech') {
        toast.warning('Aucune parole détectée');
      } else if (event.error === 'audio-capture') {
        toast.error('Microphone non accessible');
      } else if (event.error === 'not-allowed') {
        toast.error('Permission microphone refusée');
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      console.log('Transcription ended');
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [onTranscriptUpdate]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      toast.error('Transcription non disponible');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      toast.success('Transcription arrêtée');
    } else {
      try {
        recognitionRef.current.start();
        toast.success('Transcription démarrée');
      } catch (error) {
        console.error('Error starting recognition:', error);
        toast.error('Erreur lors du démarrage');
      }
    }
  };

  const clearTranscript = () => {
    setTranscript('');
    setInterimTranscript('');
    if (onTranscriptUpdate) {
      onTranscriptUpdate('');
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Mic className="w-4 h-4" />
            Transcription en direct
          </CardTitle>
          <div className="flex items-center gap-2">
            {isListening && (
              <Badge className="bg-red-500/20 text-red-500 border-0 animate-pulse">
                <Radio className="w-3 h-3 mr-1" />
                En cours
              </Badge>
            )}
            <Button
              size="sm"
              variant={isListening ? "destructive" : "default"}
              onClick={toggleListening}
              data-testid="toggle-transcription-btn"
            >
              {isListening ? (
                <>
                  <MicOff className="w-4 h-4 mr-2" />
                  Arrêter
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4 mr-2" />
                  Démarrer
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 bg-muted/30 rounded-lg border border-border min-h-[200px]">
          {!transcript && !interimTranscript && (
            <p className="text-sm text-muted-foreground italic">
              Cliquez sur "Démarrer" pour commencer la transcription audio...
            </p>
          )}
          <p className="text-sm whitespace-pre-wrap">
            {transcript}
            {interimTranscript && (
              <span className="text-muted-foreground italic">{interimTranscript}</span>
            )}
          </p>
        </div>
        {transcript && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={clearTranscript}
            data-testid="clear-transcript-btn"
          >
            Effacer
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
