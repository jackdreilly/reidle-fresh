export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[]

export interface Database {
  public: {
    Tables: {
      alembic_version: {
        Row: {
          version_num: string
        }
        Insert: {
          version_num: string
        }
        Update: {
          version_num?: string
        }
      }
      answers: {
        Row: {
          answer: string
        }
        Insert: {
          answer: string
        }
        Update: {
          answer?: string
        }
      }
      battles: {
        Row: {
          battle_id: number
          created_at: string
          state: Json
          updated_at: string
          users: Json
        }
        Insert: {
          battle_id?: number
          created_at?: string
          state?: Json
          updated_at?: string
          users?: Json
        }
        Update: {
          battle_id?: number
          created_at?: string
          state?: Json
          updated_at?: string
          users?: Json
        }
      }
      challenges: {
        Row: {
          answer: string
          challenge_id: number
          created_at: string
          starting_word: string
        }
        Insert: {
          answer: string
          challenge_id?: number
          created_at?: string
          starting_word: string
        }
        Update: {
          answer?: string
          challenge_id?: number
          created_at?: string
          starting_word?: string
        }
      }
      daily_words: {
        Row: {
          answer: string
          day: string
          word: string
        }
        Insert: {
          answer: string
          day: string
          word: string
        }
        Update: {
          answer?: string
          day?: string
          word?: string
        }
      }
      message_reads: {
        Row: {
          last_read: string
          name: string
        }
        Insert: {
          last_read: string
          name: string
        }
        Update: {
          last_read?: string
          name?: string
        }
      }
      messages: {
        Row: {
          created_at: string
          message: string
          message_id: number
          name: string
        }
        Insert: {
          created_at?: string
          message?: string
          message_id?: number
          name?: string
        }
        Update: {
          created_at?: string
          message?: string
          message_id?: number
          name?: string
        }
      }
      players: {
        Row: {
          created_at: string
          email: string | null
          name: string
          notifications_enabled: boolean
        }
        Insert: {
          created_at?: string
          email?: string | null
          name: string
          notifications_enabled?: boolean
        }
        Update: {
          created_at?: string
          email?: string | null
          name?: string
          notifications_enabled?: boolean
        }
      }
      submissions: {
        Row: {
          challenge_id: number | null
          created_at: string
          day: string
          name: string
          paste: string
          penalty: number
          playback: Json
          rank: number
          score: number
          submission_id: number
          time: number
          word: string
        }
        Insert: {
          challenge_id?: number | null
          created_at?: string
          day?: string
          name: string
          paste?: string
          penalty: number
          playback?: Json
          rank?: number
          score?: number
          submission_id?: number
          time: number
          word?: string
        }
        Update: {
          challenge_id?: number | null
          created_at?: string
          day?: string
          name?: string
          paste?: string
          penalty?: number
          playback?: Json
          rank?: number
          score?: number
          submission_id?: number
          time?: number
          word?: string
        }
      }
      winners: {
        Row: {
          name: string
          week: string
        }
        Insert: {
          name: string
          week: string
        }
        Update: {
          name?: string
          week?: string
        }
      }
      words: {
        Row: {
          word: string
        }
        Insert: {
          word: string
        }
        Update: {
          word?: string
        }
      }
    }
    Views: {
      emails_to_send: {
        Row: {
          email: string | null
          name: string | null
        }
      }
      weekly_scores: {
        Row: {
          name: string | null
          week: string | null
          week_rank: number | null
          week_score: number | null
          week_time: number | null
        }
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
