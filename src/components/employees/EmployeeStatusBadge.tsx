import { Badge } from '@/components/ui/badge';
import { 
  Clock, 
  Loader2, 
  FileSignature, 
  FileCheck, 
  FileX,
  CheckCircle,
  XCircle,
  UserX
} from 'lucide-react';

interface EmployeeStatusBadgeProps {
  status: string;
  size?: 'sm' | 'default';
}

// Enhanced status system:
// pending - Employee added but onboarding not started
// in_progress - Basic Details / Custom Pages done, Contract not submitted
// waiting_approval - Contract submitted, awaiting Super Admin approval
// awaiting_signature - Super Admin approved, ready for employee signature
// docs_pending - Contract signed, waiting for document upload
// completed - All steps finished, account ready
// active - Account fully active
// inactive - Deactivated
// terminated - Employment ended

export const STATUS_CONFIG: Record<string, {
  label: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: React.ComponentType<any>;
}> = {
  pending: {
    label: 'Pending',
    description: 'Employee added but onboarding not started',
    color: 'text-slate-600',
    bgColor: 'bg-slate-500/10',
    borderColor: 'border-slate-500/20',
    icon: Clock
  },
  in_progress: {
    label: 'In Progress',
    description: 'Onboarding in progress',
    color: 'text-blue-600',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
    icon: Loader2
  },
  waiting_approval: {
    label: 'Waiting Approval',
    description: 'Contract submitted, awaiting Super Admin approval',
    color: 'text-amber-600',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
    icon: FileSignature
  },
  awaiting_signature: {
    label: 'Awaiting Signature',
    description: 'Super Admin approved, ready for employee to sign',
    color: 'text-purple-600',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/20',
    icon: FileCheck
  },
  docs_pending: {
    label: 'Docs Pending',
    description: 'Contract signed, waiting for document upload',
    color: 'text-orange-600',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/20',
    icon: FileX
  },
  completed: {
    label: 'Completed',
    description: 'All onboarding steps finished',
    color: 'text-green-600',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/20',
    icon: CheckCircle
  },
  active: {
    label: 'Active',
    description: 'Account is fully active',
    color: 'text-green-600',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/20',
    icon: CheckCircle
  },
  inactive: {
    label: 'Deactivated',
    description: 'Account deactivated',
    color: 'text-red-600',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/20',
    icon: UserX
  },
  terminated: {
    label: 'Terminated',
    description: 'Employment ended',
    color: 'text-red-600',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/20',
    icon: XCircle
  },
  // Legacy status mappings
  onboarding: {
    label: 'In Progress',
    description: 'Onboarding in progress',
    color: 'text-blue-600',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
    icon: Loader2
  }
};

export default function EmployeeStatusBadge({ status, size = 'default' }: EmployeeStatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const Icon = config.icon;

  return (
    <Badge 
      className={`${config.bgColor} ${config.color} ${config.borderColor} ${size === 'sm' ? 'text-xs px-2 py-0.5' : ''}`}
      title={config.description}
    >
      <Icon className={`${size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} mr-1 ${status === 'in_progress' || status === 'onboarding' ? 'animate-spin' : ''}`} />
      {config.label}
    </Badge>
  );
}

export const EMPLOYEE_STATUSES = [
  { value: 'all', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'terminated', label: 'Terminated' },
];