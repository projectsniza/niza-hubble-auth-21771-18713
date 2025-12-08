import { Card } from "@/components/ui/card";
import { FileText, AlertTriangle, AlertCircle, Clipboard } from "lucide-react";

export default function RiskManagement() {
  const riskModules = [
    {
      icon: FileText,
      title: "Risk Assessments",
      description: "Create and manage comprehensive risk assessments",
      gradient: "from-primary to-accent"
    },
    {
      icon: AlertTriangle,
      title: "Hazardous Substances Risk Assessments",
      description: "COSHH assessments and chemical safety management",
      gradient: "from-accent to-primary"
    },
    {
      icon: AlertCircle,
      title: "Hazard Reporting",
      description: "Report and track workplace hazards efficiently",
      gradient: "from-primary/80 to-accent/80"
    },
    {
      icon: Clipboard,
      title: "Method Statements",
      description: "Create safe working procedures and protocols",
      gradient: "from-accent/80 to-primary/80"
    }
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Risk Management</h1>
        <p className="text-muted-foreground">Identify, assess, and control workplace risks</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {riskModules.map((module, index) => (
          <Card 
            key={index}
            className="p-6 hover:shadow-lg transition-all cursor-pointer group border-border hover:border-primary/50"
          >
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${module.gradient} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                <module.icon className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg text-foreground mb-1 group-hover:text-primary transition-colors">
                  {module.title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {module.description}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
