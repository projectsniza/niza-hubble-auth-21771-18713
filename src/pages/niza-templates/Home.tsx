import { FileText, Folder, Palette, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function TemplatesHome() {
  const stats = [
    { label: 'Total Templates', value: '0', icon: FileText, color: 'text-purple-500' },
    { label: 'Folders', value: '0', icon: Folder, color: 'text-pink-500' },
    { label: 'Brand Colors', value: '0', icon: Palette, color: 'text-blue-500' },
    { label: 'Downloads', value: '0', icon: TrendingUp, color: 'text-green-500' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-500 to-pink-600 bg-clip-text text-transparent">
          Niza Templates
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage brand assets, templates, and design resources
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Welcome to Niza Templates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Your centralized hub for managing all company templates and brand assets.
          </p>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <FileText className="h-5 w-5 text-purple-500 mt-0.5" />
              <div>
                <h3 className="font-semibold">Create & Edit Templates</h3>
                <p className="text-sm text-muted-foreground">
                  Design ID cards, visiting cards, email signatures and more
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Folder className="h-5 w-5 text-pink-500 mt-0.5" />
              <div>
                <h3 className="font-semibold">Organize in Folders</h3>
                <p className="text-sm text-muted-foreground">
                  Keep templates organized and accessible to the right team members
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Palette className="h-5 w-5 text-blue-500 mt-0.5" />
              <div>
                <h3 className="font-semibold">Brand Management</h3>
                <p className="text-sm text-muted-foreground">
                  Upload logos, define brand colors, and maintain consistency
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
