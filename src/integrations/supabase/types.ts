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
      absence_records: {
        Row: {
          absence_type: string
          created_at: string | null
          created_by: string | null
          days_count: number
          employee_id: string | null
          end_date: string
          id: string
          is_ssp_applicable: boolean | null
          notes: string | null
          reason: string | null
          return_to_work_by: string | null
          return_to_work_completed: boolean | null
          return_to_work_date: string | null
          ssp_record_id: string | null
          start_date: string
          updated_at: string | null
        }
        Insert: {
          absence_type: string
          created_at?: string | null
          created_by?: string | null
          days_count: number
          employee_id?: string | null
          end_date: string
          id?: string
          is_ssp_applicable?: boolean | null
          notes?: string | null
          reason?: string | null
          return_to_work_by?: string | null
          return_to_work_completed?: boolean | null
          return_to_work_date?: string | null
          ssp_record_id?: string | null
          start_date: string
          updated_at?: string | null
        }
        Update: {
          absence_type?: string
          created_at?: string | null
          created_by?: string | null
          days_count?: number
          employee_id?: string | null
          end_date?: string
          id?: string
          is_ssp_applicable?: boolean | null
          notes?: string | null
          reason?: string | null
          return_to_work_by?: string | null
          return_to_work_completed?: boolean | null
          return_to_work_date?: string | null
          ssp_record_id?: string | null
          start_date?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "absence_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absence_records_ssp_record_id_fkey"
            columns: ["ssp_record_id"]
            isOneToOne: false
            referencedRelation: "ssp_records"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_logs: {
        Row: {
          activity_category: string
          activity_type: string
          branch_id: string | null
          created_at: string
          description: string | null
          id: string
          is_read: boolean | null
          metadata: Json | null
          organization_id: string | null
          title: string
          user_id: string
          user_name: string
          user_role: string | null
        }
        Insert: {
          activity_category: string
          activity_type: string
          branch_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_read?: boolean | null
          metadata?: Json | null
          organization_id?: string | null
          title: string
          user_id: string
          user_name: string
          user_role?: string | null
        }
        Update: {
          activity_category?: string
          activity_type?: string
          branch_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_read?: boolean | null
          metadata?: Json | null
          organization_id?: string | null
          title?: string
          user_id?: string
          user_name?: string
          user_role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_attempts: {
        Row: {
          answers: Json | null
          assessment_id: string
          completed_at: string | null
          created_at: string | null
          employee_id: string
          id: string
          passed: boolean | null
          score: number
          started_at: string | null
          total_points: number
        }
        Insert: {
          answers?: Json | null
          assessment_id: string
          completed_at?: string | null
          created_at?: string | null
          employee_id: string
          id?: string
          passed?: boolean | null
          score?: number
          started_at?: string | null
          total_points?: number
        }
        Update: {
          answers?: Json | null
          assessment_id?: string
          completed_at?: string | null
          created_at?: string | null
          employee_id?: string
          id?: string
          passed?: boolean | null
          score?: number
          started_at?: string | null
          total_points?: number
        }
        Relationships: [
          {
            foreignKeyName: "assessment_attempts_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "course_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_attempts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_questions: {
        Row: {
          assessment_id: string
          correct_answer: Json
          created_at: string | null
          explanation: string | null
          id: string
          options: Json | null
          points: number | null
          question_text: string
          question_type: string
          sort_order: number | null
        }
        Insert: {
          assessment_id: string
          correct_answer: Json
          created_at?: string | null
          explanation?: string | null
          id?: string
          options?: Json | null
          points?: number | null
          question_text: string
          question_type?: string
          sort_order?: number | null
        }
        Update: {
          assessment_id?: string
          correct_answer?: Json
          created_at?: string | null
          explanation?: string | null
          id?: string
          options?: Json | null
          points?: number | null
          question_text?: string
          question_type?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assessment_questions_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "course_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      bradford_thresholds: {
        Row: {
          action_required: string
          color: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          organization_id: string | null
          threshold_score: number
          updated_at: string | null
        }
        Insert: {
          action_required: string
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          organization_id?: string | null
          threshold_score: number
          updated_at?: string | null
        }
        Update: {
          action_required?: string
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          organization_id?: string | null
          threshold_score?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bradford_thresholds_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      branch_weekly_hour_targets: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string | null
          high_threshold_hours: number
          id: string
          low_threshold_hours: number
          notes: string | null
          organization_id: string
          target_hours: number
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by?: string | null
          high_threshold_hours?: number
          id?: string
          low_threshold_hours?: number
          notes?: string | null
          organization_id: string
          target_hours?: number
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string | null
          high_threshold_hours?: number
          id?: string
          low_threshold_hours?: number
          notes?: string | null
          organization_id?: string
          target_hours?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branch_weekly_hour_targets_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: true
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branch_weekly_hour_targets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string | null
          created_at: string | null
          created_by: string | null
          geofence_radius: number | null
          id: string
          import_format: string | null
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
          import_format?: string | null
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
          import_format?: string | null
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
      brand_settings: {
        Row: {
          accent_color: string | null
          brand_colors: Json | null
          created_at: string | null
          created_by: string | null
          fonts: Json | null
          id: string
          organization_id: string | null
          primary_color: string | null
          primary_logo_path: string | null
          secondary_color: string | null
          secondary_logo_path: string | null
          updated_at: string | null
        }
        Insert: {
          accent_color?: string | null
          brand_colors?: Json | null
          created_at?: string | null
          created_by?: string | null
          fonts?: Json | null
          id?: string
          organization_id?: string | null
          primary_color?: string | null
          primary_logo_path?: string | null
          secondary_color?: string | null
          secondary_logo_path?: string | null
          updated_at?: string | null
        }
        Update: {
          accent_color?: string | null
          brand_colors?: Json | null
          created_at?: string | null
          created_by?: string | null
          fonts?: Json | null
          id?: string
          organization_id?: string | null
          primary_color?: string | null
          primary_logo_path?: string | null
          secondary_color?: string | null
          secondary_logo_path?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bulk_upload_document_settings: {
        Row: {
          branch_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          doc_order: number
          enabled: boolean
          id: string
          is_mandatory: boolean
          name: string
          organization_id: string | null
          updated_at: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          doc_order?: number
          enabled?: boolean
          id?: string
          is_mandatory?: boolean
          name: string
          organization_id?: string | null
          updated_at?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          doc_order?: number
          enabled?: boolean
          id?: string
          is_mandatory?: boolean
          name?: string
          organization_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bulk_upload_document_settings_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulk_upload_document_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bulk_uploads: {
        Row: {
          branch_id: string | null
          created_at: string | null
          error_log: Json | null
          failed_records: number | null
          file_name: string
          id: string
          organization_id: string | null
          processed_records: number | null
          status: string | null
          total_records: number | null
          updated_at: string | null
          uploaded_by: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          error_log?: Json | null
          failed_records?: number | null
          file_name: string
          id?: string
          organization_id?: string | null
          processed_records?: number | null
          status?: string | null
          total_records?: number | null
          updated_at?: string | null
          uploaded_by: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          error_log?: Json | null
          failed_records?: number | null
          file_name?: string
          id?: string
          organization_id?: string | null
          processed_records?: number | null
          status?: string | null
          total_records?: number | null
          updated_at?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "bulk_uploads_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulk_uploads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      certificate_designs: {
        Row: {
          accent_color: string
          background_color: string
          border_color: string
          border_style: string
          created_at: string
          created_by: string | null
          custom_footer_text: string | null
          font_family: string
          id: string
          is_default: boolean
          name: string
          organization_id: string | null
          show_logo: boolean
          show_signature: boolean
          signature_name: string | null
          signature_title: string | null
          text_color: string
          updated_at: string
        }
        Insert: {
          accent_color?: string
          background_color?: string
          border_color?: string
          border_style?: string
          created_at?: string
          created_by?: string | null
          custom_footer_text?: string | null
          font_family?: string
          id?: string
          is_default?: boolean
          name?: string
          organization_id?: string | null
          show_logo?: boolean
          show_signature?: boolean
          signature_name?: string | null
          signature_title?: string | null
          text_color?: string
          updated_at?: string
        }
        Update: {
          accent_color?: string
          background_color?: string
          border_color?: string
          border_style?: string
          created_at?: string
          created_by?: string | null
          custom_footer_text?: string | null
          font_family?: string
          id?: string
          is_default?: boolean
          name?: string
          organization_id?: string | null
          show_logo?: boolean
          show_signature?: boolean
          signature_name?: string | null
          signature_title?: string | null
          text_color?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificate_designs_organization_id_fkey"
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
          contract_content: Json | null
          contract_file_name: string | null
          contract_file_path: string | null
          created_at: string | null
          employee_id: string
          employer_signature: string | null
          employer_signature_type: string | null
          employer_signed_date: string | null
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
          contract_content?: Json | null
          contract_file_name?: string | null
          contract_file_path?: string | null
          created_at?: string | null
          employee_id: string
          employer_signature?: string | null
          employer_signature_type?: string | null
          employer_signed_date?: string | null
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
          contract_content?: Json | null
          contract_file_name?: string | null
          contract_file_path?: string | null
          created_at?: string | null
          employee_id?: string
          employer_signature?: string | null
          employer_signature_type?: string | null
          employer_signed_date?: string | null
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
      contract_branding: {
        Row: {
          created_at: string
          footer_template: string | null
          header_template: string | null
          id: string
          logo_path: string | null
          organization_id: string | null
          primary_color: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          footer_template?: string | null
          header_template?: string | null
          id?: string
          logo_path?: string | null
          organization_id?: string | null
          primary_color?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          footer_template?: string | null
          header_template?: string | null
          id?: string
          logo_path?: string | null
          organization_id?: string | null
          primary_color?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_branding_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_templates: {
        Row: {
          contract_type: string
          created_at: string
          created_by: string | null
          id: string
          is_default: boolean
          merge_fields: Json | null
          name: string
          organization_id: string | null
          template_file_path: string | null
          updated_at: string
        }
        Insert: {
          contract_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          merge_fields?: Json | null
          name: string
          organization_id?: string | null
          template_file_path?: string | null
          updated_at?: string
        }
        Update: {
          contract_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          merge_fields?: Json | null
          name?: string
          organization_id?: string | null
          template_file_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          id: string
          is_muted: boolean | null
          joined_at: string | null
          last_read_at: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          is_muted?: boolean | null
          joined_at?: string | null
          last_read_at?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          is_muted?: boolean | null
          joined_at?: string | null
          last_read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          branch_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          is_group: boolean | null
          name: string | null
          organization_id: string | null
          updated_at: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_group?: boolean | null
          name?: string | null
          organization_id?: string | null
          updated_at?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_group?: boolean | null
          name?: string | null
          organization_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      course_assessments: {
        Row: {
          course_id: string
          created_at: string | null
          id: string
          max_attempts: number | null
          passing_score: number | null
          time_limit_minutes: number | null
          title: string
          updated_at: string | null
        }
        Insert: {
          course_id: string
          created_at?: string | null
          id?: string
          max_attempts?: number | null
          passing_score?: number | null
          time_limit_minutes?: number | null
          title?: string
          updated_at?: string | null
        }
        Update: {
          course_id?: string
          created_at?: string | null
          id?: string
          max_attempts?: number | null
          passing_score?: number | null
          time_limit_minutes?: number | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_assessments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_assignments: {
        Row: {
          assign_all: boolean | null
          assigned_by: string | null
          assigned_to_branch_id: string | null
          assigned_to_department: string | null
          assigned_to_employee_id: string | null
          assigned_to_organization_id: string | null
          assigned_to_role: string | null
          course_id: string
          created_at: string | null
          due_date: string | null
          id: string
          is_mandatory: boolean | null
        }
        Insert: {
          assign_all?: boolean | null
          assigned_by?: string | null
          assigned_to_branch_id?: string | null
          assigned_to_department?: string | null
          assigned_to_employee_id?: string | null
          assigned_to_organization_id?: string | null
          assigned_to_role?: string | null
          course_id: string
          created_at?: string | null
          due_date?: string | null
          id?: string
          is_mandatory?: boolean | null
        }
        Update: {
          assign_all?: boolean | null
          assigned_by?: string | null
          assigned_to_branch_id?: string | null
          assigned_to_department?: string | null
          assigned_to_employee_id?: string | null
          assigned_to_organization_id?: string | null
          assigned_to_role?: string | null
          course_id?: string
          created_at?: string | null
          due_date?: string | null
          id?: string
          is_mandatory?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "course_assignments_assigned_to_branch_id_fkey"
            columns: ["assigned_to_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_assignments_assigned_to_employee_id_fkey"
            columns: ["assigned_to_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_assignments_assigned_to_organization_id_fkey"
            columns: ["assigned_to_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_assignments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_categories: {
        Row: {
          color: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      course_lessons: {
        Row: {
          content: Json | null
          created_at: string | null
          estimated_duration_minutes: number | null
          id: string
          module_id: string
          sort_order: number
          title: string
          updated_at: string | null
        }
        Insert: {
          content?: Json | null
          created_at?: string | null
          estimated_duration_minutes?: number | null
          id?: string
          module_id: string
          sort_order?: number
          title: string
          updated_at?: string | null
        }
        Update: {
          content?: Json | null
          created_at?: string | null
          estimated_duration_minutes?: number | null
          id?: string
          module_id?: string
          sort_order?: number
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "course_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      course_modules: {
        Row: {
          course_id: string
          created_at: string | null
          description: string | null
          id: string
          sort_order: number
          title: string
          updated_at: string | null
        }
        Insert: {
          course_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          sort_order?: number
          title: string
          updated_at?: string | null
        }
        Update: {
          course_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          sort_order?: number
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_progress: {
        Row: {
          completed_at: string | null
          course_id: string
          created_at: string | null
          employee_id: string
          id: string
          last_lesson_id: string | null
          progress_percentage: number | null
          started_at: string | null
          status: string
          total_time_minutes: number | null
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          course_id: string
          created_at?: string | null
          employee_id: string
          id?: string
          last_lesson_id?: string | null
          progress_percentage?: number | null
          started_at?: string | null
          status?: string
          total_time_minutes?: number | null
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          course_id?: string
          created_at?: string | null
          employee_id?: string
          id?: string
          last_lesson_id?: string | null
          progress_percentage?: number | null
          started_at?: string | null
          status?: string
          total_time_minutes?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_progress_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_progress_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_progress_last_lesson_id_fkey"
            columns: ["last_lesson_id"]
            isOneToOne: false
            referencedRelation: "course_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          branch_id: string | null
          category_id: string | null
          certificate_enabled: boolean | null
          created_at: string | null
          created_by: string | null
          description: string | null
          difficulty_level: string | null
          estimated_duration_minutes: number | null
          id: string
          organization_id: string | null
          passing_score: number | null
          status: string
          template_style: string
          thumbnail_path: string | null
          title: string
          updated_at: string | null
          xp_reward: number | null
        }
        Insert: {
          branch_id?: string | null
          category_id?: string | null
          certificate_enabled?: boolean | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          difficulty_level?: string | null
          estimated_duration_minutes?: number | null
          id?: string
          organization_id?: string | null
          passing_score?: number | null
          status?: string
          template_style?: string
          thumbnail_path?: string | null
          title: string
          updated_at?: string | null
          xp_reward?: number | null
        }
        Update: {
          branch_id?: string | null
          category_id?: string | null
          certificate_enabled?: boolean | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          difficulty_level?: string | null
          estimated_duration_minutes?: number | null
          id?: string
          organization_id?: string | null
          passing_score?: number | null
          status?: string
          template_style?: string
          thumbnail_path?: string | null
          title?: string
          updated_at?: string | null
          xp_reward?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "courses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "course_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_roles: {
        Row: {
          app_access: Json
          base_role: string
          branch_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          organization_id: string | null
          permissions: Json
          updated_at: string | null
        }
        Insert: {
          app_access?: Json
          base_role: string
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          organization_id?: string | null
          permissions?: Json
          updated_at?: string | null
        }
        Update: {
          app_access?: Json
          base_role?: string
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string | null
          permissions?: Json
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_roles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_account_items: {
        Row: {
          amount: number
          created_at: string
          description: string
          discount: number | null
          id: string
          monthly_account_id: string
          purchased_date: string | null
          tax: number | null
        }
        Insert: {
          amount?: number
          created_at?: string
          description: string
          discount?: number | null
          id?: string
          monthly_account_id: string
          purchased_date?: string | null
          tax?: number | null
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          discount?: number | null
          id?: string
          monthly_account_id?: string
          purchased_date?: string | null
          tax?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_account_items_monthly_account_id_fkey"
            columns: ["monthly_account_id"]
            isOneToOne: false
            referencedRelation: "customer_monthly_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_accounts: {
        Row: {
          address: string | null
          branch_id: string
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          organization_id: string | null
          phone: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          branch_id: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          organization_id?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          branch_id?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_accounts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_monthly_accounts: {
        Row: {
          amount_paid: number
          branch_id: string
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          is_paid: boolean
          marked_paid_by: string | null
          month_date: string
          notes: string | null
          organization_id: string | null
          paid_date: string | null
          total_due: number
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          branch_id: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          is_paid?: boolean
          marked_paid_by?: string | null
          month_date: string
          notes?: string | null
          organization_id?: string | null
          paid_date?: string | null
          total_due?: number
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          branch_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          is_paid?: boolean
          marked_paid_by?: string | null
          month_date?: string
          notes?: string | null
          organization_id?: string | null
          paid_date?: string | null
          total_due?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_monthly_accounts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_monthly_accounts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_monthly_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_payments: {
        Row: {
          amount_paid: number
          created_at: string
          id: string
          monthly_account_id: string
          notes: string | null
          payment_date: string
          payment_method: string | null
          recorded_by: string | null
        }
        Insert: {
          amount_paid?: number
          created_at?: string
          id?: string
          monthly_account_id: string
          notes?: string | null
          payment_date?: string
          payment_method?: string | null
          recorded_by?: string | null
        }
        Update: {
          amount_paid?: number
          created_at?: string
          id?: string
          monthly_account_id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string | null
          recorded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_payments_monthly_account_id_fkey"
            columns: ["monthly_account_id"]
            isOneToOne: false
            referencedRelation: "customer_monthly_accounts"
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
          report_date: string | null
          report_month: string | null
          report_type: string | null
          submitted_at: string | null
          submitted_by: string
          title: string
          updated_at: string | null
          vendor_ids: Json
        }
        Insert: {
          branch_id: string
          created_at?: string | null
          files?: Json | null
          id?: string
          organization_id: string
          report_date?: string | null
          report_month?: string | null
          report_type?: string | null
          submitted_at?: string | null
          submitted_by: string
          title: string
          updated_at?: string | null
          vendor_ids?: Json
        }
        Update: {
          branch_id?: string
          created_at?: string | null
          files?: Json | null
          id?: string
          organization_id?: string
          report_date?: string | null
          report_month?: string | null
          report_type?: string | null
          submitted_at?: string | null
          submitted_by?: string
          title?: string
          updated_at?: string | null
          vendor_ids?: Json
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
      daily_sales_uploads: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          notes: string | null
          organization_id: string | null
          parsed_totals: Json
          raw_text: string | null
          sale_date: string
          source_filename: string
          source_format: string
          status: string
          storage_path: string | null
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          organization_id?: string | null
          parsed_totals?: Json
          raw_text?: string | null
          sale_date: string
          source_filename: string
          source_format?: string
          status?: string
          storage_path?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          organization_id?: string | null
          parsed_totals?: Json
          raw_text?: string | null
          sale_date?: string
          source_filename?: string
          source_format?: string
          status?: string
          storage_path?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_sales_uploads_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_sales_uploads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_summaries: {
        Row: {
          atm_loaded: number
          branch_id: string
          cash_deposit: number
          cash_sale: number
          created_at: string
          created_by: string | null
          customer_count: number
          fuel_sale: number
          fuel_volume: number
          id: string
          net_sale: number
          notes: string | null
          organization_id: string
          shop_sale: number
          store_paid_outs: number
          summary_date: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          atm_loaded?: number
          branch_id: string
          cash_deposit?: number
          cash_sale?: number
          created_at?: string
          created_by?: string | null
          customer_count?: number
          fuel_sale?: number
          fuel_volume?: number
          id?: string
          net_sale?: number
          notes?: string | null
          organization_id: string
          shop_sale?: number
          store_paid_outs?: number
          summary_date: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          atm_loaded?: number
          branch_id?: string
          cash_deposit?: number
          cash_sale?: number
          created_at?: string
          created_by?: string | null
          customer_count?: number
          fuel_sale?: number
          fuel_volume?: number
          id?: string
          net_sale?: number
          notes?: string | null
          organization_id?: string
          shop_sale?: number
          store_paid_outs?: number
          summary_date?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_summaries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_summaries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          branch_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          name: string
          organization_id: string | null
          updated_at: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          organization_id?: string | null
          updated_at?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "departments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      document_follow_up_settings: {
        Row: {
          created_at: string | null
          created_by: string | null
          follow_up_count: number
          follow_up_intervals: number[]
          id: string
          is_active: boolean | null
          organization_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          follow_up_count?: number
          follow_up_intervals?: number[]
          id?: string
          is_active?: boolean | null
          organization_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          follow_up_count?: number
          follow_up_intervals?: number[]
          id?: string
          is_active?: boolean | null
          organization_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_follow_up_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      document_requirements: {
        Row: {
          branch_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          doc_order: number
          enabled: boolean
          id: string
          is_locked: boolean
          is_mandatory: boolean
          name: string
          organization_id: string | null
          requires_esignature: boolean | null
          updated_at: string
          verification_message: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          doc_order?: number
          enabled?: boolean
          id?: string
          is_locked?: boolean
          is_mandatory?: boolean
          name: string
          organization_id?: string | null
          requires_esignature?: boolean | null
          updated_at?: string
          verification_message?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          doc_order?: number
          enabled?: boolean
          id?: string
          is_locked?: boolean
          is_mandatory?: boolean
          name?: string
          organization_id?: string | null
          requires_esignature?: boolean | null
          updated_at?: string
          verification_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_requirements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_requirements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      document_submissions: {
        Row: {
          branch_id: string
          created_at: string
          document_name: string
          employee_id: string
          expiry_date: string | null
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          notes: string | null
          organization_id: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_by: string
          submitted_by_name: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          document_name: string
          employee_id: string
          expiry_date?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_by: string
          submitted_by_name: string
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          document_name?: string
          employee_id?: string
          expiry_date?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_by?: string
          submitted_by_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_submissions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_submissions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_submissions_organization_id_fkey"
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
          verification_message: string | null
          verified_at: string | null
          verified_by_name: string | null
          verified_by_role: string | null
          verified_by_signature: string | null
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
          verification_message?: string | null
          verified_at?: string | null
          verified_by_name?: string | null
          verified_by_role?: string | null
          verified_by_signature?: string | null
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
          verification_message?: string | null
          verified_at?: string | null
          verified_by_name?: string | null
          verified_by_role?: string | null
          verified_by_signature?: string | null
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
      drive_offs: {
        Row: {
          amount_drive_off: number
          branch_id: string
          cashier_name: string
          closure_reason: string | null
          created_at: string
          created_by: string | null
          date_handed_to_guardian: string | null
          drive_off_date: string
          fuel_type: string
          head_office_notes: string | null
          id: string
          organization_id: string | null
          payment_received_date: string | null
          payment_till_1: number | null
          payment_till_2: number | null
          pump_number: number
          remarks: string | null
          supporting_files: Json | null
          till_1_amount: number | null
          till_2_amount: number | null
          till_3_amount: number | null
          till_4_amount: number | null
          till_5_amount: number | null
          total_amount_received: number | null
          total_liters: number
          tracking_reference: string | null
          tracking_status: string | null
          updated_at: string
          vehicle_model: string | null
          vehicle_registration: string
        }
        Insert: {
          amount_drive_off: number
          branch_id: string
          cashier_name: string
          closure_reason?: string | null
          created_at?: string
          created_by?: string | null
          date_handed_to_guardian?: string | null
          drive_off_date: string
          fuel_type: string
          head_office_notes?: string | null
          id?: string
          organization_id?: string | null
          payment_received_date?: string | null
          payment_till_1?: number | null
          payment_till_2?: number | null
          pump_number: number
          remarks?: string | null
          supporting_files?: Json | null
          till_1_amount?: number | null
          till_2_amount?: number | null
          till_3_amount?: number | null
          till_4_amount?: number | null
          till_5_amount?: number | null
          total_amount_received?: number | null
          total_liters: number
          tracking_reference?: string | null
          tracking_status?: string | null
          updated_at?: string
          vehicle_model?: string | null
          vehicle_registration: string
        }
        Update: {
          amount_drive_off?: number
          branch_id?: string
          cashier_name?: string
          closure_reason?: string | null
          created_at?: string
          created_by?: string | null
          date_handed_to_guardian?: string | null
          drive_off_date?: string
          fuel_type?: string
          head_office_notes?: string | null
          id?: string
          organization_id?: string | null
          payment_received_date?: string | null
          payment_till_1?: number | null
          payment_till_2?: number | null
          pump_number?: number
          remarks?: string | null
          supporting_files?: Json | null
          till_1_amount?: number | null
          till_2_amount?: number | null
          till_3_amount?: number | null
          till_4_amount?: number | null
          till_5_amount?: number | null
          total_amount_received?: number | null
          total_liters?: number
          tracking_reference?: string | null
          tracking_status?: string | null
          updated_at?: string
          vehicle_model?: string | null
          vehicle_registration?: string
        }
        Relationships: [
          {
            foreignKeyName: "drive_offs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drive_offs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      elearning_certificates: {
        Row: {
          certificate_number: string
          course_id: string
          course_title: string | null
          created_at: string | null
          design_id: string | null
          employee_id: string
          employee_name: string | null
          id: string
          issued_at: string | null
          pdf_path: string | null
          verification_token: string | null
        }
        Insert: {
          certificate_number: string
          course_id: string
          course_title?: string | null
          created_at?: string | null
          design_id?: string | null
          employee_id: string
          employee_name?: string | null
          id?: string
          issued_at?: string | null
          pdf_path?: string | null
          verification_token?: string | null
        }
        Update: {
          certificate_number?: string
          course_id?: string
          course_title?: string | null
          created_at?: string | null
          design_id?: string | null
          employee_id?: string
          employee_name?: string | null
          id?: string
          issued_at?: string | null
          pdf_path?: string | null
          verification_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "elearning_certificates_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "elearning_certificates_design_id_fkey"
            columns: ["design_id"]
            isOneToOne: false
            referencedRelation: "certificate_designs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "elearning_certificates_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_certifications: {
        Row: {
          awarded_by: string | null
          certification_name: string
          created_at: string
          employee_id: string
          gold_coins: number
          id: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          awarded_by?: string | null
          certification_name: string
          created_at?: string
          employee_id: string
          gold_coins?: number
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          awarded_by?: string | null
          certification_name?: string
          created_at?: string
          employee_id?: string
          gold_coins?: number
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_certifications_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_contracts: {
        Row: {
          contract_type: string
          created_at: string | null
          created_by: string | null
          effective_from: string
          effective_to: string | null
          employee_id: string
          holiday_entitlement_days: number
          holiday_year_start: string
          id: string
          updated_at: string | null
          weekly_contracted_hours: number
        }
        Insert: {
          contract_type?: string
          created_at?: string | null
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          employee_id: string
          holiday_entitlement_days?: number
          holiday_year_start?: string
          id?: string
          updated_at?: string | null
          weekly_contracted_hours?: number
        }
        Update: {
          contract_type?: string
          created_at?: string | null
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          employee_id?: string
          holiday_entitlement_days?: number
          holiday_year_start?: string
          id?: string
          updated_at?: string | null
          weekly_contracted_hours?: number
        }
        Relationships: [
          {
            foreignKeyName: "employee_contracts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_learning_stats: {
        Row: {
          average_score: number | null
          certificates_earned: number | null
          courses_completed: number | null
          employee_id: string
          id: string
          star_tier: string | null
          total_learning_hours: number | null
          updated_at: string | null
        }
        Insert: {
          average_score?: number | null
          certificates_earned?: number | null
          courses_completed?: number | null
          employee_id: string
          id?: string
          star_tier?: string | null
          total_learning_hours?: number | null
          updated_at?: string | null
        }
        Update: {
          average_score?: number | null
          certificates_earned?: number | null
          courses_completed?: number | null
          employee_id?: string
          id?: string
          star_tier?: string | null
          total_learning_hours?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_learning_stats_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employees"
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
      employee_payroll_notes: {
        Row: {
          annum_per_hour: string | null
          created_at: string
          created_by: string | null
          employee_id: string
          id: string
          month_date: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          annum_per_hour?: string | null
          created_at?: string
          created_by?: string | null
          employee_id: string
          id?: string
          month_date: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          annum_per_hour?: string | null
          created_at?: string
          created_by?: string | null
          employee_id?: string
          id?: string
          month_date?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_payroll_notes_employee_id_fkey"
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
          bulk_upload_id: string | null
          created_at: string | null
          created_by: string | null
          date_of_birth: string | null
          deactivation_reason: string | null
          department: string | null
          email: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relationship: string | null
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
          bulk_upload_id?: string | null
          created_at?: string | null
          created_by?: string | null
          date_of_birth?: string | null
          deactivation_reason?: string | null
          department?: string | null
          email: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
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
          bulk_upload_id?: string | null
          created_at?: string | null
          created_by?: string | null
          date_of_birth?: string | null
          deactivation_reason?: string | null
          department?: string | null
          email?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
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
      financial_reports: {
        Row: {
          admin_costs: Json
          branch_id: string | null
          cost_of_sales: Json
          created_at: string
          created_by: string | null
          id: string
          name: string
          organization_id: string | null
          other_income: Json
          quarter: string
          revenue: Json
          store_name: string
          updated_at: string
        }
        Insert: {
          admin_costs?: Json
          branch_id?: string | null
          cost_of_sales?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          organization_id?: string | null
          other_income?: Json
          quarter: string
          revenue?: Json
          store_name: string
          updated_at?: string
        }
        Update: {
          admin_costs?: Json
          branch_id?: string | null
          cost_of_sales?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          organization_id?: string | null
          other_income?: Json
          quarter?: string
          revenue?: Json
          store_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_reports_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_reports_organization_id_fkey"
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
          color: string | null
          created_at: string | null
          created_by: string | null
          employee_id: string | null
          folder_type: string | null
          id: string
          is_deletable: boolean | null
          is_system: boolean | null
          name: string
          organization_id: string | null
          parent_id: string | null
          path: string
          show_in_safety: boolean | null
          updated_at: string | null
        }
        Insert: {
          access_level?: string | null
          branch_id?: string | null
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          employee_id?: string | null
          folder_type?: string | null
          id?: string
          is_deletable?: boolean | null
          is_system?: boolean | null
          name: string
          organization_id?: string | null
          parent_id?: string | null
          path: string
          show_in_safety?: boolean | null
          updated_at?: string | null
        }
        Update: {
          access_level?: string | null
          branch_id?: string | null
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          employee_id?: string | null
          folder_type?: string | null
          id?: string
          is_deletable?: boolean | null
          is_system?: boolean | null
          name?: string
          organization_id?: string | null
          parent_id?: string | null
          path?: string
          show_in_safety?: boolean | null
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
      gdpr_consent_records: {
        Row: {
          consent_date: string | null
          consent_given: boolean
          consent_type: string
          created_at: string | null
          employee_id: string | null
          id: string
          ip_address: string | null
          notes: string | null
          updated_at: string | null
          withdrawal_date: string | null
        }
        Insert: {
          consent_date?: string | null
          consent_given?: boolean
          consent_type: string
          created_at?: string | null
          employee_id?: string | null
          id?: string
          ip_address?: string | null
          notes?: string | null
          updated_at?: string | null
          withdrawal_date?: string | null
        }
        Update: {
          consent_date?: string | null
          consent_given?: boolean
          consent_type?: string
          created_at?: string | null
          employee_id?: string | null
          id?: string
          ip_address?: string | null
          notes?: string | null
          updated_at?: string | null
          withdrawal_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gdpr_consent_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      gdpr_data_requests: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          due_date: string | null
          employee_id: string | null
          id: string
          notes: string | null
          organization_id: string | null
          rejection_reason: string | null
          request_type: string
          requester_email: string
          requester_name: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          due_date?: string | null
          employee_id?: string | null
          id?: string
          notes?: string | null
          organization_id?: string | null
          rejection_reason?: string | null
          request_type: string
          requester_email: string
          requester_name: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          due_date?: string | null
          employee_id?: string | null
          id?: string
          notes?: string | null
          organization_id?: string | null
          rejection_reason?: string | null
          request_type?: string
          requester_email?: string
          requester_name?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gdpr_data_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gdpr_data_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      gdpr_retention_policies: {
        Row: {
          created_at: string | null
          created_by: string | null
          data_category: string
          description: string | null
          id: string
          is_active: boolean | null
          legal_basis: string | null
          organization_id: string | null
          retention_period_months: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          data_category: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          legal_basis?: string | null
          organization_id?: string | null
          retention_period_months?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          data_category?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          legal_basis?: string | null
          organization_id?: string | null
          retention_period_months?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gdpr_retention_policies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      gift_cards: {
        Row: {
          card_type: string
          code: string
          created_at: string | null
          created_by: string | null
          description: string | null
          design_template: Json | null
          discount: string
          id: string
          is_active: boolean | null
          organization_id: string | null
          title: string
          updated_at: string | null
          valid_date: string | null
        }
        Insert: {
          card_type?: string
          code: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          design_template?: Json | null
          discount: string
          id?: string
          is_active?: boolean | null
          organization_id?: string | null
          title: string
          updated_at?: string | null
          valid_date?: string | null
        }
        Update: {
          card_type?: string
          code?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          design_template?: Json | null
          discount?: string
          id?: string
          is_active?: boolean | null
          organization_id?: string | null
          title?: string
          updated_at?: string | null
          valid_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gift_cards_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          reported_by: string | null
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
          reported_by?: string | null
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
          reported_by?: string | null
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
      holiday_balances: {
        Row: {
          carry_forward_hours: number | null
          created_at: string | null
          employee_id: string
          holiday_entitlement_days: number
          holiday_hours_earned: number | null
          holiday_hours_remaining: number | null
          holiday_hours_taken: number | null
          holiday_year_end: string
          holiday_year_start: string
          hours_per_day: number | null
          id: string
          last_calculated_at: string | null
          total_holiday_hours_per_year: number | null
          total_worked_hours: number | null
          updated_at: string | null
          weekly_contracted_hours: number
          weeks_worked: number | null
        }
        Insert: {
          carry_forward_hours?: number | null
          created_at?: string | null
          employee_id: string
          holiday_entitlement_days: number
          holiday_hours_earned?: number | null
          holiday_hours_remaining?: number | null
          holiday_hours_taken?: number | null
          holiday_year_end: string
          holiday_year_start: string
          hours_per_day?: number | null
          id?: string
          last_calculated_at?: string | null
          total_holiday_hours_per_year?: number | null
          total_worked_hours?: number | null
          updated_at?: string | null
          weekly_contracted_hours: number
          weeks_worked?: number | null
        }
        Update: {
          carry_forward_hours?: number | null
          created_at?: string | null
          employee_id?: string
          holiday_entitlement_days?: number
          holiday_hours_earned?: number | null
          holiday_hours_remaining?: number | null
          holiday_hours_taken?: number | null
          holiday_year_end?: string
          holiday_year_start?: string
          hours_per_day?: number | null
          id?: string
          last_calculated_at?: string | null
          total_holiday_hours_per_year?: number | null
          total_worked_hours?: number | null
          updated_at?: string | null
          weekly_contracted_hours?: number
          weeks_worked?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "holiday_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
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
      learning_settings: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          learning_mode: string
          organization_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          learning_mode?: string
          organization_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          learning_mode?: string
          organization_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "learning_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
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
          last_modified_by: string | null
          leave_type_id: string
          modification_reason: string | null
          reason: string | null
          requires_reapproval: boolean
          start_date: string
          status: string | null
          supporting_document_name: string | null
          supporting_document_path: string | null
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          employee_id: string
          end_date: string
          id?: string
          last_modified_by?: string | null
          leave_type_id: string
          modification_reason?: string | null
          reason?: string | null
          requires_reapproval?: boolean
          start_date: string
          status?: string | null
          supporting_document_name?: string | null
          supporting_document_path?: string | null
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          employee_id?: string
          end_date?: string
          id?: string
          last_modified_by?: string | null
          leave_type_id?: string
          modification_reason?: string | null
          reason?: string | null
          requires_reapproval?: boolean
          start_date?: string
          status?: string | null
          supporting_document_name?: string | null
          supporting_document_path?: string | null
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
      leave_settings: {
        Row: {
          accrual_days_per_month: number | null
          accrual_enabled: boolean | null
          approval_required: boolean | null
          auto_approve_days: number | null
          carry_forward_enabled: boolean | null
          carry_forward_max_days: number | null
          created_at: string | null
          created_by: string | null
          id: string
          organization_id: string | null
          updated_at: string | null
        }
        Insert: {
          accrual_days_per_month?: number | null
          accrual_enabled?: boolean | null
          approval_required?: boolean | null
          auto_approve_days?: number | null
          carry_forward_enabled?: boolean | null
          carry_forward_max_days?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          organization_id?: string | null
          updated_at?: string | null
        }
        Update: {
          accrual_days_per_month?: number | null
          accrual_enabled?: boolean | null
          approval_required?: boolean | null
          auto_approve_days?: number | null
          carry_forward_enabled?: boolean | null
          carry_forward_max_days?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          organization_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leave_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
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
          requires_supporting_document: boolean | null
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
          requires_supporting_document?: boolean | null
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
          requires_supporting_document?: boolean | null
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
      lesson_progress: {
        Row: {
          completed: boolean | null
          completed_at: string | null
          created_at: string | null
          employee_id: string
          id: string
          lesson_id: string
          time_spent_minutes: number | null
        }
        Insert: {
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          employee_id: string
          id?: string
          lesson_id: string
          time_spent_minutes?: number | null
        }
        Update: {
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          employee_id?: string
          id?: string
          lesson_id?: string
          time_spent_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "course_lessons"
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
      lottery_daily_records: {
        Row: {
          activated_tickets: number
          branch_id: string
          created_at: string
          created_by: string | null
          game_id: string
          id: string
          record_date: string
          stock_begin: number
          stock_end: number | null
          tickets_sold: number | null
          updated_at: string
        }
        Insert: {
          activated_tickets?: number
          branch_id: string
          created_at?: string
          created_by?: string | null
          game_id: string
          id?: string
          record_date: string
          stock_begin?: number
          stock_end?: number | null
          tickets_sold?: number | null
          updated_at?: string
        }
        Update: {
          activated_tickets?: number
          branch_id?: string
          created_at?: string
          created_by?: string | null
          game_id?: string
          id?: string
          record_date?: string
          stock_begin?: number
          stock_end?: number | null
          tickets_sold?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lottery_daily_records_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lottery_daily_records_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "lottery_games"
            referencedColumns: ["id"]
          },
        ]
      }
      lottery_daily_till_reports: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          report_date: string
          till_report_amount: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          report_date: string
          till_report_amount?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          report_date?: string
          till_report_amount?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      lottery_games: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string | null
          game_name: string
          id: string
          is_active: boolean
          organization_id: string | null
          ticket_price: number
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by?: string | null
          game_name: string
          id?: string
          is_active?: boolean
          organization_id?: string | null
          ticket_price?: number
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string | null
          game_name?: string
          id?: string
          is_active?: boolean
          organization_id?: string | null
          ticket_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lottery_games_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lottery_games_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lottery_monthly_summaries: {
        Row: {
          branch_id: string
          closing_stock_physical: number | null
          closing_stock_working: number
          created_at: string
          created_by: string | null
          id: string
          month_year: string
          stock_difference: number | null
          total_sales_value: number
          updated_at: string
        }
        Insert: {
          branch_id: string
          closing_stock_physical?: number | null
          closing_stock_working?: number
          created_at?: string
          created_by?: string | null
          id?: string
          month_year: string
          stock_difference?: number | null
          total_sales_value?: number
          updated_at?: string
        }
        Update: {
          branch_id?: string
          closing_stock_physical?: number | null
          closing_stock_working?: number
          created_at?: string
          created_by?: string | null
          id?: string
          month_year?: string
          stock_difference?: number | null
          total_sales_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lottery_monthly_summaries_branch_id_fkey"
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
          closed_by: string | null
          closure_attachments: Json
          closure_notes: string | null
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
          closed_by?: string | null
          closure_attachments?: Json
          closure_notes?: string | null
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
          closed_by?: string | null
          closure_attachments?: Json
          closure_notes?: string | null
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
      mandatory_leave: {
        Row: {
          branch_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          end_date: string
          id: string
          is_paid: boolean | null
          leave_type_id: string | null
          organization_id: string | null
          start_date: string
          title: string
          updated_at: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date: string
          id?: string
          is_paid?: boolean | null
          leave_type_id?: string | null
          organization_id?: string | null
          start_date: string
          title: string
          updated_at?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date?: string
          id?: string
          is_paid?: boolean | null
          leave_type_id?: string | null
          organization_id?: string | null
          start_date?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mandatory_leave_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mandatory_leave_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mandatory_leave_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      message_mentions: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          mentioned_user_id: string
          message_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          mentioned_user_id: string
          message_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          mentioned_user_id?: string
          message_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_mentions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_read_receipts: {
        Row: {
          id: string
          message_id: string
          read_at: string | null
          user_id: string
        }
        Insert: {
          id?: string
          message_id: string
          read_at?: string | null
          user_id: string
        }
        Update: {
          id?: string
          message_id?: string
          read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_read_receipts_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_settings: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          setting_key: string
          setting_value?: Json
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          attachments: Json | null
          content: string | null
          conversation_id: string
          created_at: string | null
          deleted_at: string | null
          edited_at: string | null
          id: string
          is_deleted: boolean | null
          is_edited: boolean | null
          is_pinned: boolean | null
          message_type: string | null
          pinned_at: string | null
          pinned_by: string | null
          reply_to_id: string | null
          sender_id: string
        }
        Insert: {
          attachments?: Json | null
          content?: string | null
          conversation_id: string
          created_at?: string | null
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          is_deleted?: boolean | null
          is_edited?: boolean | null
          is_pinned?: boolean | null
          message_type?: string | null
          pinned_at?: string | null
          pinned_by?: string | null
          reply_to_id?: string | null
          sender_id: string
        }
        Update: {
          attachments?: Json | null
          content?: string | null
          conversation_id?: string
          created_at?: string | null
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          is_deleted?: boolean | null
          is_edited?: boolean | null
          is_pinned?: boolean | null
          message_type?: string | null
          pinned_at?: string | null
          pinned_by?: string | null
          reply_to_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      method_statements: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          attachments: Json | null
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
          attachments?: Json | null
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
          attachments?: Json | null
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
      niza_branch_categories: {
        Row: {
          branch_id: string
          category_code: string
          display_name: string | null
          first_seen_at: string
          id: string
          last_seen_at: string
          raw_label: string | null
        }
        Insert: {
          branch_id: string
          category_code: string
          display_name?: string | null
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          raw_label?: string | null
        }
        Update: {
          branch_id?: string
          category_code?: string
          display_name?: string | null
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          raw_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "niza_branch_categories_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      niza_category_alerts: {
        Row: {
          branch_id: string | null
          created_at: string
          created_by: string | null
          id: string
          mapped_to_code: string | null
          notes: string | null
          organization_id: string | null
          raw_label: string
          resolved_at: string | null
          resolved_by: string | null
          sale_date: string | null
          sample_amount: number | null
          source_filename: string | null
          status: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          mapped_to_code?: string | null
          notes?: string | null
          organization_id?: string | null
          raw_label: string
          resolved_at?: string | null
          resolved_by?: string | null
          sale_date?: string | null
          sample_amount?: number | null
          source_filename?: string | null
          status?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          mapped_to_code?: string | null
          notes?: string | null
          organization_id?: string | null
          raw_label?: string
          resolved_at?: string | null
          resolved_by?: string | null
          sale_date?: string | null
          sample_amount?: number | null
          source_filename?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "niza_category_alerts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      niza_email_agent_runs: {
        Row: {
          agent_id: string
          emails_scanned: number | null
          ended_at: string | null
          error_message: string | null
          id: string
          invoices_extracted: number | null
          log_text: string | null
          started_at: string
          status: string | null
        }
        Insert: {
          agent_id: string
          emails_scanned?: number | null
          ended_at?: string | null
          error_message?: string | null
          id?: string
          invoices_extracted?: number | null
          log_text?: string | null
          started_at?: string
          status?: string | null
        }
        Update: {
          agent_id?: string
          emails_scanned?: number | null
          ended_at?: string | null
          error_message?: string | null
          id?: string
          invoices_extracted?: number | null
          log_text?: string | null
          started_at?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "niza_email_agent_runs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "niza_email_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      niza_email_agents: {
        Row: {
          ai_api_key: string | null
          ai_model: string | null
          ai_provider: string
          branch_id: string | null
          created_at: string
          created_by: string | null
          folder: string | null
          gmail_connection_id: string | null
          id: string
          imap_host: string | null
          imap_password: string | null
          imap_port: number | null
          imap_use_tls: boolean | null
          imap_user: string | null
          is_active: boolean | null
          last_error: string | null
          last_run_at: string | null
          last_status: string | null
          mailbox_type: string
          name: string
          organization_id: string | null
          outlook_connection_id: string | null
          schedule_cron: string | null
          supplier_filters: string[] | null
          updated_at: string
        }
        Insert: {
          ai_api_key?: string | null
          ai_model?: string | null
          ai_provider?: string
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          folder?: string | null
          gmail_connection_id?: string | null
          id?: string
          imap_host?: string | null
          imap_password?: string | null
          imap_port?: number | null
          imap_use_tls?: boolean | null
          imap_user?: string | null
          is_active?: boolean | null
          last_error?: string | null
          last_run_at?: string | null
          last_status?: string | null
          mailbox_type?: string
          name: string
          organization_id?: string | null
          outlook_connection_id?: string | null
          schedule_cron?: string | null
          supplier_filters?: string[] | null
          updated_at?: string
        }
        Update: {
          ai_api_key?: string | null
          ai_model?: string | null
          ai_provider?: string
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          folder?: string | null
          gmail_connection_id?: string | null
          id?: string
          imap_host?: string | null
          imap_password?: string | null
          imap_port?: number | null
          imap_use_tls?: boolean | null
          imap_user?: string | null
          is_active?: boolean | null
          last_error?: string | null
          last_run_at?: string | null
          last_status?: string | null
          mailbox_type?: string
          name?: string
          organization_id?: string | null
          outlook_connection_id?: string | null
          schedule_cron?: string | null
          supplier_filters?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "niza_email_agents_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      niza_invoices: {
        Row: {
          ai_model: string | null
          branch_id: string | null
          category: string | null
          created_at: string
          created_by: string | null
          currency: string | null
          email_message_id: string | null
          extraction_error: string | null
          extraction_status: string | null
          file_path: string | null
          gross: number | null
          id: string
          invoice_date: string | null
          invoice_number: string | null
          net: number | null
          organization_id: string | null
          raw_extracted: Json | null
          source: string
          supplier: string | null
          updated_at: string
          vat: number | null
        }
        Insert: {
          ai_model?: string | null
          branch_id?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          email_message_id?: string | null
          extraction_error?: string | null
          extraction_status?: string | null
          file_path?: string | null
          gross?: number | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          net?: number | null
          organization_id?: string | null
          raw_extracted?: Json | null
          source?: string
          supplier?: string | null
          updated_at?: string
          vat?: number | null
        }
        Update: {
          ai_model?: string | null
          branch_id?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          email_message_id?: string | null
          extraction_error?: string | null
          extraction_status?: string | null
          file_path?: string | null
          gross?: number | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          net?: number | null
          organization_id?: string | null
          raw_extracted?: Json | null
          source?: string
          supplier?: string | null
          updated_at?: string
          vat?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "niza_invoices_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_custom_pages: {
        Row: {
          branch_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          enabled: boolean
          id: string
          logo_path: string | null
          name: string
          organization_id: string | null
          page_order: number
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          enabled?: boolean
          id?: string
          logo_path?: string | null
          name: string
          organization_id?: string | null
          page_order?: number
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          enabled?: boolean
          id?: string
          logo_path?: string | null
          name?: string
          organization_id?: string | null
          page_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_custom_pages_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_custom_pages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_form_responses: {
        Row: {
          created_at: string | null
          employee_id: string
          form_data: Json | null
          form_type: string
          id: string
          signature: string | null
          signed_at: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          employee_id: string
          form_data?: Json | null
          form_type: string
          id?: string
          signature?: string | null
          signed_at?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          employee_id?: string
          form_data?: Json | null
          form_type?: string
          id?: string
          signature?: string | null
          signed_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_form_responses_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_form_settings: {
        Row: {
          created_at: string | null
          enabled: boolean | null
          form_order: number | null
          form_type: string
          id: string
          organization_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean | null
          form_order?: number | null
          form_type: string
          id?: string
          organization_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          enabled?: boolean | null
          form_order?: number | null
          form_type?: string
          id?: string
          organization_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_form_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_page_fields: {
        Row: {
          created_at: string
          default_value: string | null
          field_label: string
          field_options: Json | null
          field_order: number
          field_type: string
          id: string
          is_required: boolean
          page_id: string
          placeholder: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_value?: string | null
          field_label: string
          field_options?: Json | null
          field_order?: number
          field_type?: string
          id?: string
          is_required?: boolean
          page_id: string
          placeholder?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_value?: string | null
          field_label?: string
          field_options?: Json | null
          field_order?: number
          field_type?: string
          id?: string
          is_required?: boolean
          page_id?: string
          placeholder?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_page_fields_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "onboarding_custom_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: string | null
          auto_create_folder: boolean | null
          created_at: string | null
          created_by: string | null
          id: string
          name: string
          registration_number: string | null
          updated_at: string | null
          vat_number: string | null
        }
        Insert: {
          address?: string | null
          auto_create_folder?: boolean | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          name: string
          registration_number?: string | null
          updated_at?: string | null
          vat_number?: string | null
        }
        Update: {
          address?: string | null
          auto_create_folder?: boolean | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          name?: string
          registration_number?: string | null
          updated_at?: string | null
          vat_number?: string | null
        }
        Relationships: []
      }
      payment_approval_requests: {
        Row: {
          approved_amount: number | null
          branch_id: string
          created_at: string
          customer_id: string | null
          evidence_files: Json
          id: string
          monthly_account_id: string
          notes: string | null
          organization_id: string | null
          payment_date: string | null
          payment_method: string | null
          rejection_reason: string | null
          request_type: string
          requested_amount: number
          requested_by: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          approved_amount?: number | null
          branch_id: string
          created_at?: string
          customer_id?: string | null
          evidence_files?: Json
          id?: string
          monthly_account_id: string
          notes?: string | null
          organization_id?: string | null
          payment_date?: string | null
          payment_method?: string | null
          rejection_reason?: string | null
          request_type: string
          requested_amount?: number
          requested_by: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          approved_amount?: number | null
          branch_id?: string
          created_at?: string
          customer_id?: string | null
          evidence_files?: Json
          id?: string
          monthly_account_id?: string
          notes?: string | null
          organization_id?: string | null
          payment_date?: string | null
          payment_method?: string | null
          rejection_reason?: string | null
          request_type?: string
          requested_amount?: number
          requested_by?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      payroll_categories: {
        Row: {
          category_type: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_default: boolean | null
          name: string
          updated_at: string
        }
        Insert: {
          category_type: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          updated_at?: string
        }
        Update: {
          category_type?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      payroll_items: {
        Row: {
          amount: number | null
          category_id: string | null
          created_at: string
          created_by: string | null
          employee_id: string | null
          id: string
          month: string
          notes: string | null
          payroll_record_id: string | null
          updated_at: string
        }
        Insert: {
          amount?: number | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          employee_id?: string | null
          id?: string
          month: string
          notes?: string | null
          payroll_record_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          employee_id?: string | null
          id?: string
          month?: string
          notes?: string | null
          payroll_record_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "payroll_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_items_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_items_payroll_record_id_fkey"
            columns: ["payroll_record_id"]
            isOneToOne: false
            referencedRelation: "payroll_records"
            referencedColumns: ["id"]
          },
        ]
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
          criteria_ratings: Json | null
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
          criteria_ratings?: Json | null
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
          criteria_ratings?: Json | null
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
          custom_role_id: string | null
          display_name: string | null
          email: string
          force_password_change: boolean | null
          hr_access_level: Database["public"]["Enums"]["hr_access_level"] | null
          id: string
          is_active: boolean | null
          name: string
          organization_id: string | null
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          custom_role_id?: string | null
          display_name?: string | null
          email: string
          force_password_change?: boolean | null
          hr_access_level?:
            | Database["public"]["Enums"]["hr_access_level"]
            | null
          id: string
          is_active?: boolean | null
          name: string
          organization_id?: string | null
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          custom_role_id?: string | null
          display_name?: string | null
          email?: string
          force_password_change?: boolean | null
          hr_access_level?:
            | Database["public"]["Enums"]["hr_access_level"]
            | null
          id?: string
          is_active?: boolean | null
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
          {
            foreignKeyName: "profiles_custom_role_id_fkey"
            columns: ["custom_role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      reminder_settings: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          setting_key: string
          setting_value?: Json
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string | null
        }
        Relationships: []
      }
      reminders: {
        Row: {
          assigned_to: string | null
          branch_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_completed: boolean | null
          is_dismissed: boolean | null
          organization_id: string | null
          priority: string | null
          related_entity_id: string | null
          related_entity_type: string | null
          reminder_date: string
          reminder_type: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_completed?: boolean | null
          is_dismissed?: boolean | null
          organization_id?: string | null
          priority?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          reminder_date: string
          reminder_type?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_completed?: boolean | null
          is_dismissed?: boolean | null
          organization_id?: string | null
          priority?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          reminder_date?: string
          reminder_type?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reminders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_organization_id_fkey"
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
      rota_settings: {
        Row: {
          accept_decline_enabled: boolean | null
          created_at: string | null
          default_view: string | null
          hide_shift_labels: boolean | null
          id: string
          open_shifts_enabled: boolean | null
          organization_id: string | null
          restricted_permissions: boolean | null
          updated_at: string | null
        }
        Insert: {
          accept_decline_enabled?: boolean | null
          created_at?: string | null
          default_view?: string | null
          hide_shift_labels?: boolean | null
          id?: string
          open_shifts_enabled?: boolean | null
          organization_id?: string | null
          restricted_permissions?: boolean | null
          updated_at?: string | null
        }
        Update: {
          accept_decline_enabled?: boolean | null
          created_at?: string | null
          default_view?: string | null
          hide_shift_labels?: boolean | null
          id?: string
          open_shifts_enabled?: boolean | null
          organization_id?: string | null
          restricted_permissions?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rota_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
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
          employee_response: string | null
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
          employee_response?: string | null
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
          employee_response?: string | null
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
          assigned_to: string | null
          attachments: Json | null
          branch_id: string
          completed_at: string | null
          completion_attachments: Json | null
          created_at: string | null
          description: string | null
          due_date: string | null
          id: string
          organization_id: string
          priority: string | null
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
          assigned_to?: string | null
          attachments?: Json | null
          branch_id: string
          completed_at?: string | null
          completion_attachments?: Json | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          organization_id: string
          priority?: string | null
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
          assigned_to?: string | null
          attachments?: Json | null
          branch_id?: string
          completed_at?: string | null
          completion_attachments?: Json | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          organization_id?: string
          priority?: string | null
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
      shared_templates: {
        Row: {
          branch_id: string | null
          content: Json | null
          created_at: string
          description: string | null
          file_name: string | null
          file_path: string | null
          file_size: number | null
          id: string
          is_active: boolean | null
          is_global: boolean | null
          organization_id: string | null
          shared_by: string
          template_type: string
          title: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          content?: Json | null
          created_at?: string
          description?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          is_active?: boolean | null
          is_global?: boolean | null
          organization_id?: string | null
          shared_by: string
          template_type?: string
          title: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          content?: Json | null
          created_at?: string
          description?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          is_active?: boolean | null
          is_global?: boolean | null
          organization_id?: string | null
          shared_by?: string
          template_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_templates_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      signed_document_requirements: {
        Row: {
          branch_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          doc_order: number
          enabled: boolean
          id: string
          is_mandatory: boolean
          name: string
          organization_id: string | null
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          doc_order?: number
          enabled?: boolean
          id?: string
          is_mandatory?: boolean
          name: string
          organization_id?: string | null
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          doc_order?: number
          enabled?: boolean
          id?: string
          is_mandatory?: boolean
          name?: string
          organization_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "signed_document_requirements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signed_document_requirements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      signed_document_uploads: {
        Row: {
          created_at: string
          employee_id: string
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          requirement_id: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          employee_id: string
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          requirement_id: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          employee_id?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          requirement_id?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signed_document_uploads_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signed_document_uploads_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "signed_document_requirements"
            referencedColumns: ["id"]
          },
        ]
      }
      ssp_records: {
        Row: {
          absence_end_date: string | null
          absence_start_date: string
          created_at: string | null
          days_paid: number | null
          employee_id: string | null
          exclusion_reason: string | null
          fit_note_path: string | null
          fit_note_received: boolean | null
          id: string
          linked_period: boolean | null
          notes: string | null
          previous_ssp_id: string | null
          qualifying_days: number | null
          status: string | null
          total_ssp_paid: number | null
          updated_at: string | null
          waiting_days: number | null
          weekly_rate: number | null
        }
        Insert: {
          absence_end_date?: string | null
          absence_start_date: string
          created_at?: string | null
          days_paid?: number | null
          employee_id?: string | null
          exclusion_reason?: string | null
          fit_note_path?: string | null
          fit_note_received?: boolean | null
          id?: string
          linked_period?: boolean | null
          notes?: string | null
          previous_ssp_id?: string | null
          qualifying_days?: number | null
          status?: string | null
          total_ssp_paid?: number | null
          updated_at?: string | null
          waiting_days?: number | null
          weekly_rate?: number | null
        }
        Update: {
          absence_end_date?: string | null
          absence_start_date?: string
          created_at?: string | null
          days_paid?: number | null
          employee_id?: string | null
          exclusion_reason?: string | null
          fit_note_path?: string | null
          fit_note_received?: boolean | null
          id?: string
          linked_period?: boolean | null
          notes?: string | null
          previous_ssp_id?: string | null
          qualifying_days?: number | null
          status?: string | null
          total_ssp_paid?: number | null
          updated_at?: string | null
          waiting_days?: number | null
          weekly_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ssp_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ssp_records_previous_ssp_id_fkey"
            columns: ["previous_ssp_id"]
            isOneToOne: false
            referencedRelation: "ssp_records"
            referencedColumns: ["id"]
          },
        ]
      }
      statutory_leave_entitlements: {
        Row: {
          actual_end_date: string | null
          approved_at: string | null
          approved_by: string | null
          baby_birth_date: string | null
          baby_due_date: string | null
          created_at: string | null
          employee_id: string | null
          expected_end_date: string | null
          id: string
          kit_days_used: number | null
          leave_type: string
          notes: string | null
          pay_type: string | null
          split_days_used: number | null
          start_date: string | null
          status: string | null
          updated_at: string | null
          weeks_entitled: number | null
          weeks_taken: number | null
        }
        Insert: {
          actual_end_date?: string | null
          approved_at?: string | null
          approved_by?: string | null
          baby_birth_date?: string | null
          baby_due_date?: string | null
          created_at?: string | null
          employee_id?: string | null
          expected_end_date?: string | null
          id?: string
          kit_days_used?: number | null
          leave_type: string
          notes?: string | null
          pay_type?: string | null
          split_days_used?: number | null
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
          weeks_entitled?: number | null
          weeks_taken?: number | null
        }
        Update: {
          actual_end_date?: string | null
          approved_at?: string | null
          approved_by?: string | null
          baby_birth_date?: string | null
          baby_due_date?: string | null
          created_at?: string | null
          employee_id?: string | null
          expected_end_date?: string | null
          id?: string
          kit_days_used?: number | null
          leave_type?: string
          notes?: string | null
          pay_type?: string | null
          split_days_used?: number | null
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
          weeks_entitled?: number | null
          weeks_taken?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "statutory_leave_entitlements_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      store_templates: {
        Row: {
          branch_id: string
          content: Json | null
          created_at: string
          created_by: string
          description: string | null
          file_name: string | null
          file_path: string | null
          file_size: number | null
          id: string
          is_active: boolean | null
          organization_id: string
          template_type: string
          title: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          content?: Json | null
          created_at?: string
          created_by: string
          description?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          is_active?: boolean | null
          organization_id: string
          template_type?: string
          title: string
          updated_at?: string
        }
        Update: {
          branch_id?: string
          content?: Json | null
          created_at?: string
          created_by?: string
          description?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          is_active?: boolean | null
          organization_id?: string
          template_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_templates_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      template_folders: {
        Row: {
          color: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          name: string
          organization_id: string | null
          parent_id: string | null
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          organization_id?: string | null
          parent_id?: string | null
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          organization_id?: string | null
          parent_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "template_folders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "template_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      template_types: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          label: string
          sort_order: number
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          label: string
          sort_order?: number
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          label?: string
          sort_order?: number
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      templates: {
        Row: {
          content: Json | null
          created_at: string | null
          created_by: string | null
          description: string | null
          folder_id: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          organization_id: string | null
          template_type: Database["public"]["Enums"]["template_type"]
          thumbnail_path: string | null
          updated_at: string | null
        }
        Insert: {
          content?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          folder_id?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          organization_id?: string | null
          template_type?: Database["public"]["Enums"]["template_type"]
          thumbnail_path?: string | null
          updated_at?: string | null
        }
        Update: {
          content?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          folder_id?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          organization_id?: string | null
          template_type?: Database["public"]["Enums"]["template_type"]
          thumbnail_path?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "templates_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "template_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      temporary_employees: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string | null
          end_date: string | null
          first_name: string
          hourly_rate: number | null
          id: string
          is_active: boolean
          last_name: string | null
          notes: string | null
          organization_id: string
          role: string | null
          source_branch_id: string | null
          source_name: string | null
          start_date: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          first_name: string
          hourly_rate?: number | null
          id?: string
          is_active?: boolean
          last_name?: string | null
          notes?: string | null
          organization_id: string
          role?: string | null
          source_branch_id?: string | null
          source_name?: string | null
          start_date?: string
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          first_name?: string
          hourly_rate?: number | null
          id?: string
          is_active?: boolean
          last_name?: string | null
          notes?: string | null
          organization_id?: string
          role?: string | null
          source_branch_id?: string | null
          source_name?: string | null
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "temporary_employees_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temporary_employees_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temporary_employees_source_branch_id_fkey"
            columns: ["source_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      temporary_timesheet_entries: {
        Row: {
          actual_hours: number
          branch_id: string
          created_at: string
          day_of_week: string
          entry_date: string
          id: string
          notes: string | null
          shift_end_time: string | null
          shift_start_time: string | null
          temporary_employee_id: string
          updated_at: string
          week_start_date: string
        }
        Insert: {
          actual_hours?: number
          branch_id: string
          created_at?: string
          day_of_week: string
          entry_date: string
          id?: string
          notes?: string | null
          shift_end_time?: string | null
          shift_start_time?: string | null
          temporary_employee_id: string
          updated_at?: string
          week_start_date: string
        }
        Update: {
          actual_hours?: number
          branch_id?: string
          created_at?: string
          day_of_week?: string
          entry_date?: string
          id?: string
          notes?: string | null
          shift_end_time?: string | null
          shift_start_time?: string | null
          temporary_employee_id?: string
          updated_at?: string
          week_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "temporary_timesheet_entries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temporary_timesheet_entries_temporary_employee_id_fkey"
            columns: ["temporary_employee_id"]
            isOneToOne: false
            referencedRelation: "temporary_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheet_entries: {
        Row: {
          actual_hours: number | null
          adjustment_hours: number | null
          break_duration_minutes: number | null
          created_at: string | null
          day_of_week: string
          entry_date: string
          entry_type: string | null
          holiday_hours: number | null
          id: string
          notes: string | null
          rota_shift_id: string | null
          shift_end_time: string | null
          shift_start_time: string | null
          sick_hours: number | null
          timesheet_id: string
          updated_at: string | null
        }
        Insert: {
          actual_hours?: number | null
          adjustment_hours?: number | null
          break_duration_minutes?: number | null
          created_at?: string | null
          day_of_week: string
          entry_date: string
          entry_type?: string | null
          holiday_hours?: number | null
          id?: string
          notes?: string | null
          rota_shift_id?: string | null
          shift_end_time?: string | null
          shift_start_time?: string | null
          sick_hours?: number | null
          timesheet_id: string
          updated_at?: string | null
        }
        Update: {
          actual_hours?: number | null
          adjustment_hours?: number | null
          break_duration_minutes?: number | null
          created_at?: string | null
          day_of_week?: string
          entry_date?: string
          entry_type?: string | null
          holiday_hours?: number | null
          id?: string
          notes?: string | null
          rota_shift_id?: string | null
          shift_end_time?: string | null
          shift_start_time?: string | null
          sick_hours?: number | null
          timesheet_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "timesheet_entries_rota_shift_id_fkey"
            columns: ["rota_shift_id"]
            isOneToOne: false
            referencedRelation: "rota_shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_entries_timesheet_id_fkey"
            columns: ["timesheet_id"]
            isOneToOne: false
            referencedRelation: "timesheets"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheet_month_locks: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          lock_message: string | null
          locked_at: string
          locked_by: string
          month_start: string
          organization_id: string | null
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          lock_message?: string | null
          locked_at?: string
          locked_by: string
          month_start: string
          organization_id?: string | null
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          lock_message?: string | null
          locked_at?: string
          locked_by?: string
          month_start?: string
          organization_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "timesheet_month_locks_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_month_locks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheet_monthly_summary: {
        Row: {
          approved_timesheets_count: number | null
          created_at: string | null
          employee_id: string
          id: string
          month_year: string
          total_adjustment_hours: number | null
          total_holiday_hours: number | null
          total_sick_hours: number | null
          total_worked_hours: number | null
          updated_at: string | null
        }
        Insert: {
          approved_timesheets_count?: number | null
          created_at?: string | null
          employee_id: string
          id?: string
          month_year: string
          total_adjustment_hours?: number | null
          total_holiday_hours?: number | null
          total_sick_hours?: number | null
          total_worked_hours?: number | null
          updated_at?: string | null
        }
        Update: {
          approved_timesheets_count?: number | null
          created_at?: string | null
          employee_id?: string
          id?: string
          month_year?: string
          total_adjustment_hours?: number | null
          total_holiday_hours?: number | null
          total_sick_hours?: number | null
          total_worked_hours?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "timesheet_monthly_summary_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheets: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          branch_id: string
          created_at: string | null
          created_by: string | null
          employee_id: string
          id: string
          notes: string | null
          organization_id: string
          rejection_reason: string | null
          status: string | null
          submitted_at: string | null
          submitted_by: string | null
          total_adjustment_hours: number | null
          total_holiday_hours: number | null
          total_sick_hours: number | null
          total_worked_hours: number | null
          updated_at: string | null
          week_end_date: string
          week_start_date: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          branch_id: string
          created_at?: string | null
          created_by?: string | null
          employee_id: string
          id?: string
          notes?: string | null
          organization_id: string
          rejection_reason?: string | null
          status?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          total_adjustment_hours?: number | null
          total_holiday_hours?: number | null
          total_sick_hours?: number | null
          total_worked_hours?: number | null
          updated_at?: string | null
          week_end_date: string
          week_start_date: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string
          created_at?: string | null
          created_by?: string | null
          employee_id?: string
          id?: string
          notes?: string | null
          organization_id?: string
          rejection_reason?: string | null
          status?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          total_adjustment_hours?: number | null
          total_holiday_hours?: number | null
          total_sick_hours?: number | null
          total_worked_hours?: number | null
          updated_at?: string | null
          week_end_date?: string
          week_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "timesheets_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheets_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      training_documents: {
        Row: {
          created_at: string | null
          document_type: string | null
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          training_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          document_type?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          training_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          document_type?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          training_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "training_documents_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "trainings"
            referencedColumns: ["id"]
          },
        ]
      }
      trainings: {
        Row: {
          assigned_to: string | null
          branch_id: string | null
          completed_date: string | null
          created_at: string | null
          created_by: string | null
          deadline: string | null
          description: string | null
          document_name: string | null
          document_path: string | null
          id: string
          organization_id: string | null
          status: string | null
          tags: string[] | null
          title: string
          training_date: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          branch_id?: string | null
          completed_date?: string | null
          created_at?: string | null
          created_by?: string | null
          deadline?: string | null
          description?: string | null
          document_name?: string | null
          document_path?: string | null
          id?: string
          organization_id?: string | null
          status?: string | null
          tags?: string[] | null
          title: string
          training_date?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          branch_id?: string | null
          completed_date?: string | null
          created_at?: string | null
          created_by?: string | null
          deadline?: string | null
          description?: string | null
          document_name?: string | null
          document_path?: string | null
          id?: string
          organization_id?: string | null
          status?: string | null
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
      uk_employee_pension: {
        Row: {
          contribution_percent_override: number | null
          created_at: string | null
          employee_id: string | null
          enrolled: boolean | null
          enrolment_date: string | null
          id: string
          opt_out_date: string | null
          opt_out_reason: string | null
          updated_at: string | null
        }
        Insert: {
          contribution_percent_override?: number | null
          created_at?: string | null
          employee_id?: string | null
          enrolled?: boolean | null
          enrolment_date?: string | null
          id?: string
          opt_out_date?: string | null
          opt_out_reason?: string | null
          updated_at?: string | null
        }
        Update: {
          contribution_percent_override?: number | null
          created_at?: string | null
          employee_id?: string | null
          enrolled?: boolean | null
          enrolment_date?: string | null
          id?: string
          opt_out_date?: string | null
          opt_out_reason?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "uk_employee_pension_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      uk_ni_bands: {
        Row: {
          band_name: string
          created_at: string | null
          employee_rate_percent: number
          employer_rate_percent: number
          id: string
          is_active: boolean | null
          ni_category: string
          tax_year: string
          weekly_threshold: number
        }
        Insert: {
          band_name: string
          created_at?: string | null
          employee_rate_percent: number
          employer_rate_percent: number
          id?: string
          is_active?: boolean | null
          ni_category?: string
          tax_year: string
          weekly_threshold: number
        }
        Update: {
          band_name?: string
          created_at?: string | null
          employee_rate_percent?: number
          employer_rate_percent?: number
          id?: string
          is_active?: boolean | null
          ni_category?: string
          tax_year?: string
          weekly_threshold?: number
        }
        Relationships: []
      }
      uk_pension_settings: {
        Row: {
          auto_enrolment_enabled: boolean | null
          created_at: string | null
          created_by: string | null
          employee_contribution_percent: number | null
          employer_contribution_percent: number | null
          id: string
          organization_id: string | null
          pension_provider: string | null
          postponement_period_months: number | null
          qualifying_earnings_lower: number | null
          qualifying_earnings_upper: number | null
          updated_at: string | null
        }
        Insert: {
          auto_enrolment_enabled?: boolean | null
          created_at?: string | null
          created_by?: string | null
          employee_contribution_percent?: number | null
          employer_contribution_percent?: number | null
          id?: string
          organization_id?: string | null
          pension_provider?: string | null
          postponement_period_months?: number | null
          qualifying_earnings_lower?: number | null
          qualifying_earnings_upper?: number | null
          updated_at?: string | null
        }
        Update: {
          auto_enrolment_enabled?: boolean | null
          created_at?: string | null
          created_by?: string | null
          employee_contribution_percent?: number | null
          employer_contribution_percent?: number | null
          id?: string
          organization_id?: string | null
          pension_provider?: string | null
          postponement_period_months?: number | null
          qualifying_earnings_lower?: number | null
          qualifying_earnings_upper?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "uk_pension_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      uk_tax_bands: {
        Row: {
          band_name: string
          created_at: string | null
          id: string
          is_active: boolean | null
          lower_limit: number
          rate_percent: number
          tax_year: string
          upper_limit: number | null
        }
        Insert: {
          band_name: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          lower_limit: number
          rate_percent: number
          tax_year: string
          upper_limit?: number | null
        }
        Update: {
          band_name?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          lower_limit?: number
          rate_percent?: number
          tax_year?: string
          upper_limit?: number | null
        }
        Relationships: []
      }
      uk_tax_codes: {
        Row: {
          created_at: string | null
          created_by: string | null
          director_ni_method: string | null
          effective_from: string
          employee_id: string | null
          id: string
          is_director: boolean | null
          ni_category: string | null
          p45_received: boolean | null
          starter_declaration: string | null
          student_loan_plan: string | null
          tax_code: string
          tax_code_basis: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          director_ni_method?: string | null
          effective_from?: string
          employee_id?: string | null
          id?: string
          is_director?: boolean | null
          ni_category?: string | null
          p45_received?: boolean | null
          starter_declaration?: string | null
          student_loan_plan?: string | null
          tax_code?: string
          tax_code_basis?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          director_ni_method?: string | null
          effective_from?: string
          employee_id?: string | null
          id?: string
          is_director?: boolean | null
          ni_category?: string | null
          p45_received?: boolean | null
          starter_declaration?: string | null
          student_loan_plan?: string | null
          tax_code?: string
          tax_code_basis?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "uk_tax_codes_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      user_custom_roles: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          custom_role_id: string
          id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          custom_role_id: string
          id?: string
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          custom_role_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_custom_roles_custom_role_id_fkey"
            columns: ["custom_role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_presence: {
        Row: {
          is_typing_in: string | null
          last_seen: string | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          is_typing_in?: string | null
          last_seen?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          is_typing_in?: string | null
          last_seen?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_presence_is_typing_in_fkey"
            columns: ["is_typing_in"]
            isOneToOne: false
            referencedRelation: "conversations"
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
      vendors: {
        Row: {
          branch_id: string
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          organization_id: string | null
          updated_at: string
        }
        Insert: {
          branch_id: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          organization_id?: string | null
          updated_at?: string
        }
        Update: {
          branch_id?: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          organization_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_holiday_balance: {
        Args: { p_employee_id: string; p_holiday_year_start?: string }
        Returns: undefined
      }
      cleanup_user_references: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      delete_branch_cascade: {
        Args: { p_branch_id: string }
        Returns: undefined
      }
      delete_organization_cascade: {
        Args: { p_organization_id: string }
        Returns: undefined
      }
      get_messaging_profiles: {
        Args: { p_user_ids: string[] }
        Returns: {
          email: string
          id: string
          name: string
        }[]
      }
      get_my_profile_data: {
        Args: never
        Returns: {
          branch_id: string
          hr_access_level: string
          organization_id: string
        }[]
      }
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
      is_conversation_participant: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      is_timesheet_month_locked: {
        Args: { _branch_id: string; _week_start: string }
        Returns: boolean
      }
      link_my_employee_record: { Args: never; Returns: string }
      transfer_employee: {
        Args: {
          p_employee_id: string
          p_new_branch_id: string
          p_reset_data?: boolean
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "super_admin" | "hr" | "manager" | "employee"
      hr_access_level: "full" | "organization" | "branch"
      template_type:
        | "visiting_card"
        | "email_signature"
        | "id_card"
        | "visitor_pass"
        | "invoice"
        | "gift_card"
        | "custom"
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
      template_type: [
        "visiting_card",
        "email_signature",
        "id_card",
        "visitor_pass",
        "invoice",
        "gift_card",
        "custom",
      ],
    },
  },
} as const
