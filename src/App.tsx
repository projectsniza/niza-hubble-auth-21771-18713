import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { OrgBranchProvider } from "./contexts/OrgBranchContext";
import { Loader2 } from "lucide-react";

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

// Lazy load all route components for better initial bundle size
const Index = lazy(() => import("./pages/Index"));
const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Home = lazy(() => import("./pages/dashboard/Home"));
const Overview = lazy(() => import("./pages/dashboard/Overview"));
const Employees = lazy(() => import("./pages/dashboard/Employees"));
const EmployeeProfile = lazy(() => import("./pages/dashboard/EmployeeProfile"));
const MyProfile = lazy(() => import("./pages/dashboard/MyProfile"));
const Onboarding = lazy(() => import("./pages/dashboard/Onboarding"));
const Documents = lazy(() => import("./pages/dashboard/Documents"));
const SubmitDocuments = lazy(() => import("./pages/dashboard/SubmitDocuments"));
const DocumentsTodo = lazy(() => import("./pages/dashboard/DocumentsTodo"));
const Attendance = lazy(() => import("./pages/dashboard/Attendance"));
const Scheduling = lazy(() => import("./pages/dashboard/Scheduling"));
const ClockIns = lazy(() => import("./pages/dashboard/ClockIns"));
const Payroll = lazy(() => import("./pages/dashboard/Payroll"));
const Performance = lazy(() => import("./pages/dashboard/Performance"));
const DailyReports = lazy(() => import("./pages/dashboard/DailyReports"));
const Events = lazy(() => import("./pages/dashboard/Events"));
const ELearning = lazy(() => import("./pages/dashboard/ELearning"));
const NizaSafe = lazy(() => import("./pages/NizaSafe"));
const NizaSafeHome = lazy(() => import("./pages/niza-safe/Home"));
const RiskManagement = lazy(() => import("./pages/niza-safe/RiskManagement"));
const IncidentManagement = lazy(() => import("./pages/niza-safe/IncidentManagement"));
const SafeDocuments = lazy(() => import("./pages/niza-safe/SafeDocuments"));
const SafeEmployees = lazy(() => import("./pages/niza-safe/SafeEmployees"));
const Tasks = lazy(() => import("./pages/niza-safe/Tasks"));
const NizaFinance = lazy(() => import("./pages/NizaFinance"));
const NizaTemplates = lazy(() => import("./pages/NizaTemplates"));
const TemplatesHome = lazy(() => import("./pages/niza-templates/Home"));
const IDCards = lazy(() => import("./pages/niza-templates/IDCards"));
const BusinessCards = lazy(() => import("./pages/niza-templates/BusinessCards"));
const Invoices = lazy(() => import("./pages/niza-templates/Invoices"));
const GiftCards = lazy(() => import("./pages/niza-templates/GiftCards"));
const EmailSignature = lazy(() => import("./pages/niza-templates/EmailSignature"));
const BrandSettings = lazy(() => import("./pages/niza-templates/BrandSettings"));
const DashboardTemplates = lazy(() => import("./pages/dashboard/Templates"));
const Settings = lazy(() => import("./pages/dashboard/Settings"));
const Maintenance = lazy(() => import("./pages/dashboard/Maintenance"));
const AddEmployee = lazy(() => import("./pages/dashboard/AddEmployee"));
const UKCompliance = lazy(() => import("./pages/dashboard/UKCompliance"));
const SafetyTasks = lazy(() => import("./pages/dashboard/SafetyTasks"));
const Messages = lazy(() => import("./pages/dashboard/Messages"));
const StoreTemplates = lazy(() => import("./pages/dashboard/StoreTemplates"));
const Lottery = lazy(() => import("./pages/dashboard/Lottery"));
const Reminders = lazy(() => import("./pages/dashboard/Reminders"));
const Notifications = lazy(() => import("./pages/dashboard/Notifications"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes (previously cacheTime)
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <OrgBranchProvider>
        <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Suspense fallback={<PageLoader />}>
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
                <Route path="documents/submit" element={<SubmitDocuments />} />
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
                <Route path="lottery" element={<Lottery />} />
                <Route path="reminders" element={<Reminders />} />
                <Route path="notifications" element={<Notifications />} />
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
          </Suspense>
        </BrowserRouter>
        </TooltipProvider>
      </OrgBranchProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
