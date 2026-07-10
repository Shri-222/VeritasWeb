export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      monitors: {
        Row: {
            id: string;
            user_id: string;
            url: string;
            normalized_url: string;
            frequency: 'hourly' | 'daily' | 'weekly';
            status: 'active' | 'paused';

            session_cookies:
            | {
                name: string;
                value: string;
                }[]
            | null;

            created_at: string;
            updated_at: string;
            last_captured_at: string | null;
            next_capture_at: string | null;
            last_capture_status: string | null;
            last_capture_error: string | null;
            capture_count: number;
            capture_lock_until: string | null;
            case_id: string | null;
        };

        Insert: {
            id?: string;
            user_id: string;
            url: string;
            normalized_url: string;

            frequency:
            | 'hourly'
            | 'daily'
            | 'weekly';

            status?: 'active' | 'paused';

            session_cookies?:
            | {
                name: string;
                value: string;
                }[]
            | null;

            created_at?: string;
            updated_at?: string;
            last_captured_at?: string | null;
            next_capture_at?: string | null;
            last_capture_status?: string | null;
            last_capture_error?: string | null;
            capture_count?: number;
            capture_lock_until?: string | null;
            case_id?: string | null;
        };

        Update: {
            id?: string;
            user_id?: string;
            url?: string;
            normalized_url?: string;

            frequency?:
            | 'hourly'
            | 'daily'
            | 'weekly';

            status?: 'active' | 'paused';

            session_cookies?:
            | {
                name: string;
                value: string;
                }[]
            | null;

            created_at?: string;
            updated_at?: string;
            last_captured_at?: string | null;
            next_capture_at?: string | null;
            last_capture_status?: string | null;
            last_capture_error?: string | null;
            capture_count?: number;
            capture_lock_until?: string | null;
            case_id?: string | null;
        };

        Relationships: [
            {
            foreignKeyName:
                'monitors_user_id_fkey';

            columns: ['user_id'];

            referencedRelation:
                'users';

            referencedColumns: ['id'];
            }
        ];
        };

      captures: {
        Row: {
            id: string;
            monitor_id: string;
            timestamp: string;
            storage_url: string;
            sha256_hash: string;
            tsa_token: string | null;
            status_code: number;
            headers: Json;
            previous_capture_hash: string | null;
            screenshot_path: string | null;
            html_path: string | null;
            screenshot_sha256: string | null;
            html_sha256: string | null;
            manifest_sha256: string | null;
            manifest_path: string | null;
            original_url: string | null;
            final_url: string | null;
            page_title: string | null;
            captured_at: string;
            capture_status: string;
            error_message: string | null;
            trigger_type: string;
            created_at: string;
            storage_provider: string;
            timestamp_provider: string | null;
            timestamp_status: 'not_configured' | 'pending' | 'issued' | 'failed';
            timestamp_token_path: string | null;
            timestamp_requested_at: string | null;
            timestamp_issued_at: string | null;
        };

        Insert: {
            id?: string;
            monitor_id: string;
            timestamp?: string;
            storage_url: string;
            sha256_hash: string;
            tsa_token?: string | null;
            status_code: number;
            headers?: Json;
            previous_capture_hash?: string | null;
            screenshot_path?: string | null;
            html_path?: string | null;
            screenshot_sha256?: string | null;
            html_sha256?: string | null;
            manifest_sha256?: string | null;
            manifest_path?: string | null;
            original_url?: string | null;
            final_url?: string | null;
            page_title?: string | null;
            captured_at?: string;
            capture_status?: string;
            error_message?: string | null;
            trigger_type?: string;
            created_at?: string;
            storage_provider?: string;
            timestamp_provider?: string | null;
            timestamp_status?: 'not_configured' | 'pending' | 'issued' | 'failed';
            timestamp_token_path?: string | null;
            timestamp_requested_at?: string | null;
            timestamp_issued_at?: string | null;
        };

        Update: {
            id?: string;
            monitor_id?: string;
            timestamp?: string;
            storage_url?: string;
            sha256_hash?: string;
            tsa_token?: string | null;
            status_code?: number;
            headers?: Json;
            previous_capture_hash?: string | null;
            screenshot_path?: string | null;
            html_path?: string | null;
            screenshot_sha256?: string | null;
            html_sha256?: string | null;
            manifest_sha256?: string | null;
            manifest_path?: string | null;
            original_url?: string | null;
            final_url?: string | null;
            page_title?: string | null;
            captured_at?: string;
            capture_status?: string;
            error_message?: string | null;
            trigger_type?: string;
            created_at?: string;
            storage_provider?: string;
            timestamp_provider?: string | null;
            timestamp_status?: 'not_configured' | 'pending' | 'issued' | 'failed';
            timestamp_token_path?: string | null;
            timestamp_requested_at?: string | null;
            timestamp_issued_at?: string | null;
        };

        Relationships: [
            {
            foreignKeyName: 'captures_monitor_id_fkey';
            columns: ['monitor_id'];
            referencedRelation: 'monitors';
            referencedColumns: ['id'];
            }
        ];
        };

      cases: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          status: 'active' | 'archived';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
          status?: 'active' | 'archived';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          description?: string | null;
          status?: 'active' | 'archived';
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      capture_diffs: {
        Row: {
          id: string;
          monitor_id: string;
          previous_capture_id: string;
          current_capture_id: string;
          changed: boolean;
          change_score: number | null;
          text_added_count: number;
          text_removed_count: number;
          text_diff: Json;
          metadata_diff: Json;
          visual_diff_path: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          monitor_id: string;
          previous_capture_id: string;
          current_capture_id: string;
          changed?: boolean;
          change_score?: number | null;
          text_added_count?: number;
          text_removed_count?: number;
          text_diff?: Json;
          metadata_diff?: Json;
          visual_diff_path?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          monitor_id?: string;
          previous_capture_id?: string;
          current_capture_id?: string;
          changed?: boolean;
          change_score?: number | null;
          text_added_count?: number;
          text_removed_count?: number;
          text_diff?: Json;
          metadata_diff?: Json;
          visual_diff_path?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };

      notification_endpoints: {
        Row: {
          id: string;
          user_id: string;
          type: 'webhook' | 'email';
          destination: string;
          enabled: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: 'webhook' | 'email';
          destination: string;
          enabled?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: 'webhook' | 'email';
          destination?: string;
          enabled?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };

      monitor_notification_settings: {
        Row: {
          monitor_id: string;
          notify_on_change: boolean;
          notify_on_failure: boolean;
          notify_on_status_change: boolean;
        };
        Insert: {
          monitor_id: string;
          notify_on_change?: boolean;
          notify_on_failure?: boolean;
          notify_on_status_change?: boolean;
        };
        Update: {
          monitor_id?: string;
          notify_on_change?: boolean;
          notify_on_failure?: boolean;
          notify_on_status_change?: boolean;
        };
        Relationships: [];
      };
    };

    Views: {};

    Functions: {
      increment_monitor_capture_success: {
        Args: {
          p_monitor_id: string;
          p_captured_at: string;
          p_next_capture_at: string;
        };
        Returns: undefined;
      };
    };

    Enums: {};

    CompositeTypes: {};
  };
};
