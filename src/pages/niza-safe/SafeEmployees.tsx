import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Search, Info, UserCircle2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function SafeEmployees() {
  return (
    <div className="p-8 max-w-7xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2">Employees (2)</h1>
        <p className="text-muted-foreground">Manage employee safety records and assignments</p>
      </div>

      <Card className="p-4 mb-6 border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
          <p className="text-sm text-foreground">
            To use Niza Safe, employees should be assigned to a place of work. Please ask your Niza HR admin to update this.
          </p>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <h3 className="text-sm font-semibold mb-2">Search</h3>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Name, Site, Job Title, Role"
              className="pl-10"
            />
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold mb-2">Filter by employees status</h3>
          <Select defaultValue="active">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active (2)</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="overflow-hidden border-border">
        <table className="w-full">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Full name</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Job title</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Site</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                <div className="flex items-center gap-1">
                  Role
                  <Info className="h-4 w-4 text-muted-foreground" />
                </div>
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                <div className="flex items-center gap-1">
                  Permissions
                  <Info className="h-4 w-4 text-muted-foreground" />
                </div>
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Access</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            <tr className="hover:bg-accent/5 transition-colors">
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                    <UserCircle2 className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-primary font-medium">Chandran Manoharan</span>
                </div>
              </td>
              <td className="px-6 py-4 text-muted-foreground">Not specified</td>
              <td className="px-6 py-4 text-foreground">SHEPERDSBUSH</td>
              <td className="px-6 py-4">
                <span className="px-2 py-1 rounded-md bg-accent/10 text-foreground text-xs font-medium">Employee</span>
              </td>
              <td className="px-6 py-4 text-muted-foreground">-</td>
              <td className="px-6 py-4 text-muted-foreground">-</td>
            </tr>
            <tr className="hover:bg-accent/5 transition-colors">
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent to-primary flex items-center justify-center">
                    <UserCircle2 className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-primary font-medium">Ragunathan Visvanathan</span>
                </div>
              </td>
              <td className="px-6 py-4 text-muted-foreground">Not specified</td>
              <td className="px-6 py-4">
                <span className="text-destructive font-medium">Unassigned</span>
              </td>
              <td className="px-6 py-4">
                <span className="px-2 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium">Admin</span>
              </td>
              <td className="px-6 py-4 text-muted-foreground">-</td>
              <td className="px-6 py-4">
                <span className="px-3 py-1 bg-gradient-to-r from-primary/10 to-accent/10 text-primary rounded-full text-sm font-medium">
                  All Sites
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </Card>
    </div>
  );
}
