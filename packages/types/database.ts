// Hand-written from migrations 001–003. Regenerate with:
// pnpm dlx supabase gen types typescript --project-id jqbvojjgkkhbndsgbsuo > packages/types/database.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '11';
  };
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          primary_color: string;
          icon_path: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          primary_color?: string;
          icon_path?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          primary_color?: string;
          icon_path?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      centers: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          address: string;
          licensed_capacity: number;
          occ_license_number: string;
          license_type: 'child_care_center' | 'letter_of_compliance';
          occ_region: string | null;
          state: string;
          open_slot: number;
          close_slot: number;
          operating_days: number[];
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          name: string;
          address: string;
          licensed_capacity: number;
          occ_license_number: string;
          license_type?: 'child_care_center' | 'letter_of_compliance';
          occ_region?: string | null;
          state?: string;
          open_slot?: number;
          close_slot?: number;
          operating_days?: number[];
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          name?: string;
          address?: string;
          licensed_capacity?: number;
          occ_license_number?: string;
          license_type?: 'child_care_center' | 'letter_of_compliance';
          occ_region?: string | null;
          state?: string;
          open_slot?: number;
          close_slot?: number;
          operating_days?: number[];
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'centers_org_id_fkey';
            columns: ['org_id'];
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          }
        ];
      };
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          phone: string | null;
          role: 'owner' | 'staff';
          handle: string | null;
          profile_public: boolean;
          bio: string | null;
          kiosk_pin: string | null;
          created_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id: string;
          email: string;
          full_name: string;
          phone?: string | null;
          role?: 'owner' | 'staff';
          handle?: string | null;
          profile_public?: boolean;
          bio?: string | null;
          kiosk_pin?: string | null;
          created_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          phone?: string | null;
          role?: 'owner' | 'staff';
          handle?: string | null;
          profile_public?: boolean;
          bio?: string | null;
          kiosk_pin?: string | null;
          created_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      center_memberships: {
        Row: {
          id: string;
          user_id: string;
          center_id: string;
          role: 'director' | 'admin' | 'lead_teacher' | 'assistant_teacher' | 'aide' | 'substitute';
          is_primary_center: boolean;
          lead_qualified: boolean;
          infant_toddler_trained: boolean;
          joined_at: string;
          left_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          center_id: string;
          role: 'director' | 'admin' | 'lead_teacher' | 'assistant_teacher' | 'aide' | 'substitute';
          is_primary_center?: boolean;
          lead_qualified?: boolean;
          infant_toddler_trained?: boolean;
          joined_at?: string;
          left_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          center_id?: string;
          role?: 'director' | 'admin' | 'lead_teacher' | 'assistant_teacher' | 'aide' | 'substitute';
          is_primary_center?: boolean;
          lead_qualified?: boolean;
          infant_toddler_trained?: boolean;
          joined_at?: string;
          left_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'center_memberships_center_id_fkey';
            columns: ['center_id'];
            referencedRelation: 'centers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'center_memberships_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      credentials: {
        Row: {
          id: string;
          user_id: string;
          credential_type: 'preschool_90hr' | 'infant_toddler_9hr' | 'communication_9hr' | 'ada_training' | 'first_aid_cpr' | 'child_abuse_prevention' | 'medication_administration' | 'cda' | 'directors_certification' | 'college_degree' | 'other';
          custom_type_name: string | null;
          issuing_org: string;
          issued_at: string;
          expires_at: string | null;
          storage_path: string;
          show_on_profile: boolean;
          created_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          credential_type: 'preschool_90hr' | 'infant_toddler_9hr' | 'communication_9hr' | 'ada_training' | 'first_aid_cpr' | 'child_abuse_prevention' | 'medication_administration' | 'cda' | 'directors_certification' | 'college_degree' | 'other';
          custom_type_name?: string | null;
          issuing_org: string;
          issued_at: string;
          expires_at?: string | null;
          storage_path: string;
          show_on_profile?: boolean;
          created_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          credential_type?: 'preschool_90hr' | 'infant_toddler_9hr' | 'communication_9hr' | 'ada_training' | 'first_aid_cpr' | 'child_abuse_prevention' | 'medication_administration' | 'cda' | 'directors_certification' | 'college_degree' | 'other';
          custom_type_name?: string | null;
          issuing_org?: string;
          issued_at?: string;
          expires_at?: string | null;
          storage_path?: string;
          show_on_profile?: boolean;
          created_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'credentials_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      credential_audit_logs: {
        Row: {
          id: string;
          credential_id: string;
          action: string;
          changed_by: string;
          previous_values: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          credential_id: string;
          action: string;
          changed_by: string;
          previous_values?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          credential_id?: string;
          action?: string;
          changed_by?: string;
          previous_values?: Json | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'credential_audit_logs_credential_id_fkey';
            columns: ['credential_id'];
            referencedRelation: 'credentials';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'credential_audit_logs_changed_by_fkey';
            columns: ['changed_by'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      employment_history: {
        Row: {
          id: string;
          user_id: string;
          employer_name: string;
          center_id: string | null;
          role_title: string;
          start_date: string;
          end_date: string | null;
          show_on_profile: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          employer_name: string;
          center_id?: string | null;
          role_title: string;
          start_date: string;
          end_date?: string | null;
          show_on_profile?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          employer_name?: string;
          center_id?: string | null;
          role_title?: string;
          start_date?: string;
          end_date?: string | null;
          show_on_profile?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'employment_history_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      classrooms: {
        Row: {
          id: string;
          center_id: string;
          name: string;
          age_group: 'infant' | 'toddler' | 'two_year' | 'preschool' | 'school_age';
          licensed_capacity: number;
          typical_enrollment: number;
          pattern_effective_date: string | null;
          open_slot: number | null;
          close_slot: number | null;
          operating_days: number[] | null;
          ratio_children_per_staff: number | null;
          ratio_max_group: number | null;
          created_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          center_id: string;
          name: string;
          age_group: 'infant' | 'toddler' | 'two_year' | 'preschool' | 'school_age';
          licensed_capacity: number;
          typical_enrollment?: number;
          pattern_effective_date?: string | null;
          open_slot?: number | null;
          close_slot?: number | null;
          operating_days?: number[] | null;
          ratio_children_per_staff?: number | null;
          ratio_max_group?: number | null;
          created_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          center_id?: string;
          name?: string;
          age_group?: 'infant' | 'toddler' | 'two_year' | 'preschool' | 'school_age';
          licensed_capacity?: number;
          typical_enrollment?: number;
          pattern_effective_date?: string | null;
          open_slot?: number | null;
          close_slot?: number | null;
          operating_days?: number[] | null;
          ratio_children_per_staff?: number | null;
          ratio_max_group?: number | null;
          created_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'classrooms_center_id_fkey';
            columns: ['center_id'];
            referencedRelation: 'centers';
            referencedColumns: ['id'];
          }
        ];
      };
      activity_log: {
        Row: {
          id: string;
          center_id: string;
          actor_id: string | null;
          event_type: string;
          payload: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          center_id: string;
          actor_id?: string | null;
          event_type: string;
          payload?: Record<string, unknown>;
          created_at?: string;
        };
        Update: {
          id?: string;
          center_id?: string;
          actor_id?: string | null;
          event_type?: string;
          payload?: Record<string, unknown>;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'activity_log_center_id_fkey';
            columns: ['center_id'];
            referencedRelation: 'centers';
            referencedColumns: ['id'];
          }
        ];
      };
      time_entries: {
        Row: {
          id: string;
          user_id: string;
          center_id: string;
          clocked_in_at: string;
          clocked_out_at: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          center_id: string;
          clocked_in_at?: string;
          clocked_out_at?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          center_id?: string;
          clocked_in_at?: string;
          clocked_out_at?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'time_entries_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'time_entries_center_id_fkey';
            columns: ['center_id'];
            referencedRelation: 'centers';
            referencedColumns: ['id'];
          }
        ];
      };
      push_tokens: {
        Row: {
          id: string;
          user_id: string;
          token: string;
          platform: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          token: string;
          platform: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          token?: string;
          platform?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'push_tokens_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      staffing_patterns: {
        Row: {
          id: string;
          classroom_id: string;
          day_of_week: number;
          hour: number;
          staff_count: number;
        };
        Insert: {
          id?: string;
          classroom_id: string;
          day_of_week: number;
          hour: number;
          staff_count?: number;
        };
        Update: {
          id?: string;
          classroom_id?: string;
          day_of_week?: number;
          hour?: number;
          staff_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'staffing_patterns_classroom_id_fkey';
            columns: ['classroom_id'];
            referencedRelation: 'classrooms';
            referencedColumns: ['id'];
          }
        ];
      };
      classroom_staff: {
        Row: {
          id: string;
          classroom_id: string;
          user_id: string | null;
          staff_name: string | null;
          position_code: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          classroom_id: string;
          user_id?: string | null;
          staff_name?: string | null;
          position_code?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          classroom_id?: string;
          user_id?: string | null;
          staff_name?: string | null;
          position_code?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'classroom_staff_classroom_id_fkey';
            columns: ['classroom_id'];
            referencedRelation: 'classrooms';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'classroom_staff_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      staff_shift_slots: {
        Row: {
          id: string;
          classroom_staff_id: string;
          day_of_week: number;
          slot: number;
        };
        Insert: {
          id?: string;
          classroom_staff_id: string;
          day_of_week: number;
          slot: number;
        };
        Update: {
          id?: string;
          classroom_staff_id?: string;
          day_of_week?: number;
          slot?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'staff_shift_slots_classroom_staff_id_fkey';
            columns: ['classroom_staff_id'];
            referencedRelation: 'classroom_staff';
            referencedColumns: ['id'];
          }
        ];
      };
      classroom_child_counts: {
        Row: {
          id: string;
          classroom_id: string;
          day_of_week: number;
          slot: number;
          total_children: number;
        };
        Insert: {
          id?: string;
          classroom_id: string;
          day_of_week: number;
          slot: number;
          total_children?: number;
        };
        Update: {
          id?: string;
          classroom_id?: string;
          day_of_week?: number;
          slot?: number;
          total_children?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'classroom_child_counts_classroom_id_fkey';
            columns: ['classroom_id'];
            referencedRelation: 'classrooms';
            referencedColumns: ['id'];
          }
        ];
      };
      children: {
        Row: {
          id: string;
          center_id: string;
          classroom_id: string | null;
          first_name: string;
          last_name: string;
          birthdate: string;
          enrolled_at: string;
          status: 'enrolled' | 'withdrawn';
          created_at: string;
          deleted_at: string | null;
          middle_name: string | null;
          preferred_name: string | null;
          student_code: string | null;
          enrollment_status: 'active' | 'inactive' | 'waitlist' | 'graduated';
          sex: string | null;
          primary_language: string | null;
          home_languages: string[];
          tags: string[];
          address_line1: string | null;
          address_line2: string | null;
          city: string | null;
          state: string | null;
          zip: string | null;
          graduates_on: string | null;
          photo_path: string | null;
          photo_consent: boolean;
          admin_notes: string | null;
        };
        Insert: {
          id?: string;
          center_id: string;
          classroom_id?: string | null;
          first_name: string;
          last_name: string;
          birthdate: string;
          enrolled_at?: string;
          status?: 'enrolled' | 'withdrawn';
          created_at?: string;
          deleted_at?: string | null;
          middle_name?: string | null;
          preferred_name?: string | null;
          student_code?: string | null;
          enrollment_status?: 'active' | 'inactive' | 'waitlist' | 'graduated';
          sex?: string | null;
          primary_language?: string | null;
          home_languages?: string[];
          tags?: string[];
          address_line1?: string | null;
          address_line2?: string | null;
          city?: string | null;
          state?: string | null;
          zip?: string | null;
          graduates_on?: string | null;
          photo_path?: string | null;
          photo_consent?: boolean;
          admin_notes?: string | null;
        };
        Update: {
          id?: string;
          center_id?: string;
          classroom_id?: string | null;
          first_name?: string;
          last_name?: string;
          birthdate?: string;
          enrolled_at?: string;
          status?: 'enrolled' | 'withdrawn';
          created_at?: string;
          deleted_at?: string | null;
          middle_name?: string | null;
          preferred_name?: string | null;
          student_code?: string | null;
          enrollment_status?: 'active' | 'inactive' | 'waitlist' | 'graduated';
          sex?: string | null;
          primary_language?: string | null;
          home_languages?: string[];
          tags?: string[];
          address_line1?: string | null;
          address_line2?: string | null;
          city?: string | null;
          state?: string | null;
          zip?: string | null;
          graduates_on?: string | null;
          photo_path?: string | null;
          photo_consent?: boolean;
          admin_notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'children_center_id_fkey';
            columns: ['center_id'];
            referencedRelation: 'centers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'children_classroom_id_fkey';
            columns: ['classroom_id'];
            referencedRelation: 'classrooms';
            referencedColumns: ['id'];
          }
        ];
      };
      child_attendance: {
        Row: {
          id: string;
          child_id: string;
          classroom_id: string;
          attendance_date: string;
          signed_in_at: string | null;
          signed_out_at: string | null;
          created_at: string;
          signed_in_by: string | null;
          sign_in_method: string | null;
          signed_out_by: string | null;
          sign_out_method: string | null;
        };
        Insert: {
          id?: string;
          child_id: string;
          classroom_id: string;
          attendance_date: string;
          signed_in_at?: string | null;
          signed_out_at?: string | null;
          created_at?: string;
          signed_in_by?: string | null;
          sign_in_method?: string | null;
          signed_out_by?: string | null;
          sign_out_method?: string | null;
        };
        Update: {
          id?: string;
          child_id?: string;
          classroom_id?: string;
          attendance_date?: string;
          signed_in_at?: string | null;
          signed_out_at?: string | null;
          created_at?: string;
          signed_in_by?: string | null;
          sign_in_method?: string | null;
          signed_out_by?: string | null;
          sign_out_method?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'child_attendance_child_id_fkey';
            columns: ['child_id'];
            referencedRelation: 'children';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'child_attendance_classroom_id_fkey';
            columns: ['classroom_id'];
            referencedRelation: 'classrooms';
            referencedColumns: ['id'];
          }
        ];
      };
      child_updates: {
        Row: {
          id: string;
          classroom_id: string;
          author_id: string | null;
          update_type: 'meal' | 'nap' | 'milestone' | 'incident';
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          classroom_id: string;
          author_id?: string | null;
          update_type: 'meal' | 'nap' | 'milestone' | 'incident';
          body: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          classroom_id?: string;
          author_id?: string | null;
          update_type?: 'meal' | 'nap' | 'milestone' | 'incident';
          body?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'child_updates_classroom_id_fkey';
            columns: ['classroom_id'];
            referencedRelation: 'classrooms';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'child_updates_author_id_fkey';
            columns: ['author_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      child_update_children: {
        Row: {
          update_id: string;
          child_id: string;
        };
        Insert: {
          update_id: string;
          child_id: string;
        };
        Update: {
          update_id?: string;
          child_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'child_update_children_update_id_fkey';
            columns: ['update_id'];
            referencedRelation: 'child_updates';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'child_update_children_child_id_fkey';
            columns: ['child_id'];
            referencedRelation: 'children';
            referencedColumns: ['id'];
          }
        ];
      };
      staff_notes: {
        Row: {
          id: string;
          user_id: string;
          center_id: string;
          written_by: string;
          content: string;
          category: 'general' | 'hr' | 'performance_review' | 'commendation' | 'incident';
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          center_id: string;
          written_by: string;
          content: string;
          category?: 'general' | 'hr' | 'performance_review' | 'commendation' | 'incident';
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          center_id?: string;
          written_by?: string;
          content?: string;
          category?: 'general' | 'hr' | 'performance_review' | 'commendation' | 'incident';
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'staff_notes_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      teacher_scores: {
        Row: {
          id: string;
          user_id: string;
          center_id: string;
          attendance_score: number;
          posting_score: number;
          lesson_plan_score: number;
          schedule_score: number;
          observation_score: number;
          center_score: number;
          teacher_visible_score: number | null;
          teacher_visible_as_of: string | null;
          computed_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          center_id: string;
          attendance_score?: number;
          posting_score?: number;
          lesson_plan_score?: number;
          schedule_score?: number;
          observation_score?: number;
          center_score?: number;
          teacher_visible_score?: number | null;
          teacher_visible_as_of?: string | null;
          computed_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          center_id?: string;
          attendance_score?: number;
          posting_score?: number;
          lesson_plan_score?: number;
          schedule_score?: number;
          observation_score?: number;
          center_score?: number;
          teacher_visible_score?: number | null;
          teacher_visible_as_of?: string | null;
          computed_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'teacher_scores_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      staff_profiles: {
        Row: {
          id: string;
          user_id: string;
          center_id: string;
          personal_email: string | null;
          emergency_contact_name: string | null;
          emergency_contact_relation: string | null;
          emergency_contact_phone: string | null;
          availability: Record<string, string>;
          sick_hours: number;
          vacation_hours: number;
          personal_hours: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          center_id: string;
          personal_email?: string | null;
          emergency_contact_name?: string | null;
          emergency_contact_relation?: string | null;
          emergency_contact_phone?: string | null;
          availability?: Record<string, string>;
          sick_hours?: number;
          vacation_hours?: number;
          personal_hours?: number;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          center_id?: string;
          personal_email?: string | null;
          emergency_contact_name?: string | null;
          emergency_contact_relation?: string | null;
          emergency_contact_phone?: string | null;
          availability?: Record<string, string>;
          sick_hours?: number;
          vacation_hours?: number;
          personal_hours?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'staff_profiles_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      staff_leave_days: {
        Row: {
          id: string;
          user_id: string;
          center_id: string;
          day: string;
          kind: 'pto' | 'sick' | 'personal' | 'unexcused';
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          center_id: string;
          day: string;
          kind: 'pto' | 'sick' | 'personal' | 'unexcused';
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          center_id?: string;
          day?: string;
          kind?: 'pto' | 'sick' | 'personal' | 'unexcused';
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'staff_leave_days_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      staff_requests: {
        Row: {
          id: string;
          user_id: string;
          center_id: string;
          type: 'schedule' | 'time_correction' | 'leave';
          status: 'pending' | 'approved' | 'rejected';
          for_date: string | null;
          time_entry_id: string | null;
          details: string | null;
          created_by: string | null;
          created_at: string;
          resolved_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          center_id: string;
          type: 'schedule' | 'time_correction' | 'leave';
          status?: 'pending' | 'approved' | 'rejected';
          for_date?: string | null;
          time_entry_id?: string | null;
          details?: string | null;
          created_by?: string | null;
          created_at?: string;
          resolved_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          center_id?: string;
          type?: 'schedule' | 'time_correction' | 'leave';
          status?: 'pending' | 'approved' | 'rejected';
          for_date?: string | null;
          time_entry_id?: string | null;
          details?: string | null;
          created_by?: string | null;
          created_at?: string;
          resolved_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'staff_requests_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      student_siblings: {
        Row: {
          child_id: string;
          sibling_id: string;
        };
        Insert: {
          child_id: string;
          sibling_id: string;
        };
        Update: {
          child_id?: string;
          sibling_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'student_siblings_child_id_fkey';
            columns: ['child_id'];
            referencedRelation: 'children';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'student_siblings_sibling_id_fkey';
            columns: ['sibling_id'];
            referencedRelation: 'children';
            referencedColumns: ['id'];
          }
        ];
      };
      guardians: {
        Row: {
          id: string;
          child_id: string;
          full_name: string;
          relationship: 'mother' | 'father' | 'grandparent' | 'guardian' | 'other';
          email: string | null;
          mobile_phone: string | null;
          employer: string | null;
          work_phone: string | null;
          is_primary: boolean;
          is_emergency: boolean;
          custody_note: string | null;
          is_pickup_restricted: boolean;
          kiosk_pin: string | null;
          app_user_id: string | null;
          invited_at: string | null;
          sort_order: number;
        };
        Insert: {
          id?: string;
          child_id: string;
          full_name: string;
          relationship: 'mother' | 'father' | 'grandparent' | 'guardian' | 'other';
          email?: string | null;
          mobile_phone?: string | null;
          employer?: string | null;
          work_phone?: string | null;
          is_primary?: boolean;
          is_emergency?: boolean;
          custody_note?: string | null;
          is_pickup_restricted?: boolean;
          kiosk_pin?: string | null;
          app_user_id?: string | null;
          invited_at?: string | null;
          sort_order?: number;
        };
        Update: {
          id?: string;
          child_id?: string;
          full_name?: string;
          relationship?: 'mother' | 'father' | 'grandparent' | 'guardian' | 'other';
          email?: string | null;
          mobile_phone?: string | null;
          employer?: string | null;
          work_phone?: string | null;
          is_primary?: boolean;
          is_emergency?: boolean;
          custody_note?: string | null;
          is_pickup_restricted?: boolean;
          kiosk_pin?: string | null;
          app_user_id?: string | null;
          invited_at?: string | null;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'guardians_child_id_fkey';
            columns: ['child_id'];
            referencedRelation: 'children';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'guardians_app_user_id_fkey';
            columns: ['app_user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      authorized_pickups: {
        Row: {
          id: string;
          child_id: string;
          full_name: string;
          relationship: string | null;
          phone: string | null;
          kiosk_pin: string | null;
          photo_path: string | null;
          authorized_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          child_id: string;
          full_name: string;
          relationship?: string | null;
          phone?: string | null;
          kiosk_pin?: string | null;
          photo_path?: string | null;
          authorized_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          child_id?: string;
          full_name?: string;
          relationship?: string | null;
          phone?: string | null;
          kiosk_pin?: string | null;
          photo_path?: string | null;
          authorized_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'authorized_pickups_child_id_fkey';
            columns: ['child_id'];
            referencedRelation: 'children';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'authorized_pickups_authorized_by_fkey';
            columns: ['authorized_by'];
            referencedRelation: 'guardians';
            referencedColumns: ['id'];
          }
        ];
      };
      student_health: {
        Row: {
          id: string;
          child_id: string;
          kind: string;
          name: string;
          detail: string | null;
          severity: string | null;
          rescue_med: string | null;
          rescue_med_location: string | null;
          rescue_med_expires: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          child_id: string;
          kind: string;
          name: string;
          detail?: string | null;
          severity?: string | null;
          rescue_med?: string | null;
          rescue_med_location?: string | null;
          rescue_med_expires?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          child_id?: string;
          kind?: string;
          name?: string;
          detail?: string | null;
          severity?: string | null;
          rescue_med?: string | null;
          rescue_med_location?: string | null;
          rescue_med_expires?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'student_health_child_id_fkey';
            columns: ['child_id'];
            referencedRelation: 'children';
            referencedColumns: ['id'];
          }
        ];
      };
      student_physicians: {
        Row: {
          id: string;
          child_id: string;
          name: string;
          practice: string | null;
          phone: string | null;
          last_visit: string | null;
        };
        Insert: {
          id?: string;
          child_id: string;
          name: string;
          practice?: string | null;
          phone?: string | null;
          last_visit?: string | null;
        };
        Update: {
          id?: string;
          child_id?: string;
          name?: string;
          practice?: string | null;
          phone?: string | null;
          last_visit?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'student_physicians_child_id_fkey';
            columns: ['child_id'];
            referencedRelation: 'children';
            referencedColumns: ['id'];
          }
        ];
      };
      student_documents: {
        Row: {
          id: string;
          child_id: string;
          doc_type: string;
          label: string;
          storage_path: string | null;
          status: 'current' | 'review_due' | 'missing' | 'na';
          is_required: boolean;
          is_confidential: boolean;
          signed_by: string | null;
          signed_on: string | null;
          review_due: string | null;
          uploaded_by: string | null;
          uploaded_at: string | null;
          superseded_by: string | null;
        };
        Insert: {
          id?: string;
          child_id: string;
          doc_type: string;
          label: string;
          storage_path?: string | null;
          status?: 'current' | 'review_due' | 'missing' | 'na';
          is_required?: boolean;
          is_confidential?: boolean;
          signed_by?: string | null;
          signed_on?: string | null;
          review_due?: string | null;
          uploaded_by?: string | null;
          uploaded_at?: string | null;
          superseded_by?: string | null;
        };
        Update: {
          id?: string;
          child_id?: string;
          doc_type?: string;
          label?: string;
          storage_path?: string | null;
          status?: 'current' | 'review_due' | 'missing' | 'na';
          is_required?: boolean;
          is_confidential?: boolean;
          signed_by?: string | null;
          signed_on?: string | null;
          review_due?: string | null;
          uploaded_by?: string | null;
          uploaded_at?: string | null;
          superseded_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'student_documents_child_id_fkey';
            columns: ['child_id'];
            referencedRelation: 'children';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'student_documents_uploaded_by_fkey';
            columns: ['uploaded_by'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'student_documents_superseded_by_fkey';
            columns: ['superseded_by'];
            referencedRelation: 'student_documents';
            referencedColumns: ['id'];
          }
        ];
      };
      student_descriptors: {
        Row: {
          id: string;
          center_id: string | null;
          group_key: string;
          label: string;
        };
        Insert: {
          id?: string;
          center_id?: string | null;
          group_key: string;
          label: string;
        };
        Update: {
          id?: string;
          center_id?: string | null;
          group_key?: string;
          label?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'student_descriptors_center_id_fkey';
            columns: ['center_id'];
            referencedRelation: 'centers';
            referencedColumns: ['id'];
          }
        ];
      };
      student_about: {
        Row: {
          child_id: string;
          selections: Record<string, unknown>;
          note: string | null;
          updated_at: string;
        };
        Insert: {
          child_id: string;
          selections?: Record<string, unknown>;
          note?: string | null;
          updated_at?: string;
        };
        Update: {
          child_id?: string;
          selections?: Record<string, unknown>;
          note?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'student_about_child_id_fkey';
            columns: ['child_id'];
            referencedRelation: 'children';
            referencedColumns: ['id'];
          }
        ];
      };
      student_schedule: {
        Row: {
          child_id: string;
          days: Record<string, unknown>;
          dropoff_window: string | null;
          pickup_window: string | null;
          transition_room: string | null;
          transition_date: string | null;
        };
        Insert: {
          child_id: string;
          days?: Record<string, unknown>;
          dropoff_window?: string | null;
          pickup_window?: string | null;
          transition_room?: string | null;
          transition_date?: string | null;
        };
        Update: {
          child_id?: string;
          days?: Record<string, unknown>;
          dropoff_window?: string | null;
          pickup_window?: string | null;
          transition_room?: string | null;
          transition_date?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'student_schedule_child_id_fkey';
            columns: ['child_id'];
            referencedRelation: 'children';
            referencedColumns: ['id'];
          }
        ];
      };
      frameworks: {
        Row: {
          id: string;
          name: string;
          publisher: string | null;
          version: string | null;
          is_licensed: boolean;
          is_system: boolean;
          center_id: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          publisher?: string | null;
          version?: string | null;
          is_licensed?: boolean;
          is_system?: boolean;
          center_id?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          publisher?: string | null;
          version?: string | null;
          is_licensed?: boolean;
          is_system?: boolean;
          center_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'frameworks_center_id_fkey';
            columns: ['center_id'];
            referencedRelation: 'centers';
            referencedColumns: ['id'];
          }
        ];
      };
      framework_domains: {
        Row: {
          id: string;
          framework_id: string;
          view: 'infant_toddler' | 'preschool';
          code: string;
          name: string;
          sort_order: number;
        };
        Insert: {
          id?: string;
          framework_id: string;
          view: 'infant_toddler' | 'preschool';
          code: string;
          name: string;
          sort_order?: number;
        };
        Update: {
          id?: string;
          framework_id?: string;
          view?: 'infant_toddler' | 'preschool';
          code?: string;
          name?: string;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'framework_domains_framework_id_fkey';
            columns: ['framework_id'];
            referencedRelation: 'frameworks';
            referencedColumns: ['id'];
          }
        ];
      };
      framework_subdomains: {
        Row: {
          id: string;
          domain_id: string;
          name: string;
          sort_order: number;
        };
        Insert: {
          id?: string;
          domain_id: string;
          name: string;
          sort_order?: number;
        };
        Update: {
          id?: string;
          domain_id?: string;
          name?: string;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'framework_subdomains_domain_id_fkey';
            columns: ['domain_id'];
            referencedRelation: 'framework_domains';
            referencedColumns: ['id'];
          }
        ];
      };
      framework_goals: {
        Row: {
          id: string;
          subdomain_id: string;
          code: string;
          goal_text: string | null;
          sort_order: number;
        };
        Insert: {
          id?: string;
          subdomain_id: string;
          code: string;
          goal_text?: string | null;
          sort_order?: number;
        };
        Update: {
          id?: string;
          subdomain_id?: string;
          code?: string;
          goal_text?: string | null;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'framework_goals_subdomain_id_fkey';
            columns: ['subdomain_id'];
            referencedRelation: 'framework_subdomains';
            referencedColumns: ['id'];
          }
        ];
      };
      goal_progressions: {
        Row: {
          id: string;
          goal_id: string;
          age_band_min_months: number;
          age_band_max_months: number;
          descriptor: string | null;
          indicators: string[] | null;
          sort_order: number;
        };
        Insert: {
          id?: string;
          goal_id: string;
          age_band_min_months: number;
          age_band_max_months: number;
          descriptor?: string | null;
          indicators?: string[] | null;
          sort_order?: number;
        };
        Update: {
          id?: string;
          goal_id?: string;
          age_band_min_months?: number;
          age_band_max_months?: number;
          descriptor?: string | null;
          indicators?: string[] | null;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'goal_progressions_goal_id_fkey';
            columns: ['goal_id'];
            referencedRelation: 'framework_goals';
            referencedColumns: ['id'];
          }
        ];
      };
      goal_crosswalks: {
        Row: {
          goal_id: string;
          standard_set: string;
          standard_code: string;
        };
        Insert: {
          goal_id: string;
          standard_set: string;
          standard_code: string;
        };
        Update: {
          goal_id?: string;
          standard_set?: string;
          standard_code?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'goal_crosswalks_goal_id_fkey';
            columns: ['goal_id'];
            referencedRelation: 'framework_goals';
            referencedColumns: ['id'];
          }
        ];
      };
      rating_levels: {
        Row: {
          id: string;
          center_id: string | null;
          level_number: number;
          label: string;
          color: string;
          sort_order: number;
        };
        Insert: {
          id?: string;
          center_id?: string | null;
          level_number: number;
          label: string;
          color: string;
          sort_order: number;
        };
        Update: {
          id?: string;
          center_id?: string | null;
          level_number?: number;
          label?: string;
          color?: string;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'rating_levels_center_id_fkey';
            columns: ['center_id'];
            referencedRelation: 'centers';
            referencedColumns: ['id'];
          }
        ];
      };
      checkpoints: {
        Row: {
          id: string;
          child_id: string;
          center_id: string;
          framework_id: string;
          view: 'infant_toddler' | 'preschool';
          period_label: string;
          period_start: string;
          period_end: string;
          status: 'draft' | 'submitted' | 'locked';
          rated_by: string | null;
          submitted_at: string | null;
        };
        Insert: {
          id?: string;
          child_id: string;
          center_id: string;
          framework_id: string;
          view: 'infant_toddler' | 'preschool';
          period_label: string;
          period_start: string;
          period_end: string;
          status?: 'draft' | 'submitted' | 'locked';
          rated_by?: string | null;
          submitted_at?: string | null;
        };
        Update: {
          id?: string;
          child_id?: string;
          center_id?: string;
          framework_id?: string;
          view?: 'infant_toddler' | 'preschool';
          period_label?: string;
          period_start?: string;
          period_end?: string;
          status?: 'draft' | 'submitted' | 'locked';
          rated_by?: string | null;
          submitted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'checkpoints_child_id_fkey';
            columns: ['child_id'];
            referencedRelation: 'children';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'checkpoints_center_id_fkey';
            columns: ['center_id'];
            referencedRelation: 'centers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'checkpoints_framework_id_fkey';
            columns: ['framework_id'];
            referencedRelation: 'frameworks';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'checkpoints_rated_by_fkey';
            columns: ['rated_by'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      checkpoint_ratings: {
        Row: {
          id: string;
          checkpoint_id: string;
          goal_id: string;
          rating_level_id: string | null;
          note: string | null;
          rated_at: string | null;
        };
        Insert: {
          id?: string;
          checkpoint_id: string;
          goal_id: string;
          rating_level_id?: string | null;
          note?: string | null;
          rated_at?: string | null;
        };
        Update: {
          id?: string;
          checkpoint_id?: string;
          goal_id?: string;
          rating_level_id?: string | null;
          note?: string | null;
          rated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'checkpoint_ratings_checkpoint_id_fkey';
            columns: ['checkpoint_id'];
            referencedRelation: 'checkpoints';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'checkpoint_ratings_goal_id_fkey';
            columns: ['goal_id'];
            referencedRelation: 'framework_goals';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'checkpoint_ratings_rating_level_id_fkey';
            columns: ['rating_level_id'];
            referencedRelation: 'rating_levels';
            referencedColumns: ['id'];
          }
        ];
      };
      observations: {
        Row: {
          id: string;
          child_id: string;
          classroom_id: string | null;
          center_id: string;
          observed_by: string;
          observed_on: string;
          title: string;
          body: string;
          photo_path: string | null;
          created_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          child_id: string;
          classroom_id?: string | null;
          center_id: string;
          observed_by: string;
          observed_on: string;
          title: string;
          body: string;
          photo_path?: string | null;
          created_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          child_id?: string;
          classroom_id?: string | null;
          center_id?: string;
          observed_by?: string;
          observed_on?: string;
          title?: string;
          body?: string;
          photo_path?: string | null;
          created_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'observations_child_id_fkey';
            columns: ['child_id'];
            referencedRelation: 'children';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'observations_classroom_id_fkey';
            columns: ['classroom_id'];
            referencedRelation: 'classrooms';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'observations_center_id_fkey';
            columns: ['center_id'];
            referencedRelation: 'centers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'observations_observed_by_fkey';
            columns: ['observed_by'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      observation_goals: {
        Row: {
          observation_id: string;
          goal_id: string;
        };
        Insert: {
          observation_id: string;
          goal_id: string;
        };
        Update: {
          observation_id?: string;
          goal_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'observation_goals_observation_id_fkey';
            columns: ['observation_id'];
            referencedRelation: 'observations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'observation_goals_goal_id_fkey';
            columns: ['goal_id'];
            referencedRelation: 'framework_goals';
            referencedColumns: ['id'];
          }
        ];
      };
      screenings: {
        Row: {
          id: string;
          child_id: string;
          center_id: string;
          instrument: string;
          interval_label: string | null;
          result_summary: string;
          outcome: string;
          administered_by: string | null;
          administered_on: string | null;
          due_on: string | null;
          superseded_by: string | null;
        };
        Insert: {
          id?: string;
          child_id: string;
          center_id: string;
          instrument: string;
          interval_label?: string | null;
          result_summary: string;
          outcome: string;
          administered_by?: string | null;
          administered_on?: string | null;
          due_on?: string | null;
          superseded_by?: string | null;
        };
        Update: {
          id?: string;
          child_id?: string;
          center_id?: string;
          instrument?: string;
          interval_label?: string | null;
          result_summary?: string;
          outcome?: string;
          administered_by?: string | null;
          administered_on?: string | null;
          due_on?: string | null;
          superseded_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'screenings_child_id_fkey';
            columns: ['child_id'];
            referencedRelation: 'children';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'screenings_center_id_fkey';
            columns: ['center_id'];
            referencedRelation: 'centers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'screenings_administered_by_fkey';
            columns: ['administered_by'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'screenings_superseded_by_fkey';
            columns: ['superseded_by'];
            referencedRelation: 'screenings';
            referencedColumns: ['id'];
          }
        ];
      };
      referrals: {
        Row: {
          id: string;
          child_id: string;
          center_id: string;
          stage: 'concern_raised' | 'parent_consent_pending' | 'referred' | 'input_submitted' | 'evaluation_scheduled' | 'eligible' | 'not_eligible' | 'services_active' | 'closed';
          concern_summary: string;
          raised_by: string;
          raised_on: string;
          agency: string | null;
          is_part_c: boolean;
          parent_consent_on: string | null;
          referred_on: string | null;
          evaluation_on: string | null;
          outcome_note: string | null;
          plan_type: string | null;
          plan_start: string | null;
          plan_review_due: string | null;
          closed_on: string | null;
        };
        Insert: {
          id?: string;
          child_id: string;
          center_id: string;
          stage?: 'concern_raised' | 'parent_consent_pending' | 'referred' | 'input_submitted' | 'evaluation_scheduled' | 'eligible' | 'not_eligible' | 'services_active' | 'closed';
          concern_summary: string;
          raised_by: string;
          raised_on: string;
          agency?: string | null;
          is_part_c: boolean;
          parent_consent_on?: string | null;
          referred_on?: string | null;
          evaluation_on?: string | null;
          outcome_note?: string | null;
          plan_type?: string | null;
          plan_start?: string | null;
          plan_review_due?: string | null;
          closed_on?: string | null;
        };
        Update: {
          id?: string;
          child_id?: string;
          center_id?: string;
          stage?: 'concern_raised' | 'parent_consent_pending' | 'referred' | 'input_submitted' | 'evaluation_scheduled' | 'eligible' | 'not_eligible' | 'services_active' | 'closed';
          concern_summary?: string;
          raised_by?: string;
          raised_on?: string;
          agency?: string | null;
          is_part_c?: boolean;
          parent_consent_on?: string | null;
          referred_on?: string | null;
          evaluation_on?: string | null;
          outcome_note?: string | null;
          plan_type?: string | null;
          plan_start?: string | null;
          plan_review_due?: string | null;
          closed_on?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'referrals_child_id_fkey';
            columns: ['child_id'];
            referencedRelation: 'children';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'referrals_center_id_fkey';
            columns: ['center_id'];
            referencedRelation: 'centers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'referrals_raised_by_fkey';
            columns: ['raised_by'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      referral_inputs: {
        Row: {
          id: string;
          referral_id: string;
          submitted_by: string;
          body: string;
          observation_ids: string[] | null;
          submitted_at: string;
        };
        Insert: {
          id?: string;
          referral_id: string;
          submitted_by: string;
          body: string;
          observation_ids?: string[] | null;
          submitted_at?: string;
        };
        Update: {
          id?: string;
          referral_id?: string;
          submitted_by?: string;
          body?: string;
          observation_ids?: string[] | null;
          submitted_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'referral_inputs_referral_id_fkey';
            columns: ['referral_id'];
            referencedRelation: 'referrals';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'referral_inputs_submitted_by_fkey';
            columns: ['submitted_by'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      plan_goals: {
        Row: {
          id: string;
          referral_id: string;
          goal_text: string;
          strategy: string | null;
          progress_note: string | null;
          reviewed_on: string | null;
        };
        Insert: {
          id?: string;
          referral_id: string;
          goal_text: string;
          strategy?: string | null;
          progress_note?: string | null;
          reviewed_on?: string | null;
        };
        Update: {
          id?: string;
          referral_id?: string;
          goal_text?: string;
          strategy?: string | null;
          progress_note?: string | null;
          reviewed_on?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'plan_goals_referral_id_fkey';
            columns: ['referral_id'];
            referencedRelation: 'referrals';
            referencedColumns: ['id'];
          }
        ];
      };
      staff_assignments: {
        Row: {
          id: string;
          center_id: string;
          classroom_id: string;
          user_id: string;
          starts_at: string;
          ends_at: string;
          source: 'schedule' | 'float' | 'substitute' | 'cover';
          assigned_by: string | null;
          note: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          center_id: string;
          classroom_id: string;
          user_id: string;
          starts_at: string;
          ends_at: string;
          source?: 'schedule' | 'float' | 'substitute' | 'cover';
          assigned_by?: string | null;
          note?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          center_id?: string;
          classroom_id?: string;
          user_id?: string;
          starts_at?: string;
          ends_at?: string;
          source?: 'schedule' | 'float' | 'substitute' | 'cover';
          assigned_by?: string | null;
          note?: string | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      classroom_nap_events: {
        Row: {
          id: string;
          classroom_id: string;
          state: 'awake' | 'settling' | 'resting';
          set_by: string;
          set_at: string;
        };
        Insert: {
          id?: string;
          classroom_id: string;
          state: 'awake' | 'settling' | 'resting';
          set_by: string;
          set_at?: string;
        };
        Update: {
          id?: string;
          classroom_id?: string;
          state?: 'awake' | 'settling' | 'resting';
          set_by?: string;
          set_at?: string;
        };
        Relationships: [];
      };
      staff_breaks: {
        Row: {
          id: string;
          classroom_id: string;
          user_id: string;
          started_at: string;
          ended_at: string | null;
          engine_snapshot: Record<string, unknown>;
        };
        Insert: {
          id?: string;
          classroom_id: string;
          user_id: string;
          started_at: string;
          ended_at?: string | null;
          engine_snapshot: Record<string, unknown>;
        };
        Update: {
          id?: string;
          classroom_id?: string;
          user_id?: string;
          started_at?: string;
          ended_at?: string | null;
          engine_snapshot?: Record<string, unknown>;
        };
        Relationships: [];
      };
      cover_sessions: {
        Row: {
          id: string;
          classroom_id: string;
          user_id: string;
          mode: 'preview' | 'cover';
          started_at: string;
          ended_at: string | null;
        };
        Insert: {
          id?: string;
          classroom_id: string;
          user_id: string;
          mode: 'preview' | 'cover';
          started_at: string;
          ended_at?: string | null;
        };
        Update: {
          id?: string;
          classroom_id?: string;
          user_id?: string;
          mode?: 'preview' | 'cover';
          started_at?: string;
          ended_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {};
    Functions: {};
    Enums: {
      license_type_enum: 'child_care_center' | 'letter_of_compliance';
      platform_role_enum: 'owner' | 'staff';
      center_role_enum: 'director' | 'admin' | 'lead_teacher' | 'assistant_teacher' | 'aide' | 'substitute';
      credential_type_enum: 'preschool_90hr' | 'infant_toddler_9hr' | 'communication_9hr' | 'ada_training' | 'first_aid_cpr' | 'child_abuse_prevention' | 'medication_administration' | 'cda' | 'directors_certification' | 'college_degree' | 'other';
      credential_status_enum: 'active' | 'expiring_soon' | 'expired' | 'no_expiration';
      age_group_enum: 'infant' | 'toddler' | 'two_year' | 'preschool' | 'school_age';
    };
  };
};
