import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, CheckCircle2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Tasks() {
  return (
    <div className="p-8 max-w-7xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2">Tasks</h1>
        <p className="text-muted-foreground">Manage and track safety-related tasks</p>
      </div>

      <div className="flex gap-4 mb-6 border-b border-border">
        <button className="pb-3 border-b-2 border-primary text-primary font-medium px-4 transition-colors">
          Assigned to me <span className="bg-gradient-to-r from-primary to-accent text-white px-2 py-0.5 rounded-full text-sm ml-2">0</span>
        </button>
        <button className="pb-3 text-muted-foreground hover:text-foreground px-4 transition-colors">
          Attached to my responsibilities <span className="bg-muted px-2 py-0.5 rounded-full text-sm ml-2">0</span>
        </button>
        <button className="pb-3 text-muted-foreground hover:text-foreground px-4 transition-colors">
          All tasks <span className="bg-muted px-2 py-0.5 rounded-full text-sm ml-2">0</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div>
          <h3 className="text-sm font-semibold mb-2">Search</h3>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search title, category, site"
              className="pl-10"
            />
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold mb-2">Sites</h3>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search or select"
              className="pl-10"
            />
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold mb-2">Category</h3>
          <Select defaultValue="all">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <h3 className="text-sm font-semibold mb-2">Task status</h3>
          <Select defaultValue="incomplete">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="incomplete">Incomplete</SelectItem>
              <SelectItem value="complete">Complete</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="mb-6 inline-block p-8 rounded-full bg-gradient-to-br from-primary/10 to-accent/10">
            <CheckCircle2 className="w-24 h-24 text-primary mx-auto" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">No tasks found</h2>
          <p className="text-muted-foreground">There are currently no tasks assigned to you</p>
        </div>
      </div>
    </div>
  );
}
