import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Settings2, Bell, FileSpreadsheet, Cpu, Building2, Save, Trash2, Plus, Wand2,
} from 'lucide-react';
import { toast } from 'sonner';

interface AlertSettings {
  id?: string;
  organization_id: string | null;
  variance_threshold_gbp: number;
  missing_day_alert: boolean;
  new_category_alert: boolean;
  recipients: string[];
}
interface ExportPreset {
  id: string;
  name: string;
  preset_type: string;
  config: any;
  is_default: boolean;
  organization_id: string | null;
}
interface AiSetting {
  id?: string;
  organization_id: string | null;
  task_key: string;
  provider: string;
  model: string;
  prompt: string;
  temperature: number;
  max_tokens: number;
}

const TASK_KEYS = [
  { key: 'invoice_extract', label: 'Invoice extraction' },
  { key: 'category_match', label: 'Category matching' },
  { key: 'anomaly', label: 'Anomaly detection' },
  { key: 'summary', label: 'Daily summary' },
];

export default function AnalysisSettings() {
  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([]);
  const [orgId, setOrgId] = useState<string>('');
  const [branches, setBranches] = useState<{ id: string; name: string; organization_id: string }[]>([]);
  const [branchCats, setBranchCats] = useState<{ id: string; branch_id: string; category_code: string; display_name: string | null }[]>([]);
  const [alerts, setAlerts] = useState<AlertSettings>({
    organization_id: null, variance_threshold_gbp: 5, missing_day_alert: true, new_category_alert: true, recipients: [],
  });
  const [recipientInput, setRecipientInput] = useState('');
  const [presets, setPresets] = useState<ExportPreset[]>([]);
  const [newPreset, setNewPreset] = useState({ name: '', preset_type: 'xero', config: '{}' });
  const [aiSettings, setAiSettings] = useState<Record<string, AiSetting>>({});

  useEffect(() => {
    (async () => {
      const [{ data: o }, { data: b }] = await Promise.all([
        supabase.from('organizations').select('id, name').order('name'),
        supabase.from('branches').select('id, name, organization_id').order('name'),
      ]);
      setOrgs((o as any) || []);
      setBranches((b as any) || []);
      if (o && o.length > 0) setOrgId((o as any)[0].id);
    })();
  }, []);

  useEffect(() => {
    if (!orgId) return;
    (async () => {
      const [{ data: al }, { data: pr }, { data: ai }, { data: bc }] = await Promise.all([
        supabase.from('niza_alert_settings').select('*').eq('organization_id', orgId).maybeSingle(),
        supabase.from('niza_export_presets').select('*').eq('organization_id', orgId).order('name'),
        supabase.from('niza_ai_settings').select('*').eq('organization_id', orgId),
        supabase.from('niza_branch_categories').select('id, branch_id, category_code, display_name').order('category_code'),
      ]);
      if (al) setAlerts(al as any);
      else setAlerts({ organization_id: orgId, variance_threshold_gbp: 5, missing_day_alert: true, new_category_alert: true, recipients: [] });
      setPresets((pr as any) || []);
      const aiMap: Record<string, AiSetting> = {};
      TASK_KEYS.forEach(t => {
        const existing = (ai as any[] | null)?.find(x => x.task_key === t.key);
        aiMap[t.key] = existing || {
          organization_id: orgId, task_key: t.key, provider: 'openai', model: 'gpt-4o-mini',
          prompt: '', temperature: 0.1, max_tokens: 1500,
        };
      });
      setAiSettings(aiMap);
      setBranchCats((bc as any) || []);
    })();
  }, [orgId]);

  const saveAlerts = async () => {
    const payload = { ...alerts, organization_id: orgId };
    const { error } = await supabase.from('niza_alert_settings').upsert(payload, { onConflict: 'organization_id' });
    if (error) return toast.error(error.message);
    toast.success('Alert settings saved');
  };

  const addRecipient = () => {
    if (!recipientInput.includes('@')) return toast.error('Enter a valid email');
    setAlerts({ ...alerts, recipients: [...(alerts.recipients || []), recipientInput.trim()] });
    setRecipientInput('');
  };

  const removeRecipient = (e: string) => {
    setAlerts({ ...alerts, recipients: alerts.recipients.filter(x => x !== e) });
  };

  const addPreset = async () => {
    if (!newPreset.name.trim()) return toast.error('Name required');
    let cfg: any = {};
    try { cfg = JSON.parse(newPreset.config); } catch { return toast.error('Config must be valid JSON'); }
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from('niza_export_presets').insert({
      organization_id: orgId, name: newPreset.name.trim(), preset_type: newPreset.preset_type, config: cfg, created_by: u.user?.id,
    });
    if (error) return toast.error(error.message);
    setNewPreset({ name: '', preset_type: 'xero', config: '{}' });
    const { data: pr } = await supabase.from('niza_export_presets').select('*').eq('organization_id', orgId).order('name');
    setPresets((pr as any) || []);
    toast.success('Preset added');
  };

  const delPreset = async (id: string) => {
    await supabase.from('niza_export_presets').delete().eq('id', id);
    setPresets(presets.filter(p => p.id !== id));
  };

  const saveAi = async (taskKey: string) => {
    const s = aiSettings[taskKey];
    const { error } = await supabase.from('niza_ai_settings').upsert({ ...s, organization_id: orgId }, { onConflict: 'organization_id,task_key' });
    if (error) return toast.error(error.message);
    toast.success(`${taskKey} saved`);
  };

  const branchesForOrg = branches.filter(b => b.organization_id === orgId);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30">
      <div className="p-6 md:p-10 max-w-[1600px] mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
              <span className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Settings2 className="h-6 w-6" />
              </span>
              Niza Analysis Settings
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Branch overrides, alert thresholds, export presets and AI tuning.</p>
          </div>
          <div className="w-72">
            <Label className="text-xs">Organization</Label>
            <Select value={orgId} onValueChange={setOrgId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{orgs.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        {/* Bento */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          {/* Alerts */}
          <Card className="p-5 md:col-span-3">
            <Header icon={<Bell className="h-4 w-4" />} title="Alerts & Recipients" />
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Variance threshold (£)</Label>
                  <Input type="number" step="0.5" value={alerts.variance_threshold_gbp} onChange={e => setAlerts({ ...alerts, variance_threshold_gbp: Number(e.target.value) })} />
                </div>
                <div className="flex items-center gap-2 mt-6">
                  <Switch checked={alerts.missing_day_alert} onCheckedChange={v => setAlerts({ ...alerts, missing_day_alert: v })} />
                  <Label className="text-xs">Missing-day alert</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={alerts.new_category_alert} onCheckedChange={v => setAlerts({ ...alerts, new_category_alert: v })} />
                  <Label className="text-xs">New-category alert</Label>
                </div>
              </div>
              <div>
                <Label className="text-xs">Recipients</Label>
                <div className="flex gap-2 mt-1">
                  <Input value={recipientInput} onChange={e => setRecipientInput(e.target.value)} placeholder="ops@brand.co.uk" />
                  <Button onClick={addRecipient}><Plus className="h-4 w-4" /></Button>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {alerts.recipients?.map(r => (
                    <Badge key={r} variant="outline" className="cursor-pointer" onClick={() => removeRecipient(r)}>
                      {r} <Trash2 className="h-3 w-3 ml-1" />
                    </Badge>
                  ))}
                  {(!alerts.recipients || alerts.recipients.length === 0) && <span className="text-xs italic text-muted-foreground">No recipients yet</span>}
                </div>
              </div>
              <Button onClick={saveAlerts}><Save className="h-4 w-4 mr-1" /> Save alerts</Button>
            </div>
          </Card>

          {/* Branch overrides */}
          <Card className="p-5 md:col-span-3">
            <Header icon={<Building2 className="h-4 w-4" />} title="Branch-level overrides" subtitle={`${branchesForOrg.length} branches`} />
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {branchesForOrg.length === 0 && <div className="text-xs italic text-muted-foreground">No branches in this organization.</div>}
              {branchesForOrg.map(b => {
                const cats = branchCats.filter(c => c.branch_id === b.id);
                return (
                  <div key={b.id} className="p-2 border border-border/60 rounded">
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-sm">{b.name}</div>
                      <Badge variant="outline">{cats.length} categories</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 truncate">
                      {cats.length === 0 ? 'No till categories tracked yet' : cats.slice(0, 6).map(c => c.display_name || c.category_code).join(' · ')}
                      {cats.length > 6 ? ` … +${cats.length - 6}` : ''}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground mt-3">Branch categories are populated automatically by Daily Sales upload. Manage them per branch via Category Mappings.</p>
          </Card>

          {/* Export presets */}
          <Card className="p-5 md:col-span-4">
            <Header icon={<FileSpreadsheet className="h-4 w-4" />} title="Export Presets" subtitle={`${presets.length} saved`} />
            <div className="space-y-2 mb-3 max-h-72 overflow-y-auto">
              {presets.length === 0 && <div className="text-xs italic text-muted-foreground">No presets yet.</div>}
              {presets.map(p => (
                <div key={p.id} className="flex items-center justify-between p-2 border border-border/60 rounded">
                  <div>
                    <div className="font-medium text-sm">{p.name} <Badge variant="outline" className="ml-1">{p.preset_type}</Badge></div>
                    <div className="text-[11px] text-muted-foreground font-mono truncate max-w-md">{JSON.stringify(p.config).slice(0, 90)}</div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => delPreset(p.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                </div>
              ))}
            </div>
            <div className="border-t pt-3 space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <Input placeholder="Preset name" value={newPreset.name} onChange={e => setNewPreset({ ...newPreset, name: e.target.value })} />
                <Select value={newPreset.preset_type} onValueChange={v => setNewPreset({ ...newPreset, preset_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="xero">Xero CSV</SelectItem>
                    <SelectItem value="excel">Excel Branch Cash</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={addPreset}><Plus className="h-4 w-4 mr-1" /> Add</Button>
              </div>
              <Textarea rows={3} className="font-mono text-xs" placeholder='{"date_format":"DD/MM/YYYY","include_vat":true}' value={newPreset.config} onChange={e => setNewPreset({ ...newPreset, config: e.target.value })} />
            </div>
          </Card>

          {/* AI tuning */}
          <Card className="p-5 md:col-span-2">
            <Header icon={<Cpu className="h-4 w-4" />} title="AI Model Tuning" />
            <div className="space-y-3 max-h-72 overflow-y-auto">
              {TASK_KEYS.map(t => {
                const s = aiSettings[t.key];
                if (!s) return null;
                return (
                  <details key={t.key} className="border border-border/60 rounded">
                    <summary className="cursor-pointer p-2 text-sm font-medium flex items-center justify-between">
                      {t.label} <Badge variant="outline" className="text-[10px]">{s.provider}</Badge>
                    </summary>
                    <div className="p-2 space-y-2">
                      <Select value={s.provider} onValueChange={v => setAiSettings({ ...aiSettings, [t.key]: { ...s, provider: v } })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="openai">OpenAI</SelectItem>
                          <SelectItem value="gemini">Gemini</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input placeholder="model" value={s.model} onChange={e => setAiSettings({ ...aiSettings, [t.key]: { ...s, model: e.target.value } })} />
                      <Input type="number" step="0.1" placeholder="temperature" value={s.temperature} onChange={e => setAiSettings({ ...aiSettings, [t.key]: { ...s, temperature: Number(e.target.value) } })} />
                      <Textarea rows={3} placeholder="custom prompt (optional)" value={s.prompt} onChange={e => setAiSettings({ ...aiSettings, [t.key]: { ...s, prompt: e.target.value } })} />
                      <Button size="sm" onClick={() => saveAi(t.key)}><Wand2 className="h-3.5 w-3.5 mr-1" /> Save</Button>
                    </div>
                  </details>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Header({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2 font-semibold text-base"><span className="text-primary">{icon}</span> {title}</div>
      {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
    </div>
  );
}
