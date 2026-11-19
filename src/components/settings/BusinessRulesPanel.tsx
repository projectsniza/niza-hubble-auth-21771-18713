import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, X, RotateCcw, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganizations } from '@/hooks/useOrganizations';
import { useOrgSettingsAdmin } from '@/hooks/useOrgSetting';
import { SETTINGS, optionsFromLabels, resolveSetting, type OptionItem, type SettingKey } from '@/lib/settingsSchema';

const GROUP = '__group__';
const AREAS = ['People', 'Store operations', 'Attendance', 'Security'] as const;

/** Settings -> Business Rules: change lists and numbers per organisation (or for the whole group). */
export default function BusinessRulesPanel() {
  const { user } = useAuth();
  const { organizations } = useOrganizations();
  const { rows, isLoading, getRow, save, reset } = useOrgSettingsAdmin();
  const isSuper = user?.role === 'super_admin';

  // HR can only change their own organisation; Super Admin can also change the group default.
  const choices = useMemo(
    () => (isSuper ? organizations : organizations.filter((o) => o.id === user?.organizationId)),
    [isSuper, organizations, user?.organizationId]
  );
  const [scope, setScope] = useState<string>(isSuper ? GROUP : user?.organizationId || GROUP);
  const orgId = scope === GROUP ? null : scope;

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const canEditScope = isSuper || (orgId !== null && orgId === user?.organizationId) || (user?.role === 'hr' && orgId !== null);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Business Rules</CardTitle>
          <CardDescription>
            Change the lists and numbers the app uses for each organisation. An organisation without its own value
            uses the group default, and everything starts with the app's normal values.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Label>Editing rules for</Label>
          <Select value={scope} onValueChange={setScope}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {isSuper && <SelectItem value={GROUP}>Group default (all organisations)</SelectItem>}
              {choices.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!canEditScope && <Badge variant="secondary">View only</Badge>}
        </CardContent>
      </Card>

      {AREAS.map((area) => {
        const keys = (Object.keys(SETTINGS) as SettingKey[]).filter((k) => SETTINGS[k].area === area);
        if (keys.length === 0) return null;
        return (
          <Card key={area}>
            <CardHeader>
              <CardTitle className="text-base">{area}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {keys.map((k) => (
                <RuleEditor
                  key={`${k}-${scope}-${rows.length}`}
                  settingKey={k}
                  orgId={orgId}
                  ownValue={getRow(k, orgId)?.value}
                  groupValue={getRow(k, null)?.value}
                  canEdit={canEditScope}
                  onSave={save}
                  onReset={reset}
                />
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

interface RuleEditorProps {
  settingKey: SettingKey;
  orgId: string | null;
  ownValue: unknown;
  groupValue: unknown;
  canEdit: boolean;
  onSave: (key: SettingKey, orgId: string | null, value: unknown) => Promise<void>;
  onReset: (key: SettingKey, orgId: string | null) => Promise<void>;
}

function RuleEditor({ settingKey, orgId, ownValue, groupValue, canEdit, onSave, onReset }: RuleEditorProps) {
  const def = SETTINGS[settingKey];
  const hasOwn = ownValue !== undefined && ownValue !== null;
  // What the editor starts from: this scope's own value, else what it would inherit.
  const inherited = resolveSetting(settingKey, undefined, groupValue);
  const start = hasOwn ? resolveSetting(settingKey, ownValue, groupValue) : inherited;

  const [value, setValue] = useState<unknown>(start);
  const [newItem, setNewItem] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
    } catch (e) {
      toast.error((e as { message?: string })?.message || 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  const validate = (): string | null => {
    if (def.type === 'number') {
      const n = Number(value);
      if (!Number.isFinite(n)) return 'Enter a number';
      if ('min' in def && def.min !== undefined && n < def.min) return `Must be at least ${def.min}`;
      if ('max' in def && def.max !== undefined && n > def.max) return `Must be at most ${def.max}`;
    }
    if (def.type === 'options' && (value as OptionItem[]).length === 0) return 'Keep at least one option';
    if (def.type === 'text' && !String(value).trim()) return 'This cannot be empty';
    return null;
  };

  const handleSave = () => {
    const problem = validate();
    if (problem) {
      toast.error(`${def.label}: ${problem}`);
      return;
    }
    const toSave = def.type === 'number' ? Number(value) : value;
    run(() => onSave(settingKey, orgId, toSave), 'Saved');
  };

  const addItem = () => {
    const parsed = optionsFromLabels([newItem]);
    if (parsed.length === 0) return;
    const list = value as OptionItem[];
    if (list.some((o) => o.value === parsed[0].value)) {
      toast.error('That option already exists');
      return;
    }
    setValue([...list, parsed[0]]);
    setNewItem('');
  };

  return (
    <div className="space-y-2 border-b last:border-0 pb-5 last:pb-0">
      <div className="flex flex-wrap items-center gap-2">
        <Label className="text-sm font-semibold">{def.label}</Label>
        {orgId !== null && (hasOwn ? <Badge>Own value</Badge> : <Badge variant="secondary">Using group default</Badge>)}
      </div>
      {def.help && <p className="text-xs text-muted-foreground">{def.help}</p>}

      {def.type === 'options' && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {(value as OptionItem[]).map((o) => (
              <Badge key={o.value} variant="outline" className="gap-1 text-sm py-1">
                {o.label}
                {canEdit && (
                  <button
                    type="button"
                    aria-label={`Remove ${o.label}`}
                    onClick={() => setValue((value as OptionItem[]).filter((x) => x.value !== o.value))}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </Badge>
            ))}
          </div>
          {canEdit && (
            <div className="flex gap-2 max-w-sm">
              <Input
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                placeholder="Add an option"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addItem();
                  }
                }}
              />
              <Button type="button" variant="outline" size="icon" onClick={addItem} aria-label="Add option">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      {def.type === 'number' && (
        <Input type="number" className="max-w-[160px]" disabled={!canEdit} value={String(value)} onChange={(e) => setValue(e.target.value)} />
      )}
      {def.type === 'text' && (
        <Input className="max-w-[160px]" disabled={!canEdit} value={String(value)} onChange={(e) => setValue(e.target.value)} />
      )}

      {canEdit && (
        <div className="flex gap-2 pt-1">
          <Button size="sm" onClick={handleSave} disabled={busy} className="gap-1.5">
            <Save className="h-3.5 w-3.5" /> Save
          </Button>
          {orgId !== null && hasOwn && (
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              className="gap-1.5"
              onClick={() => run(() => onReset(settingKey, orgId), 'Now using the group default')}
            >
              <RotateCcw className="h-3.5 w-3.5" /> Use group default
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
