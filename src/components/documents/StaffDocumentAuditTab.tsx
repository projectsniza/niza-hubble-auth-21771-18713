import React, { useState, useEffect, useMemo, useRef } from 'react';
import { todayUK } from '@/lib/ukDate';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { NizaLoaderInline } from '@/components/ui/niza-loader';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { getOrCreateEmployeeFolder } from '@/lib/ensureEmployeeDocuments';
import {
  ClipboardCheck,
  Search,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  Check,
  AlertTriangle,
  XCircle,
  Eye,
  FileText,
  Upload,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  RefreshCw,
  Plus,
  Trash2,
  Settings2,
  ExternalLink,
  ShieldCheck,
  FolderOpen,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

// Core standard requirement keys matching Staff_Documentation_Audit.xlsx
export interface AuditRequirement {
  id: string;
  name: string;
  description: string;
  isCustom?: boolean;
}

export const DEFAULT_REQUIREMENTS: AuditRequirement[] = [
  { id: 'contract', name: 'Contract', description: 'Signed Employment Contract / Offer Letter' },
  { id: 'id_documents', name: 'ID Documents', description: 'Passport, Driving Licence, BRP or National ID' },
  { id: 'right_to_work', name: 'Right to Work Check', description: 'Home Office Share Code / RTW verification' },
  { id: 'bank_details', name: 'Bank Details', description: 'Bank Statement / Direct Debit mandate' },
  { id: 'starter_checklist', name: 'Starter Checklist', description: 'HMRC Starter Checklist P45 / P46 form' },
  { id: 'application_form', name: 'Application Form', description: 'Signed Employment Application Form' },
];

export type RequirementStatus = 'verified' | 'pending' | 'missing' | 'expired' | 'not_applicable';

export interface AuditCheckItem {
  checked: boolean;
  status: RequirementStatus;
  notes?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  matchedFileId?: string;
  matchedFileName?: string;
  isManual?: boolean;
}

export interface EmployeeAuditRecord {
  employeeId: string;
  requirements: Record<string, AuditCheckItem>;
  lastAuditedAt?: string;
  lastAuditedBy?: string;
}

interface EmployeeItem {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  status: string;
  organization_id: string | null;
  branch_id: string | null;
  organization?: { id: string; name: string } | null;
  branch?: { id: string; name: string } | null;
  onboarding?: {
    id: string;
    contract_uploaded?: boolean;
    contract_approved?: boolean;
    contract_signed?: boolean;
    right_to_work_completed?: boolean;
    documents_uploaded?: boolean;
    basic_details_completed?: boolean;
  } | null;
  contract_approval?: {
    id: string;
    status: string;
    contract_file_path?: string | null;
    signed_contract_path?: string | null;
  } | null;
}

interface DocumentItem {
  id: string;
  title: string;
  file_name: string;
  file_path: string;
  file_type?: string | null;
  file_size?: number | null;
  created_at: string;
  folder_id?: string | null;
  employee_id?: string | null;
}

const STORAGE_KEY_AUDIT_DATA = 'niza_staff_documentation_audit_records_v3';
const STORAGE_KEY_CUSTOM_REQS = 'niza_staff_audit_custom_requirements_v3';

export default function StaffDocumentAuditTab() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [organizations, setOrganizations] = useState<Array<{ id: string; name: string }>>([]);
  const [branches, setBranches] = useState<Array<{ id: string; name: string; organization_id?: string }>>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState<string>('all');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'complete' | 'incomplete' | 'priority'>('all');
  const [missingReqFilter, setMissingReqFilter] = useState<string>('all');

  // Custom Requirements & Audits state
  const [requirements, setRequirements] = useState<AuditRequirement[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CUSTOM_REQS);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return DEFAULT_REQUIREMENTS;
  });

  const [auditRecords, setAuditRecords] = useState<Record<string, EmployeeAuditRecord>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_AUDIT_DATA);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return {};
  });

  // Debounce timer map for saving notes to DB in real time
  const saveTimeoutRef = useRef<Record<string, any>>({});

  // Split View Modal State
  const [splitViewEmployeeId, setSplitViewEmployeeId] = useState<string | null>(null);
  const [splitViewIsFullscreen, setSplitViewIsFullscreen] = useState(false);
  const [activeEmployeeDocs, setActiveEmployeeDocs] = useState<DocumentItem[]>([]);
  const [activeDocFolder, setActiveDocFolder] = useState<{ id: string; name: string } | null>(null);
  const [selectedPreviewDoc, setSelectedPreviewDoc] = useState<DocumentItem | null>(null);
  const [previewSignedUrl, setPreviewSignedUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [isUploadingToFolder, setIsUploadingToFolder] = useState(false);

  // Requirements Manager Dialog
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
  const [newReqName, setNewReqName] = useState('');
  const [newReqDesc, setNewReqDesc] = useState('');

  // Persist record to Supabase database in real time
  const syncAuditToDb = async (employeeId: string, record: EmployeeAuditRecord) => {
    try {
      const { error } = await supabase
        .from('onboarding_form_responses')
        .upsert(
          {
            employee_id: employeeId,
            form_type: 'staff_documentation_audit',
            form_data: record as any,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'employee_id,form_type' }
        );

      if (error) {
        console.error('Error syncing audit record to database:', error);
        toast.error('The audit change could not be saved: ' + error.message);
      }
    } catch (err) {
      console.error('Failed to sync audit record to database:', err);
      toast.error('The audit change could not be saved');
    }
  };

  // Save audit records to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_AUDIT_DATA, JSON.stringify(auditRecords));
    } catch (e) {
      console.error('Failed to save audit records to localStorage:', e);
    }
  }, [auditRecords]);

  // Save custom requirements
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CUSTOM_REQS, JSON.stringify(requirements));
    } catch (e) {
      console.error('Failed to save requirements to localStorage:', e);
    }
  }, [requirements]);

  // Initial Data Fetch
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      // 1. Fetch organizations & branches for filter dropdowns
      const [orgsRes, branchesRes] = await Promise.all([
        supabase.from('organizations').select('id, name').order('name'),
        supabase.from('branches').select('id, name, organization_id').order('name'),
      ]);

      setOrganizations(orgsRes.data || []);
      setBranches(branchesRes.data || []);

      // 2. Fetch employees with org, branch, onboarding, contract approvals
      const { data: emps, error: empErr } = await supabase
        .from('employees')
        .select(`
          id, first_name, last_name, email, phone, job_title, status, organization_id, branch_id,
          organization:organizations(id, name),
          branch:branches(id, name),
          onboarding:employee_onboarding(id, contract_uploaded, contract_approved, contract_signed, right_to_work_completed, documents_uploaded, basic_details_completed),
          contract_approval:contract_approvals(id, status, contract_file_path, signed_contract_path)
        `)
        .not('status', 'eq', 'terminated')
        .order('first_name', { ascending: true });

      if (empErr) throw empErr;

      // These two relations come back as lists; the audit reads one record each.
      const first = <T,>(v: T[] | T | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);
      const employeeList = ((emps || []) as any[]).map(e => ({ ...e, onboarding: first(e.onboarding), contract_approval: first(e.contract_approval) })) as EmployeeItem[];
      setEmployees(employeeList);

      // 3. Fetch any existing audit records saved in Supabase database
      const { data: dbAuditRows } = await supabase
        .from('onboarding_form_responses')
        .select('employee_id, form_data')
        .eq('form_type', 'staff_documentation_audit');

      const savedDbMap: Record<string, EmployeeAuditRecord> = {};
      (dbAuditRows || []).forEach(row => {
        if (row.employee_id && row.form_data) {
          savedDbMap[row.employee_id] = row.form_data as any;
        }
      });

      // 4. Scan documents and onboarding responses in bulk to seed auto-detection
      await autoScanEmployees(employeeList, savedDbMap);
    } catch (err: any) {
      console.error('Error fetching initial audit data:', err);
      toast.error('Failed to load employee audit data');
    } finally {
      setLoading(false);
    }
  };

  // Auto-scan documents and onboarding records to detect existing files
  const autoScanEmployees = async (
    empList: EmployeeItem[],
    savedDbRecords: Record<string, EmployeeAuditRecord> = {}
  ) => {
    try {
      const empIds = empList.map(e => e.id);
      if (empIds.length === 0) return;

      // Fetch documents belonging to these employees
      const { data: docs } = await supabase
        .from('documents')
        .select('id, title, file_name, file_path, file_type, file_size, created_at, employee_id, folder_id')
        .in('employee_id', empIds);

      // Fetch onboarding form responses
      const { data: responses } = await supabase
        .from('onboarding_form_responses')
        .select('employee_id, form_type')
        .in('employee_id', empIds);

      // Group docs and form responses by employee
      const docsByEmp = new Map<string, DocumentItem[]>();
      (docs || []).forEach(d => {
        if (!d.employee_id) return;
        const list = docsByEmp.get(d.employee_id) || [];
        list.push(d);
        docsByEmp.set(d.employee_id, list);
      });

      const formsByEmp = new Map<string, Set<string>>();
      (responses || []).forEach(r => {
        if (!r.employee_id) return;
        const set = formsByEmp.get(r.employee_id) || new Set<string>();
        set.add(r.form_type);
        formsByEmp.set(r.employee_id, set);
      });

      // Merge with existing audit records (DB records takes highest precedence, then state/local)
      setAuditRecords(prev => {
        const next = { ...prev, ...savedDbRecords };

        empList.forEach(emp => {
          const empDocs = docsByEmp.get(emp.id) || [];
          const empForms = formsByEmp.get(emp.id) || new Set<string>();
          const existingRecord = next[emp.id] || { employeeId: emp.id, requirements: {} };
          const reqs: Record<string, AuditCheckItem> = { ...(existingRecord.requirements || {}) };

          // Standard 1: Contract
          if (!reqs['contract'] || !reqs['contract'].isManual) {
            const hasContractDoc = empDocs.some(d => {
              const text = `${d.title || ''} ${d.file_name || ''}`.toLowerCase();
              return text.includes('contract') || text.includes('agreement') || text.includes('offer');
            });
            const hasContractRecord =
              emp.contract_approval?.status === 'approved' ||
              Boolean(emp.contract_approval?.contract_file_path || emp.contract_approval?.signed_contract_path) ||
              Boolean(emp.onboarding?.contract_uploaded || emp.onboarding?.contract_approved || emp.onboarding?.contract_signed);

            const isPresent = hasContractDoc || hasContractRecord;
            const matchedDoc = empDocs.find(d => {
              const text = `${d.title || ''} ${d.file_name || ''}`.toLowerCase();
              return text.includes('contract') || text.includes('agreement');
            });

            reqs['contract'] = {
              checked: isPresent,
              status: isPresent ? 'verified' : 'missing',
              notes: reqs['contract']?.notes || (isPresent ? 'Auto-detected from contract records' : ''),
              matchedFileId: matchedDoc?.id,
              matchedFileName: matchedDoc?.file_name || (hasContractRecord ? 'System Contract Record' : undefined),
              isManual: false,
            };
          }

          // Standard 2: ID Documents
          if (!reqs['id_documents'] || !reqs['id_documents'].isManual) {
            const matchedDoc = empDocs.find(d => {
              const text = `${d.title || ''} ${d.file_name || ''}`.toLowerCase();
              return (
                text.includes('passport') ||
                text.includes('id_card') ||
                text.includes('driving') ||
                text.includes('licence') ||
                text.includes('brp') ||
                text.includes('identification') ||
                text.includes('photo_id')
              );
            });
            const isPresent = Boolean(matchedDoc || emp.onboarding?.documents_uploaded);
            reqs['id_documents'] = {
              checked: isPresent,
              status: isPresent ? 'verified' : 'missing',
              notes: reqs['id_documents']?.notes || (isPresent ? 'Auto-detected from uploaded ID' : ''),
              matchedFileId: matchedDoc?.id,
              matchedFileName: matchedDoc?.file_name,
              isManual: false,
            };
          }

          // Standard 3: Right to Work Check
          if (!reqs['right_to_work'] || !reqs['right_to_work'].isManual) {
            const matchedDoc = empDocs.find(d => {
              const text = `${d.title || ''} ${d.file_name || ''}`.toLowerCase();
              return (
                text.includes('right_to_work') ||
                text.includes('right to work') ||
                text.includes('rtw') ||
                text.includes('share_code') ||
                text.includes('share code') ||
                text.includes('visa') ||
                text.includes('work_permit')
              );
            });
            const isPresent = Boolean(matchedDoc || emp.onboarding?.right_to_work_completed);
            reqs['right_to_work'] = {
              checked: isPresent,
              status: isPresent ? 'verified' : 'missing',
              notes: reqs['right_to_work']?.notes || (isPresent ? 'Auto-detected from Right to Work records' : ''),
              matchedFileId: matchedDoc?.id,
              matchedFileName: matchedDoc?.file_name,
              isManual: false,
            };
          }

          // Standard 4: Bank Details
          if (!reqs['bank_details'] || !reqs['bank_details'].isManual) {
            const hasForm = empForms.has('bank_details');
            const matchedDoc = empDocs.find(d => {
              const text = `${d.title || ''} ${d.file_name || ''}`.toLowerCase();
              return text.includes('bank') || text.includes('direct_debit') || text.includes('sort_code');
            });
            const isPresent = hasForm || Boolean(matchedDoc);
            reqs['bank_details'] = {
              checked: isPresent,
              status: isPresent ? 'verified' : 'missing',
              notes: reqs['bank_details']?.notes || (isPresent ? (hasForm ? 'Auto-detected from Onboarding Form' : 'Auto-detected from Bank Document') : ''),
              matchedFileId: matchedDoc?.id,
              matchedFileName: matchedDoc?.file_name || (hasForm ? 'Onboarding Bank Form' : undefined),
              isManual: false,
            };
          }

          // Standard 5: Starter Checklist
          if (!reqs['starter_checklist'] || !reqs['starter_checklist'].isManual) {
            const hasForm = empForms.has('starter_checklist');
            const matchedDoc = empDocs.find(d => {
              const text = `${d.title || ''} ${d.file_name || ''}`.toLowerCase();
              return (
                text.includes('starter') ||
                text.includes('starter_checklist') ||
                text.includes('p45') ||
                text.includes('p46') ||
                text.includes('tax_form')
              );
            });
            const isPresent = hasForm || Boolean(matchedDoc);
            reqs['starter_checklist'] = {
              checked: isPresent,
              status: isPresent ? 'verified' : 'missing',
              notes: reqs['starter_checklist']?.notes || (isPresent ? (hasForm ? 'Auto-detected from Starter Checklist Response' : 'Auto-detected from Starter Document') : ''),
              matchedFileId: matchedDoc?.id,
              matchedFileName: matchedDoc?.file_name || (hasForm ? 'Starter Checklist Submission' : undefined),
              isManual: false,
            };
          }

          // Standard 6: Application Form
          if (!reqs['application_form'] || !reqs['application_form'].isManual) {
            const hasForm = empForms.has('application_form');
            const matchedDoc = empDocs.find(d => {
              const text = `${d.title || ''} ${d.file_name || ''}`.toLowerCase();
              return (
                text.includes('application') ||
                text.includes('application_form') ||
                text.includes('app_form') ||
                text.includes('job_application')
              );
            });
            const isPresent = hasForm || Boolean(matchedDoc) || Boolean(emp.onboarding?.basic_details_completed);
            reqs['application_form'] = {
              checked: isPresent,
              status: isPresent ? 'verified' : 'missing',
              notes: reqs['application_form']?.notes || (isPresent ? (hasForm ? 'Auto-detected from Application Form Response' : 'Auto-detected from Application Document') : ''),
              matchedFileId: matchedDoc?.id,
              matchedFileName: matchedDoc?.file_name || (hasForm ? 'Application Form Submission' : undefined),
              isManual: false,
            };
          }

          next[emp.id] = {
            employeeId: emp.id,
            requirements: reqs,
            lastAuditedAt: existingRecord.lastAuditedAt || new Date().toISOString(),
          };
        });

        return next;
      });
    } catch (e) {
      console.error('Error during autoScanEmployees:', e);
    }
  };

  // Helper to toggle a single requirement check for an employee in real time
  const handleToggleRequirement = (employeeId: string, requirementId: string, forcedChecked?: boolean) => {
    setAuditRecords(prev => {
      const empRecord = prev[employeeId] || { employeeId, requirements: {} };
      const current = empRecord.requirements[requirementId] || { checked: false, status: 'missing' };
      const newChecked = forcedChecked !== undefined ? forcedChecked : !current.checked;
      const newStatus: RequirementStatus = newChecked ? 'verified' : 'missing';

      const updatedRecord: EmployeeAuditRecord = {
        ...empRecord,
        requirements: {
          ...empRecord.requirements,
          [requirementId]: {
            ...current,
            checked: newChecked,
            status: newStatus,
            verifiedAt: newChecked ? new Date().toISOString() : undefined,
            verifiedBy: newChecked ? user?.name || 'HR Staff' : undefined,
            isManual: true,
          },
        },
        lastAuditedAt: new Date().toISOString(),
        lastAuditedBy: user?.name || 'HR Staff',
      };

      // Real-time database sync
      syncAuditToDb(employeeId, updatedRecord);

      return {
        ...prev,
        [employeeId]: updatedRecord,
      };
    });
  };

  // Helper to update requirement status via dropdown in real time
  const handleUpdateRequirementStatus = (
    employeeId: string,
    requirementId: string,
    status: RequirementStatus,
    notes?: string
  ) => {
    setAuditRecords(prev => {
      const empRecord = prev[employeeId] || { employeeId, requirements: {} };
      const current = empRecord.requirements[requirementId] || { checked: false, status: 'missing' };
      const isChecked = status === 'verified';

      const updatedRecord: EmployeeAuditRecord = {
        ...empRecord,
        requirements: {
          ...empRecord.requirements,
          [requirementId]: {
            ...current,
            checked: isChecked,
            status,
            notes: notes !== undefined ? notes : current.notes,
            verifiedAt: isChecked ? new Date().toISOString() : current.verifiedAt,
            verifiedBy: isChecked ? user?.name || 'HR Staff' : current.verifiedBy,
            isManual: true,
          },
        },
        lastAuditedAt: new Date().toISOString(),
        lastAuditedBy: user?.name || 'HR Staff',
      };

      syncAuditToDb(employeeId, updatedRecord);

      return {
        ...prev,
        [employeeId]: updatedRecord,
      };
    });
  };

  // Helper to update notes in real time (instant local UI update + debounced DB sync)
  const handleUpdateRequirementNotes = (employeeId: string, requirementId: string, notes: string) => {
    setAuditRecords(prev => {
      const empRecord = prev[employeeId] || { employeeId, requirements: {} };
      const current = empRecord.requirements[requirementId] || { checked: false, status: 'missing' };

      const updatedRecord: EmployeeAuditRecord = {
        ...empRecord,
        requirements: {
          ...empRecord.requirements,
          [requirementId]: {
            ...current,
            notes,
            isManual: true,
          },
        },
        lastAuditedAt: new Date().toISOString(),
      };

      // Debounce real-time database push by 400ms
      if (saveTimeoutRef.current[employeeId]) {
        clearTimeout(saveTimeoutRef.current[employeeId]);
      }
      saveTimeoutRef.current[employeeId] = setTimeout(() => {
        syncAuditToDb(employeeId, updatedRecord);
      }, 400);

      return {
        ...prev,
        [employeeId]: updatedRecord,
      };
    });
  };

  // Mark every requirement that already has a file as verified.
  // Requirements with nothing on file are left alone (they must be uploaded first).
  const handleMarkAllComplete = (employeeId: string) => {
    let skipped = 0;
    setAuditRecords(prev => {
      const empRecord = prev[employeeId] || { employeeId, requirements: {} };
      const updatedReqs: Record<string, AuditCheckItem> = { ...empRecord.requirements };
      skipped = 0;

      requirements.forEach(req => {
        const current = empRecord.requirements[req.id];
        if (!current?.checked) {
          skipped++;
          return;
        }
        updatedReqs[req.id] = {
          ...current,
          status: 'verified',
          notes: current.notes || 'Marked verified by HR',
          verifiedAt: new Date().toISOString(),
          verifiedBy: user?.name || 'HR Staff',
          isManual: true,
        };
      });

      const updatedRecord: EmployeeAuditRecord = {
        ...empRecord,
        requirements: updatedReqs,
        lastAuditedAt: new Date().toISOString(),
        lastAuditedBy: user?.name || 'HR Staff',
      };

      syncAuditToDb(employeeId, updatedRecord);

      return {
        ...prev,
        [employeeId]: updatedRecord,
      };
    });
    if (skipped > 0) {
      toast.warning(`Verified the documents on file. ${skipped} requirement(s) have no file yet and were not marked.`);
    } else {
      toast.success('All documents on file were marked verified');
    }
  };

  // Reset to auto-detection
  const handleResetToAutoDetection = async (employeeId: string) => {
    const targetEmp = employees.find(e => e.id === employeeId);
    if (!targetEmp) return;

    // Delete record from Supabase database
    try {
      await supabase
        .from('onboarding_form_responses')
        .delete()
        .eq('employee_id', employeeId)
        .eq('form_type', 'staff_documentation_audit');
    } catch (e) {
      console.error('Error clearing database audit record:', e);
    }

    // Remove manual overrides for this employee
    setAuditRecords(prev => {
      const next = { ...prev };
      delete next[employeeId];
      return next;
    });

    await autoScanEmployees([targetEmp]);
    toast.info('Reset checklist to system auto-detected files');
  };

  // Add custom requirement
  const handleAddCustomRequirement = () => {
    if (!newReqName.trim()) {
      toast.error('Please enter a requirement name');
      return;
    }
    const id = newReqName.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
    if (requirements.some(r => r.id === id)) {
      toast.error('A requirement with this name already exists');
      return;
    }

    const updated = [
      ...requirements,
      {
        id,
        name: newReqName.trim(),
        description: newReqDesc.trim() || 'Custom Document Requirement',
        isCustom: true,
      },
    ];
    setRequirements(updated);
    setNewReqName('');
    setNewReqDesc('');
    setIsConfigDialogOpen(false);
    toast.success('Custom requirement added');
  };

  // Remove custom requirement
  const handleRemoveRequirement = (id: string) => {
    const updated = requirements.filter(r => r.id !== id);
    setRequirements(updated);
    toast.info('Requirement removed from checklist');
  };

  // Calculate stats for a single employee
  const getEmployeeStats = (empId: string) => {
    const record = auditRecords[empId];
    let onFileCount = 0;
    const totalCount = requirements.length;

    requirements.forEach(req => {
      if (record?.requirements[req.id]?.checked) {
        onFileCount += 1;
      }
    });

    // Color thresholds exactly matching Excel:
    // RED | 0–2 documents -> "Priority"
    // AMBER | 3–5 documents -> "Incomplete"
    // GREEN | 6 documents (or 100%) -> "Complete"
    let status: 'Complete' | 'Incomplete' | 'Priority' = 'Priority';
    if (totalCount === 6) {
      if (onFileCount === 6) status = 'Complete';
      else if (onFileCount >= 3) status = 'Incomplete';
      else status = 'Priority';
    } else {
      const pct = totalCount > 0 ? onFileCount / totalCount : 0;
      if (pct === 1) status = 'Complete';
      else if (pct >= 0.5) status = 'Incomplete';
      else status = 'Priority';
    }

    return {
      onFileCount,
      totalCount,
      status,
      percentage: Math.round((onFileCount / (totalCount || 1)) * 100),
    };
  };

  // Filtered employees list
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.toLowerCase();
        const orgName = (emp.organization?.name || '').toLowerCase();
        const branchName = (emp.branch?.name || '').toLowerCase();
        const email = (emp.email || '').toLowerCase();
        if (
          !fullName.includes(q) &&
          !orgName.includes(q) &&
          !branchName.includes(q) &&
          !email.includes(q)
        ) {
          return false;
        }
      }

      // Company filter
      if (selectedOrgId !== 'all' && emp.organization_id !== selectedOrgId) {
        return false;
      }

      // Store/Branch filter
      if (selectedBranchId !== 'all' && emp.branch_id !== selectedBranchId) {
        return false;
      }

      // Audit status filter
      if (statusFilter !== 'all') {
        const { status } = getEmployeeStats(emp.id);
        if (statusFilter === 'complete' && status !== 'Complete') return false;
        if (statusFilter === 'incomplete' && status !== 'Incomplete') return false;
        if (statusFilter === 'priority' && status !== 'Priority') return false;
      }

      // Missing requirement filter
      if (missingReqFilter !== 'all') {
        const record = auditRecords[emp.id];
        const isChecked = record?.requirements[missingReqFilter]?.checked;
        if (isChecked) return false;
      }

      return true;
    });
  }, [
    employees,
    searchQuery,
    selectedOrgId,
    selectedBranchId,
    statusFilter,
    missingReqFilter,
    auditRecords,
    requirements,
  ]);

  // Overall aggregate counts matching Excel
  const overallMetrics = useMemo(() => {
    let completeCount = 0;
    let incompleteCount = 0;
    let priorityCount = 0;
    let totalDocsOnFile = 0;
    const totalStaff = employees.length;

    employees.forEach(emp => {
      const { onFileCount, status } = getEmployeeStats(emp.id);
      totalDocsOnFile += onFileCount;
      if (status === 'Complete') completeCount++;
      else if (status === 'Incomplete') incompleteCount++;
      else priorityCount++;
    });

    const maxPossibleDocs = totalStaff * (requirements.length || 6);
    const complianceRate = maxPossibleDocs > 0 ? Math.round((totalDocsOnFile / maxPossibleDocs) * 100) : 0;

    return {
      totalStaff,
      completeCount,
      incompleteCount,
      priorityCount,
      totalDocsOnFile,
      complianceRate,
    };
  }, [employees, auditRecords, requirements]);

  // Export Matrix to Excel (.xlsx) matching user's spreadsheet template
  const handleExportExcel = () => {
    try {
      const rows = filteredEmployees.map(emp => {
        const stats = getEmployeeStats(emp.id);
        const record = auditRecords[emp.id];

        const row: Record<string, any> = {
          'Company Name': emp.organization?.name || 'N/A',
          'Store Name': emp.branch?.name || 'N/A',
          'Staff Name': `${emp.first_name || ''} ${emp.last_name || ''}`.trim(),
        };

        requirements.forEach(req => {
          row[req.name] = record?.requirements[req.id]?.checked ? 'TRUE' : 'FALSE';
        });

        row['On File'] = stats.onFileCount;
        row['Audit Status'] = stats.status;
        return row;
      });

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Staff Document Audit');

      const dateStr = todayUK();
      XLSX.writeFile(workbook, `Staff_Documentation_Audit_${dateStr}.xlsx`);
      toast.success('Excel audit matrix exported successfully');
    } catch (e: any) {
      console.error('Failed to export Excel audit:', e);
      toast.error('Failed to export Excel audit');
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    try {
      const headers = [
        'Company Name',
        'Store Name',
        'Staff Name',
        ...requirements.map(r => r.name),
        'On File',
        'Audit Status',
      ];

      const csvRows = [headers.join(',')];

      filteredEmployees.forEach(emp => {
        const stats = getEmployeeStats(emp.id);
        const record = auditRecords[emp.id];

        const escape = (val: string) => `"${(val || '').replace(/"/g, '""')}"`;

        const row = [
          escape(emp.organization?.name || 'N/A'),
          escape(emp.branch?.name || 'N/A'),
          escape(`${emp.first_name || ''} ${emp.last_name || ''}`.trim()),
          ...requirements.map(r => (record?.requirements[r.id]?.checked ? 'TRUE' : 'FALSE')),
          stats.onFileCount,
          stats.status,
        ];
        csvRows.push(row.join(','));
      });

      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const dateStr = todayUK();
      link.download = `Staff_Documentation_Audit_${dateStr}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('CSV audit exported successfully');
    } catch (e) {
      toast.error('Failed to export CSV');
    }
  };

  // Open Split View for an Employee
  const handleOpenSplitView = async (empId: string) => {
    setSplitViewEmployeeId(empId);
    setSelectedPreviewDoc(null);
    setPreviewSignedUrl(null);
    await loadEmployeeFolderAndFiles(empId);
  };

  // Load employee's folder & files for the Left Pane
  const loadEmployeeFolderAndFiles = async (empId: string) => {
    try {
      // Find employee's dedicated folder
      let { data: folder } = await supabase
        .from('folders')
        .select('id, name')
        .eq('folder_type', 'employee')
        .eq('employee_id', empId)
        .maybeSingle();

      // If folder does not exist, resolve or create it
      if (!folder) {
        const targetEmp = employees.find(e => e.id === empId);
        const createdId = await getOrCreateEmployeeFolder(empId, targetEmp, user?.id);
        if (createdId) {
          const { data: createdFolder } = await supabase
            .from('folders')
            .select('id, name')
            .eq('id', createdId)
            .maybeSingle();
          folder = createdFolder;
        }
      }

      if (folder) {
        setActiveDocFolder(folder);
      } else {
        setActiveDocFolder(null);
      }

      // Query all documents associated with this employee or inside their folder
      let query = supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (folder?.id) {
        query = query.or(`employee_id.eq.${empId},folder_id.eq.${folder.id}`);
      } else {
        query = query.eq('employee_id', empId);
      }

      const { data: docs } = await query;
      const docList = docs || [];
      setActiveEmployeeDocs(docList);

      // Automatically select the first file for preview if available
      if (docList.length > 0) {
        handleSelectPreviewDoc(docList[0]);
      }
    } catch (err) {
      console.error('Error loading employee folder & files:', err);
    }
  };

  // Select a document to preview in the left pane
  const handleSelectPreviewDoc = async (doc: DocumentItem) => {
    setSelectedPreviewDoc(doc);
    setLoadingPreview(true);
    setPreviewSignedUrl(null);

    try {
      if (doc.file_path) {
        const { data, error } = await supabase.storage
          .from('documents')
          .createSignedUrl(doc.file_path, 3600);

        if (error) throw error;
        if (data?.signedUrl) {
          setPreviewSignedUrl(data.signedUrl);
        }
      }
    } catch (err: any) {
      console.error('Error loading preview for document:', err);
      toast.error('Could not load document preview');
    } finally {
      setLoadingPreview(false);
    }
  };

  // Current employee in Split View
  const splitViewEmployee = useMemo(() => {
    return employees.find(e => e.id === splitViewEmployeeId) || null;
  }, [employees, splitViewEmployeeId]);

  // SINGLE UPLOAD BUTTON ON LEFT SIDE: Uploads directly inside employee's folder
  const handleFileUploadToEmployeeFolder = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !splitViewEmployeeId) return;

    setIsUploadingToFolder(true);
    try {
      // 1. Resolve or create employee folder inside company & branch
      let folderId = activeDocFolder?.id;
      if (!folderId) {
        folderId = await getOrCreateEmployeeFolder(splitViewEmployeeId, splitViewEmployee, user?.id);
        if (folderId) {
          const { data: f } = await supabase.from('folders').select('id, name').eq('id', folderId).maybeSingle();
          if (f) setActiveDocFolder(f);
        }
      }

      // 2. Upload file to Supabase storage under employee's directory
      const fileExt = file.name.split('.').pop() || 'bin';
      const storagePath = `emp_${splitViewEmployeeId}/${crypto.randomUUID()}.${fileExt}`;

      const { error: uploadErr } = await supabase.storage
        .from('documents')
        .upload(storagePath, file);

      if (uploadErr) throw uploadErr;

      // 3. Insert record into documents table assigned to this employee's folder
      const { data: newDoc, error: insertErr } = await supabase
        .from('documents')
        .insert({
          title: file.name,
          file_name: file.name,
          file_path: storagePath,
          file_size: file.size,
          file_type: file.type,
          employee_id: splitViewEmployeeId,
          folder_id: folderId || null,
          uploaded_by: user?.id,
        })
        .select()
        .single();

      if (insertErr) throw insertErr;

      toast.success(`Uploaded ${file.name} to employee folder`);

      // 4. Refresh files list & auto-select newly uploaded file
      await loadEmployeeFolderAndFiles(splitViewEmployeeId);
      if (newDoc) {
        handleSelectPreviewDoc(newDoc);
      }
    } catch (err: any) {
      console.error('Upload failed:', err);
      toast.error('Upload failed: ' + (err.message || 'Unknown error'));
    } finally {
      setIsUploadingToFolder(false);
      e.target.value = '';
    }
  };

  // Index of current employee in filtered list for next/prev navigation
  const currentSplitIndex = useMemo(() => {
    if (!splitViewEmployeeId) return -1;
    return filteredEmployees.findIndex(e => e.id === splitViewEmployeeId);
  }, [filteredEmployees, splitViewEmployeeId]);

  const handleNavigateNext = () => {
    if (currentSplitIndex >= 0 && currentSplitIndex < filteredEmployees.length - 1) {
      const nextEmp = filteredEmployees[currentSplitIndex + 1];
      handleOpenSplitView(nextEmp.id);
    }
  };

  const handleNavigatePrev = () => {
    if (currentSplitIndex > 0) {
      const prevEmp = filteredEmployees[currentSplitIndex - 1];
      handleOpenSplitView(prevEmp.id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Header matching Staff Documentation Audit */}
      <div className="rounded-xl border border-border/80 bg-linear-to-r from-emerald-500/10 via-background to-teal-500/5 p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-2xs">
                <ClipboardCheck className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold tracking-tight text-foreground">
                    Staff Documentation Audit
                  </h2>
                  <Badge variant="outline" className="border-emerald-500 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 font-semibold text-xs">
                    2-Line Boxes & Split View
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Enter or verify staff records. Tick each box when the document is on file. Use header filters to review by company or store.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              className="gap-1.5 text-xs font-semibold border-emerald-600/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              Export Excel (.xlsx)
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="gap-1.5 text-xs"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsConfigDialogOpen(true)}
              className="gap-1.5 text-xs"
            >
              <Settings2 className="h-3.5 w-3.5" />
              Configure ({requirements.length})
            </Button>
            <Button
              size="sm"
              onClick={() => fetchInitialData()}
              variant="secondary"
              className="gap-1.5 text-xs"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Rescan Records
            </Button>
          </div>
        </div>

        {/* Threshold KPI Bands: EXACTLY MATCHING USER'S EXCEL SPEC */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-4 pt-4 border-t border-border/60">
          {/* Total Staff */}
          <div className="rounded-lg bg-card/80 border border-border p-3">
            <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Total Staff
            </div>
            <div className="text-2xl font-bold text-foreground mt-0.5">
              {overallMetrics.totalStaff}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              Active employees
            </div>
          </div>

          {/* GREEN Band: 6 documents */}
          <div className="rounded-lg bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-500/40 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                GREEN | Complete
              </span>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">
              {overallMetrics.completeCount}
            </div>
            <div className="text-[10px] text-emerald-800/80 dark:text-emerald-400 mt-0.5">
              All 6 documents on file
            </div>
          </div>

          {/* AMBER Band: 3–5 documents */}
          <div className="rounded-lg bg-amber-50/70 dark:bg-amber-950/40 border border-amber-500/40 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                AMBER | Incomplete
              </span>
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
            </div>
            <div className="text-2xl font-bold text-amber-700 dark:text-amber-300 mt-0.5">
              {overallMetrics.incompleteCount}
            </div>
            <div className="text-[10px] text-amber-800/80 dark:text-amber-400 mt-0.5">
              3–5 documents on file
            </div>
          </div>

          {/* RED Band: 0–2 documents */}
          <div className="rounded-lg bg-red-50/70 dark:bg-red-950/40 border border-red-500/40 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-red-800 dark:text-red-300 uppercase tracking-wider">
                RED | Priority
              </span>
              <XCircle className="h-3.5 w-3.5 text-red-600" />
            </div>
            <div className="text-2xl font-bold text-red-700 dark:text-red-300 mt-0.5">
              {overallMetrics.priorityCount}
            </div>
            <div className="text-[10px] text-red-800/80 dark:text-red-400 mt-0.5">
              0–2 documents (Needs action)
            </div>
          </div>

          {/* Total Documents on File */}
          <div className="rounded-lg bg-card/80 border border-border p-3">
            <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Total On File
            </div>
            <div className="text-2xl font-bold text-foreground mt-0.5">
              {overallMetrics.totalDocsOnFile}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              Verified documents
            </div>
          </div>

          {/* Overall Compliance */}
          <div className="rounded-lg bg-card/80 border border-border p-3">
            <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Compliance Rate
            </div>
            <div className="text-2xl font-bold text-foreground mt-0.5">
              {overallMetrics.complianceRate}%
            </div>
            <div className="w-full bg-muted rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  overallMetrics.complianceRate >= 90
                    ? 'bg-blue-600'
                    : overallMetrics.complianceRate >= 60
                    ? 'bg-amber-500'
                    : 'bg-red-500'
                }`}
                style={{ width: `${overallMetrics.complianceRate}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            {/* Search */}
            <div className="relative md:col-span-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search staff, store, email..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 h-9 text-xs"
              />
            </div>

            {/* Company Filter */}
            <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="All Companies" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Companies</SelectItem>
                {organizations.map(org => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Store / Branch Filter */}
            <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="All Stores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stores</SelectItem>
                {branches
                  .filter(b => selectedOrgId === 'all' || !b.organization_id || b.organization_id === selectedOrgId)
                  .map(b => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select
              value={statusFilter}
              onValueChange={v => setStatusFilter(v as any)}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Audit Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="complete">🟢 Complete (6 Docs)</SelectItem>
                <SelectItem value="incomplete">🟡 Incomplete (3–5 Docs)</SelectItem>
                <SelectItem value="priority">🔴 Priority (0–2 Docs)</SelectItem>
              </SelectContent>
            </Select>

            {/* Missing Requirement Filter */}
            <Select value={missingReqFilter} onValueChange={setMissingReqFilter}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Filter by Missing..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any Requirement</SelectItem>
                {requirements.map(r => (
                  <SelectItem key={r.id} value={r.id}>
                    Missing: {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/50">
            <span>
              Showing <strong className="text-foreground">{filteredEmployees.length}</strong> of{' '}
              {employees.length} staff records
            </span>

            {(searchQuery || selectedOrgId !== 'all' || selectedBranchId !== 'all' || statusFilter !== 'all' || missingReqFilter !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedOrgId('all');
                  setSelectedBranchId('all');
                  setStatusFilter('all');
                  setMissingReqFilter('all');
                }}
              >
                Clear Filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Main Audit Matrix Display: ONLY 2-LINE BEAUTIFUL BOXES */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <NizaLoaderInline />
          <p className="text-sm text-muted-foreground mt-3">Scanning employee documentation records...</p>
        </div>
      ) : filteredEmployees.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <ClipboardCheck className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-base font-semibold">No staff records match filter</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Try adjusting your search query, store filter, or status criteria.
          </p>
        </Card>
      ) : (
        /* ========================================================================= */
        /* 2-LINE BEAUTIFUL BOXES (Only view - real-time blue markers)                */
        /* ========================================================================= */
        <div className="space-y-3">
          {filteredEmployees.map(emp => {
            const stats = getEmployeeStats(emp.id);
            const record = auditRecords[emp.id];
            const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || 'Unnamed Staff';

            return (
              <div
                key={emp.id}
                className="rounded-xl border border-border/80 bg-card p-4 shadow-2xs hover:shadow-md hover:border-blue-500/50 dark:hover:border-blue-500/50 transition-all duration-200 space-y-3 group"
              >
                {/* LINE 1: Employee info (Staff Name, Job title, Store, Company) + On File stats + Status Badge + Split View */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-border/60 pb-3">
                  {/* Left: Avatar + Staff Name + Job Title + Store + Company */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 font-bold text-sm shrink-0 border border-blue-500/20 shadow-2xs">
                      {(emp.first_name?.[0] || 'S').toUpperCase()}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => handleOpenSplitView(emp.id)}
                          className="font-bold text-sm text-foreground hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-left hover:underline truncate"
                        >
                          {fullName}
                        </button>
                        {emp.job_title && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal text-muted-foreground">
                            {emp.job_title}
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-2.5 text-xs text-muted-foreground mt-0.5 flex-wrap">
                        {emp.branch?.name && (
                          <span className="font-medium text-foreground/85">
                            {emp.branch.name}
                          </span>
                        )}
                        {emp.organization?.name && (
                          <span className="text-muted-foreground/80">
                            • {emp.organization.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Progress On File + Audit Status Badge + Split View Button */}
                  <div className="flex items-center gap-2.5 shrink-0 self-start md:self-center flex-wrap sm:flex-nowrap">
                    {/* On File counter */}
                    <div className="flex items-center gap-2 bg-muted/40 border border-border px-3 py-1.5 rounded-lg">
                      <span className="text-xs font-bold text-foreground">
                        {stats.onFileCount} / {stats.totalCount}
                      </span>
                      <span className="text-[10px] text-muted-foreground uppercase font-medium">
                        On File
                      </span>
                      <div className="w-12 bg-muted-foreground/20 rounded-full h-1.5 overflow-hidden ml-0.5">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            stats.status === 'Complete'
                              ? 'bg-blue-600'
                              : stats.status === 'Incomplete'
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                          }`}
                          style={{ width: `${stats.percentage}%` }}
                        />
                      </div>
                    </div>

                    {/* Audit Status Badge */}
                    {stats.status === 'Complete' ? (
                      <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 text-xs font-semibold px-2.5 py-1">
                        Complete
                      </Badge>
                    ) : stats.status === 'Incomplete' ? (
                      <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-300 dark:border-amber-800 text-xs font-semibold px-2.5 py-1">
                        Incomplete
                      </Badge>
                    ) : (
                      <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border-rose-300 dark:border-rose-800 text-xs font-semibold px-2.5 py-1">
                        Priority
                      </Badge>
                    )}

                    {/* Split View Button */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenSplitView(emp.id)}
                      className="h-8 text-xs font-semibold gap-1.5 border-blue-500/40 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/50 shadow-2xs"
                    >
                      <Eye className="h-3.5 w-3.5 text-blue-600" />
                      Split View
                    </Button>
                  </div>
                </div>

                {/* LINE 2: All Document Checkpoints with Full Labels & Blue Marker */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-0.5">
                  {requirements.map(req => {
                    const itemState = record?.requirements[req.id];
                    const isChecked = Boolean(itemState?.checked);

                    return (
                      <button
                        key={req.id}
                        type="button"
                        onClick={() => handleToggleRequirement(emp.id, req.id)}
                        className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-all duration-150 group/item cursor-pointer ${
                          isChecked
                            ? 'bg-blue-500/10 border-blue-500/40 hover:bg-blue-500/15 dark:bg-blue-950/30 dark:border-blue-700/60'
                            : 'bg-muted/20 border-border/70 hover:bg-muted/40 hover:border-blue-400/40'
                        }`}
                        title={`${req.name}: ${isChecked ? 'Verified on file (Click to uncheck)' : 'Missing (Click to mark verified)'}`}
                      >
                        {/* BLUE COLOR Marker */}
                        <div
                          className={`flex h-5 w-5 items-center justify-center rounded-md border transition-all shrink-0 ${
                            isChecked
                              ? 'bg-blue-600 border-blue-600 text-white shadow-2xs'
                              : 'border-slate-300 dark:border-slate-600 bg-background group-hover/item:border-blue-500'
                          }`}
                        >
                          {isChecked && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className={`text-xs font-semibold truncate ${
                            isChecked ? 'text-blue-950 dark:text-blue-200' : 'text-foreground'
                          }`}>
                            {req.name}
                          </div>
                          <div className={`text-[10px] truncate ${
                            isChecked ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-muted-foreground'
                          }`}>
                            {isChecked ? 'On File' : 'Missing'}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* THE SPLIT VIEW MODAL / WORKSPACE (50% File Viewer | 50% Audit Checklist)  */}
      {/* ========================================================================= */}
      <Dialog
        open={Boolean(splitViewEmployeeId)}
        onOpenChange={open => {
          if (!open) {
            setSplitViewEmployeeId(null);
            setSelectedPreviewDoc(null);
            setPreviewSignedUrl(null);
          }
        }}
      >
        <DialogContent
          className={`p-0 gap-0 overflow-hidden flex flex-col transition-all duration-300 ${
            splitViewIsFullscreen
              ? 'w-screen h-screen max-w-none rounded-none m-0'
              : 'w-[95vw] max-w-7xl h-[90vh] rounded-xl'
          }`}
        >
          {splitViewEmployee && (
            <>
              {/* Split View Header */}
              <div className="flex items-center justify-between border-b border-border bg-muted/40 px-5 py-3 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-sm shrink-0 shadow-2xs">
                    {(splitViewEmployee.first_name?.[0] || 'S').toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-base text-foreground truncate">
                        {splitViewEmployee.first_name} {splitViewEmployee.last_name}
                      </h3>
                      <Badge variant="outline" className="text-xs">
                        {splitViewEmployee.branch?.name || 'No Branch'}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {splitViewEmployee.organization?.name || 'No Company'}
                      </Badge>
                      {(() => {
                        const s = getEmployeeStats(splitViewEmployee.id);
                        return s.status === 'Complete' ? (
                          <Badge className="bg-emerald-600 text-white text-xs">
                            Complete (6/6)
                          </Badge>
                        ) : s.status === 'Incomplete' ? (
                          <Badge className="bg-amber-600 text-white text-xs">
                            Incomplete ({s.onFileCount}/{s.totalCount})
                          </Badge>
                        ) : (
                          <Badge className="bg-rose-600 text-white text-xs">
                            Priority ({s.onFileCount}/{s.totalCount})
                          </Badge>
                        );
                      })()}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                      <span>Folder: Employee Documents / {splitViewEmployee.branch?.name || 'Store'} / {splitViewEmployee.first_name} {splitViewEmployee.last_name}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Prev / Next Navigation */}
                  <div className="flex items-center rounded-md border border-border bg-card">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs gap-1"
                      disabled={currentSplitIndex <= 0}
                      onClick={handleNavigatePrev}
                      title="Previous Staff Member"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Prev
                    </Button>
                    <span className="text-[11px] text-muted-foreground px-2 font-medium">
                      {currentSplitIndex + 1} / {filteredEmployees.length}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs gap-1"
                      disabled={currentSplitIndex >= filteredEmployees.length - 1}
                      onClick={handleNavigateNext}
                      title="Next Staff Member"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Toggle Fullscreen */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => setSplitViewIsFullscreen(prev => !prev)}
                    title={splitViewIsFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                  >
                    {splitViewIsFullscreen ? (
                      <Minimize2 className="h-4 w-4" />
                    ) : (
                      <Maximize2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Split Body: 50% Left (Folder & File Preview) | 50% Right (Audit Checklist) */}
              <div className="flex-1 flex flex-col md:flex-row overflow-hidden divide-y md:divide-y-0 md:divide-x divide-border">
                {/* ------------------------------------------------------------- */}
                {/* LEFT HALF (50%): EMPLOYEE FOLDER & DOCUMENT PREVIEWER         */}
                {/* ------------------------------------------------------------- */}
                <div className="w-full md:w-1/2 flex flex-col h-full bg-card overflow-hidden">
                  {/* Folder Files Bar */}
                  <div className="border-b border-border bg-muted/20 px-4 py-2.5 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <FolderOpen className="h-4 w-4 text-blue-600 shrink-0" />
                      <span className="text-xs font-semibold text-foreground truncate">
                        Employee Folder Files ({activeEmployeeDocs.length})
                      </span>
                    </div>

                    {/* ONLY ONE UPLOAD BUTTON ON LEFT SIDE: Goes directly inside employee folder */}
                    <label className="cursor-pointer shrink-0">
                      <input
                        type="file"
                        className="sr-only"
                        onChange={handleFileUploadToEmployeeFolder}
                        disabled={isUploadingToFolder}
                      />
                      <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-2xs transition-colors">
                        <Upload className="h-3.5 w-3.5" />
                        {isUploadingToFolder ? 'Uploading...' : 'Upload to Folder'}
                      </span>
                    </label>
                  </div>

                  {/* Files Chips / Horizontal Scrollable List */}
                  <div className="border-b border-border bg-muted/10 p-2 overflow-x-auto flex items-center gap-1.5 shrink-0">
                    {activeEmployeeDocs.length === 0 ? (
                      <span className="text-xs text-muted-foreground italic px-2">
                        No uploaded documents found for this employee yet. Click "Upload to Folder" above.
                      </span>
                    ) : (
                      activeEmployeeDocs.map(doc => {
                        const isSelected = selectedPreviewDoc?.id === doc.id;
                        return (
                          <button
                            key={doc.id}
                            onClick={() => handleSelectPreviewDoc(doc)}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-all shrink-0 max-w-[200px] border ${
                              isSelected
                                ? 'bg-blue-500/15 border-blue-500 text-blue-800 dark:text-blue-300 font-semibold shadow-2xs'
                                : 'bg-card border-border/80 text-foreground hover:bg-muted'
                            }`}
                            title={doc.title || doc.file_name}
                          >
                            <FileText className={`h-3.5 w-3.5 shrink-0 ${isSelected ? 'text-blue-600' : 'text-muted-foreground'}`} />
                            <span className="truncate">{doc.title || doc.file_name}</span>
                          </button>
                        );
                      })
                    )}
                  </div>

                  {/* Live Document Preview Viewer */}
                  <div className="flex-1 bg-muted/30 p-3 overflow-hidden flex flex-col">
                    {loadingPreview ? (
                      <div className="flex-1 flex flex-col items-center justify-center">
                        <NizaLoaderInline />
                        <span className="text-xs text-muted-foreground mt-2">Loading document preview...</span>
                      </div>
                    ) : selectedPreviewDoc && previewSignedUrl ? (
                      <div className="flex-1 flex flex-col rounded-lg border border-border bg-background overflow-hidden shadow-xs">
                        <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-1.5 shrink-0">
                          <span className="text-xs font-medium truncate max-w-[280px]">
                            {selectedPreviewDoc.title || selectedPreviewDoc.file_name}
                          </span>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => window.open(previewSignedUrl, '_blank')}
                            >
                              <ExternalLink className="h-3 w-3 mr-1" />
                              Open
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => {
                                const a = document.createElement('a');
                                a.href = previewSignedUrl;
                                a.download = selectedPreviewDoc.file_name || 'document';
                                a.click();
                              }}
                            >
                              <Download className="h-3 w-3 mr-1" />
                              Download
                            </Button>
                          </div>
                        </div>

                        {/* Embed Preview based on type */}
                        <div className="flex-1 overflow-auto bg-slate-900/5 dark:bg-black/40 flex items-center justify-center p-2">
                          {selectedPreviewDoc.file_name?.toLowerCase().endsWith('.pdf') ||
                          selectedPreviewDoc.file_type?.includes('pdf') ? (
                            <iframe
                              src={`${previewSignedUrl}#toolbar=1`}
                              className="w-full h-full border-0 rounded"
                              title="Document PDF Preview"
                            />
                          ) : selectedPreviewDoc.file_name?.toLowerCase().match(/\.(jpg|jpeg|png|webp|gif)$/) ||
                            selectedPreviewDoc.file_type?.includes('image') ? (
                            <img
                              src={previewSignedUrl}
                              alt="Document Preview"
                              className="max-w-full max-h-full object-contain rounded shadow-sm"
                            />
                          ) : (
                            <div className="text-center p-6 space-y-2">
                              <FileText className="h-12 w-12 text-muted-foreground mx-auto" />
                              <p className="text-xs text-muted-foreground">
                                Preview not supported directly in iframe for this format.
                              </p>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => window.open(previewSignedUrl, '_blank')}
                                className="text-xs"
                              >
                                Open / Download File
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-border rounded-lg bg-background/50">
                        <FolderOpen className="h-10 w-10 text-muted-foreground mb-2" />
                        <h4 className="font-semibold text-sm">Document Viewer</h4>
                        <p className="text-xs text-muted-foreground max-w-sm mt-1">
                          Select a document from the folder list above to preview it immediately, or upload a new file directly into this employee's folder.
                        </p>
                        <label className="cursor-pointer mt-4">
                          <input
                            type="file"
                            className="sr-only"
                            onChange={handleFileUploadToEmployeeFolder}
                          />
                          <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-2xs">
                            <Upload className="h-3.5 w-3.5" />
                            Upload to Employee Folder
                          </span>
                        </label>
                      </div>
                    )}
                  </div>
                </div>

                {/* ------------------------------------------------------------- */}
                {/* RIGHT HALF (50%): CONFIGURABLE VERIFICATION CHECKLIST         */}
                {/* ------------------------------------------------------------- */}
                <div className="w-full md:w-1/2 flex flex-col h-full bg-card overflow-hidden">
                  <div className="border-b border-border bg-muted/20 px-4 py-2.5 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-blue-600" />
                      <span className="text-xs font-semibold text-foreground">
                        Document Verification Checklist
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                        onClick={() => handleResetToAutoDetection(splitViewEmployee.id)}
                        title="Revert manual changes to system detected files"
                      >
                        Reset to Auto
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 text-xs px-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                        onClick={() => handleMarkAllComplete(splitViewEmployee.id)}
                      >
                        Verify all on file
                      </Button>
                    </div>
                  </div>

                  {/* Checklist Items Container */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {requirements.map((req, idx) => {
                      const record = auditRecords[splitViewEmployee.id];
                      const itemState = record?.requirements[req.id];
                      const isChecked = Boolean(itemState?.checked);
                      const status: RequirementStatus = itemState?.status || (isChecked ? 'verified' : 'missing');

                      // Check if a matching document is in activeEmployeeDocs
                      const matchingDoc = activeEmployeeDocs.find(d => {
                        const t = `${d.title || ''} ${d.file_name || ''}`.toLowerCase();
                        if (req.id === 'contract') return t.includes('contract') || t.includes('agreement');
                        if (req.id === 'id_documents') return t.includes('passport') || t.includes('driving') || t.includes('id') || t.includes('brp');
                        if (req.id === 'right_to_work') return t.includes('right_to_work') || t.includes('rtw') || t.includes('share_code');
                        if (req.id === 'bank_details') return t.includes('bank') || t.includes('sort_code');
                        if (req.id === 'starter_checklist') return t.includes('starter') || t.includes('p45') || t.includes('p46');
                        if (req.id === 'application_form') return t.includes('application');
                        return t.includes(req.name.toLowerCase());
                      });

                      return (
                        <div
                          key={req.id}
                          className={`rounded-lg border p-3 transition-all ${
                            isChecked
                              ? 'bg-blue-500/5 border-blue-500/40'
                              : 'bg-card border-border hover:border-border/80'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            {/* Blue Checkbox Marker & Details */}
                            <div className="flex items-start gap-2.5 flex-1 min-w-0">
                              <button
                                type="button"
                                onClick={() => handleToggleRequirement(splitViewEmployee.id, req.id)}
                                className="cursor-pointer pt-0.5 inline-flex items-center shrink-0"
                              >
                                <div
                                  className={`flex h-5 w-5 items-center justify-center rounded-md border transition-all ${
                                    isChecked
                                      ? 'bg-blue-600 border-blue-600 text-white shadow-2xs'
                                      : 'border-slate-300 dark:border-slate-600 bg-background hover:border-blue-500'
                                  }`}
                                >
                                  {isChecked && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                                </div>
                              </button>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`text-xs font-bold ${isChecked ? 'text-blue-950 dark:text-blue-200' : 'text-foreground'}`}>
                                    {idx + 1}. {req.name}
                                  </span>

                                  {/* Auto-detected pill */}
                                  {matchingDoc ? (
                                    <button
                                      type="button"
                                      onClick={() => handleSelectPreviewDoc(matchingDoc)}
                                      className="inline-flex items-center gap-1 rounded bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 px-1.5 py-0.5 text-[10px] font-semibold hover:underline"
                                      title="Click to preview matching file in left panel"
                                    >
                                      <Sparkles className="h-3 w-3 text-blue-600" />
                                      Found: {matchingDoc.file_name}
                                    </button>
                                  ) : isChecked && itemState?.notes ? (
                                    <span className="inline-flex items-center gap-1 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 text-[10px]">
                                      Verified
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                                      (No file in folder)
                                    </span>
                                  )}
                                </div>

                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                  {req.description}
                                </p>
                              </div>
                            </div>

                            {/* Status Dropdown (Upload button removed as requested) */}
                            <div className="shrink-0 flex items-center gap-2">
                              <Select
                                value={status}
                                onValueChange={v =>
                                  handleUpdateRequirementStatus(
                                    splitViewEmployee.id,
                                    req.id,
                                    v as RequirementStatus
                                  )
                                }
                              >
                                <SelectTrigger
                                  className={`h-7 text-[11px] font-semibold w-[130px] ${
                                    status === 'verified'
                                      ? 'border-blue-500/60 text-blue-700 dark:text-blue-300 bg-blue-50/70 dark:bg-blue-950/40'
                                      : status === 'pending'
                                      ? 'border-amber-500/60 text-amber-700 dark:text-amber-300 bg-amber-50/70 dark:bg-amber-950/40'
                                      : status === 'expired'
                                      ? 'border-orange-500/60 text-orange-700 dark:text-orange-300 bg-orange-50/70 dark:bg-orange-950/40'
                                      : status === 'not_applicable'
                                      ? 'border-muted text-muted-foreground bg-muted/40'
                                      : 'border-red-500/60 text-red-700 dark:text-red-300 bg-red-50/70 dark:bg-red-950/40'
                                  }`}
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="verified">🔵 On File (Verified)</SelectItem>
                                  <SelectItem value="pending">🟡 Pending Review</SelectItem>
                                  <SelectItem value="missing">🔴 Missing</SelectItem>
                                  <SelectItem value="expired">🟠 Expired</SelectItem>
                                  <SelectItem value="not_applicable">⚪ Not Applicable</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {/* Notes / Reference input: REAL-TIME TYPING & INSTANT DB SYNC */}
                          <div className="mt-2 pt-2 border-t border-border/50 flex items-center gap-2">
                            <span className="text-[10px] text-muted-foreground font-medium shrink-0">
                              Notes / Ref:
                            </span>
                            <Input
                              placeholder="e.g. Passport valid to 2029 / Share code verified"
                              value={itemState?.notes || ''}
                              onChange={e =>
                                handleUpdateRequirementNotes(splitViewEmployee.id, req.id, e.target.value)
                              }
                              className="h-7 text-xs bg-background/80"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Split View Footer Action */}
                  <div className="border-t border-border bg-muted/30 px-4 py-2.5 flex items-center justify-between shrink-0">
                    <span className="text-xs text-muted-foreground">
                      Autosaved to database register in real time
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-8"
                        onClick={() => {
                          setSplitViewEmployeeId(null);
                          setSelectedPreviewDoc(null);
                        }}
                      >
                        Close Split View
                      </Button>
                      <Button
                        size="sm"
                        className="text-xs h-8 bg-blue-600 hover:bg-blue-700 text-white gap-1 font-semibold"
                        onClick={() => {
                          if (currentSplitIndex < filteredEmployees.length - 1) {
                            handleNavigateNext();
                          } else {
                            toast.success('Completed all filtered staff members!');
                            setSplitViewEmployeeId(null);
                          }
                        }}
                      >
                        Save & Next Staff
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* CONFIGURE REQUIREMENTS DIALOG (Editable & Configurable Audit Matrix)      */}
      {/* ========================================================================= */}
      <Dialog open={isConfigDialogOpen} onOpenChange={setIsConfigDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-emerald-600" />
              Configure Audit Checklist Requirements
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground">
              These checkpoints define the audit matrix. Standard requirements align with regulatory staff documentation audits.
            </p>

            <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
              {requirements.map((req, i) => (
                <div
                  key={req.id}
                  className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-card text-xs"
                >
                  <div>
                    <div className="font-semibold text-foreground flex items-center gap-2">
                      <span>{i + 1}. {req.name}</span>
                      {req.isCustom && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0">Custom</Badge>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground">{req.description}</div>
                  </div>
                  {req.isCustom && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleRemoveRequirement(req.id)}
                      title="Delete requirement"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-border space-y-2">
              <div className="text-xs font-semibold text-foreground">Add Custom Checklist Item</div>
              <Input
                placeholder="Requirement Name (e.g. DBS Check, Food Hygiene Level 2)"
                value={newReqName}
                onChange={e => setNewReqName(e.target.value)}
                className="text-xs h-8"
              />
              <Input
                placeholder="Description / Guide (optional)"
                value={newReqDesc}
                onChange={e => setNewReqDesc(e.target.value)}
                className="text-xs h-8"
              />
              <Button
                size="sm"
                className="w-full text-xs h-8 bg-blue-600 hover:bg-blue-700 text-white font-semibold gap-1.5"
                onClick={handleAddCustomRequirement}
              >
                <Plus className="h-3.5 w-3.5" />
                Add Requirement
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsConfigDialogOpen(false)}
              className="text-xs"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
