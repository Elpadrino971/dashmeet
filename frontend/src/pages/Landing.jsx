import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { authAPI } from '@/lib/api';
import { 
  Timer, 
  Users, 
  FileText, 
  CheckCircle, 
  ArrowRight, 
  Clock, 
  Sparkles,
  Sun,
  Moon,
  Play
} from 'lucide-react';

export default function Landing() {
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' ||
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  useEffect(() => {
    // Check if user is already logged in
    const checkAuth = async () => {
      try {
        await authAPI.getCurrentUser();
        navigate('/dashboard', { replace: true });
      } catch (error) {
        // Not logged in, stay on landing
      }
    };
    checkAuth();
  }, [navigate]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  const handleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + '/dashboard';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const features = [
    {
      icon: Timer,
      title: "Timer Intelligent",
      description: "Maîtrisez chaque sujet avec un timer visuel. Alertes automatiques et gestion du temps de parole."
    },
    {
      icon: Users,
      title: "Gestion des Participants",
      description: "Invitez votre équipe, assignez des rôles et suivez la participation de chacun."
    },
    {
      icon: Sparkles,
      title: "Rapports IA",
      description: "Générez des comptes-rendus personnalisés pour chaque participant avec Claude Sonnet."
    },
    {
      icon: CheckCircle,
      title: "Dispatch des Tâches",
      description: "Créez et assignez des actions en temps réel. Suivi automatique des échéances."
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <Timer className="w-6 h-6 text-primary-foreground" />
              </div>
              <span className="font-bold text-xl tracking-tight">COPIL Master</span>
            </div>
            
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDarkMode(!darkMode)}
                data-testid="landing-theme-toggle"
                className="rounded-full"
              >
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </Button>
              <Button onClick={handleLogin} data-testid="login-btn">
                Se connecter
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left content */}
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full text-primary text-sm font-medium">
                <Clock className="w-4 h-4" />
                Gestion de réunions intelligente
              </div>
              
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight">
                Maîtrisez vos <span className="text-primary">COPIL</span> comme jamais
              </h1>
              
              <p className="text-lg text-muted-foreground leading-relaxed max-w-xl">
                Timer pour suivre l'ordre du jour, IA pour générer des rapports ciblés, 
                dispatch automatique des tâches. Tout ce dont vous avez besoin pour des 
                réunions efficaces.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" onClick={handleLogin} data-testid="hero-cta-btn" className="text-base">
                  Commencer gratuitement
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
                <Button size="lg" variant="outline" className="text-base">
                  <Play className="w-5 h-5 mr-2" />
                  Voir la démo
                </Button>
              </div>
              
              <div className="flex items-center gap-6 pt-4">
                <div className="flex -space-x-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-blue-400 border-2 border-background" />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">+500</span> équipes font confiance à COPIL Master
                </p>
              </div>
            </div>

            {/* Right - Hero Image/Visual */}
            <div className="relative">
              <div className="relative z-10 bg-card rounded-2xl border border-border shadow-2xl overflow-hidden">
                <img 
                  src="https://images.unsplash.com/photo-1760611656160-7c7bf7e6da9f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1NzZ8MHwxfHNlYXJjaHwyfHxjb3Jwb3JhdGUlMjBtZWV0aW5nJTIwbW9kZXJuJTIwb2ZmaWNlfGVufDB8fHx8MTc2NzM3MDk0Nnww&ixlib=rb-4.1.0&q=85"
                  alt="Modern meeting room"
                  className="w-full h-80 object-cover"
                />
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">COPIL Projet Alpha</h3>
                    <span className="px-3 py-1 bg-orange-500/20 text-orange-500 rounded-full text-sm font-medium">
                      En cours
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-16 rounded-full bg-orange-500/20 flex items-center justify-center timer-glow">
                        <span className="text-2xl font-mono font-bold text-orange-500">4:32</span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">Sujet actuel</p>
                      <p className="font-medium">Revue du budget Q1</p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Decorative elements */}
              <div className="absolute -top-4 -right-4 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
              <div className="absolute -bottom-4 -left-4 w-48 h-48 bg-orange-500/10 rounded-full blur-2xl" />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Tout pour des réunions <span className="text-primary">productives</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Des outils puissants pour organiser, animer et suivre vos réunions de pilotage
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div 
                  key={index}
                  className="bg-card rounded-xl border border-border p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
                  data-testid={`feature-card-${index}`}
                >
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-6">
            Prêt à transformer vos réunions ?
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Rejoignez des centaines d'équipes qui utilisent COPIL Master pour 
            des réunions plus efficaces et mieux organisées.
          </p>
          <Button size="lg" onClick={handleLogin} data-testid="cta-btn" className="text-base px-8">
            Démarrer maintenant
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Timer className="w-5 h-5 text-primary" />
            <span className="font-semibold">COPIL Master</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © 2025 COPIL Master. Tous droits réservés.
          </p>
        </div>
      </footer>
    </div>
  );
}
