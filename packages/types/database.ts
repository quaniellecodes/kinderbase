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
          joined_at: string;
          left_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          center_id: string;
          role: 'director' | 'admin' | 'lead_teacher' | 'assistant_teacher' | 'aide' | 'substitute';
          is_primary_center?: boolean;
          joined_at?: string;
          left_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          center_id?: string;
          role?: 'director' | 'admin' | 'lead_teacher' | 'assistant_teacher' | 'aide' | 'substitute';
          is_primary_center?: boolean;
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
