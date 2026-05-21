import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Bot, Plus, Play, Trash2, Mail, Settings2 } from 'lucide-react';
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
  last_run_at: string | null;
  last_status: string | null;
  last_error: string | null;
  schedule_cron: string | null;
}

const DEFAULT: Partial<Agent> = {
  name: '',
  ai_provider: 'openai',
  ai_model: 'gpt-4o-mini',
  mailbox_type: 'imap',
  imap_host: '',
  imap_port: 993,
  imap_user: '',
  imap_password: '',
  imap_use_tls: true,
  folder: 'INBOX',
  is_active: true,
};

export default function EmailAgents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Agent>>(DEFAULT);
  const [running, setRunning] = useState<string | null>(null);

  const load = async () => {
    const [{ data: a }, { data: b }] = await Promise.all([
      supabase.from('niza_email_agents').select('*').order('created_at', { ascending: false }),
      supabase.from('branches').select('id,name').order('name'),
    ]);
    setAgents((a as any) || []);
    setBranches((b as any) || []);
  };
  useEffect(() => { load(); }, []);

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
    toast.success('Saved');
    setOpen(false);
    setEditing(DEFAULT);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this agent?')) return;
    const { error } = await supabase.from('niza_email_agents').delete().eq('id', id);
    if (error) return toast.error(error.message);
    load();
  };

  const run = async (id: string) => {
    setRunning(id);
    try {
      const { data, error } = await supabase.functions.invoke('niza-email-agent-run', { body: { agent_id: id } });
      if (error) throw error;
      toast.success(`Run finished · ${data?.invoices_extracted ?? 0} invoices`);
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Run failed');
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30">
      <div className="p-6 md:p-10 max-w-6xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
              <span className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Bot className="h-5 w-5" />
              </span>
              Email AI Agents
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Connect a supplier mailbox. The agent fetches invoices, extracts totals with OpenAI or Gemini,
              and feeds them into the Credit Purchases tab of the Branch Cash Summary.
            </p>
          </div>
          <Button onClick={() => { setEditing(DEFAULT); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> New agent
          </Button>
        </div>

        {agents.length === 0 ? (
          <Card className="p-10 text-center text-muted-foreground">
            <Mail className="h-10 w-10 mx-auto mb-2" />
            No email agents yet.
          </Card>
        ) : (
          <div className="grid gap-3">
            {agents.map(a => (
              <Card key={a.id} className="p-4 border-border/60">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{a.name}</span>
                      <Badge variant="outline">{a.ai_provider}{a.ai_model ? ` · ${a.ai_model}` : ''}</Badge>
                      <Badge variant="outline">{a.mailbox_type}</Badge>
                      {a.is_active ? <Badge>Active</Badge> : <Badge variant="secondary">Paused</Badge>}
                      {a.last_status && <Badge variant={a.last_status === 'error' ? 'destructive' : 'secondary'}>{a.last_status}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {a.imap_user || a.mailbox_type} · folder {a.folder || 'INBOX'}
                      {a.last_run_at ? ` · last run ${new Date(a.last_run_at).toLocaleString()}` : ''}
                    </div>
                    {a.last_error && (
                      <div className="text-xs text-destructive mt-1 max-w-2xl">{a.last_error}</div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => run(a.id)} disabled={running === a.id}>
                      <Play className="h-4 w-4 mr-1" /> {running === a.id ? 'Running…' : 'Run now'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { setEditing(a); setOpen(true); }}>
                      <Settings2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => remove(a.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing.id ? 'Edit agent' : 'New email agent'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
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

              <div className="border-t pt-3">
                <div className="text-sm font-medium mb-2">AI provider</div>
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
                  <div>
                    <Label>Model</Label>
                    <Input value={editing.ai_model || ''} onChange={(e) => setEditing({ ...editing, ai_model: e.target.value })} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  API key is read from server-side secret (<code>OPENAI_API_KEY</code> or <code>GEMINI_API_KEY</code>).
                </p>
              </div>

              <div className="border-t pt-3">
                <div className="text-sm font-medium mb-2">Mailbox</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label>Type</Label>
                    <Select value={editing.mailbox_type} onValueChange={(v) => setEditing({ ...editing, mailbox_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="imap">Webmail / IMAP (Zoho, cPanel, etc.)</SelectItem>
                        <SelectItem value="outlook">Outlook / Microsoft 365 (OAuth)</SelectItem>
                        <SelectItem value="gmail">Gmail (OAuth)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Folder</Label>
                    <Input value={editing.folder || ''} onChange={(e) => setEditing({ ...editing, folder: e.target.value })} placeholder="INBOX" />
                  </div>
                </div>

                {editing.mailbox_type === 'imap' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                    <div>
                      <Label>IMAP host</Label>
                      <Input value={editing.imap_host || ''} onChange={(e) => setEditing({ ...editing, imap_host: e.target.value })} placeholder="imap.zoho.eu" />
                    </div>
                    <div>
                      <Label>Port</Label>
                      <Input type="number" value={editing.imap_port ?? 993} onChange={(e) => setEditing({ ...editing, imap_port: Number(e.target.value) })} />
                    </div>
                    <div>
                      <Label>Email</Label>
                      <Input value={editing.imap_user || ''} onChange={(e) => setEditing({ ...editing, imap_user: e.target.value })} />
                    </div>
                    <div>
                      <Label>App password</Label>
                      <Input type="password" value={editing.imap_password || ''} onChange={(e) => setEditing({ ...editing, imap_password: e.target.value })} />
                    </div>
                    <div className="flex items-center gap-2 mt-6">
                      <Switch checked={!!editing.imap_use_tls} onCheckedChange={(v) => setEditing({ ...editing, imap_use_tls: v })} />
                      <Label>Use TLS</Label>
                    </div>
                  </div>
                )}

                {(editing.mailbox_type === 'outlook' || editing.mailbox_type === 'gmail') && (
                  <p className="text-xs text-muted-foreground mt-2">
                    OAuth connection for {editing.mailbox_type} will be requested at first run. Save the agent, then click <strong>Run now</strong> to authorise.
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 border-t pt-3">
                <Switch checked={!!editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
                <Label>Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={save}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
