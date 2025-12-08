import { Card } from "@/components/ui/card";
import { AlertTriangle, Info } from "lucide-react";

export default function IncidentManagement() {
  const incidentTypes = [
    {
      icon: AlertTriangle,
      title: "Accidents",
      description: "Record and investigate workplace accidents thoroughly",
      gradient: "from-destructive to-destructive/70",
      count: 0
    },
    {
      icon: Info,
      title: "Near Misses",
      description: "Track and analyze near miss incidents to prevent future accidents",
      gradient: "from-accent to-primary",
      count: 0
    }
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Incident Management</h1>
        <p className="text-muted-foreground">Record, investigate, and learn from workplace incidents</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {incidentTypes.map((incident, index) => (
          <Card 
            key={index}
            className="p-6 hover:shadow-lg transition-all cursor-pointer group border-border hover:border-primary/50"
          >
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${incident.gradient} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                <incident.icon className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold text-lg text-foreground group-hover:text-primary transition-colors">
                    {incident.title}
                  </h3>
                  <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                    {incident.count}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {incident.description}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
