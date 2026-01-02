import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authAPI } from '@/lib/api';
import { Loader2 } from 'lucide-react';

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH

export default function AuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const hasProcessed = useRef(false);

  useEffect(() => {
    // Use ref to prevent double processing in StrictMode
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processAuth = async () => {
      try {
        // Extract session_id from hash
        const hash = location.hash;
        const sessionId = hash.split('session_id=')[1]?.split('&')[0];
        
        if (!sessionId) {
          console.error('No session_id found');
          navigate('/', { replace: true });
          return;
        }

        // Exchange session_id for user data
        const userData = await authAPI.getSession(sessionId);
        
        // Store session token
        if (userData.session_token) {
          localStorage.setItem('session_token', userData.session_token);
          document.cookie = `session_token=${userData.session_token}; path=/; secure; samesite=none; max-age=${7 * 24 * 60 * 60}`;
        }

        // Navigate to dashboard with user data
        navigate('/dashboard', { 
          replace: true, 
          state: { user: userData } 
        });

      } catch (error) {
        console.error('Auth error:', error);
        navigate('/', { replace: true });
      }
    };

    processAuth();
  }, [navigate, location]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
        <p className="text-muted-foreground font-medium">Connexion en cours...</p>
      </div>
    </div>
  );
}
