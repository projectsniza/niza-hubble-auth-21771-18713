import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Bell, Briefcase, GraduationCap, Cake, Users, Megaphone } from "lucide-react";

export default function Events() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("all");

  const categoryConfig = {
    all: { label: "All", icon: Bell, color: "from-primary to-accent" },
    company: { label: "Company Events", icon: Briefcase, color: "from-blue-500 to-blue-600" },
    training: { label: "Training", icon: GraduationCap, color: "from-purple-500 to-purple-600" },
    birthday: { label: "Birthdays", icon: Cake, color: "from-pink-500 to-pink-600" },
    employee: { label: "Employee Events", icon: Users, color: "from-green-500 to-green-600" },
    announcement: { label: "Announcements", icon: Megaphone, color: "from-orange-500 to-orange-600" },
    urgent: { label: "Urgent", icon: Bell, color: "from-red-500 to-red-600" },
  };

  const QuickFilterButton = ({ category, count }: { category: string; count: number }) => {
    const config = categoryConfig[category as keyof typeof categoryConfig];
    const isActive = activeFilter === category;

    return (
      <Button
        variant={isActive ? "default" : "outline"}
        size="sm"
        onClick={() => setActiveFilter(category)}
        className={`gap-2 ${isActive ? `bg-gradient-to-r ${config.color} text-white border-0 shadow-lg` : ''}`}
      >
        <config.icon className="h-4 w-4" />
        {config.label}
        <Badge variant="secondary" className="ml-1">{count}</Badge>
      </Button>
    );
  };

  return (
    <div className="p-8 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Events & Announcements</h1>
          <p className="text-muted-foreground">Stay updated with all company activities and important news</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            New Announcement
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Event
          </Button>
        </div>
      </div>

      <Card className="mb-6 p-4 border-primary/20 bg-gradient-to-r from-card to-card/50">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search events, announcements, locations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </Card>

      <div className="mb-6">
        <h3 className="text-sm font-semibold text-muted-foreground mb-3">QUICK FILTERS</h3>
        <div className="flex flex-wrap gap-2">
          <QuickFilterButton category="all" count={0} />
          <QuickFilterButton category="company" count={0} />
          <QuickFilterButton category="training" count={0} />
          <QuickFilterButton category="birthday" count={0} />
          <QuickFilterButton category="employee" count={0} />
          <QuickFilterButton category="announcement" count={0} />
          <QuickFilterButton category="urgent" count={0} />
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">
          {activeFilter === "all" ? "All Updates" : categoryConfig[activeFilter as keyof typeof categoryConfig].label}
        </h2>
        <Card className="p-12 text-center border-dashed">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Bell className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-foreground mb-2">No events or announcements</h3>
              <p className="text-muted-foreground mb-4">Create your first event or announcement to get started</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                New Announcement
              </Button>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Event
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
