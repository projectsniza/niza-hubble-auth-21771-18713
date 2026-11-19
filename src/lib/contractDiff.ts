// Helpers for the contract edit screen: which fields changed, and how to show a logged value.

export const CONTRACT_FIELD_LABELS: Record<string, string> = {
  contract_date: 'Contract date',
  organization_id: 'Employer (organisation)',
  employee_name: 'Employee name',
  employee_address: 'Employee address',
  job_title: 'Job title',
  commencement_date: 'Commencement date',
  hours_per_week: 'Hours per week',
  salary_rate: 'Pay',
  salary_type: 'Pay basis',
  place_of_work: 'Place of work',
  holiday_days: 'Holiday entitlement',
  registered_number: 'Registered number',
  registered_office: 'Registered office',
  vat_number: 'VAT number',
  employer_name: 'Employer representative',
  employer_signed_date: 'Employer signature date',
  employee_branch: 'Employee branch',
  signed_contract_path: 'Signed copy',
};

export interface ContractChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

const norm = (v: unknown): string => (v === null || v === undefined ? '' : String(v).trim());

/** Fields whose value differs between the stored contract and the edited form. */
export function diffContract(original: Record<string, unknown>, edited: Record<string, unknown>): ContractChange[] {
  const out: ContractChange[] = [];
  for (const field of Object.keys(edited)) {
    if (norm(original[field]) !== norm(edited[field])) {
      out.push({ field, oldValue: original[field] ?? null, newValue: edited[field] ?? null });
    }
  }
  return out;
}

export function formatLogValue(v: unknown): string {
  const s = norm(typeof v === 'object' && v !== null ? JSON.stringify(v) : v);
  if (!s) return '(empty)';
  return s.length > 60 ? s.slice(0, 57) + '…' : s;
}
