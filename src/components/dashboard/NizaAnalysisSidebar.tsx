import { NavLink } from 'react-router-dom';
import { Home, Upload, FileSpreadsheet, Settings2, LogOut, Menu, AlertTriangle, Bot } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import nizaCloudLogo from '@/assets/niza-cloud-logo.png';
import nizaGroupIcon from '@/assets/niza-group-icon.png';

interface Props {
  collapsed: boolean;
  onToggle: () => void;
}

export default function NizaAnalysisSidebar({ collapsed, onToggle }: Props) {
  const { user, logout } = useAuth();

  const items = [
    { title: 'Home', icon: Home, path: '/niza-analysis' },
    { title: 'Xero Export', icon: FileSpreadsheet, path: '/niza-analysis/xero-export' },
    { title: 'Daily Sales', icon: Upload, path: '/niza-analysis/daily-sales' },
    { title: 'Branch Formats', icon: Settings2, path: '/niza-analysis/branch-formats' },
    { title: 'Category Alerts', icon: AlertTriangle, path: '/niza-analysis/category-alerts' },
    { title: 'Email Agents', icon: Bot, path: '/niza-analysis/email-agents' },
  ];

  return (
    <aside
      className="transition-all duration-300 border-r border-primary/20 flex flex-col relative overflow-hidden h-screen sticky top-0 flex-shrink-0"
      style={{ background: 'var(--gradient-panel)', width: collapsed ? '80px' : '256px' }}
    >
      <div className="p-4 flex items-center justify-center min-h-[80px]">
        {collapsed ? (
          <img src={nizaGroupIcon} alt="Niza" className="h-12 w-auto object-contain" />
        ) : (
          <img src={nizaCloudLogo} alt="Niza Analysis" className="h-16 w-auto object-contain" />
        )}
      </div>

      <div className={`px-3 pb-2 ${collapsed ? 'flex justify-center' : ''}`}>
        <Button variant="ghost" size="icon" onClick={onToggle} className="h-10 w-10 rounded-full hidden md:flex">
          <Menu className="h-5 w-5 text-foreground/70" />
        </Button>
      </div>

      {!collapsed && user && (
        <div className="p-4 border-b border-primary/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-semibold">
              {user.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{user.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/niza-analysis'}
            className={({ isActive }) => `
              flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all
              ${collapsed ? 'justify-center' : ''}
              ${isActive
                ? 'bg-gradient-to-r from-primary to-accent text-white shadow-lg'
                : 'text-foreground/70 hover:bg-card/50 hover:text-foreground'}
            `}
            title={collapsed ? item.title : undefined}
          >
            <item.icon className="h-5 w-5 flex-shrink-0" />
            {!collapsed && <span className="text-sm font-medium">{item.title}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="p-2 border-t border-primary/20">
        <Button
          variant="ghost"
          className={`w-full ${collapsed ? 'justify-center px-0' : 'justify-start'} gap-3 text-destructive hover:bg-destructive/10`}
          onClick={logout}
        >
          <LogOut className="h-5 w-5" />
          {!collapsed && <span className="font-medium">Logout</span>}
        </Button>
      </div>
    </aside>
  );
}
