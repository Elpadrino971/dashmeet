import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { authAPI } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  LayoutDashboard,
  Calendar,
  CheckSquare,
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
  Timer
} from 'lucide-react';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/meetings/new', label: 'Nouvelle Réunion', icon: Calendar },
  { path: '/tasks', label: 'Mes Tâches', icon: CheckSquare },
  { path: '/reports', label: 'Rapports', icon: FileText },
];

export default function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' ||
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await authAPI.getCurrentUser();
        setUser(userData);
      } catch (error) {
        console.error('Failed to fetch user:', error);
      }
    };
    fetchUser();
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  const handleLogout = async () => {
    try {
      await authAPI.logout();
      navigate('/', { replace: true });
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 z-50 h-full w-64 bg-card border-r border-border 
        transform transition-transform duration-200 ease-in-out
        md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full p-4">
          {/* Logo */}
          <div className="flex items-center gap-2 mb-8 px-2">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <Timer className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="font-bold text-xl tracking-tight">COPIL Master</span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path || 
                (item.path === '/meetings/new' && location.pathname.startsWith('/meetings'));
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  data-testid={`nav-${item.path.replace('/', '')}`}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-all
                    ${isActive 
                      ? 'bg-primary text-primary-foreground' 
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    }
                  `}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Bottom section */}
          <div className="border-t border-border pt-4 mt-4">
            <Link
              to="/settings"
              data-testid="nav-settings"
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-all
                ${location.pathname === '/settings'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                }
              `}
              onClick={() => setSidebarOpen(false)}
            >
              <Settings className="w-5 h-5" />
              <span>Paramètres</span>
            </Link>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="md:ml-64">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-lg border-b border-border">
          <div className="flex items-center justify-between h-16 px-4 md:px-6">
            {/* Mobile menu button */}
            <button
              className="md:hidden p-2 rounded-lg hover:bg-accent"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              data-testid="mobile-menu-btn"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            {/* Page title - hidden on mobile */}
            <div className="hidden md:block">
              <h1 className="text-lg font-semibold">
                {navItems.find(item => location.pathname.startsWith(item.path.split('/')[1] ? `/${item.path.split('/')[1]}` : item.path))?.label || 'Dashboard'}
              </h1>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-3">
              {/* Theme toggle */}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleDarkMode}
                data-testid="theme-toggle"
                className="rounded-full"
              >
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </Button>

              {/* User menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full" data-testid="user-menu">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user?.picture} alt={user?.name} />
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium">{user?.name}</p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/settings" className="cursor-pointer">
                      <Settings className="w-4 h-4 mr-2" />
                      Paramètres
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive" data-testid="logout-btn">
                    <LogOut className="w-4 h-4 mr-2" />
                    Déconnexion
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
