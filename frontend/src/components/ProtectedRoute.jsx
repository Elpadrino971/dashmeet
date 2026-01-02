import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authAPI } from '@/lib/api';
import { Loader2 } from 'lucide-react';

export default function ProtectedRoute({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState(location.state?.user ? true : null);
  const [user, setUser] = useState(location.state?.user || null);

  useEffect(() => {
    // Skip if user data was passed from AuthCallback
    if (location.state?.user) {
      setUser(location.state.user);
      setIsAuthenticated(true);
      return;
    }

    const checkAuth = async () => {
      try {
        const userData = await authAPI.getCurrentUser();
        setUser(userData);
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Auth check failed:', error);
        setIsAuthenticated(false);
        navigate('/', { replace: true });
      }
    };

    checkAuth();
  }, [navigate, location.state]);

  // Show loading while checking auth
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Vérification...</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (isAuthenticated === false) {
    return null;
  }

  // Authenticated - render children
  return children;
}
