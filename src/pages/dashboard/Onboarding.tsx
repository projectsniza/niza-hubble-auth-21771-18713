import { useAuth } from '@/contexts/AuthContext';
import OnboardingApprovals from '@/components/onboarding/OnboardingApprovals';
import OnboardingManagement from '@/components/onboarding/OnboardingManagement';

export default function Onboarding() {
  const { user } = useAuth();

  // Super Admin sees approval workflow
  if (user?.role === 'super_admin') {
    return <OnboardingApprovals />;
  }

  // HR and Managers see management interface
  if (user?.role === 'hr' || user?.role === 'manager') {
    return <OnboardingManagement />;
  }

  // Employees see their own onboarding status (future enhancement)
  return (
    <div className="p-8">
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold mb-2">Employee Onboarding</h2>
        <p className="text-muted-foreground">Access restricted to HR and Management roles</p>
      </div>
    </div>
  );
}
