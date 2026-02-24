import { NavLink } from 'react-router-dom';
import { 
  Home, AlertTriangle, AlertCircle, FileText, Users, 
  CheckSquare, LogOut, Menu
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import nizaCloudLogo from '@/assets/niza-cloud-logo.png';
import nizaGroupIcon from '@/assets/niza-group-icon.png';

const menuItems = [
  { title: 'Home', icon: Home, path: '/niza-safe' },
  { title: 'Risk Management', icon: AlertTriangle, path: '/niza-safe/risk-management' },
  { title: 'Incident Management', icon: AlertCircle, path: '/niza-safe/incident-management' },
  { title: 'Documents', icon: FileText, path: '/niza-safe/documents' },
  { title: 'Employees', icon: Users, path: '/niza-safe/employees' },
  { title: 'Tasks', icon: CheckSquare, path: '/niza-safe/tasks' },
];

interface NizaSafeSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function NizaSafeSidebar({ collapsed, onToggle }: NizaSafeSidebarProps) {
  const { user, logout } = useAuth();

  return (
    <aside 
      className={`transition-all duration-300 border-r border-primary/20 flex flex-col relative overflow-hidden h-screen sticky top-0 flex-shrink-0`}
      style={{ background: 'var(--gradient-panel)', width: collapsed ? '80px' : '256px' }}
    >
      {/* Decorative SVG Background */}
      <svg className="absolute inset-0 w-full h-full opacity-5 z-0" viewBox="0 0 593 470" fill="none" preserveAspectRatio="xMidYMid slice">
        <path d="M8.44398 0.617329H592.052V469.547C592.052 48.6499 274.052 498.547 366.552 250.047C459.052 1.5472 419.436 102.82 419.436 102.82C419.436 102.82 343.17 209.048 201.552 208.547C124.426 208.274 104.783 140.619 188.052 102.82C319.337 43.2233 149.498 31.3712 120.052 23.0472C56.1705 4.98889 22.6081 1.25634 8.44398 0.617329H0.0516663C0.0516663 0.617329 2.59244 0.353338 8.44398 0.617329Z" fill="url(#paint0_linear)" stroke="hsl(var(--border))"/>
        <defs>
          <linearGradient id="paint0_linear" x1="592.659" y1="0.617318" x2="376.315" y2="504.04" gradientUnits="userSpaceOnUse">
            <stop offset="0.0734679" stopColor="hsl(var(--accent))"/>
            <stop offset="0.458691" stopColor="hsl(var(--primary))"/>
          </linearGradient>
        </defs>
      </svg>

      {/* Logo */}
      <div className="p-4 flex items-center justify-center relative z-10 min-h-[80px] overflow-visible" style={{ width: collapsed ? '80px' : '256px' }}>
        {collapsed ? (
          <img src={nizaGroupIcon} alt="Niza Group" className="h-12 w-auto object-contain" />
        ) : (
          <img src={nizaCloudLogo} alt="Niza Safe" className="h-16 w-auto object-contain" />
        )}
      </div>

      {/* Hamburger Toggle - Gmail style */}
      <div className={`px-3 pb-2 relative z-10 ${collapsed ? 'flex justify-center' : ''}`}>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="h-10 w-10 rounded-full hover:bg-card/60 cursor-pointer hidden md:flex items-center justify-center"
          title={collapsed ? 'Expand menu' : 'Collapse menu'}
        >
          <Menu className="h-5 w-5 text-foreground/70" />
        </Button>
      </div>

      {/* User Info */}
      {!collapsed && user && (
        <div className="p-4 border-b border-primary/20 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-semibold shadow-lg">
              {user.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground text-sm truncate">{user.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-1 relative z-10">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/niza-safe'}
            className={({ isActive }) => `
              flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group
              ${collapsed ? 'justify-center' : ''}
              ${isActive 
                ? 'bg-gradient-to-r from-primary to-accent text-white shadow-lg shadow-primary/25' 
                : 'text-foreground/70 hover:bg-card/50 hover:text-foreground'
              }
            `}
            title={collapsed ? item.title : undefined}
          >
            <item.icon className="h-5 w-5 flex-shrink-0" />
            {!collapsed && <span className="text-sm font-medium">{item.title}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="p-2 border-t border-primary/20 relative z-10">
        <Button 
          variant="ghost" 
          className={`w-full ${collapsed ? 'justify-center px-0' : 'justify-start'} gap-3 text-destructive hover:bg-destructive/10 hover:text-destructive`}
          onClick={logout}
          title={collapsed ? 'Logout' : undefined}
        >
          <LogOut className="h-5 w-5" />
          {!collapsed && <span className="font-medium">Logout</span>}
        </Button>
      </div>
    </aside>
  );
}
