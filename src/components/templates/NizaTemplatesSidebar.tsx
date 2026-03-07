import { NavLink } from 'react-router-dom';
import { Home, Palette, BadgeCheck, CreditCard, Receipt, Gift, Mail, Menu, Share2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import nizaCloudLogo from '@/assets/niza-cloud-logo.png';
import nizaGroupIcon from '@/assets/niza-group-icon.png';
import { useAuth } from '@/contexts/AuthContext';

interface NizaTemplatesSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

import { FolderOpen } from 'lucide-react';

const getMenuItems = (role: string) => {
  const items = [
    { name: 'Home', path: '/niza-templates', icon: Home, end: true },
    { name: 'ID Card & Visitor Pass', path: '/niza-templates/id-cards', icon: BadgeCheck },
    { name: 'Business Cards', path: '/niza-templates/business-cards', icon: CreditCard },
    { name: 'Invoices', path: '/niza-templates/invoices', icon: Receipt },
    { name: 'Letterhead', path: '/niza-templates/letterhead', icon: FileText },
    { name: 'Email Signature', path: '/niza-templates/email-signature', icon: Mail },
    { name: 'Brand Settings', path: '/niza-templates/brand-settings', icon: Palette },
  ];
  // Gift Cards only for super_admin and HR
  if (role === 'super_admin' || role === 'hr') {
    items.splice(4, 0, { name: 'Gift Cards', path: '/niza-templates/gift-cards', icon: Gift });
  }
  // Add Shared Templates and Store & HR Templates for super_admin and HR only (not store/manager)
  if (role === 'super_admin' || role === 'hr') {
    items.push(
      { name: 'Shared Templates', path: '/niza-templates/shared', icon: Share2, end: false } as any,
      { name: 'Store & HR Templates', path: '/niza-templates/store-hr', icon: FolderOpen, end: false } as any,
    );
  }
  return items;
};

export default function NizaTemplatesSidebar({ collapsed, onToggle }: NizaTemplatesSidebarProps) {
  const { user } = useAuth();
  const menuItems = getMenuItems(user?.role || 'employee');

  return (
    <aside 
      className={`border-r border-primary/20 backdrop-blur-xl transition-all duration-300 flex flex-col relative h-screen sticky top-0 flex-shrink-0 overflow-hidden`}
      style={{ background: 'var(--gradient-panel)', width: collapsed ? '80px' : '256px' }}
    >
      {/* Logo */}
      <div className="p-4 flex items-center justify-center relative z-10 min-h-[80px] overflow-visible" style={{ width: collapsed ? '80px' : '256px' }}>
        {collapsed ? (
          <img src={nizaGroupIcon} alt="Niza Group" className="h-12 w-auto object-contain" />
        ) : (
          <img src={nizaCloudLogo} alt="Niza Templates" className="h-16 w-auto object-contain" />
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
