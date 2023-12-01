export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      archer_profiles: {
        Row: {
          archery_gb_experience: string | null
          archery_gb_membership: string | null
          club: string | null
          date_of_birth: string
          first_name: string
          gender: string
          id: string
          is_disabled: boolean
          last_name: string
          university: string | null
        }
        Insert: {
          archery_gb_experience?: string | null
          archery_gb_membership?: string | null
          club?: string | null
          date_of_birth: string
          first_name: string
          gender: string
          id: string
          is_disabled?: boolean
          last_name: string
          university?: string | null
        }
        Update: {
          archery_gb_experience?: string | null
          archery_gb_membership?: string | null
          club?: string | null
          date_of_birth?: string
          first_name?: string
          gender?: string
          id?: string
          is_disabled?: boolean
          last_name?: string
          university?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "archer_profiles_club_fkey"
            columns: ["club"]
            isOneToOne: false
            referencedRelation: "club_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "archer_profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "archer_profiles_university_fkey"
            columns: ["university"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["name"]
          }
        ]
      }
      archers_in_competitions: {
        Row: {
          competition_id: string
          user_id: string
        }
        Insert: {
          competition_id: string
          user_id: string
        }
        Update: {
          competition_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "archers_in_competitions_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "archers_in_competitions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      club_profiles: {
        Row: {
          id: string
          name: string
          university: string | null
        }
        Insert: {
          id: string
          name: string
          university?: string | null
        }
        Update: {
          id?: string
          name?: string
          university?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "club_profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_profiles_university_fkey"
            columns: ["university"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["name"]
          }
        ]
      }
      competitions: {
        Row: {
          address: Json | null
          completed: boolean
          finished_at: string | null
          host: string
          id: string
          league: string | null
          name: string
          scheduled_for: string | null
          started_at: string | null
        }
        Insert: {
          address?: Json | null
          completed?: boolean
          finished_at?: string | null
          host: string
          id?: string
          league?: string | null
          name: string
          scheduled_for?: string | null
          started_at?: string | null
        }
        Update: {
          address?: Json | null
          completed?: boolean
          finished_at?: string | null
          host?: string
          id?: string
          league?: string | null
          name?: string
          scheduled_for?: string | null
          started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "competitions_host_fkey"
            columns: ["host"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitions_league_fkey"
            columns: ["league"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["name"]
          }
        ]
      }
      judges_in_competitions: {
        Row: {
          competition_id: string
          user_id: string
        }
        Insert: {
          competition_id: string
          user_id: string
        }
        Update: {
          competition_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "judges_in_competitions_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "judges_in_competitions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      leagues: {
        Row: {
          name: string
        }
        Insert: {
          name: string
        }
        Update: {
          name?: string
        }
        Relationships: []
      }
      matches: {
        Row: {
          competition: string | null
          finished_at: string
          host: string | null
          id: string
          name: string
          started_at: string
        }
        Insert: {
          competition?: string | null
          finished_at: string
          host?: string | null
          id?: string
          name: string
          started_at: string
        }
        Update: {
          competition?: string | null
          finished_at?: string
          host?: string | null
          id?: string
          name?: string
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_competition_fkey"
            columns: ["competition"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_host_fkey"
            columns: ["host"]
            isOneToOne: false
            referencedRelation: "archer_profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      rounds: {
        Row: {
          created_by: string | null
          is_competitive: boolean
          name: string
          specifications: Json
        }
        Insert: {
          created_by?: string | null
          is_competitive: boolean
          name: string
          specifications: Json
        }
        Update: {
          created_by?: string | null
          is_competitive?: boolean
          name?: string
          specifications?: Json
        }
        Relationships: [
          {
            foreignKeyName: "rounds_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      scoresheets: {
        Row: {
          arrows_per_end: number
          arrows_shot: number
          bow: string | null
          competition: string | null
          created_at: string
          id: string
          match_id: string
          round: string | null
          scoresheet: Json
          user_id: string
        }
        Insert: {
          arrows_per_end: number
          arrows_shot: number
          bow?: string | null
          competition?: string | null
          created_at?: string
          id?: string
          match_id: string
          round?: string | null
          scoresheet: Json
          user_id: string
        }
        Update: {
          arrows_per_end?: number
          arrows_shot?: number
          bow?: string | null
          competition?: string | null
          created_at?: string
          id?: string
          match_id?: string
          round?: string | null
          scoresheet?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scoresheets_competition_fkey"
            columns: ["competition"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scoresheets_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scoresheets_round_fkey"
            columns: ["round"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["name"]
          },
          {
            foreignKeyName: "scoresheets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      universities: {
        Row: {
          address: Json | null
          city: string
          country: string
          name: string
        }
        Insert: {
          address?: Json | null
          city: string
          country: string
          name: string
        }
        Update: {
          address?: Json | null
          city?: string
          country?: string
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      hello: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
