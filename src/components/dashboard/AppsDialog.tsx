import { Grid3x3, Shield, FileText, BarChart3, ArrowRight, Calculator } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface AppItem {
  name: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  gradient: string;
}

const apps: AppItem[] = [
  {
    name: "Niza Safe",
    description: "Safety & Compliance",
    icon: <Shield className="h-7 w-7" />,
    path: "/niza-safe",
    gradient: "from-primary to-accent",
  },
  {
    name: "Niza Finance",
    description: "Profit & Loss Calculator",
    icon: <Calculator className="h-7 w-7" />,
    path: "/niza-finance",
    gradient: "from-green-500 to-emerald-600",
  },
  {
    name: "Niza Templates",
    description: "Templates & Brand Assets",
    icon: <FileText className="h-7 w-7" />,
    path: "/niza-templates",
    gradient: "from-purple-500 to-pink-600",
  },
];

export default function AppsDialog() {
  const navigate = useNavigate();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-9 w-9 relative group hover:bg-primary/10"
        >
          <Grid3x3 className="h-5 w-5 text-foreground group-hover:text-primary transition-colors" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md border-primary/20 backdrop-blur-xl" style={{ background: 'var(--gradient-panel)' }}>
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Applications
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-4">
          {apps.map((app) => (
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
