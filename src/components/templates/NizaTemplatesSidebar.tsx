import { NavLink } from 'react-router-dom';
import { Home, Palette, ChevronLeft, ChevronRight, BadgeCheck, CreditCard, Receipt, Gift, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import nizaCloudLogo from '@/assets/niza-cloud-logo.png';

interface NizaTemplatesSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const menuItems = [
  { name: 'Home', path: '/niza-templates', icon: Home, end: true },
  { name: 'ID Card & Visitor Pass', path: '/niza-templates/id-cards', icon: BadgeCheck },
  { name: 'Business Cards', path: '/niza-templates/business-cards', icon: CreditCard },
  { name: 'Invoices', path: '/niza-templates/invoices', icon: Receipt },
  { name: 'Gift Cards', path: '/niza-templates/gift-cards', icon: Gift },
  { name: 'Email Signature', path: '/niza-templates/email-signature', icon: Mail },
  { name: 'Brand Settings', path: '/niza-templates/brand-settings', icon: Palette },
];

export default function NizaTemplatesSidebar({ collapsed, onToggle }: NizaTemplatesSidebarProps) {
  return (
    <aside 
      className={`${collapsed ? 'w-16' : 'w-64'} border-r border-primary/20 backdrop-blur-xl transition-all duration-300 flex flex-col relative h-screen sticky top-0 flex-shrink-0`}
      style={{ background: 'var(--gradient-panel)' }}
    >
      {/* Toggle Button */}
      <Button
        variant="outline"
        size="icon"
        onClick={onToggle}
        className="absolute -right-4 top-7 h-8 w-8 rounded-full bg-background border-2 border-primary shadow-lg hover:bg-primary hover:text-primary-foreground z-20 hidden md:flex items-center justify-center cursor-pointer"
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </Button>

      <div className={`${collapsed ? 'p-2' : 'p-4'} border-b border-primary/20 flex items-center justify-center min-h-[60px]`}>
        <img src={nizaCloudLogo} alt="Niza Templates" className={collapsed ? "h-10 w-auto object-contain" : "h-10"} />
      </div>

      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                collapsed ? 'justify-center' : ''
              } ${
                isActive
                  ? 'bg-gradient-to-r from-primary to-accent text-white shadow-lg shadow-primary/25'
                  : 'text-muted-foreground hover:bg-primary/10 hover:text-foreground'
              }`
            }
            title={collapsed ? item.name : undefined}
          >
            <item.icon className="h-5 w-5 flex-shrink-0" />
            {!collapsed && <span className="font-medium text-sm">{item.name}</span>}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
