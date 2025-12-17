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
      className={`${collapsed ? 'w-16' : 'w-64'} border-r border-primary/20 backdrop-blur-xl transition-all duration-300 flex flex-col relative`}
      style={{ background: 'var(--gradient-panel)' }}
    >
      <div className="p-4 border-b border-primary/20 flex items-center justify-center h-16">
        <img src={nizaCloudLogo} alt="Niza Templates" className={collapsed ? "h-8" : "h-10"} />
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-primary/10 hover:text-foreground'
              }`
            }
          >
            <item.icon className="h-5 w-5 flex-shrink-0" />
            {!collapsed && <span className="font-medium text-sm">{item.name}</span>}
          </NavLink>
        ))}
      </nav>

      <Button
        variant="ghost"
        size="icon"
        onClick={onToggle}
        className="absolute -right-3 top-20 h-6 w-6 rounded-full border border-primary/20 bg-card hover:bg-primary/10"
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </Button>
    </aside>
  );
}
