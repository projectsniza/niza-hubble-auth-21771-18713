import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Bot, Plus, Play, Trash2, Mail, Settings2, Clock, Filter, Wand2,
  Activity, AlertCircle, CheckCircle2, Pause, RefreshCw, FileSpreadsheet,
  ListChecks, ServerCog, Zap, Sparkles, Shield, Bell, Database, Cpu,
  TrendingUp, Inbox, Building2, KeyRound, BookOpen, Gauge, History,
  PlugZap, AlertTriangle, Download, Eye, Globe, Lock, Layers, BarChart3,
} from 'lucide-react';
import { toast } from 'sonner';

interface Agent {
  id: string;
  name: string;
  ai_provider: string;
  ai_model: string | null;
  mailbox_type: string;
  imap_host: string | null;
  imap_port: number | null;
  imap_user: string | null;
  imap_password: string | null;
  imap_use_tls: boolean | null;
  folder: string | null;
  branch_id: string | null;
  is_active: boolean | null;
  paused?: boolean | null;
  last_run_at: string | null;
  last_status: string | null;
  last_error: string | null;
  schedule_cron: string | null;
  subject_filters?: string[] | null;
  sender_filters?: string[] | null;
  attachment_types?: string[] | null;
  max_emails_per_run?: number | null;
  prompt_override?: string | null;
  temperature?: number | null;
}

interface Rule { id: string; agent_id: string; rule_type: string; rule_value: string; is_active: boolean }
interface Mapping { id: string; agent_id: string; source_field: string; target_column: string; default_value: string | null; is_required: boolean }
interface Run { id: string; agent_id: string; started_at: string; ended_at: string | null; status: string; emails_scanned: number; invoices_extracted: number; error_message: string | null; log_text: string | null }

const DEFAULT_AGENT: Partial<Agent> = {
  name: '', ai_provider: 'openai', ai_model: 'gpt-4o-mini', mailbox_type: 'imap',
  imap_host: '', imap_port: 993, imap_user: '', imap_password: '', imap_use_tls: true,
  folder: 'INBOX', is_active: true, paused: false, max_emails_per_run: 50,
  attachment_types: ['pdf'], temperature: 0.1,
};

const SOURCE_FIELDS = ['supplier', 'invoice_date', 'invoice_number', 'net', 'vat', 'gross', 'category', 'currency', 'po_number', 'due_date', 'payment_terms', 'discount', 'line_items'];
const RULE_TYPES = [
  { value: 'subject_contains', label: 'Subject contains' },
  { value: 'subject_excludes', label: 'Subject excludes' },
  { value: 'sender_contains', label: 'Sender contains' },
  { value: 'sender_excludes', label: 'Sender excludes' },
  { value: 'supplier_whitelist', label: 'Allowed supplier' },
  { value: 'supplier_blacklist', label: 'Blocked supplier' },
  { value: 'attachment_required', label: 'Attachment required (type)' },
  { value: 'amount_min', label: 'Minimum gross amount' },
  { value: 'amount_max', label: 'Maximum gross amount' },
  { value: 'date_after', label: 'Invoice date after' },
];

const MAILBOX_PRESETS = [
  { id: 'zoho-eu',   name: 'Zoho Mail (EU)',     host: 'imap.zoho.eu',         port: 993, tls: true, type: 'imap' },
  { id: 'zoho-com',  name: 'Zoho Mail (.com)',   host: 'imap.zoho.com',        port: 993, tls: true, type: 'imap' },
  { id: 'gmail',     name: 'Gmail (IMAP)',       host: 'imap.gmail.com',       port: 993, tls: true, type: 'imap' },
  { id: 'outlook',   name: 'Outlook / M365',     host: 'outlook.office365.com',port: 993, tls: true, type: 'imap' },
  { id: 'yahoo',     name: 'Yahoo Mail',         host: 'imap.mail.yahoo.com',  port: 993, tls: true, type: 'imap' },
  { id: 'icloud',    name: 'iCloud Mail',        host: 'imap.mail.me.com',     port: 993, tls: true, type: 'imap' },
  { id: 'fastmail',  name: 'Fastmail',           host: 'imap.fastmail.com',    port: 993, tls: true, type: 'imap' },
  { id: 'cpanel',    name: 'cPanel / shared host',host: 'mail.yourdomain.com', port: 993, tls: true, type: 'imap' },
];

const CRON_PRESETS = [
  { label: 'Every 15 min',  value: '*/15 * * * *' },
  { label: 'Hourly',        value: '0 * * * *' },
  { label: 'Every 2 hours', value: '0 */2 * * *' },
  { label: 'Every 6 hours', value: '0 */6 * * *' },
  { label: 'Daily 06:00',   value: '0 6 * * *' },
  { label: 'Daily 09:00 & 17:00', value: '0 9,17 * * *' },
  { label: 'Weekdays 08:00', value: '0 8 * * 1-5' },
];

const MODEL_OPTIONS: Record<string, string[]> = {
  openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1'],
  gemini: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
};

export default function EmailAgents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Agent>>(DEFAULT_AGENT);
  const [running, setRunning] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [recentInvoices, setRecentInvoices] = useState<any[]>([]);
  const [testing, setTesting] = useState(false);
  const [newRule, setNewRule] = useState<{ rule_type: string; rule_value: string }>({ rule_type: 'subject_contains', rule_value: '' });
  const [newMap, setNewMap] = useState<{ source_field: string; target_column: string }>({ source_field: 'supplier', target_column: 'Supplier' });

  const loadAgents = async () => {
    const [{ data: a }, { data: b }] = await Promise.all([
      supabase.from('niza_email_agents').select('*').order('created_at', { ascending: false }),
      supabase.from('branches').select('id,name').order('name'),
    ]);
    setAgents((a as any) || []);
    setBranches((b as any) || []);
    if (!selectedId && a && a.length > 0) setSelectedId((a as any)[0].id);
  };

  const loadDetail = async (id: string) => {
    const [{ data: r }, { data: m }, { data: rn }, { data: inv }] = await Promise.all([
      supabase.from('niza_agent_rules').select('*').eq('agent_id', id).order('created_at', { ascending: false }),
      supabase.from('niza_agent_field_mappings').select('*').eq('agent_id', id).order('source_field'),
      supabase.from('niza_email_agent_runs').select('*').eq('agent_id', id).order('started_at', { ascending: false }).limit(20),
      supabase.from('niza_invoices').select('id,supplier,invoice_date,gross,extraction_status,created_at,file_path').eq('source', 'email_agent').order('created_at', { ascending: false }).limit(15),
    ]);
    setRules((r as any) || []);
    setMappings((m as any) || []);
    setRuns((rn as any) || []);
    setRecentInvoices((inv as any) || []);
  };

  useEffect(() => { loadAgents(); }, []);
  useEffect(() => { if (selectedId) loadDetail(selectedId); }, [selectedId]);

  const selected = useMemo(() => agents.find(a => a.id === selectedId) || null, [agents, selectedId]);

  const save = async () => {
    if (!editing.name) return toast.error('Name is required');
    const { data: userData } = await supabase.auth.getUser();
    const payload: any = { ...editing, created_by: userData.user?.id };
    if (editing.id) {
      const { error } = await supabase.from('niza_email_agents').update(payload).eq('id', editing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from('niza_email_agents').insert(payload);
      if (error) return toast.error(error.message);
    }
    toast.success('Agent saved');
    setOpen(false); setEditing(DEFAULT_AGENT);
    loadAgents();
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this agent (rules, mappings and run history will be removed)?')) return;
    const { error } = await supabase.from('niza_email_agents').delete().eq('id', id);
    if (error) return toast.error(error.message);
    if (selectedId === id) setSelectedId(null);
    loadAgents();
  };

  const togglePause = async (a: Agent) => {
    const { error } = await supabase.from('niza_email_agents').update({ paused: !a.paused }).eq('id', a.id);
    if (error) return toast.error(error.message);
    loadAgents();
  };

  const run = async (id: string) => {
    setRunning(id);
    try {
      const { data, error } = await supabase.functions.invoke('niza-email-agent-run', { body: { agent_id: id } });
      if (error) throw error;
      toast.success(`Run finished · ${data?.invoices_extracted ?? 0} invoices`);
      loadAgents();
      if (selectedId === id) loadDetail(id);
    } catch (e: any) {
      toast.error(e?.message || 'Run failed');
    } finally {
      setRunning(null);
    }
  };

  const addRule = async () => {
    if (!selectedId || !newRule.rule_value.trim()) return;
    const { error } = await supabase.from('niza_agent_rules').insert({
      agent_id: selectedId, rule_type: newRule.rule_type, rule_value: newRule.rule_value.trim(), is_active: true,
    });
    if (error) return toast.error(error.message);
    setNewRule({ rule_type: 'subject_contains', rule_value: '' });
    loadDetail(selectedId);
  };

  const toggleRule = async (r: Rule) => {
    await supabase.from('niza_agent_rules').update({ is_active: !r.is_active }).eq('id', r.id);
    if (selectedId) loadDetail(selectedId);
  };

  const delRule = async (id: string) => {
    await supabase.from('niza_agent_rules').delete().eq('id', id);
    if (selectedId) loadDetail(selectedId);
  };

  const addMapping = async () => {
    if (!selectedId || !newMap.target_column.trim()) return;
    const { error } = await supabase.from('niza_agent_field_mappings').upsert({
      agent_id: selectedId, source_field: newMap.source_field, target_column: newMap.target_column.trim(),
    }, { onConflict: 'agent_id,source_field' });
    if (error) return toast.error(error.message);
    loadDetail(selectedId);
  };

  const delMapping = async (id: string) => {
    await supabase.from('niza_agent_field_mappings').delete().eq('id', id);
    if (selectedId) loadDetail(selectedId);
  };

  const stats = useMemo(() => {
    const total = agents.length;
    const active = agents.filter(a => a.is_active && !a.paused).length;
    const paused = agents.filter(a => a.paused).length;
    const errors = agents.filter(a => a.last_status === 'error').length;
    const scheduled = agents.filter(a => !!a.schedule_cron).length;
    const neverRun = agents.filter(a => !a.last_run_at).length;
    return { total, active, paused, errors, scheduled, neverRun };
  }, [agents]);

  const runStats = useMemo(() => {
    if (runs.length === 0) return { successRate: 0, avgDuration: 0, totalScanned: 0, totalExtracted: 0, conversion: 0 };
    const ok = runs.filter(r => r.status !== 'error' && r.status !== 'failed').length;
    const durs = runs.filter(r => r.ended_at).map(r => (new Date(r.ended_at!).getTime() - new Date(r.started_at).getTime()) / 1000);
    const totalScanned = runs.reduce((s, r) => s + (r.emails_scanned || 0), 0);
    const totalExtracted = runs.reduce((s, r) => s + (r.invoices_extracted || 0), 0);
    return {
      successRate: Math.round((ok / runs.length) * 100),
      avgDuration: durs.length ? Math.round(durs.reduce((a, b) => a + b, 0) / durs.length) : 0,
      totalScanned, totalExtracted,
      conversion: totalScanned ? Math.round((totalExtracted / totalScanned) * 100) : 0,
    };
  }, [runs]);

  const testConnection = async (a: Agent) => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('niza-email-agent-run', { body: { agent_id: a.id, test_only: true } });
      if (error) throw error;
      toast.success(`Connection OK · ${data?.scanned ?? 0} unread`);
    } catch (e: any) {
      toast.error(`Connection failed: ${e?.message || 'unknown'}`);
    } finally {
      setTesting(false);
    }
  };


  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30">
      <div className="p-6 md:p-10 max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
              <span className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Bot className="h-6 w-6" />
              </span>
              Email AI Agents
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Configure mailbox agents that extract supplier invoices and feed them into Credit Purchases.
              Set rules, map fields, schedule runs and monitor live logs.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadAgents}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</Button>
            <Button onClick={() => { setEditing(DEFAULT_AGENT); setOpen(true); }}><Plus className="h-4 w-4 mr-2" /> New agent</Button>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <StatCard icon={<Bot className="h-4 w-4" />} label="Agents" value={stats.total} />
          <StatCard icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />} label="Active" value={stats.active} />
          <StatCard icon={<Pause className="h-4 w-4 text-amber-500" />} label="Paused" value={stats.paused} />
          <StatCard icon={<AlertCircle className="h-4 w-4 text-destructive" />} label="Errors" value={stats.errors} />
          <StatCard icon={<Clock className="h-4 w-4 text-blue-500" />} label="Scheduled" value={stats.scheduled} />
          <StatCard icon={<Inbox className="h-4 w-4 text-muted-foreground" />} label="Never run" value={stats.neverRun} />
        </div>


        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
          {/* Sidebar with agent list */}
          <Card className="p-3 h-fit lg:sticky lg:top-4">
            <div className="text-xs font-semibold text-muted-foreground mb-2 px-2">AGENTS</div>
            {agents.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
                No agents yet
              </div>
            ) : (
              <div className="space-y-1 max-h-[600px] overflow-y-auto">
                {agents.map(a => (
                  <button
                    key={a.id}
                    onClick={() => setSelectedId(a.id)}
                    className={`w-full text-left p-2 rounded-md transition-colors ${selectedId === a.id ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted/60'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm truncate">{a.name}</span>
                      {a.paused ? <Badge variant="secondary" className="text-[10px]">Paused</Badge>
                        : a.is_active ? <Badge className="text-[10px]">On</Badge>
                          : <Badge variant="outline" className="text-[10px]">Off</Badge>}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                      {a.imap_user || a.mailbox_type}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>

          {/* Detail panel — BENTO */}
          {selected ? (
            <div className="space-y-4">
              {/* Hero card */}
              <Card className="p-5 bg-gradient-to-br from-primary/5 via-background to-accent/5 border-primary/20">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-xl font-bold">{selected.name}</h2>
                      <Badge variant="outline">{selected.ai_provider}{selected.ai_model ? ` · ${selected.ai_model}` : ''}</Badge>
                      <Badge variant="outline">{selected.mailbox_type}</Badge>
                      {selected.last_status && (
                        <Badge variant={selected.last_status === 'error' ? 'destructive' : 'secondary'}>{selected.last_status}</Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {selected.imap_user || selected.mailbox_type} · folder {selected.folder || 'INBOX'}
                      {selected.last_run_at ? ` · last run ${new Date(selected.last_run_at).toLocaleString()}` : ' · never run'}
                    </div>
                    {selected.last_error && (
                      <div className="text-xs text-destructive mt-2 max-w-2xl bg-destructive/10 p-2 rounded-md">{selected.last_error}</div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => run(selected.id)} disabled={running === selected.id || !!selected.paused}>
                      <Play className="h-4 w-4 mr-1" /> {running === selected.id ? 'Running…' : 'Run now'}
                    </Button>
                    <Button variant="outline" onClick={() => testConnection(selected)} disabled={testing}>
                      <PlugZap className="h-4 w-4 mr-1" /> {testing ? 'Testing…' : 'Test connection'}
                    </Button>
                    <Button variant="outline" onClick={() => togglePause(selected)}>
                      {selected.paused ? <Play className="h-4 w-4 mr-1" /> : <Pause className="h-4 w-4 mr-1" />}
                      {selected.paused ? 'Resume' : 'Pause'}
                    </Button>
                    <Button variant="outline" onClick={() => { setEditing(selected); setOpen(true); }}>
                      <Settings2 className="h-4 w-4 mr-1" /> Configure
                    </Button>
                    <Button variant="ghost" onClick={() => remove(selected.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>

                </div>
              </Card>

              {/* Bento grid */}
              <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                {/* Rules — wide */}
                <Card className="p-4 md:col-span-4">
                  <BentoHeader icon={<Filter className="h-4 w-4" />} title="Rules & Filters" subtitle={`${rules.length} active`} />
                  <div className="space-y-2 mb-3 max-h-72 overflow-y-auto">
                    {rules.length === 0 && <div className="text-xs text-muted-foreground italic">No rules — agent will process every matching email.</div>}
                    {rules.map(r => (
                      <div key={r.id} className="flex items-center justify-between gap-2 p-2 rounded border border-border/60">
                        <div className="flex items-center gap-2 min-w-0">
                          <Switch checked={r.is_active} onCheckedChange={() => toggleRule(r)} />
                          <Badge variant="outline" className="shrink-0">{RULE_TYPES.find(t => t.value === r.rule_type)?.label || r.rule_type}</Badge>
                          <span className="text-sm truncate">{r.rule_value}</span>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => delRule(r.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2 border-t pt-3">
                    <Select value={newRule.rule_type} onValueChange={(v) => setNewRule({ ...newRule, rule_type: v })}>
                      <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {RULE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input className="flex-1 min-w-[180px]" placeholder="value" value={newRule.rule_value} onChange={e => setNewRule({ ...newRule, rule_value: e.target.value })} />
                    <Button onClick={addRule}><Plus className="h-4 w-4 mr-1" /> Add</Button>
                  </div>
                </Card>

                {/* Schedule + throttle */}
                <Card className="p-4 md:col-span-2">
                  <BentoHeader icon={<Clock className="h-4 w-4" />} title="Schedule & Throttle" />
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs">Cron schedule</Label>
                      <Input
                        placeholder="e.g. 0 */2 * * *"
                        value={selected.schedule_cron || ''}
                        onChange={async (e) => {
                          await supabase.from('niza_email_agents').update({ schedule_cron: e.target.value }).eq('id', selected.id);
                          loadAgents();
                        }}
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">Empty = manual only</p>
                    </div>
                    <div>
                      <Label className="text-xs">Max emails per run</Label>
                      <Input
                        type="number"
                        value={selected.max_emails_per_run ?? 50}
                        onChange={async (e) => {
                          await supabase.from('niza_email_agents').update({ max_emails_per_run: Number(e.target.value) || 50 }).eq('id', selected.id);
                          loadAgents();
                        }}
                      />
                    </div>
                  </div>
                </Card>

                {/* Field mapping — wide */}
                <Card className="p-4 md:col-span-4">
                  <BentoHeader icon={<FileSpreadsheet className="h-4 w-4" />} title="Field Mapping" subtitle={`${mappings.length} fields mapped`} />
                  <div className="space-y-1 mb-3 max-h-72 overflow-y-auto">
                    {mappings.length === 0 && <div className="text-xs text-muted-foreground italic">No mappings — defaults will be used.</div>}
                    {mappings.map(m => (
                      <div key={m.id} className="flex items-center justify-between gap-2 p-2 rounded border border-border/60 text-sm">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{m.source_field}</Badge>
                          <span>→</span>
                          <span className="font-medium">{m.target_column}</span>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => delMapping(m.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2 border-t pt-3">
                    <Select value={newMap.source_field} onValueChange={(v) => setNewMap({ ...newMap, source_field: v })}>
                      <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                      <SelectContent>{SOURCE_FIELDS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                    </Select>
                    <span className="self-center text-muted-foreground">→</span>
                    <Input className="flex-1 min-w-[180px]" placeholder="CSV column header" value={newMap.target_column} onChange={e => setNewMap({ ...newMap, target_column: e.target.value })} />
                    <Button onClick={addMapping}><Plus className="h-4 w-4 mr-1" /> Map</Button>
                  </div>
                </Card>

                {/* Stats card */}
                <Card className="p-4 md:col-span-2">
                  <BentoHeader icon={<Activity className="h-4 w-4" />} title="Run Stats (20)" />
                  {runs.length === 0 ? (
                    <div className="text-xs text-muted-foreground italic">No runs yet.</div>
                  ) : (
                    <div className="space-y-2 text-sm">
                      <Row label="Total emails scanned" value={runs.reduce((s, r) => s + (r.emails_scanned || 0), 0)} />
                      <Row label="Invoices extracted" value={runs.reduce((s, r) => s + (r.invoices_extracted || 0), 0)} />
                      <Row label="Errors" value={runs.filter(r => r.status === 'error').length} />
                      <Row label="Avg per run" value={(runs.reduce((s, r) => s + (r.invoices_extracted || 0), 0) / runs.length).toFixed(1)} />
                    </div>
                  )}
                </Card>

                {/* Logs — full width */}
                <Card className="p-4 md:col-span-6">
                  <BentoHeader icon={<ListChecks className="h-4 w-4" />} title="Run History & Logs" subtitle="Latest 20 runs" />
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {runs.length === 0 && <div className="text-xs text-muted-foreground italic">No runs yet — click Run now.</div>}
                    {runs.map(r => (
                      <details key={r.id} className="rounded border border-border/60">
                        <summary className="cursor-pointer p-2 flex items-center justify-between gap-2 hover:bg-muted/40">
                          <div className="flex items-center gap-2">
                            {r.status === 'error' ? <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                              : r.status === 'completed' ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                : <RefreshCw className="h-3.5 w-3.5 text-muted-foreground animate-spin" />}
                            <span className="text-sm">{new Date(r.started_at).toLocaleString()}</span>
                            <Badge variant="outline">{r.status}</Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            scanned {r.emails_scanned} · extracted {r.invoices_extracted}
                          </div>
                        </summary>
                        <div className="p-2 bg-muted/40 text-xs font-mono whitespace-pre-wrap border-t">
                          {r.log_text || '(no log)'}
                          {r.error_message && <div className="text-destructive mt-1">Error: {r.error_message}</div>}
                        </div>
                      </details>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          ) : (
            <Card className="p-10 text-center text-muted-foreground">
              <Bot className="h-12 w-12 mx-auto mb-3 opacity-40" />
              Select an agent on the left, or create a new one.
            </Card>
          )}
        </div>

        {/* Configure dialog */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing.id ? 'Configure agent' : 'New email agent'}</DialogTitle>
            </DialogHeader>
            <Tabs defaultValue="basic" className="mt-2">
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="basic">Basic</TabsTrigger>
                <TabsTrigger value="mailbox">Mailbox</TabsTrigger>
                <TabsTrigger value="ai">AI</TabsTrigger>
                <TabsTrigger value="advanced">Advanced</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-3 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label>Name</Label>
                    <Input value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="e.g. Shepherd's Bush supplier mailbox" />
                  </div>
                  <div>
                    <Label>Branch (optional)</Label>
                    <Select value={editing.branch_id || 'none'} onValueChange={(v) => setEditing({ ...editing, branch_id: v === 'none' ? null : v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">All branches</SelectItem>
                        {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={!!editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
                  <Label>Active</Label>
                  <Separator orientation="vertical" className="h-6" />
                  <Switch checked={!!editing.paused} onCheckedChange={(v) => setEditing({ ...editing, paused: v })} />
                  <Label>Paused (skips runs but keeps history)</Label>
                </div>
              </TabsContent>

              <TabsContent value="mailbox" className="space-y-3 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label>Type</Label>
                    <Select value={editing.mailbox_type} onValueChange={(v) => setEditing({ ...editing, mailbox_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="imap">Webmail / IMAP (Zoho, cPanel)</SelectItem>
                        <SelectItem value="outlook">Outlook / Microsoft 365</SelectItem>
                        <SelectItem value="gmail">Gmail</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Folder</Label>
                    <Input value={editing.folder || ''} onChange={(e) => setEditing({ ...editing, folder: e.target.value })} placeholder="INBOX" />
                  </div>
                </div>
                {editing.mailbox_type === 'imap' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div><Label>IMAP host</Label><Input value={editing.imap_host || ''} onChange={(e) => setEditing({ ...editing, imap_host: e.target.value })} placeholder="imap.zoho.eu" /></div>
                    <div><Label>Port</Label><Input type="number" value={editing.imap_port ?? 993} onChange={(e) => setEditing({ ...editing, imap_port: Number(e.target.value) })} /></div>
                    <div><Label>Email</Label><Input value={editing.imap_user || ''} onChange={(e) => setEditing({ ...editing, imap_user: e.target.value })} /></div>
                    <div><Label>App password</Label><Input type="password" value={editing.imap_password || ''} onChange={(e) => setEditing({ ...editing, imap_password: e.target.value })} /></div>
                    <div className="flex items-center gap-2 mt-6">
                      <Switch checked={!!editing.imap_use_tls} onCheckedChange={(v) => setEditing({ ...editing, imap_use_tls: v })} />
                      <Label>Use TLS</Label>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="ai" className="space-y-3 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label>Provider</Label>
                    <Select value={editing.ai_provider} onValueChange={(v) => setEditing({ ...editing, ai_provider: v, ai_model: v === 'openai' ? 'gpt-4o-mini' : 'gemini-2.5-flash' })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="openai">OpenAI</SelectItem>
                        <SelectItem value="gemini">Google Gemini</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Model</Label><Input value={editing.ai_model || ''} onChange={(e) => setEditing({ ...editing, ai_model: e.target.value })} /></div>
                  <div><Label>Temperature</Label><Input type="number" step="0.1" value={editing.temperature ?? 0.1} onChange={(e) => setEditing({ ...editing, temperature: Number(e.target.value) })} /></div>
                </div>
                <div>
                  <Label>Prompt override (optional)</Label>
                  <Textarea rows={5} value={editing.prompt_override || ''} onChange={(e) => setEditing({ ...editing, prompt_override: e.target.value })} placeholder="Override the default invoice-extraction system prompt." />
                </div>
                <p className="text-xs text-muted-foreground">
                  Keys read server-side: <code>OPENAI_API_KEY</code>, <code>GEMINI_API_KEY</code>.
                </p>
              </TabsContent>

              <TabsContent value="advanced" className="space-y-3 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label>Max emails per run</Label>
                    <Input type="number" value={editing.max_emails_per_run ?? 50} onChange={(e) => setEditing({ ...editing, max_emails_per_run: Number(e.target.value) })} />
                  </div>
                  <div>
                    <Label>Cron schedule</Label>
                    <Input placeholder="0 */2 * * *" value={editing.schedule_cron || ''} onChange={(e) => setEditing({ ...editing, schedule_cron: e.target.value })} />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Attachment types (comma-separated)</Label>
                    <Input
                      value={(editing.attachment_types || []).join(', ')}
                      onChange={(e) => setEditing({ ...editing, attachment_types: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                      placeholder="pdf, jpg, png"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Subject keywords (any-of, comma-separated)</Label>
                    <Input
                      value={(editing.subject_filters || []).join(', ')}
                      onChange={(e) => setEditing({ ...editing, subject_filters: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                      placeholder="invoice, statement, receipt"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Sender filters (any-of, comma-separated)</Label>
                    <Input
                      value={(editing.sender_filters || []).join(', ')}
                      onChange={(e) => setEditing({ ...editing, sender_filters: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                      placeholder="@supplier.co.uk, billing@..."
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={save}><Wand2 className="h-4 w-4 mr-1" /> Save agent</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </Card>
  );
}
function BentoHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2 font-semibold"><span className="text-primary">{icon}</span> {title}</div>
      {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
    </div>
  );
}
function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border/40 py-1">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
