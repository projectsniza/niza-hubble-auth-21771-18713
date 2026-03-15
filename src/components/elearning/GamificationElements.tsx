import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Flame, Target, Trophy, Star, Zap, Shield, Award, 
  TrendingUp, Crosshair, Lock, Unlock, ChevronRight 
} from 'lucide-react';
import { cn } from '@/lib/utils';

// XP Bar with animated fill
export function XPBar({ current, total, level }: { current: number; total: number; level: number }) {
  const [animatedValue, setAnimatedValue] = useState(0);
  const percent = Math.min((current / total) * 100, 100);

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedValue(percent), 100);
    return () => clearTimeout(timer);
  }, [percent]);

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30">
        <Star className="h-3.5 w-3.5 text-amber-500" />
        <span className="text-xs font-bold text-amber-600">LVL {level}</span>
      </div>
      <div className="flex-1 relative">
        <div className="h-3 rounded-full bg-muted overflow-hidden">
          <div 
            className="h-full rounded-full bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 transition-all duration-1000 ease-out relative"
            style={{ width: `${animatedValue}%` }}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
            <div className="absolute right-0 top-0 bottom-0 w-2 bg-white/40 rounded-full animate-pulse" />
          </div>
        </div>
      </div>
      <span className="text-xs font-mono font-bold text-muted-foreground">{current}/{total} XP</span>
    </div>
  );
}

// Streak Counter
export function StreakCounter({ days }: { days: number }) {
  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all",
      days > 0 
        ? "bg-gradient-to-r from-orange-500/10 to-red-500/10 border-orange-500/30" 
        : "bg-muted/50 border-border"
    )}>
      <Flame className={cn("h-4 w-4", days > 0 ? "text-orange-500 animate-pulse" : "text-muted-foreground")} />
      <span className={cn("text-sm font-bold", days > 0 ? "text-orange-600" : "text-muted-foreground")}>
        {days} day streak
      </span>
    </div>
  );
}

// Achievement Badge
export function AchievementBadge({ 
  icon: Icon, title, unlocked, color = "amber" 
}: { 
  icon: any; title: string; unlocked: boolean; color?: string 
}) {
  const colorMap: Record<string, string> = {
    amber: "from-amber-400 to-orange-500 border-amber-500/40",
    emerald: "from-emerald-400 to-green-500 border-emerald-500/40",
    blue: "from-blue-400 to-indigo-500 border-blue-500/40",
    purple: "from-purple-400 to-violet-500 border-purple-500/40",
    red: "from-red-400 to-rose-500 border-red-500/40",
  };

  return (
    <div className={cn(
      "flex flex-col items-center gap-1.5 transition-all",
      unlocked ? "opacity-100 scale-100" : "opacity-40 scale-95 grayscale"
    )}>
      <div className={cn(
        "w-12 h-12 rounded-xl flex items-center justify-center border-2 shadow-lg",
        unlocked 
          ? `bg-gradient-to-br ${colorMap[color]} shadow-${color}-500/20` 
          : "bg-muted border-muted-foreground/20"
      )}>
        {unlocked ? (
          <Icon className="h-5 w-5 text-white" />
        ) : (
          <Lock className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      <span className="text-[10px] font-semibold text-center leading-tight max-w-[60px] text-muted-foreground">
        {title}
      </span>
    </div>
  );
}

// Points Popup Animation
export function PointsPopup({ points, show }: { points: number; show: boolean }) {
  if (!show) return null;
  return (
    <div className="fixed top-20 right-8 z-50 animate-fade-in">
      <div className="bg-gradient-to-r from-amber-500 to-orange-600 text-white px-4 py-2 rounded-xl shadow-2xl flex items-center gap-2">
        <Zap className="h-5 w-5" />
        <span className="font-bold text-lg">+{points} XP</span>
      </div>
    </div>
  );
}

// Difficulty Badge
export function DifficultyBadge({ level }: { level: 'beginner' | 'intermediate' | 'advanced' | 'expert' }) {
  const config = {
    beginner: { color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30", icon: Target, label: "Beginner" },
    intermediate: { color: "bg-blue-500/10 text-blue-600 border-blue-500/30", icon: TrendingUp, label: "Intermediate" },
    advanced: { color: "bg-orange-500/10 text-orange-600 border-orange-500/30", icon: Crosshair, label: "Advanced" },
    expert: { color: "bg-red-500/10 text-red-600 border-red-500/30", icon: Shield, label: "Expert" },
  }[level];

  return (
    <Badge className={cn("gap-1 border", config.color)}>
      <config.icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

// Lesson completion reward card
export function LessonRewardCard({ xp, isBonus }: { xp: number; isBonus?: boolean }) {
  return (
    <Card className={cn(
      "border-2 overflow-hidden",
      isBonus 
        ? "border-amber-500/40 bg-gradient-to-br from-amber-500/5 to-orange-500/5" 
        : "border-primary/20"
    )}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center",
          isBonus 
            ? "bg-gradient-to-br from-amber-400 to-orange-500" 
            : "bg-gradient-to-br from-emerald-400 to-green-500"
        )}>
          {isBonus ? <Star className="h-5 w-5 text-white" /> : <Zap className="h-5 w-5 text-white" />}
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">
            {isBonus ? "Bonus Reward" : "Lesson Complete"}
          </p>
          <p className="text-xs text-muted-foreground">+{xp} XP earned</p>
        </div>
      </CardContent>
    </Card>
  );
}

// Course Progress Ring
export function ProgressRing({ percent, size = 48 }: { percent: number; size?: number }) {
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          strokeWidth={strokeWidth}
          fill="none"
          className="stroke-muted"
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="stroke-primary transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-bold">{percent}%</span>
      </div>
    </div>
  );
}

// Milestone tracker
export function MilestoneTracker({ current, milestones }: { 
  current: number; 
  milestones: { at: number; label: string; icon: any }[] 
}) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-2">
      {milestones.map((m, i) => {
        const reached = current >= m.at;
        const Icon = m.icon;
        return (
          <div key={i} className="flex items-center">
            <div className={cn(
              "flex flex-col items-center gap-1 px-2",
              reached ? "opacity-100" : "opacity-40"
            )}>
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all",
                reached 
                  ? "bg-gradient-to-br from-amber-400 to-orange-500 border-amber-500/40 shadow-lg shadow-amber-500/20" 
                  : "bg-muted border-muted-foreground/20"
              )}>
                {reached ? <Icon className="h-3.5 w-3.5 text-white" /> : <Lock className="h-3 w-3 text-muted-foreground" />}
              </div>
              <span className="text-[9px] font-semibold text-muted-foreground whitespace-nowrap">{m.label}</span>
            </div>
            {i < milestones.length - 1 && (
              <div className={cn(
                "w-6 h-0.5 rounded-full",
                current >= milestones[i + 1]?.at ? "bg-amber-500" : "bg-muted"
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}
