import { BadgeCheck, CreditCard, Mail, Gift, Receipt, Palette } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTemplateStats, useBrandSettings } from '@/hooks/useTemplates';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export default function TemplatesHome() {
  const { stats, isLoading } = useTemplateStats();
  const { brandSettings } = useBrandSettings();
  const navigate = useNavigate();

  const templateTypes = [
    { 
      name: 'ID Cards & Visitor Passes', 
      description: 'Create employee ID cards and visitor passes with photo',
      icon: BadgeCheck, 
      color: 'bg-purple-500/10 text-purple-500',
      path: '/niza-templates/id-cards'
    },
    { 
      name: 'Business Cards', 
      description: 'Professional business cards with organization details',
      icon: CreditCard, 
      color: 'bg-blue-500/10 text-blue-500',
      path: '/niza-templates/business-cards'
    },
    { 
      name: 'Invoices', 
      description: 'Customize invoice header, footer, and body templates',
      icon: Receipt, 
      color: 'bg-pink-500/10 text-pink-500',
      path: '/niza-templates/invoices'
    },
    { 
      name: 'Gift Cards & Coupons', 
      description: 'Create personalized gift cards for employees',
      icon: Gift, 
      color: 'bg-amber-500/10 text-amber-500',
      path: '/niza-templates/gift-cards'
    },
    { 
      name: 'Email Signature', 
      description: 'Generate branded email signatures with HTML code',
      icon: Mail, 
      color: 'bg-green-500/10 text-green-500',
      path: '/niza-templates/email-signature'
    },
    { 
      name: 'Brand Settings', 
      description: 'Manage logos, colors, and brand assets',
      icon: Palette, 
      color: 'bg-red-500/10 text-red-500',
      path: '/niza-templates/brand-settings'
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          Niza Templates
        </h1>
        <p className="text-muted-foreground mt-2">
          Create professional templates for your organization
        </p>
      </div>

      {/* Brand Status */}
      <Card className="border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            {brandSettings?.primary_logo_path ? (
              <img src={brandSettings.primary_logo_path} alt="Logo" className="h-12 object-contain" />
            ) : (
              <div className="h-12 w-24 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">
                No Logo
              </div>
            )}
            <div className="flex-1">
              <p className="font-medium">Brand Settings</p>
              <p className="text-sm text-muted-foreground">
                {brandSettings?.primary_logo_path ? 'Logo configured' : 'Upload your logo to get started'}
              </p>
            </div>
            <button 
              onClick={() => navigate('/niza-templates/brand-settings')}
              className="text-sm text-primary hover:underline"
            >
              Configure →
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Template Categories */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Template Categories</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templateTypes.map((type) => (
            <Card 
              key={type.path} 
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => navigate(type.path)}
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

      {/* Store/HR Templates moved to dedicated sidebar page */}

      {/* Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold">{isLoading ? '...' : stats.totalGiftCards}</p>
              <p className="text-sm text-muted-foreground">Gift Cards</p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold">{isLoading ? '...' : stats.brandColorsCount}</p>
              <p className="text-sm text-muted-foreground">Brand Colors</p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold">{brandSettings?.primary_logo_path ? '✓' : '—'}</p>
              <p className="text-sm text-muted-foreground">Primary Logo</p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold">{brandSettings?.secondary_logo_path ? '✓' : '—'}</p>
              <p className="text-sm text-muted-foreground">Secondary Logo</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}