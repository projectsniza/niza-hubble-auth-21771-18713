import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ChevronRight, User, FileText, Briefcase, DollarSign, Calendar, Shield, Download, Mail, Phone, MapPin, Building2, Clock, Edit, Star, Award, BookOpen, TrendingUp } from 'lucide-react';
import { NizaLoaderInline } from '@/components/ui/niza-loader';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import EditEmployeeDialog from '@/components/employees/EditEmployeeDialog';
import EmployeeStatusBadge from '@/components/employees/EmployeeStatusBadge';
import { Progress } from '@/components/ui/progress';

export default function EmployeeProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [employee, setEmployee] = useState<any>(null);
  const [onboarding, setOnboarding] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [salaryStructure, setSalaryStructure] = useState<any>(null);
  const [payrollRecords, setPayrollRecords] = useState<any[]>([]);
  const [formResponses, setFormResponses] = useState<any[]>([]);
  const [learningStats, setLearningStats] = useState<any>(null);
  const [completedCourses, setCompletedCourses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Only Super Admin, HR, and Manager can view employee profiles
  if (user?.role === 'employee') {
    navigate('/dashboard/my-profile');
    return null;
  }

  useEffect(() => {
    if (id) {
      fetchEmployeeData();
    }
  }, [id]);

  const fetchEmployeeData = async () => {
    setIsLoading(true);
    try {
      // Fetch employee with related data
      const { data: emp, error: empError } = await supabase
        .from('employees')
        .select(`
          *,
          organization:organizations(name),
          branch:branches(name)
        `)
        .eq('id', id)
        .single();

      if (empError) throw empError;
      setEmployee(emp);

      // Fetch onboarding status
      const { data: onb } = await supabase
        .from('employee_onboarding')
        .select('*')
        .eq('employee_id', id)
        .single();
      setOnboarding(onb);

      // Fetch documents
      const { data: docs } = await supabase
        .from('documents')
        .select('*')
        .eq('employee_id', id)
        .order('created_at', { ascending: false });
      setDocuments(docs || []);

      // Fetch contracts
      const { data: conts } = await supabase
        .from('contract_approvals')
        .select('*')
        .eq('employee_id', id)
        .order('created_at', { ascending: false });
      setContracts(conts || []);

      // Fetch salary structure
      const { data: salary } = await supabase
        .from('salary_structures')
        .select('*')
        .eq('employee_id', id)
        .single();
      setSalaryStructure(salary);

      // Fetch payroll records
      const { data: payroll } = await supabase
        .from('payroll_records')
        .select('*')
        .eq('employee_id', id)
        .order('month', { ascending: false });
      setPayrollRecords(payroll || []);

      // Fetch form responses
      const { data: responses } = await supabase
        .from('onboarding_form_responses')
        .select('*')
        .eq('employee_id', id);
      setFormResponses(responses || []);

      // Fetch learning stats
      const { data: stats } = await supabase
        .from('employee_learning_stats')
        .select('*')
        .eq('employee_id', id)
        .maybeSingle();
      setLearningStats(stats);

      // Fetch completed courses
      const { data: progress } = await supabase
        .from('course_progress')
        .select('*, course:courses(title, estimated_duration_minutes)')
        .eq('employee_id', id)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false });
      setCompletedCourses(progress || []);

    } catch (error) {
      console.error('Error fetching employee data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    return <EmployeeStatusBadge status={status} />;
  };

  const calculateNetSalary = () => {
    if (!salaryStructure) return 0;
    const allowances = (salaryStructure.hra || 0) + (salaryStructure.travel_allowance || 0) + (salaryStructure.other_allowances || 0);
    const deductions = (salaryStructure.salary_advance || 0) + (salaryStructure.late_fine || 0);
    return (salaryStructure.basic_salary || 0) + allowances - deductions;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full py-12">
        <NizaLoaderInline />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="p-8">
        <Card className="p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-foreground mb-2">Employee not found</h3>
              <p className="text-muted-foreground mb-4">This employee profile doesn't exist or has been removed</p>
            </div>
            <Button onClick={() => navigate('/dashboard/employees')}>
              Back to Employees
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="cursor-pointer hover:text-foreground" onClick={() => navigate('/dashboard')}>
          Home
        </span>
        <ChevronRight className="h-4 w-4" />
        <span className="cursor-pointer hover:text-foreground" onClick={() => navigate('/dashboard/employees')}>
          Employees
        </span>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">{employee.first_name} {employee.last_name}</span>
      </div>

      {/* Header */}
      <Card className="p-6">
        <div className="flex items-start gap-6">
          <Avatar className="h-20 w-20">
            <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-2xl">
              {employee.first_name?.charAt(0)}{employee.last_name?.charAt(0)}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold">{employee.first_name} {employee.last_name}</h1>
              {getStatusBadge(employee.status)}
            </div>
            <p className="text-muted-foreground">{employee.job_title || 'No job title'}</p>
            
            <div className="flex flex-wrap gap-4 mt-4 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4" />
                {employee.email}
              </div>
              {employee.phone && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  {employee.phone}
                </div>
              )}
              <div className="flex items-center gap-2 text-muted-foreground">
                <Building2 className="h-4 w-4" />
                {employee.organization?.name} / {employee.branch?.name}
              </div>
              {employee.join_date && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  Joined {format(new Date(employee.join_date), 'dd MMM yyyy')}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Profile
            </Button>
            {employee.status === 'onboarding' && (
              <Button onClick={() => navigate(`/dashboard/onboarding/${employee.id}`)}>
                Continue Onboarding
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Edit Employee Dialog */}
      <EditEmployeeDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        employee={employee}
        onSuccess={fetchEmployeeData}
      />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="contracts">Contracts</TabsTrigger>
          <TabsTrigger value="payroll">Payroll</TabsTrigger>
          <TabsTrigger value="forms">Onboarding Forms</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Personal Info */}
            <Card className="p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Personal Information
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Full Name</span>
                  <span>{employee.first_name} {employee.last_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <span>{employee.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phone</span>
                  <span>{employee.phone || 'Not provided'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date of Birth</span>
                  <span>{employee.date_of_birth ? format(new Date(employee.date_of_birth), 'dd MMM yyyy') : 'Not provided'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Address</span>
                  <span className="text-right max-w-[200px]">{employee.address || 'Not provided'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">NI Number</span>
                  <span>{employee.national_insurance_number || 'Not provided'}</span>
                </div>
              </div>
            </Card>

            {/* Employment Info */}
            <Card className="p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-primary" />
                Employment Details
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Job Title</span>
                  <span>{employee.job_title || 'Not assigned'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Department</span>
                  <span>{employee.department || 'Not assigned'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Organization</span>
                  <span>{employee.organization?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Branch</span>
                  <span>{employee.branch?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Join Date</span>
                  <span>{employee.join_date ? format(new Date(employee.join_date), 'dd MMM yyyy') : 'Not set'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  {getStatusBadge(employee.status)}
                </div>
              </div>
            </Card>

            {/* Emergency Contact */}
            <Card className="p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Phone className="h-5 w-5 text-primary" />
                Emergency Contact
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Name</span>
                  <span>{employee.emergency_contact_name || 'Not provided'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phone</span>
                  <span>{employee.emergency_contact_phone || 'Not provided'}</span>
                </div>
              </div>
            </Card>

            {/* Onboarding Status */}
            <Card className="p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Onboarding Status
              </h3>
              {!onboarding ? (
                <p className="text-muted-foreground text-sm">No onboarding record found. This employee may have been added before onboarding tracking was enabled.</p>
              ) : (
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Basic Details</span>
                    <Badge variant={onboarding.basic_details_completed ? 'default' : 'outline'}>
                      {onboarding.basic_details_completed ? 'Complete' : 'Pending'}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Documents Uploaded</span>
                    <Badge variant={onboarding.documents_uploaded ? 'default' : 'outline'}>
                      {onboarding.documents_uploaded ? 'Complete' : 'Pending'}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Contract Submitted</span>
                    <Badge variant={onboarding.contract_submitted_for_approval ? 'default' : 'outline'}>
                      {onboarding.contract_submitted_for_approval ? 'Submitted' : 'Pending'}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Contract Approved</span>
                    <Badge variant={onboarding.contract_approved ? 'default' : 'outline'}>
                      {onboarding.contract_approved ? 'Approved' : 'Pending'}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Signed Contract Uploaded</span>
                    <Badge variant={onboarding.contract_signed ? 'default' : 'outline'}>
                      {onboarding.contract_signed ? 'Complete' : 'Pending'}
                    </Badge>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="mt-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Employee Documents</h3>
            {documents.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No documents uploaded yet</p>
            ) : (
              <div className="space-y-3">
                {documents.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium">{doc.title}</p>
                        <p className="text-xs text-muted-foreground">
                          Uploaded {format(new Date(doc.created_at), 'dd MMM yyyy')}
                          {doc.expiry_date && ` • Expires ${format(new Date(doc.expiry_date), 'dd MMM yyyy')}`}
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm">
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Contracts Tab */}
        <TabsContent value="contracts" className="mt-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Employment Contracts</h3>
            {contracts.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No contracts found</p>
            ) : (
              <div className="space-y-3">
                {contracts.map(contract => (
                  <div key={contract.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Briefcase className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium">{contract.contract_file_name || 'Employment Contract'}</p>
                        <div className="flex items-center gap-2">
                          <Badge variant={contract.status === 'approved' ? 'default' : contract.status === 'rejected' ? 'destructive' : 'secondary'}>
                            {contract.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            Submitted {format(new Date(contract.submitted_at), 'dd MMM yyyy')}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm">
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Payroll Tab */}
        <TabsContent value="payroll" className="mt-6 space-y-6">
          {/* Salary Structure */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Salary Structure
            </h3>
            {salaryStructure ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <p className="text-2xl font-bold">£{salaryStructure.basic_salary?.toFixed(2) || '0.00'}</p>
                  <p className="text-xs text-muted-foreground">Basic Salary</p>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">
                    £{((salaryStructure.hra || 0) + (salaryStructure.travel_allowance || 0) + (salaryStructure.other_allowances || 0)).toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">Allowances</p>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <p className="text-2xl font-bold text-red-600">
                    £{((salaryStructure.salary_advance || 0) + (salaryStructure.late_fine || 0)).toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">Deductions</p>
                </div>
                <div className="text-center p-4 bg-primary/10 rounded-lg">
                  <p className="text-2xl font-bold text-primary">£{calculateNetSalary().toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">Net Salary</p>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">Salary structure not configured</p>
            )}
          </Card>

          {/* Payroll History */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Payroll History</h3>
            {payrollRecords.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No payroll records found</p>
            ) : (
              <div className="space-y-3">
                {payrollRecords.map(record => (
                  <div key={record.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium">{format(new Date(record.month), 'MMMM yyyy')}</p>
                        <p className="text-xs text-muted-foreground">
                          Net: £{record.net_salary?.toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm">
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Forms Tab */}
        <TabsContent value="forms" className="mt-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Onboarding Form Responses</h3>
            {formResponses.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No form responses found</p>
            ) : (
              <div className="space-y-3">
                {formResponses.map(response => (
                  <div key={response.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium capitalize">{response.form_type.replace('_', ' ')}</p>
                        <p className="text-xs text-muted-foreground">
                          {response.signed_at 
                            ? `Signed ${format(new Date(response.signed_at), 'dd MMM yyyy')}`
                            : 'Not signed'}
                        </p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">View</Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
