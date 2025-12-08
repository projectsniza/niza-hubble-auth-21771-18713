import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";

export default function NizaSafeHome() {
  const today = new Date().toLocaleDateString('en-US', { 
    weekday: 'short', 
    day: '2-digit', 
    month: 'short', 
    year: 'numeric' 
  });

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-foreground mb-2">
          Hi, User <span className="text-lg font-normal text-muted-foreground">{today}</span>
        </h1>
      </div>

      <div className="flex gap-4 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search your documents..."
            className="pl-10"
          />
        </div>
        <Button className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white shadow-lg">
          Report a hazard
        </Button>
        <Button variant="outline" className="border-primary text-primary hover:bg-primary/10">
          Request an appointment
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Your tasks */}
        <Card className="p-6 border-border hover:shadow-lg transition-shadow">
          <h2 className="text-xl font-semibold mb-4 text-foreground">Your tasks...</h2>
          <p className="text-sm text-muted-foreground mb-4">Over the next 7 days</p>
          
          <div className="flex items-center justify-center py-12">
            <div className="relative">
              <div className="w-32 h-32 rounded-full border-8 border-primary/20 flex items-center justify-center">
                <span className="text-5xl font-bold text-foreground">0</span>
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div className="p-3 rounded-lg bg-destructive/10">
              <p className="text-sm font-medium text-destructive">⚠ Overdue (0)</p>
              <p className="text-sm text-muted-foreground mt-1">There are no overdue tasks</p>
            </div>
            <div className="p-3 rounded-lg bg-accent/10">
              <p className="text-sm font-medium text-foreground">⏰ Upcoming (0)</p>
              <p className="text-sm text-muted-foreground mt-1">There are no upcoming tasks</p>
            </div>
          </div>

          <Button variant="link" className="mt-4 p-0 text-primary hover:text-primary/80">
            View all →
          </Button>
        </Card>

        {/* Risk assessments */}
        <Card className="p-6 border-border hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="bg-gradient-to-r from-primary to-accent text-white w-8 h-8 rounded-full flex items-center justify-center font-semibold shadow-lg">
                1
              </span>
              <h2 className="text-lg font-semibold text-foreground">Risk assessments</h2>
              <Button variant="link" className="text-primary p-0 hover:text-primary/80">View all →</Button>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-2 h-3 w-3 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  className="pl-7 h-8 text-sm w-48"
                />
              </div>
              <Button className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white shadow-lg h-8 text-sm">
                Create +
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Card className="flex-1 p-4 border-accent/30 bg-gradient-to-br from-accent/10 to-primary/5">
              <h3 className="font-semibold text-foreground">WW</h3>
              <p className="text-sm text-foreground">SHEPERDSBUSH</p>
              <span className="text-xs text-muted-foreground">(Draft)</span>
              <p className="text-xs text-primary mt-2">Date: Tue 21 Oct 2025</p>
            </Card>
            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Accidents section */}
          <div className="mt-8">
            <div className="flex gap-4 border-b border-border mb-4">
              <button className="pb-2 border-b-2 border-primary text-primary font-medium">
                Accidents
              </button>
              <button className="pb-2 text-muted-foreground hover:text-foreground transition-colors">
                Near Misses
              </button>
            </div>

            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="bg-gradient-to-r from-primary to-accent text-white w-8 h-8 rounded-full flex items-center justify-center font-semibold shadow-lg">
                  0
                </span>
                <span className="font-semibold text-foreground">Accidents</span>
              </div>
              <Button className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white shadow-lg h-8 text-sm">
                Create +
              </Button>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              In the unfortunate event of an accident, you can log the details and allow 'Responsible Persons' to conduct investigations to identify root causes to prevent re-occurrence.
            </p>
          </div>
        </Card>
      </div>

      {/* Bottom promotional cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <Card className="p-6 bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20 hover:shadow-lg transition-shadow">
          <h3 className="font-semibold mb-2 text-foreground">Get expert support</h3>
          <p className="text-sm text-muted-foreground">
            Access professional health and safety advice
          </p>
        </Card>
        <Card className="p-6 bg-gradient-to-br from-sidebar to-sidebar-accent text-sidebar-foreground hover:shadow-lg transition-shadow">
          <h3 className="font-semibold mb-2">Niza EX</h3>
          <p className="text-sm opacity-90">
            Transform your employee experience
          </p>
        </Card>
        <Card className="p-6 bg-gradient-to-r from-accent to-primary text-white hover:shadow-lg transition-shadow">
          <h3 className="font-semibold mb-2">Premium Features</h3>
          <p className="text-sm opacity-90">
            Unlock advanced safety management tools
          </p>
        </Card>
      </div>
    </div>
  );
}
