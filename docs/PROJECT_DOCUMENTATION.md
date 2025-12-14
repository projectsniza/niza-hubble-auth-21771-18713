# Niza Cloud - Project Documentation

## Overview

Niza Cloud is a comprehensive HR Management System (HRIS) with four integrated applications:

1. **Niza HR** (Main Dashboard) - Core HR Management
2. **Niza Safe** - Health & Safety Management
3. **Niza Finance** - Financial P&L Management
4. **Niza Templates** - Brand Asset & Template Management

---

## Technology Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS + Shadcn UI Components
- **Backend**: Supabase (Database, Auth, Storage, Edge Functions)
- **State Management**: React Query (TanStack Query)
- **Routing**: React Router v6

---

## 1. Niza HR (Main Dashboard)

### Authentication & Roles

| Role | Access Level | Description |
|------|-------------|-------------|
| **Super Admin** | Full platform control | Can approve contracts, sign on behalf of employer, manage all settings |
| **HR Admin** | Full/Organization/Branch restricted | Manages employees within their scope |
| **Manager** | Branch-restricted | Onboards employees, manages teams within their branch |
| **Employee** | Self-service only | Views own profile, documents, payslips |

### Modules

#### 1.1 Dashboard Home
- **Super Admin/HR/Manager**: Grid view with module access cards
- **Employee**: Personal dashboard with quick stats and actions

#### 1.2 Overview (Admin Dashboard)
- Real-time statistics: Total Employees, Present Today, Pending Approvals, Events
- Document Follow-up Summary (Overdue/Upcoming)
- Daily Reports list
- Maintenance Tickets list
- Real-time Supabase subscriptions for live updates

#### 1.3 Employee Hub
**Tabs:**
- **Employees**: Employee list with search, filters, status badges
- **Onboarding**: Track employee onboarding progress
- **Contract Approvals**: (Super Admin only) Review and sign contracts
- **Approved Contracts**: Download signed contracts, continue onboarding
- **Teams**: Create and manage teams
- **Annual Leave**: Track leave balances
- **User Management**: (Super Admin only) Create/manage user accounts
- **Onboarding Settings**: (Super Admin only) Configure onboarding workflow

#### 1.4 Employee Onboarding Workflow
**6-Step Process:**
1. Basic Details entry (auto-creates employee folder)
2. Contract Creation & Submission
3. Super Admin Approval & Signature (typed/drawn/uploaded)
4. Print for physical employee signature
5. Right-to-Work Check & document upload
6. Final Document Upload with expiry/follow-up tracking

**Onboarding Forms:**
- Application Form (PDF generation)
- Starter Checklist (HMRC-style)
- Bank Details Form

#### 1.5 Documents
- Hierarchical folder structure: Company Documents → Organization → Branch → Employee Documents
- Document types with expiry and follow-up dates
- Upload, download, delete functionality
- Color-coded follow-up status (Red=Overdue, Yellow=Upcoming, Grey=Normal)

#### 1.6 Clock-ins (Geofencing)
- GPS-based clock in/out
- Location configuration with coordinates (Decimal/DMS formats)
- Geofence radius enforcement
- Branch-restricted location visibility

#### 1.7 Attendance
- Leave requests with approval workflow
- Mandatory leave configuration
- Leave types management
- Leave balance tracking

#### 1.8 Scheduling
- Rota management (Active/Old)
- Shift creation and assignment
- Weekly view calendar

#### 1.9 Daily Reports
- Manager/HR report submission
- File attachments
- Report types: Report, Invoice
- Super Admin oversight view

#### 1.10 Maintenance
- Ticket creation with priority levels (Low/Medium/High)
- Status tracking (Pending/In Progress/Resolved)
- Image attachments
- Real-time updates

#### 1.11 Payroll
- Simplified salary model (Basic + Allowances - Deductions)
- Salary structure management
- Payroll generation
- PDF salary slip generation
- Role-based access

#### 1.12 Training (E-Learning)
- Training creation with deadlines
- Manager assignment
- Document uploads
- Completion tracking

#### 1.13 Events & News
- Event creation with visibility scopes (Company/Organization/Branch)
- Announcements
- Attendance tracking

#### 1.14 Performance
- Performance reviews
- Criteria-based ratings
- Goals tracking
- Multi-scope comparison

#### 1.15 Settings
- **Profile Tab**: All roles can edit display name, change password
- **Organizations Tab**: (Super Admin) Create/manage organizations
- **Users Tab**: (Super Admin) User account management

---

## 2. Niza Safe (Health & Safety)

### Modules

#### 2.1 Dashboard Home
- Task overview (Overdue/Upcoming)
- Risk assessments carousel
- Incident statistics (Accidents/Near Misses)
- Quick stats cards

#### 2.2 Risk Management
- **Risk Assessments**: Create, review, approve risk assessments
- **COSHH Assessments**: Chemical safety documentation
- **Method Statements**: Step-by-step procedure documentation
- **Hazard Reports**: Report and track hazards

#### 2.3 Incident Management
- **Accidents**: Full incident documentation with investigation
- **Near Misses**: Track and prevent potential incidents
- Corrective actions tracking
- Evidence attachments

#### 2.4 Safety Tasks
- Task assignment to employees
- Due date tracking
- Status management
- Overdue alerts

#### 2.5 Safety Documents
- Isolated folder hierarchy (separate from HR documents)
- Safety-specific document storage
- Protected root folder

#### 2.6 Safety Employees
- Employee safety training status
- Certification tracking

---

## 3. Niza Finance

### Features

#### 3.1 P&L Calculator
- Revenue tracking (Shops, Fuel, Car Wash, Lotto, Valeting, Other)
- Cost of Sales breakdown
- Administrative Costs (Staff Wages, Rent, Utilities, etc.)
- Other Income (Commission, Credits, Cash Back, Rent Income)
- Auto-calculated Gross/Net Profit

#### 3.2 Report Management
- Save reports with store name and quarter
- Report comparison view
- PDF export functionality

#### 3.3 Access Control
- Super Admin: Full access
- HR: Scope-based access
- Manager: View only for their branch

---

## 4. Niza Templates

### Modules

#### 4.1 Templates Home
- Overview statistics
- Quick access cards

#### 4.2 Templates
- Create and manage design templates
- ID cards, visiting cards, email signatures

#### 4.3 Gift Cards
- Gift card template management
- Dynamic generation

#### 4.4 Folders
- Organize templates
- Access control

#### 4.5 Brand Settings
- Logo management
- Brand colors
- Style guidelines

---

## Database Schema

### Core Tables

| Table | Purpose |
|-------|---------|
| `organizations` | Company/organization entities |
| `branches` | Branch/location entities |
| `teams` | Team groupings within branches |
| `employees` | Employee records |
| `profiles` | User profile data (linked to auth.users) |
| `user_roles` | Role assignments |

### HR Tables

| Table | Purpose |
|-------|---------|
| `employee_onboarding` | Onboarding progress tracking |
| `contract_approvals` | Contract approval workflow |
| `right_to_work_checks` | RTW verification |
| `documents` | Document storage metadata |
| `folders` | Folder hierarchy |
| `document_types` | Document categorization |
| `document_requirements` | Required documents config |

### Attendance Tables

| Table | Purpose |
|-------|---------|
| `clock_ins` | Clock in/out records |
| `locations` | Clock-in locations with geofencing |
| `leave_requests` | Leave applications |
| `leave_types` | Leave categories |
| `leave_settings` | Leave policy config |
| `mandatory_leave` | Company-mandated leave |

### Scheduling Tables

| Table | Purpose |
|-------|---------|
| `rotas` | Rota definitions |
| `rota_shifts` | Individual shifts |

### Payroll Tables

| Table | Purpose |
|-------|---------|
| `salary_structures` | Employee salary configuration |
| `payroll_records` | Generated payroll records |

### Safety Tables

| Table | Purpose |
|-------|---------|
| `risk_assessments` | Risk assessment records |
| `coshh_assessments` | Chemical safety assessments |
| `method_statements` | Procedure documentation |
| `hazard_reports` | Hazard reports |
| `incidents` | Accident/near-miss records |
| `safety_tasks` | Safety task assignments |

### Training Tables

| Table | Purpose |
|-------|---------|
| `trainings` | Training records |
| `training_documents` | Training materials |
| `training_assignments` | Assignment tracking |

### Other Tables

| Table | Purpose |
|-------|---------|
| `events` | Events and announcements |
| `daily_reports` | Manager daily reports |
| `maintenance_tickets` | Maintenance requests |
| `financial_reports` | P&L reports |
| `performance_reviews` | Employee performance |
| `performance_criteria` | Review criteria |

---

## Security (RLS Policies)

All tables implement Row-Level Security with role-based access:

- **Super Admin**: Full access to all data
- **HR Admin**: Access based on hr_access_level (full/organization/branch)
- **Manager**: Branch-restricted access
- **Employee**: Self-only access

---

## Storage Buckets

| Bucket | Purpose | Public |
|--------|---------|--------|
| `documents` | All document storage | No |
| `training-documents` | Training materials | No |

---

## Key Features Summary

### Implemented ✅

1. **Authentication**: Supabase Auth with role-based access
2. **Multi-tenant**: Organization → Branch → Employee hierarchy
3. **Onboarding Workflow**: 6-step process with contract signing
4. **Document Management**: Hierarchical folders, expiry tracking
5. **Geofenced Clock-ins**: GPS-based attendance
6. **Leave Management**: Request/approval workflow
7. **Payroll**: Simplified salary calculation
8. **Safety Management**: Risk assessments, incidents, tasks
9. **Financial Reporting**: P&L calculator
10. **Real-time Updates**: Supabase subscriptions
11. **Mobile Responsive**: Adaptive layouts
12. **PDF Generation**: Contracts, forms, salary slips

### Database Triggers

1. `create_organization_folder`: Auto-creates folder on organization creation
2. `create_branch_folder`: Auto-creates folder on branch creation
3. `create_employee_folder`: Auto-creates folder on employee creation
4. `handle_new_user`: Creates profile and assigns role on auth signup
5. `prevent_system_folder_deletion`: Protects system folders
6. `update_updated_at_column`: Auto-updates timestamps

---

## Environment Configuration

```env
# Supabase Configuration
SUPABASE_URL=https://exapetzvebjmdbjwsipg.supabase.co
SUPABASE_ANON_KEY=[configured]
SUPABASE_SERVICE_ROLE_KEY=[configured]
```

---

## File Structure

```
src/
├── assets/              # Static assets (logos, images)
├── components/
│   ├── dashboard/       # Dashboard components
│   ├── documents/       # Document management
│   ├── employees/       # Employee management
│   ├── finance/         # Financial components
│   ├── onboarding/      # Onboarding workflow
│   ├── scheduling/      # Scheduling components
│   ├── settings/        # Settings components
│   ├── templates/       # Template components
│   └── ui/              # Shadcn UI components
├── contexts/
│   └── AuthContext.tsx  # Authentication context
├── hooks/               # Custom React hooks
├── integrations/
│   └── supabase/        # Supabase client & types
├── lib/
│   └── utils.ts         # Utility functions
├── pages/
│   ├── dashboard/       # Dashboard pages
│   ├── niza-safe/       # Safety module pages
│   └── niza-templates/  # Templates module pages
└── types/               # TypeScript type definitions
```

---

## Version History

- **Current Version**: Production-ready with full Supabase integration
- **Mock Data**: Removed - All data from Supabase
- **RLS Policies**: Comprehensive coverage for all tables

---

*Last Updated: December 2024*
