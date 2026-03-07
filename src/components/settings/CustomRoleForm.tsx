import { memo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Settings2, ShieldCheck } from "lucide-react";

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
  branch_id: string;
  permissions: Record<string, boolean>;
  app_access: AppAccess;
}

export interface OrganizationOption {
  id: string;
  name: string;
}

export interface BranchOption {
  id: string;
  name: string;
  organization_id: string;
}

interface Props {
  isEditMode: boolean;
  formData: CustomRoleFormData;
  setFormData: React.Dispatch<React.SetStateAction<CustomRoleFormData>>;
  organizations: OrganizationOption[];
  filteredBranches: BranchOption[];
  // user fields
  userEmail: string;
  setUserEmail: (v: string) => void;
  userPassword: string;
  setUserPassword: (v: string) => void;
  userName: string;
  setUserName: (v: string) => void;
  // features
  features: FeatureGroups;
  toggleAllInGroup: (features: { key: string }[], enable: boolean) => void;
  togglePermission: (key: string) => void;
}

function CustomRoleFormImpl({
  isEditMode,
  formData,
  setFormData,
  organizations,
  filteredBranches,
  userEmail,
  setUserEmail,
  userPassword,
  setUserPassword,
  userName,
  setUserName,
  features,
  toggleAllInGroup,
  togglePermission,
}: Props) {
  return (
    <div className="space-y-6 max-h-[65vh] overflow-y-auto pr-2 overscroll-contain">
      {/* Basic Info */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Role Name *</Label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="e.g., Store Supervisor"
            autoComplete="off"
          />
        </div>

        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea
            value={formData.description}
            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Describe the role's responsibilities..."
            rows={2}
          />
        </div>

        <div className="space-y-2">
          <Label>Base Role Type *</Label>
          <Select
            value={formData.base_role}
            onValueChange={(v) =>
              setFormData((prev) => ({
                ...prev,
                base_role: v as BaseRole,
                permissions: {}, // Reset permissions when base role changes
              }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="z-[200]">
              <SelectItem value="manager">Store Account</SelectItem>
              <SelectItem value="hr">HR</SelectItem>
              <SelectItem value="employee">Employee</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Select the base role type to inherit its feature set</p>
        </div>
      </div>

      {/* User Credentials - Only show in Create mode, positioned after base role */}
      {!isEditMode && (
        <div className="space-y-4 border-t pt-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Email Address *</Label>
              <Input
                type="email"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                placeholder="user@company.com"
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <Label>Password *</Label>
              <Input
                type="password"
                value={userPassword}
                onChange={(e) => setUserPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                autoComplete="new-password"
              />
            </div>

            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Enter full name"
                autoComplete="off"
              />
            </div>
          </div>
        </div>
      )}

      {/* Scope Configuration - Only for Manager/HR */}
      {formData.base_role !== "employee" && (
        <div className="space-y-4 border-t pt-4">
          <h4 className="font-medium flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Scope Configuration
          </h4>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Organization</Label>
              <Select
                value={formData.organization_id || "all"}
                onValueChange={(v) =>
                  setFormData((prev) => ({
                    ...prev,
                    organization_id: v === "all" ? "" : v,
                    branch_id: "", // Reset branch when org changes
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select organization" />
                </SelectTrigger>
                <SelectContent className="z-[200]">
                  <SelectItem value="all">All Organizations</SelectItem>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Branch {formData.organization_id ? `(${filteredBranches.length} available)` : '(select org first)'}</Label>
              <Select
                value={formData.branch_id || "all"}
                onValueChange={(v) => setFormData((prev) => ({ ...prev, branch_id: v === "all" ? "" : v }))}
                disabled={!formData.organization_id}
              >
                <SelectTrigger className={!formData.organization_id ? "opacity-50" : ""}>
                  <SelectValue placeholder={formData.organization_id ? "Select branch" : "Select organization first"} />
                </SelectTrigger>
                <SelectContent className="z-[200]">
                  <SelectItem value="all">All Branches</SelectItem>
                  {filteredBranches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* Feature Permissions - Module-level toggles */}
      <div className="space-y-4 border-t pt-4">
        <h4 className="font-medium flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" />
          Feature Permissions
        </h4>

        <div className="space-y-3">
          {Object.entries(features).map(([groupName, groupFeatures]) => {
            const featureKey = groupFeatures[0]?.key;
            if (!featureKey) return null;
            return (
              <div key={groupName} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium text-sm">{groupName}</p>
                </div>
                <Switch
                  checked={formData.permissions[featureKey] || false}
                  onCheckedChange={(checked) => {
                    togglePermission(featureKey);
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Extra App Access */}
      <div className="space-y-4 border-t pt-4">
        <h4 className="font-medium flex items-center gap-2">
          <Settings2 className="h-4 w-4" />
          Extra App Access
        </h4>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <p className="font-medium text-sm">Niza Safe</p>
              <p className="text-xs text-muted-foreground">Health & Safety management</p>
            </div>
            <Switch
              checked={formData.app_access.niza_safe}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({ ...prev, app_access: { ...prev.app_access, niza_safe: checked } }))
              }
            />
          </div>

          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <p className="font-medium text-sm">Niza Finance</p>
              <p className="text-xs text-muted-foreground">Financial reports & P&L</p>
            </div>
            <Switch
              checked={formData.app_access.niza_finance}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({ ...prev, app_access: { ...prev.app_access, niza_finance: checked } }))
              }
            />
          </div>

          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <p className="font-medium text-sm">Niza Templates</p>
              <p className="text-xs text-muted-foreground">Business cards, ID cards, etc.</p>
            </div>
            <Switch
              checked={formData.app_access.niza_templates}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({ ...prev, app_access: { ...prev.app_access, niza_templates: checked } }))
              }
            />
          </div>

          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <p className="font-medium text-sm">Niza E-Learning</p>
              <p className="text-xs text-muted-foreground">Training courses & certifications</p>
            </div>
            <Switch
              checked={formData.app_access.niza_elearning}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({ ...prev, app_access: { ...prev.app_access, niza_elearning: checked } }))
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export const CustomRoleForm = memo(CustomRoleFormImpl);
