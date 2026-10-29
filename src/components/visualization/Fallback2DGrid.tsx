import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, Lock } from 'lucide-react';
import { DOCK_MODULES } from './GamifiedDock';
import { ZoneDataMap } from './useDigitalTwinData';
import { useAuth } from '@/contexts/AuthContext';

interface Fallback2DGridProps {
  metrics: ZoneDataMap;
  onSelectModule?: (moduleId: string) => void;
}

export function Fallback2DGrid({ metrics, onSelectModule }: Fallback2DGridProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEmployee = user?.role === 'employee';

  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-primary/20">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <span>Station Overview</span>
            <Badge variant="outline" className="border-primary/40 text-primary">
              2D Overview
            </Badge>
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Operational telemetry and live branch metrics grid
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {DOCK_MODULES.map((module) => {
          const data = metrics[module.id as keyof ZoneDataMap];
          const isLocked = isEmployee && !module.isAllowedForEmployee;
          const count = data?.count || 0;
          const Icon = module.icon;

          return (
            <Card
              key={module.id}
              className={`border-primary/20 transition-all duration-200 group relative overflow-hidden ${
                isLocked
                  ? 'opacity-60 bg-muted/20'
                  : 'hover:shadow-lg hover:border-primary/50 hover:-translate-y-0.5 cursor-pointer bg-card/80 backdrop-blur'
              }`}
              onClick={() => {
                if (isLocked) return;
                if (onSelectModule) onSelectModule(module.id);
                else navigate(module.route);
              }}
            >
              {/* Subtle top indicator bar */}
              <div
                className={`h-1 w-full ${
                  data?.status === 'alert'
                    ? 'bg-destructive'
                    : data?.status === 'warning'
                    ? 'bg-amber-500'
                    : 'bg-primary'
                }`}
              />

              <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-semibold text-foreground">
                      {module.name}
                    </CardTitle>
                    <span className="text-[11px] text-muted-foreground">
                      {data?.badgeLabel || 'Active'}
                    </span>
                  </div>
                </div>

                {isLocked ? (
                  <Badge variant="outline" className="text-[10px] gap-1 text-muted-foreground">
                    <Lock className="h-2.5 w-2.5" />
                    Locked
                  </Badge>
                ) : (
                  count > 0 && (
                    <Badge
                      variant={data?.status === 'alert' ? 'destructive' : 'secondary'}
                      className="text-xs font-bold"
                    >
                      {count}
                    </Badge>
                  )
                )}
              </CardHeader>

              <CardContent className="p-4 pt-2 space-y-3">
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                  {isLocked
                    ? 'Restricted to branch store management and administrators.'
                    : data?.summary || 'Operational tracking up-to-date.'}
                </p>

                <div className="pt-2 flex items-center justify-between border-t border-primary/10">
                  <span className="text-[11px] text-muted-foreground font-mono">
                    Zone #{module.id}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isLocked}
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(module.route);
                    }}
                    className="h-7 px-2 text-xs text-primary hover:text-primary gap-1 group-hover:bg-primary/10"
                  >
                    <span>Launch</span>
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
