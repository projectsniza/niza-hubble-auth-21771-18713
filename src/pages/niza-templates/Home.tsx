import { FileText, Folder, Palette, Gift, CreditCard, Mail, BadgeCheck, Receipt, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTemplateStats } from '@/hooks/useTemplates';
import { useNavigate } from 'react-router-dom';

export default function TemplatesHome() {
  const { stats, isLoading } = useTemplateStats();
  const navigate = useNavigate();

  const statsCards = [
    { label: 'Total Templates', value: stats.totalTemplates, icon: FileText, color: 'text-purple-500' },
    { label: 'Folders', value: stats.totalFolders, icon: Folder, color: 'text-pink-500' },
    { label: 'Gift Cards', value: stats.totalGiftCards, icon: Gift, color: 'text-amber-500' },
    { label: 'Brand Colors', value: stats.brandColorsCount, icon: Palette, color: 'text-blue-500' },
  ];

  const templateTypes = [
    { 
      name: 'Visiting Cards', 
      description: 'Professional business cards for employees',
      icon: CreditCard, 
      color: 'bg-blue-500/10 text-blue-500',
      type: 'visiting_card'
    },
    { 
      name: 'Email Signatures', 
      description: 'Branded email signatures for company emails',
      icon: Mail, 
      color: 'bg-green-500/10 text-green-500',
      type: 'email_signature'
    },
    { 
      name: 'ID Cards', 
      description: 'Employee identification cards with photos',
      icon: BadgeCheck, 
      color: 'bg-purple-500/10 text-purple-500',
      type: 'id_card'
    },
    { 
      name: 'Visitor Passes', 
      description: 'Temporary visitor identification passes',
      icon: Users, 
      color: 'bg-amber-500/10 text-amber-500',
      type: 'visitor_pass'
    },
    { 
      name: 'Invoice Templates', 
      description: 'Invoice headers, footers, and body templates',
      icon: Receipt, 
      color: 'bg-pink-500/10 text-pink-500',
      type: 'invoice'
    },
    { 
      name: 'Gift Cards', 
      description: 'Digital gift cards for employees',
      icon: Gift, 
      color: 'bg-red-500/10 text-red-500',
      type: 'gift_card'
    },
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
        {statsCards.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? '...' : stat.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Template Types</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templateTypes.map((type) => (
            <Card 
              key={type.type} 
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => navigate(`/niza-templates/templates?type=${type.type}`)}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg ${type.color}`}>
                    <type.icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">{type.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {type.description}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Start Guide</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">1</div>
              <div>
                <h3 className="font-semibold">Set Up Brand Settings</h3>
                <p className="text-sm text-muted-foreground">
                  Upload your logos, define brand colors, and set up fonts
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">2</div>
              <div>
                <h3 className="font-semibold">Create Template Folders</h3>
                <p className="text-sm text-muted-foreground">
                  Organize your templates into folders for easy access
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">3</div>
              <div>
                <h3 className="font-semibold">Create Templates</h3>
                <p className="text-sm text-muted-foreground">
                  Design ID cards, visiting cards, email signatures and more
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
