export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      branches: {
        Row: {
          address: string | null
          created_at: string | null
          created_by: string | null
          geofence_radius: number | null
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          organization_id: string
          qr_enabled: boolean | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          created_by?: string | null
          geofence_radius?: number | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          organization_id: string
          qr_enabled?: boolean | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          created_by?: string | null
          geofence_radius?: number | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          organization_id?: string
          qr_enabled?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      clock_ins: {
        Row: {
          branch_id: string
          clock_in_latitude: number | null
          clock_in_longitude: number | null
          clock_in_method: string | null
          clock_in_time: string
          clock_out_latitude: number | null
          clock_out_longitude: number | null
          clock_out_time: string | null
          created_at: string | null
          id: string
          location_id: string | null
          notes: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          branch_id: string
          clock_in_latitude?: number | null
          clock_in_longitude?: number | null
          clock_in_method?: string | null
          clock_in_time: string
          clock_out_latitude?: number | null
          clock_out_longitude?: number | null
          clock_out_time?: string | null
          created_at?: string | null
          id?: string
          location_id?: string | null
          notes?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          branch_id?: string
          clock_in_latitude?: number | null
          clock_in_longitude?: number | null
          clock_in_method?: string | null
          clock_in_time?: string
          clock_out_latitude?: number | null
          clock_out_longitude?: number | null
          clock_out_time?: string | null
          created_at?: string | null
          id?: string
          location_id?: string | null
          notes?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clock_ins_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clock_ins_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_approvals: {
        Row: {
          admin_signature: string | null
          approved_at: string | null
          approved_by: string | null
          contract_file_name: string | null
          contract_file_path: string | null
          created_at: string | null
          employee_id: string
          id: string
          rejection_reason: string | null
          signed_contract_path: string | null
          signed_contract_uploaded_at: string | null
          signed_contract_uploaded_by: string | null
          status: string | null
          submitted_at: string | null
          submitted_by: string
          updated_at: string | null
        }
        Insert: {
          admin_signature?: string | null
          approved_at?: string | null
          approved_by?: string | null
          contract_file_name?: string | null
          contract_file_path?: string | null
          created_at?: string | null
          employee_id: string
          id?: string
          rejection_reason?: string | null
          signed_contract_path?: string | null
          signed_contract_uploaded_at?: string | null
          signed_contract_uploaded_by?: string | null
          status?: string | null
          submitted_at?: string | null
          submitted_by: string
          updated_at?: string | null
        }
        Update: {
          admin_signature?: string | null
          approved_at?: string | null
          approved_by?: string | null
          contract_file_name?: string | null
          contract_file_path?: string | null
          created_at?: string | null
          employee_id?: string
          id?: string
          rejection_reason?: string | null
          signed_contract_path?: string | null
          signed_contract_uploaded_at?: string | null
          signed_contract_uploaded_by?: string | null
          status?: string | null
          submitted_at?: string | null
          submitted_by?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_approvals_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      coshh_assessments: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          branch_id: string
          chemical_name: string
          created_at: string | null
          created_by: string | null
          exposure_limits: string | null
          id: string
          is_discontinued: boolean | null
          organization_id: string
          ppe_requirements: string[] | null
          sds_expiry_date: string | null
          sds_file_path: string | null
          status: string | null
          storage_requirements: string | null
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          branch_id: string
          chemical_name: string
          created_at?: string | null
          created_by?: string | null
          exposure_limits?: string | null
          id?: string
          is_discontinued?: boolean | null
          organization_id: string
          ppe_requirements?: string[] | null
          sds_expiry_date?: string | null
          sds_file_path?: string | null
          status?: string | null
          storage_requirements?: string | null
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string
          chemical_name?: string
          created_at?: string | null
          created_by?: string | null
          exposure_limits?: string | null
          id?: string
          is_discontinued?: boolean | null
          organization_id?: string
          ppe_requirements?: string[] | null
          sds_expiry_date?: string | null
          sds_file_path?: string | null
          status?: string | null
          storage_requirements?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coshh_assessments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coshh_assessments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_reports: {
        Row: {
          branch_id: string
          created_at: string | null
          files: Json | null
          id: string
          organization_id: string
          report_type: string | null
          submitted_at: string | null
          submitted_by: string
          title: string
          updated_at: string | null
        }
        Insert: {
          branch_id: string
          created_at?: string | null
          files?: Json | null
          id?: string
          organization_id: string
          report_type?: string | null
          submitted_at?: string | null
          submitted_by: string
          title: string
          updated_at?: string | null
        }
        Update: {
          branch_id?: string
          created_at?: string | null
          files?: Json | null
          id?: string
          organization_id?: string
          report_type?: string | null
          submitted_at?: string | null
          submitted_by?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_reports_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_reports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      document_types: {
        Row: {
          branch_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          organization_id: string | null
          required_for: string | null
          updated_at: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          organization_id?: string | null
          required_for?: string | null
          updated_at?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string | null
          required_for?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_types_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_types_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string | null
          document_type_id: string | null
          employee_id: string | null
          expiry_date: string | null
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          folder_id: string | null
          follow_up_date: string | null
          id: string
          title: string
          updated_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          document_type_id?: string | null
          employee_id?: string | null
          expiry_date?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          folder_id?: string | null
          follow_up_date?: string | null
          id?: string
          title: string
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          document_type_id?: string | null
          employee_id?: string | null
          expiry_date?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          folder_id?: string | null
          follow_up_date?: string | null
          id?: string
          title?: string
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_document_type_id_fkey"
            columns: ["document_type_id"]
            isOneToOne: false
            referencedRelation: "document_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_onboarding: {
        Row: {
          basic_details_completed: boolean | null
          completed_at: string | null
          contract_approved: boolean | null
          contract_signed: boolean | null
          contract_submitted_for_approval: boolean | null
          contract_uploaded: boolean | null
          created_at: string | null
          current_step: number | null
          documents_uploaded: boolean | null
          employee_id: string
          id: string
          right_to_work_completed: boolean | null
          updated_at: string | null
        }
        Insert: {
          basic_details_completed?: boolean | null
          completed_at?: string | null
          contract_approved?: boolean | null
          contract_signed?: boolean | null
          contract_submitted_for_approval?: boolean | null
          contract_uploaded?: boolean | null
          created_at?: string | null
          current_step?: number | null
          documents_uploaded?: boolean | null
          employee_id: string
          id?: string
          right_to_work_completed?: boolean | null
          updated_at?: string | null
        }
        Update: {
          basic_details_completed?: boolean | null
          completed_at?: string | null
          contract_approved?: boolean | null
          contract_signed?: boolean | null
          contract_submitted_for_approval?: boolean | null
          contract_uploaded?: boolean | null
          created_at?: string | null
          current_step?: number | null
          documents_uploaded?: boolean | null
          employee_id?: string
          id?: string
          right_to_work_completed?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_onboarding_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          account_activated: boolean | null
          address: string | null
          branch_id: string
          created_at: string | null
          created_by: string | null
          date_of_birth: string | null
          department: string | null
          email: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          first_name: string
          id: string
          job_title: string | null
          join_date: string | null
          last_name: string
          manager_id: string | null
          national_insurance_number: string | null
          organization_id: string
          phone: string | null
          status: string | null
          team_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          account_activated?: boolean | null
          address?: string | null
          branch_id: string
          created_at?: string | null
          created_by?: string | null
          date_of_birth?: string | null
          department?: string | null
          email: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name: string
          id?: string
          job_title?: string | null
          join_date?: string | null
          last_name: string
          manager_id?: string | null
          national_insurance_number?: string | null
          organization_id: string
          phone?: string | null
          status?: string | null
          team_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          account_activated?: boolean | null
          address?: string | null
          branch_id?: string
          created_at?: string | null
          created_by?: string | null
          date_of_birth?: string | null
          department?: string | null
          email?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name?: string
          id?: string
          job_title?: string | null
          join_date?: string | null
          last_name?: string
          manager_id?: string | null
          national_insurance_number?: string | null
          organization_id?: string
          phone?: string | null
          status?: string | null
          team_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          attachments: Json | null
          attending_count: number | null
          branch_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          event_date: string | null
          event_type: string | null
          id: string
          is_pinned: boolean | null
          organization_id: string | null
          title: string
          updated_at: string | null
          views_count: number | null
          visibility: string | null
        }
        Insert: {
          attachments?: Json | null
          attending_count?: number | null
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          event_date?: string | null
          event_type?: string | null
          id?: string
          is_pinned?: boolean | null
          organization_id?: string | null
          title: string
          updated_at?: string | null
          views_count?: number | null
          visibility?: string | null
        }
        Update: {
          attachments?: Json | null
          attending_count?: number | null
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          event_date?: string | null
          event_type?: string | null
          id?: string
          is_pinned?: boolean | null
          organization_id?: string | null
          title?: string
          updated_at?: string | null
          views_count?: number | null
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      folders: {
        Row: {
          access_level: string | null
          branch_id: string | null
          created_at: string | null
          created_by: string | null
          employee_id: string | null
          folder_type: string | null
          id: string
          name: string
          organization_id: string | null
          parent_id: string | null
          path: string
          updated_at: string | null
        }
        Insert: {
          access_level?: string | null
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          employee_id?: string | null
          folder_type?: string | null
          id?: string
          name: string
          organization_id?: string | null
          parent_id?: string | null
          path: string
          updated_at?: string | null
        }
        Update: {
          access_level?: string | null
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          employee_id?: string | null
          folder_type?: string | null
          id?: string
          name?: string
          organization_id?: string | null
          parent_id?: string | null
          path?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "folders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folders_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      hazard_reports: {
        Row: {
          assigned_to: string | null
          branch_id: string
          created_at: string | null
          description: string | null
          id: string
          images: Json | null
          location_details: string | null
          organization_id: string
          priority: string | null
          reported_by: string
          resolution_notes: string | null
          resolved_at: string | null
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          branch_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          images?: Json | null
          location_details?: string | null
          organization_id: string
          priority?: string | null
          reported_by: string
          resolution_notes?: string | null
          resolved_at?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          branch_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          images?: Json | null
          location_details?: string | null
          organization_id?: string
          priority?: string | null
          reported_by?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hazard_reports_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hazard_reports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          branch_id: string
          closed_at: string | null
          closed_by: string | null
          corrective_actions: string | null
          created_at: string | null
          description: string | null
          id: string
          images: Json | null
          incident_date: string
          incident_type: string
          injury_type: string | null
          investigated_by: string | null
          location_details: string | null
          medical_documents: Json | null
          organization_id: string
          reported_by: string
          root_cause: string | null
          status: string | null
          title: string
          updated_at: string | null
          victim_employee_id: string | null
          victim_name: string | null
          witness_statements: string | null
        }
        Insert: {
          branch_id: string
          closed_at?: string | null
          closed_by?: string | null
          corrective_actions?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          images?: Json | null
          incident_date: string
          incident_type: string
          injury_type?: string | null
          investigated_by?: string | null
          location_details?: string | null
          medical_documents?: Json | null
          organization_id: string
          reported_by: string
          root_cause?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
          victim_employee_id?: string | null
          victim_name?: string | null
          witness_statements?: string | null
        }
        Update: {
          branch_id?: string
          closed_at?: string | null
          closed_by?: string | null
          corrective_actions?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          images?: Json | null
          incident_date?: string
          incident_type?: string
          injury_type?: string | null
          investigated_by?: string | null
          location_details?: string | null
          medical_documents?: Json | null
          organization_id?: string
          reported_by?: string
          root_cause?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
          victim_employee_id?: string | null
          victim_name?: string | null
          witness_statements?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incidents_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_victim_employee_id_fkey"
            columns: ["victim_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          employee_id: string
          end_date: string
          id: string
          leave_type_id: string
          reason: string | null
          start_date: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          employee_id: string
          end_date: string
          id?: string
          leave_type_id: string
          reason?: string | null
          start_date: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          employee_id?: string
          end_date?: string
          id?: string
          leave_type_id?: string
          reason?: string | null
          start_date?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_types: {
        Row: {
          created_at: string | null
          created_by: string | null
          days_allowed: number | null
          description: string | null
          id: string
          is_paid: boolean | null
          name: string
          organization_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          days_allowed?: number | null
          description?: string | null
          id?: string
          is_paid?: boolean | null
          name: string
          organization_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          days_allowed?: number | null
          description?: string | null
          id?: string
          is_paid?: boolean | null
          name?: string
          organization_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leave_types_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address: string | null
          branch_id: string
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          latitude: number
          longitude: number
          name: string
          qr_code: string | null
          qr_enabled: boolean | null
          radius: number | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          branch_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          latitude: number
          longitude: number
          name: string
          qr_code?: string | null
          qr_enabled?: boolean | null
          radius?: number | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          branch_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          latitude?: number
          longitude?: number
          name?: string
          qr_code?: string | null
          qr_enabled?: boolean | null
          radius?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "locations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_tickets: {
        Row: {
          assigned_to: string | null
          branch_id: string
          created_at: string | null
          description: string | null
          id: string
          images: Json | null
          organization_id: string
          priority: string | null
          reported_by: string
          resolved_at: string | null
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          branch_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          images?: Json | null
          organization_id: string
          priority?: string | null
          reported_by: string
          resolved_at?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          branch_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          images?: Json | null
          organization_id?: string
          priority?: string | null
          reported_by?: string
          resolved_at?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_tickets_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tickets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      method_statements: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          branch_id: string
          created_at: string | null
          created_by: string | null
          equipment: string[] | null
          id: string
          manual_file_path: string | null
          organization_id: string
          ppe_required: string[] | null
          responsibilities: string | null
          status: string | null
          steps: Json | null
          title: string
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          branch_id: string
          created_at?: string | null
          created_by?: string | null
          equipment?: string[] | null
          id?: string
          manual_file_path?: string | null
          organization_id: string
          ppe_required?: string[] | null
          responsibilities?: string | null
          status?: string | null
          steps?: Json | null
          title: string
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string
          created_at?: string | null
          created_by?: string | null
          equipment?: string[] | null
          id?: string
          manual_file_path?: string | null
          organization_id?: string
          ppe_required?: string[] | null
          responsibilities?: string | null
          status?: string | null
          steps?: Json | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "method_statements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "method_statements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          auto_create_folder: boolean | null
          created_at: string | null
          created_by: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          auto_create_folder?: boolean | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          auto_create_folder?: boolean | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      payroll_records: {
        Row: {
          basic_salary: number | null
          created_at: string | null
          employee_id: string
          generated_at: string | null
          generated_by: string | null
          id: string
          month: string
          net_salary: number | null
          salary_slip_path: string | null
          total_allowances: number | null
          total_deductions: number | null
          updated_at: string | null
        }
        Insert: {
          basic_salary?: number | null
          created_at?: string | null
          employee_id: string
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          month: string
          net_salary?: number | null
          salary_slip_path?: string | null
          total_allowances?: number | null
          total_deductions?: number | null
          updated_at?: string | null
        }
        Update: {
          basic_salary?: number | null
          created_at?: string | null
          employee_id?: string
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          month?: string
          net_salary?: number | null
          salary_slip_path?: string | null
          total_allowances?: number | null
          total_deductions?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_criteria: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
          weight: number | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
          weight?: number | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
          weight?: number | null
        }
        Relationships: []
      }
      performance_reviews: {
        Row: {
          created_at: string | null
          employee_id: string
          feedback: string | null
          goals: string | null
          goals_progress: number | null
          id: string
          overall_rating: number | null
          ratings: Json | null
          review_period_end: string | null
          review_period_start: string | null
          reviewer_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          employee_id: string
          feedback?: string | null
          goals?: string | null
          goals_progress?: number | null
          id?: string
          overall_rating?: number | null
          ratings?: Json | null
          review_period_end?: string | null
          review_period_start?: string | null
          reviewer_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          employee_id?: string
          feedback?: string | null
          goals?: string | null
          goals_progress?: number | null
          id?: string
          overall_rating?: number | null
          ratings?: Json | null
          review_period_end?: string | null
          review_period_start?: string | null
          reviewer_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "performance_reviews_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          branch_id: string | null
          created_at: string
          email: string
          hr_access_level: Database["public"]["Enums"]["hr_access_level"] | null
          id: string
          name: string
          organization_id: string | null
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          email: string
          hr_access_level?:
            | Database["public"]["Enums"]["hr_access_level"]
            | null
          id: string
          name: string
          organization_id?: string | null
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          email?: string
          hr_access_level?:
            | Database["public"]["Enums"]["hr_access_level"]
            | null
          id?: string
          name?: string
          organization_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_profiles_branch"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_profiles_organization"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      right_to_work_checks: {
        Row: {
          check_date: string | null
          checked_by: string | null
          created_at: string | null
          document_name: string | null
          document_path: string | null
          employee_id: string
          expiry_date: string | null
          gov_portal_link: string | null
          id: string
          notes: string | null
          share_code: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          check_date?: string | null
          checked_by?: string | null
          created_at?: string | null
          document_name?: string | null
          document_path?: string | null
          employee_id: string
          expiry_date?: string | null
          gov_portal_link?: string | null
          id?: string
          notes?: string | null
          share_code?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          check_date?: string | null
          checked_by?: string | null
          created_at?: string | null
          document_name?: string | null
          document_path?: string | null
          employee_id?: string
          expiry_date?: string | null
          gov_portal_link?: string | null
          id?: string
          notes?: string | null
          share_code?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "right_to_work_checks_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_assessments: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          branch_id: string
          control_measures: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          evidence_files: Json | null
          hazard_description: string | null
          id: string
          organization_id: string
          responsible_person_id: string | null
          review_date: string | null
          risk_level: string | null
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          branch_id: string
          control_measures?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          evidence_files?: Json | null
          hazard_description?: string | null
          id?: string
          organization_id: string
          responsible_person_id?: string | null
          review_date?: string | null
          risk_level?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string
          control_measures?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          evidence_files?: Json | null
          hazard_description?: string | null
          id?: string
          organization_id?: string
          responsible_person_id?: string | null
          review_date?: string | null
          risk_level?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "risk_assessments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_assessments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      rota_shifts: {
        Row: {
          break_duration: number | null
          created_at: string | null
          employee_id: string
          end_time: string
          id: string
          notes: string | null
          rota_id: string
          shift_date: string
          start_time: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          break_duration?: number | null
          created_at?: string | null
          employee_id: string
          end_time: string
          id?: string
          notes?: string | null
          rota_id: string
          shift_date: string
          start_time: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          break_duration?: number | null
          created_at?: string | null
          employee_id?: string
          end_time?: string
          id?: string
          notes?: string | null
          rota_id?: string
          shift_date?: string
          start_time?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rota_shifts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rota_shifts_rota_id_fkey"
            columns: ["rota_id"]
            isOneToOne: false
            referencedRelation: "rotas"
            referencedColumns: ["id"]
          },
        ]
      }
      rotas: {
        Row: {
          branch_id: string
          created_at: string | null
          created_by: string | null
          end_date: string
          id: string
          name: string
          notes: string | null
          organization_id: string
          start_date: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          branch_id: string
          created_at?: string | null
          created_by?: string | null
          end_date: string
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          start_date: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          branch_id?: string
          created_at?: string | null
          created_by?: string | null
          end_date?: string
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          start_date?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rotas_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rotas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_tasks: {
        Row: {
          assigned_by: string | null
          assigned_to: string
          branch_id: string
          completed_at: string | null
          created_at: string | null
          description: string | null
          due_date: string | null
          id: string
          organization_id: string
          related_hazard_id: string | null
          related_incident_id: string | null
          related_risk_assessment_id: string | null
          status: string | null
          task_type: string | null
          title: string
          updated_at: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          assigned_by?: string | null
          assigned_to: string
          branch_id: string
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          organization_id: string
          related_hazard_id?: string | null
          related_incident_id?: string | null
          related_risk_assessment_id?: string | null
          status?: string | null
          task_type?: string | null
          title: string
          updated_at?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          assigned_by?: string | null
          assigned_to?: string
          branch_id?: string
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          organization_id?: string
          related_hazard_id?: string | null
          related_incident_id?: string | null
          related_risk_assessment_id?: string | null
          status?: string | null
          task_type?: string | null
          title?: string
          updated_at?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "safety_tasks_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_tasks_related_hazard_id_fkey"
            columns: ["related_hazard_id"]
            isOneToOne: false
            referencedRelation: "hazard_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_tasks_related_incident_id_fkey"
            columns: ["related_incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_tasks_related_risk_assessment_id_fkey"
            columns: ["related_risk_assessment_id"]
            isOneToOne: false
            referencedRelation: "risk_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_structures: {
        Row: {
          basic_salary: number | null
          created_at: string | null
          created_by: string | null
          employee_id: string
          hra: number | null
          id: string
          late_fine: number | null
          other_allowances: number | null
          salary_advance: number | null
          travel_allowance: number | null
          unpaid_leave_days: number | null
          updated_at: string | null
        }
        Insert: {
          basic_salary?: number | null
          created_at?: string | null
          created_by?: string | null
          employee_id: string
          hra?: number | null
          id?: string
          late_fine?: number | null
          other_allowances?: number | null
          salary_advance?: number | null
          travel_allowance?: number | null
          unpaid_leave_days?: number | null
          updated_at?: string | null
        }
        Update: {
          basic_salary?: number | null
          created_at?: string | null
          created_by?: string | null
          employee_id?: string
          hra?: number | null
          id?: string
          late_fine?: number | null
          other_allowances?: number | null
          salary_advance?: number | null
          travel_allowance?: number | null
          unpaid_leave_days?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "salary_structures_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          branch_id: string
          created_at: string | null
          created_by: string | null
          id: string
          name: string
          team_leader_id: string | null
          updated_at: string | null
        }
        Insert: {
          branch_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          name: string
          team_leader_id?: string | null
          updated_at?: string | null
        }
        Update: {
          branch_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          name?: string
          team_leader_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      training_assignments: {
        Row: {
          assigned_by: string | null
          assigned_to: string
          completed_at: string | null
          created_at: string | null
          id: string
          started_at: string | null
          status: string | null
          training_id: string
          updated_at: string | null
        }
        Insert: {
          assigned_by?: string | null
          assigned_to: string
          completed_at?: string | null
          created_at?: string | null
          id?: string
          started_at?: string | null
          status?: string | null
          training_id: string
          updated_at?: string | null
        }
        Update: {
          assigned_by?: string | null
          assigned_to?: string
          completed_at?: string | null
          created_at?: string | null
          id?: string
          started_at?: string | null
          status?: string | null
          training_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "training_assignments_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "trainings"
            referencedColumns: ["id"]
          },
        ]
      }
      trainings: {
        Row: {
          branch_id: string | null
          created_at: string | null
          created_by: string | null
          deadline: string | null
          description: string | null
          document_name: string | null
          document_path: string | null
          id: string
          organization_id: string | null
          tags: string[] | null
          title: string
          training_date: string | null
          updated_at: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deadline?: string | null
          description?: string | null
          document_name?: string | null
          document_path?: string | null
          id?: string
          organization_id?: string | null
          tags?: string[] | null
          title: string
          training_date?: string | null
          updated_at?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deadline?: string | null
          description?: string | null
          document_name?: string | null
          document_path?: string | null
          id?: string
          organization_id?: string | null
          tags?: string[] | null
          title?: string
          training_date?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trainings_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "super_admin" | "hr" | "manager" | "employee"
      hr_access_level: "full" | "organization" | "branch"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["super_admin", "hr", "manager", "employee"],
      hr_access_level: ["full", "organization", "branch"],
    },
  },
} as const
