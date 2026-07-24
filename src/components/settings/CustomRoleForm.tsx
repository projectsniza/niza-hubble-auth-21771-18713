import { memo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Settings2, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { useState as useFormState } from "react";

export type BaseRole = "manager" | "hr" | "employee";

export interface AppAccess {
  niza_safe: boolean;
  niza_finance: boolean;
  niza_templates: boolean;
  niza_elearning: boolean;
}

export type FeatureDef = { key: string; label: string };
export type FeatureGroups = Record<string, FeatureDef[]>;

export interface CustomRoleFormData {
  name: string;
  description: string;
  base_role: BaseRole;
  organization_id: string;
  branch_id: string;          // kept for backwards compat with existing rows
  branch_ids: string[];       // new: multi-branch scope. Empty = all branches in org.
  permissions: Record<string, boolean>;
  app_access: AppAccess;
}

export interface OrganizationOption { id: string; name: string; }
export interface BranchOption { id: string; name: string; organization_id: string; }

interface Props {
  isEditMode: boolean;
  formData: CustomRoleFormData;
  setFormData: React.Dispatch<React.SetStateAction<CustomRoleFormData>>;
  organizations: OrganizationOption[];
  filteredBranches: BranchOption[];
  userEmail: string; setUserEmail: (v: string) => void;
  userPassword: string; setUserPassword: (v: string) => void;
  userName: string; setUserName: (v: string) => void;
  features: FeatureGroups;
  toggleAllInGroup: (features: { key: string }[], enable: boolean) => void;
  togglePermission: (key: string) => void;
}

function PasswordFieldWithToggle({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  const [show, setShow] = useFormState(false);
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="relative">
        <Input type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete="new-password" className="pr-10" />
        <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function CustomRoleFormImpl({
  isEditMode, formData, setFormData, organizations, filteredBranches,
  userEmail, setUserEmail, userPassword, setUserPassword, userName, setUserName,
  features, togglePermission,
}: Props) {
  const selectedBranchIds = formData.branch_ids || [];
  const allBranchesSelected = selectedBranchIds.length === 0;

  const toggleBranch = (id: string) => {
    setFormData(prev => {
      const cur = prev.branch_ids || [];
      const next = cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id];
      return { ...prev, branch_ids: next, branch_id: next.length === 1 ? next[0] : '' };
    });
  };

  const setAllBranches = () => {
    setFormData(prev => ({ ...prev, branch_ids: [], branch_id: '' }));
  };

  return (
    <div className="space-y-6 max-h-[65vh] overflow-y-auto pr-2 overscroll-contain">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Role Name *</Label>
          <Input value={formData.name} onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))} placeholder="e.g., Store Supervisor" autoComplete="off" />
        </div>
        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea value={formData.description} onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))} placeholder="Describe the role's responsibilities..." rows={2} />
        </div>
        <div className="space-y-2">
          <Label>Base Role Type *</Label>
          <Select value={formData.base_role} onValueChange={(v) => setFormData((p) => ({ ...p, base_role: v as BaseRole, permissions: {} }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent className="z-[200]">
              <SelectItem value="manager">Store Account</SelectItem>
              <SelectItem value="hr">HR</SelectItem>
              <SelectItem value="employee">Employee</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Select the base role type to inherit its feature set</p>
        </div>
      </div>

      {!isEditMode && (
        <div className="space-y-4 border-t pt-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Email Address *</Label>
              <Input type="email" value={userEmail} onChange={(e) => setUserEmail(e.target.value)} placeholder="user@company.com" autoComplete="off" />
            </div>
            <PasswordFieldWithToggle label="Password *" value={userPassword} onChange={setUserPassword} placeholder="Minimum 6 characters" />
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input value={userName} onChange={(e) => setUserName(e.target.value)} placeholder="Enter full name" autoComplete="off" />
            </div>
          </div>
        </div>
      )}

      {formData.base_role !== "employee" && (
        <div className="space-y-4 border-t pt-4">
          <h4 className="font-medium flex items-center gap-2"><Building2 className="h-4 w-4" />Scope Configuration</h4>

          <div className="space-y-2">
            <Label>Organization</Label>
            <Select value={formData.organization_id || "all"} onValueChange={(v) => setFormData((p) => ({ ...p, organization_id: v === "all" ? "" : v, branch_id: "", branch_ids: [] }))}>
              <SelectTrigger><SelectValue placeholder="Select organization" /></SelectTrigger>
              <SelectContent className="z-[200]">
                <SelectItem value="all">All Organizations</SelectItem>
                {organizations.map((org) => <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>
                Branches {formData.organization_id
                  ? `(${filteredBranches.length} available)`
                  : '(select org first)'}
              </Label>
              <span className="text-xs text-muted-foreground">
                {allBranchesSelected ? 'All branches' : `${selectedBranchIds.length} selected`}
              </span>
            </div>
            {!formData.organization_id ? (
              <div className="text-xs text-muted-foreground border border-dashed rounded-md p-3">
                Select an organization to pick specific branches.
              </div>
            ) : (
              <div className="space-y-2 border rounded-md p-3 max-h-52 overflow-y-auto">
                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                  <Checkbox checked={allBranchesSelected} onCheckedChange={setAllBranches} />
                  All branches in this organization
                </label>
                <div className="border-t pt-2 space-y-1.5">
                  {filteredBranches.map(b => (
                    <label key={b.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/40 rounded px-1 py-0.5">
                      <Checkbox
                        checked={selectedBranchIds.includes(b.id)}
                        onCheckedChange={() => toggleBranch(b.id)}
                      />
                      {b.name}
                    </label>
                  ))}
                  {filteredBranches.length === 0 && (
                    <p className="text-xs text-muted-foreground">No branches in this organization yet.</p>
                  )}
                </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Tick multiple branches to give this role oversight of only those branches. Leave everything unticked or tick "All branches" to allow every branch in the organization.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-4 border-t pt-4">
        <h4 className="font-medium flex items-center gap-2"><ShieldCheck className="h-4 w-4" />Feature Permissions</h4>
        <div className="space-y-3">
          {Object.entries(features).map(([groupName, groupFeatures]) => {
            const featureKey = groupFeatures[0]?.key;
            if (!featureKey) return null;
            return (
              <div key={groupName} className="flex items-center justify-between p-3 border rounded-lg">
                <div><p className="font-medium text-sm">{groupName}</p></div>
                <Switch checked={formData.permissions[featureKey] || false} onCheckedChange={() => togglePermission(featureKey)} />
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-4 border-t pt-4">
        <h4 className="font-medium flex items-center gap-2"><Settings2 className="h-4 w-4" />Extra App Access</h4>
        <div className="space-y-3">
          {([
            { key: 'niza_safe', label: 'Niza Safe', desc: 'Health & Safety management', show: true },
            { key: 'niza_finance', label: 'Niza Finance', desc: 'Profit & Loss Calculator', show: formData.base_role !== 'manager' },
            { key: 'niza_templates', label: 'Niza Templates', desc: 'Templates & Brand Assets', show: formData.base_role !== 'manager' },
            { key: 'niza_elearning', label: 'Niza E-Learning', desc: 'Training courses & certifications', show: true },
          ] as const).filter(x => x.show).map(x => (
            <div key={x.key} className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium text-sm">{x.label}</p>
                <p className="text-xs text-muted-foreground">{x.desc}</p>
              </div>
              <Switch
                checked={(formData.app_access as any)[x.key]}
                onCheckedChange={(checked) => setFormData((p) => ({ ...p, app_access: { ...p.app_access, [x.key]: checked } as AppAccess }))}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const CustomRoleForm = memo(CustomRoleFormImpl);
