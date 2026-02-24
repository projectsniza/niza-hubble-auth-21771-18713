import { BadgeCheck, CreditCard, Mail, Gift, Receipt, Palette, FolderOpen, Download, Building, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTemplateStats, useBrandSettings } from '@/hooks/useTemplates';
import { useNavigate } from 'react-router-dom';

import { useAllStoreTemplates } from '@/hooks/useSharedTemplates';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';

export default function TemplatesHome() {
  const { stats, isLoading } = useTemplateStats();
  const { brandSettings } = useBrandSettings();
  const { user } = useAuth();
  const { templates: storeTemplates, isLoading: storeLoading } = useAllStoreTemplates();
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
        <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-500 to-pink-600 bg-clip-text text-transparent">
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

      {/* Shared Templates Panel removed - now in its own sidebar page */}

      {/* Store/HR Created Templates - Super Admin Only */}
      {user?.role === 'super_admin' && (
        <Card className="border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              Store & HR Templates
            </CardTitle>
          </CardHeader>
          <CardContent>
            {storeLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
              </div>
            ) : storeTemplates.length === 0 ? (
              <div className="text-center py-8">
                <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold mb-2">No Store Templates</h3>
                <p className="text-sm text-muted-foreground">
                  Templates created by store and HR accounts will appear here
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {storeTemplates.map((template: any) => (
                  <div key={template.id} className="flex items-center gap-3 p-3 rounded-lg border hover:border-primary/30 transition-colors">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <FolderOpen className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium truncate">{template.title}</h4>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="capitalize">{template.template_type.replace('_', ' ')}</span>
                        <span>•</span>
                        {template.organization && (
                          <span className="flex items-center gap-1">
                            <Building className="h-3 w-3" />
                            {template.organization.name}
                          </span>
                        )}
                        {template.branch && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {template.branch.name}
                          </span>
                        )}
                        <span>•</span>
                        <span>{format(new Date(template.created_at), 'MMM d, yyyy')}</span>
                      </div>
                    </div>
                    {template.file_path && (
                      <Button variant="ghost" size="icon" onClick={() => window.open(template.file_path, '_blank')}>
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

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