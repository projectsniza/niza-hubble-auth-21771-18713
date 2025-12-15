import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { PoundSterling, Percent, Building2, GraduationCap } from 'lucide-react';

interface TaxBand {
  id: string;
  tax_year: string;
  band_name: string;
  lower_limit: number;
  upper_limit: number | null;
  rate_percent: number;
}

interface NIBand {
  id: string;
  tax_year: string;
  ni_category: string;
  band_name: string;
  weekly_threshold: number;
  employee_rate_percent: number;
  employer_rate_percent: number;
}

interface PensionSettings {
  id?: string;
  pension_provider: string;
  employer_contribution_percent: number;
  employee_contribution_percent: number;
  qualifying_earnings_lower: number;
  qualifying_earnings_upper: number;
  auto_enrolment_enabled: boolean;
  postponement_period_months: number;
}

export function UKPayrollSettings() {
  const [taxBands, setTaxBands] = useState<TaxBand[]>([]);
  const [niBands, setNIBands] = useState<NIBand[]>([]);
  const [pensionSettings, setPensionSettings] = useState<PensionSettings>({
    pension_provider: '',
    employer_contribution_percent: 3,
    employee_contribution_percent: 5,
    qualifying_earnings_lower: 6240,
    qualifying_earnings_upper: 50270,
    auto_enrolment_enabled: true,
    postponement_period_months: 0
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [taxRes, niRes, pensionRes] = await Promise.all([
        supabase.from('uk_tax_bands').select('*').eq('is_active', true).order('lower_limit'),
        supabase.from('uk_ni_bands').select('*').eq('is_active', true).order('weekly_threshold'),
        supabase.from('uk_pension_settings').select('*').limit(1).single()
      ]);

      if (taxRes.data) setTaxBands(taxRes.data);
      if (niRes.data) setNIBands(niRes.data);
      if (pensionRes.data) setPensionSettings(pensionRes.data);
    } catch (error) {
      console.error('Error fetching UK payroll settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePensionSettings = async () => {
    setSaving(true);
    try {
      const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', (await supabase.auth.getUser()).data.user?.id).single();
      
      if (pensionSettings.id) {
        const { error } = await supabase.from('uk_pension_settings').update({
          ...pensionSettings,
          organization_id: profile?.organization_id
        }).eq('id', pensionSettings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('uk_pension_settings').insert({
          ...pensionSettings,
          organization_id: profile?.organization_id,
          created_by: (await supabase.auth.getUser()).data.user?.id
        });
        if (error) throw error;
      }
      toast.success('Pension settings saved');
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <PoundSterling className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-bold">UK Payroll Settings</h2>
      </div>

      <Tabs defaultValue="pension" className="w-full">
        <TabsList>
          <TabsTrigger value="pension">
            <Building2 className="h-4 w-4 mr-2" />
            Pension Auto-Enrolment
          </TabsTrigger>
          <TabsTrigger value="tax">
            <Percent className="h-4 w-4 mr-2" />
            Tax Bands (PAYE)
          </TabsTrigger>
          <TabsTrigger value="ni">
            <GraduationCap className="h-4 w-4 mr-2" />
            National Insurance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pension" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Workplace Pension Settings</CardTitle>
              <CardDescription>Configure auto-enrolment pension settings (UK minimum: 3% employer, 5% employee)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto-Enrolment Enabled</Label>
                  <p className="text-sm text-muted-foreground">Automatically enrol eligible employees</p>
                </div>
                <Switch
                  checked={pensionSettings.auto_enrolment_enabled}
                  onCheckedChange={(checked) => setPensionSettings({ ...pensionSettings, auto_enrolment_enabled: checked })}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Pension Provider</Label>
                  <Input
                    value={pensionSettings.pension_provider}
                    onChange={(e) => setPensionSettings({ ...pensionSettings, pension_provider: e.target.value })}
                    placeholder="e.g., NEST, People's Pension"
                  />
                </div>
                <div>
                  <Label>Postponement Period (months)</Label>
                  <Select
                    value={pensionSettings.postponement_period_months.toString()}
                    onValueChange={(v) => setPensionSettings({ ...pensionSettings, postponement_period_months: parseInt(v) })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">No postponement</SelectItem>
                      <SelectItem value="1">1 month</SelectItem>
                      <SelectItem value="2">2 months</SelectItem>
                      <SelectItem value="3">3 months (maximum)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Employer Contribution (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="3"
                    value={pensionSettings.employer_contribution_percent}
                    onChange={(e) => setPensionSettings({ ...pensionSettings, employer_contribution_percent: parseFloat(e.target.value) })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">UK minimum: 3%</p>
                </div>
                <div>
                  <Label>Employee Contribution (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="5"
                    value={pensionSettings.employee_contribution_percent}
                    onChange={(e) => setPensionSettings({ ...pensionSettings, employee_contribution_percent: parseFloat(e.target.value) })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">UK minimum: 5%</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Qualifying Earnings Lower Limit (Annual)</Label>
                  <Input
                    type="number"
                    value={pensionSettings.qualifying_earnings_lower}
                    onChange={(e) => setPensionSettings({ ...pensionSettings, qualifying_earnings_lower: parseFloat(e.target.value) })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">2024/25: £6,240</p>
                </div>
                <div>
                  <Label>Qualifying Earnings Upper Limit (Annual)</Label>
                  <Input
                    type="number"
                    value={pensionSettings.qualifying_earnings_upper}
                    onChange={(e) => setPensionSettings({ ...pensionSettings, qualifying_earnings_upper: parseFloat(e.target.value) })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">2024/25: £50,270</p>
                </div>
              </div>

              <Button onClick={handleSavePensionSettings} disabled={saving}>
                {saving ? 'Saving...' : 'Save Pension Settings'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tax" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Income Tax Bands (2024-25)</CardTitle>
              <CardDescription>Current UK PAYE tax rates and thresholds</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Band</TableHead>
                    <TableHead>Annual Income Range</TableHead>
                    <TableHead>Tax Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {taxBands.map((band) => (
                    <TableRow key={band.id}>
                      <TableCell className="font-medium capitalize">{band.band_name.replace('_', ' ')}</TableCell>
                      <TableCell>
                        {formatCurrency(band.lower_limit)} - {band.upper_limit ? formatCurrency(band.upper_limit) : '∞'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={band.rate_percent === 0 ? 'secondary' : 'default'}>
                          {band.rate_percent}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="text-xs text-muted-foreground mt-4">
                Note: Personal allowance reduces by £1 for every £2 earned over £100,000
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ni" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>National Insurance Bands (2024-25)</CardTitle>
              <CardDescription>Category A - Standard employee rates</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Threshold</TableHead>
                    <TableHead>Weekly Amount</TableHead>
                    <TableHead>Employee Rate</TableHead>
                    <TableHead>Employer Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {niBands.map((band) => (
                    <TableRow key={band.id}>
                      <TableCell className="font-medium">{band.band_name}</TableCell>
                      <TableCell>{formatCurrency(band.weekly_threshold)}/week</TableCell>
                      <TableCell>
                        <Badge variant={band.employee_rate_percent === 0 ? 'secondary' : 'default'}>
                          {band.employee_rate_percent}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={band.employer_rate_percent === 0 ? 'secondary' : 'default'}>
                          {band.employer_rate_percent}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-4 text-xs text-muted-foreground space-y-1">
                <p><strong>LEL</strong> = Lower Earnings Limit (no NICs due)</p>
                <p><strong>PT</strong> = Primary Threshold (employee NICs start)</p>
                <p><strong>ST</strong> = Secondary Threshold (employer NICs start)</p>
                <p><strong>UEL</strong> = Upper Earnings Limit (reduced employee rate above this)</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
