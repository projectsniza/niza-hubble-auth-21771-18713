export interface Attachment {
  name: string;
  path: string;
  type: string;
  size: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  message_type: string;
  attachments: Attachment[] | null;
  created_at: string;
  is_edited: boolean;
  is_deleted: boolean;
  is_pinned: boolean;
  pinned_by: string | null;
  pinned_at: string | null;
  reply_to_id: string | null;
  reply_to?: Message | null;
  sender?: UserProfile;
  thread_count?: number;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role?: string;
}

export interface Conversation {
  id: string;
  name: string | null;
  is_group: boolean;
  created_by: string | null;
  organization_id: string | null;
  branch_id: string | null;
  created_at: string;
  updated_at: string;
  participants?: UserProfile[];
  last_message?: Message;
  unread_count?: number;
}

export interface UserPresence {
  user_id: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  last_seen: string;
  is_typing_in: string | null;
}

export interface MentionUser {
  id: string;
  name: string;
  role: string;
}
