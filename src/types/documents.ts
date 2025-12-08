export interface Document {
  id: string;
  name: string;
  type: string;
  size: string;
  dateCreated: string;
  folder: string;
  uploadedBy: string;
  tags: string[];
  followUpDate?: string;
  version: number;
  readReceipts: string[];
  previewUrl?: string;
  isVerified?: boolean;
  verifiedBy?: string;
}

export interface Folder {
  id: string;
  name: string;
  icon: string;
  children?: Folder[];
  count: number;
}

export type ViewMode = 'list' | 'grid';
export type SortField = 'name' | 'type' | 'size' | 'dateCreated';
export type SortOrder = 'asc' | 'desc';
