import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Home from "./pages/dashboard/Home";
import Overview from "./pages/dashboard/Overview";
import Employees from "./pages/dashboard/Employees";
import EmployeeProfile from "./pages/dashboard/EmployeeProfile";
import MyProfile from "./pages/dashboard/MyProfile";
import Onboarding from "./pages/dashboard/Onboarding";
import Documents from "./pages/dashboard/Documents";
import DocumentsTodo from "./pages/dashboard/DocumentsTodo";
import Attendance from "./pages/dashboard/Attendance";
import Scheduling from "./pages/dashboard/Scheduling";
import ClockIns from "./pages/dashboard/ClockIns";
import Payroll from "./pages/dashboard/Payroll";
import Performance from "./pages/dashboard/Performance";
import DailyReports from "./pages/dashboard/DailyReports";
import Events from "./pages/dashboard/Events";
import ELearning from "./pages/dashboard/ELearning";
import NizaSafe from "./pages/NizaSafe";
import NizaSafeHome from "./pages/niza-safe/Home";
import RiskManagement from "./pages/niza-safe/RiskManagement";
import IncidentManagement from "./pages/niza-safe/IncidentManagement";
import SafeDocuments from "./pages/niza-safe/SafeDocuments";
import SafeEmployees from "./pages/niza-safe/SafeEmployees";
import Tasks from "./pages/niza-safe/Tasks";
import NizaFinance from "./pages/NizaFinance";
import NizaTemplates from "./pages/NizaTemplates";
import TemplatesHome from "./pages/niza-templates/Home";
import IDCards from "./pages/niza-templates/IDCards";
import BusinessCards from "./pages/niza-templates/BusinessCards";
import Invoices from "./pages/niza-templates/Invoices";
import GiftCards from "./pages/niza-templates/GiftCards";
import EmailSignature from "./pages/niza-templates/EmailSignature";
import BrandSettings from "./pages/niza-templates/BrandSettings";
import DashboardTemplates from "./pages/dashboard/Templates";
import Settings from "./pages/dashboard/Settings";
import Maintenance from "./pages/dashboard/Maintenance";
import AddEmployee from "./pages/dashboard/AddEmployee";
import UKCompliance from "./pages/dashboard/UKCompliance";
import SafetyTasks from "./pages/dashboard/SafetyTasks";
import Messages from "./pages/dashboard/Messages";
import StoreTemplates from "./pages/dashboard/StoreTemplates";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<Dashboard />}>
              <Route index element={<Home />} />
              <Route path="overview" element={<Overview />} />
              <Route path="employees" element={<Employees />} />
              <Route path="employees/:id" element={<EmployeeProfile />} />
              <Route path="my-profile" element={<MyProfile />} />
              <Route path="onboarding" element={<Onboarding />} />
              <Route path="onboarding/:id" element={<AddEmployee />} />
              <Route path="add-employee" element={<AddEmployee />} />
              <Route path="documents" element={<Documents />} />
              <Route path="documents/todo" element={<DocumentsTodo />} />
              <Route path="attendance" element={<Attendance />} />
              <Route path="scheduling" element={<Scheduling />} />
              <Route path="clock-ins" element={<ClockIns />} />
              <Route path="payroll" element={<Payroll />} />
              <Route path="performance" element={<Performance />} />
              <Route path="daily-reports" element={<DailyReports />} />
              <Route path="events" element={<Events />} />
              <Route path="elearning" element={<ELearning />} />
              <Route path="templates" element={<DashboardTemplates />} />
              <Route path="settings" element={<Settings />} />
              <Route path="maintenance" element={<Maintenance />} />
              <Route path="uk-compliance" element={<UKCompliance />} />
              <Route path="safety-tasks" element={<SafetyTasks />} />
              <Route path="messages" element={<Messages />} />
              <Route path="store-templates" element={<StoreTemplates />} />
            </Route>
            <Route path="/niza-safe" element={<NizaSafe />}>
              <Route index element={<NizaSafeHome />} />
              <Route path="risk-management" element={<RiskManagement />} />
              <Route path="incident-management" element={<IncidentManagement />} />
              <Route path="documents" element={<SafeDocuments />} />
              <Route path="employees" element={<SafeEmployees />} />
              <Route path="tasks" element={<Tasks />} />
            </Route>
            <Route path="/niza-finance" element={<NizaFinance />} />
            <Route path="/niza-templates" element={<NizaTemplates />}>
              <Route index element={<TemplatesHome />} />
              <Route path="id-cards" element={<IDCards />} />
              <Route path="business-cards" element={<BusinessCards />} />
              <Route path="invoices" element={<Invoices />} />
              <Route path="gift-cards" element={<GiftCards />} />
              <Route path="email-signature" element={<EmailSignature />} />
              <Route path="brand-settings" element={<BrandSettings />} />
            </Route>
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;