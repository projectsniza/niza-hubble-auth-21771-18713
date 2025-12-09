import { useAuth } from '@/contexts/AuthContext';
import DashboardGrid from '@/components/dashboard/DashboardGrid';
import EmployeeDashboard from '@/components/dashboard/EmployeeDashboard';

export default function Home() {
  const { user } = useAuth();
  
  // Employees get their own dashboard
  if (user?.role === 'employee') {
    return <EmployeeDashboard />;
  }
  
  // Everyone else gets the grid view
  return <DashboardGrid />;
}
