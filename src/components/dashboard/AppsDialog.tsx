import { Grid3x3, Shield, FileText, Calculator, ArrowRight, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCustomRoleAccess } from "@/hooks/useCustomRoleAccess";

interface AppItem {
  name: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  gradient: string;
  accessKey?: 'niza_safe' | 'niza_finance' | 'niza_templates';
}

const apps: AppItem[] = [
  {
    name: "Niza HR",
    description: "Human Resources Management",
    icon: <Users className="h-7 w-7" />,
    path: "/dashboard",
    gradient: "from-blue-500 to-cyan-600",
    // HR is always accessible for users who can see the dialog
  },
  {
    name: "Niza Safe",
    description: "Safety & Compliance",
    icon: <Shield className="h-7 w-7" />,
    path: "/niza-safe",
    gradient: "from-primary to-accent",
    accessKey: 'niza_safe',
  },
  {
    name: "Niza Finance",
    description: "Profit & Loss Calculator",
    icon: <Calculator className="h-7 w-7" />,
    path: "/niza-finance",
    gradient: "from-green-500 to-emerald-600",
    accessKey: 'niza_finance',
  },
  {
    name: "Niza Templates",
    description: "Templates & Brand Assets",
    icon: <FileText className="h-7 w-7" />,
    path: "/niza-templates",
    gradient: "from-purple-500 to-pink-600",
    accessKey: 'niza_templates',
  },
];

export default function AppsDialog() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { hasAppAccess, customRole, isLoading } = useCustomRoleAccess();

  // Super admins and full HR always have access to the app switcher
  const isSuperAdminOrFullHR = user?.role === 'super_admin' || 
    (user?.role === 'hr' && user?.hrAccessLevel === 'full');

  // Check if user has a custom role with any app access
  const hasAnyCustomAppAccess = customRole?.app_access && (
    customRole.app_access.niza_safe || 
    customRole.app_access.niza_finance || 
    customRole.app_access.niza_templates
  );

  // Show dialog for: super admin, full HR, or users with custom role app access
  const canAccessApps = isSuperAdminOrFullHR || hasAnyCustomAppAccess;

  if (isLoading) {
    return null;
  }

  if (!canAccessApps) {
    return null;
  }

  // Filter out current app based on location
  const currentPath = location.pathname;
  
  // Filter apps based on access permissions
  const filteredApps = apps.filter(app => {
    // First, check if we're on the current app's path
    if (app.path === '/dashboard') {
      if (currentPath.startsWith('/dashboard')) return false;
    } else {
      if (currentPath.startsWith(app.path)) return false;
    }

    // HR app is always accessible for those who can see the dialog
    if (!app.accessKey) return true;

    // For other apps, check access
    return hasAppAccess(app.accessKey);
  });

  // If no apps to show, don't render the button
  if (filteredApps.length === 0) {
    return null;
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button 
          className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 group"
        >
          <div className="grid grid-cols-2 gap-[3px]">
            <div className="w-[7px] h-[7px] rounded-[2px] border-[1.5px] border-white" />
            <div className="w-[7px] h-[7px] rounded-[2px] border-[1.5px] border-white" />
            <div className="w-[7px] h-[7px] rounded-[2px] border-[1.5px] border-white" />
            <div className="w-[7px] h-[7px] rounded-[2px] border-[1.5px] border-white flex items-center justify-center">
              <span className="text-[6px] font-bold text-white leading-none">+</span>
            </div>
          </div>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md border-primary/20 backdrop-blur-xl" style={{ background: 'var(--gradient-panel)' }}>
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Applications
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-4">
          {filteredApps.map((app) => (
            <button
              key={app.name}
              onClick={() => navigate(app.path)}
              className="group relative overflow-hidden flex items-center gap-4 p-4 rounded-xl border border-primary/20 bg-card/80 backdrop-blur-sm hover:bg-card transition-all text-left hover:shadow-lg hover:-translate-y-0.5"
            >
              {/* Icon */}
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${app.gradient} flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform`}>
                {app.icon}
              </div>
              
              {/* Text */}
              <div className="flex-1">
                <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                  {app.name}
                </h3>
                <p className="text-sm text-muted-foreground">{app.description}</p>
              </div>
              
              {/* Arrow */}
              <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-all group-hover:translate-x-1" />
              
              {/* Shine Effect */}
              <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
