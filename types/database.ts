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
            original_url: string | null;
            final_url: string | null;
            page_title: string | null;
            captured_at: string;
            capture_status: string;
            error_message: string | null;
            trigger_type: string;
            created_at: string;
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
            original_url?: string | null;
            final_url?: string | null;
            page_title?: string | null;
            captured_at?: string;
            capture_status?: string;
            error_message?: string | null;
            trigger_type?: string;
            created_at?: string;
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
            original_url?: string | null;
            final_url?: string | null;
            page_title?: string | null;
            captured_at?: string;
            capture_status?: string;
            error_message?: string | null;
            trigger_type?: string;
            created_at?: string;
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
    };

    Views: {};

    Functions: {};

    Enums: {};

    CompositeTypes: {};
  };
};
