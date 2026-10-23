import { supabase } from '@/integrations/supabase/client';

export interface DeletedDocumentRecord {
  id: string; // original document ID
  title: string;
  file_name: string;
  file_path: string;
  file_size?: number | null;
  file_type?: string | null;
  folder_id: string | null;
  folder_name?: string | null;
  folder_path?: string | null;
  employee_id?: string | null;
  employee_name?: string | null;
  expiry_date?: string | null;
  follow_up_date?: string | null;
  deleted_at: string;
  deleted_by_name?: string | null;
}

const RECYCLE_BIN_STORAGE_KEY = 'niza_documents_recycle_bin';
const RETENTION_DAYS = 90;

/**
 * Get all deleted documents stored within the last 90 days.
 * Documents older than 90 days are automatically purged.
 */
export function getRecycleBinDocuments(): DeletedDocumentRecord[] {
  try {
    const raw = localStorage.getItem(RECYCLE_BIN_STORAGE_KEY);
    if (!raw) return [];
    const list: DeletedDocumentRecord[] = JSON.parse(raw);
    const now = Date.now();
    const ninetyDaysMs = RETENTION_DAYS * 24 * 60 * 60 * 1000;

    // Filter out items older than 90 days
    const active = list.filter(item => {
      const deletedTime = new Date(item.deleted_at).getTime();
      return !isNaN(deletedTime) && (now - deletedTime) <= ninetyDaysMs;
    });

    if (active.length !== list.length) {
      localStorage.setItem(RECYCLE_BIN_STORAGE_KEY, JSON.stringify(active));
    }

    return active.sort((a, b) => new Date(b.deleted_at).getTime() - new Date(a.deleted_at).getTime());
  } catch (err) {
    console.error('Error reading recycle bin documents:', err);
    return [];
  }
}

/**
 * Move a document to the Recycle Bin (90-day retention).
 * The database row is removed from the active documents view,
 * but the physical storage file is preserved so it can be restored.
 */
export async function moveToRecycleBin(
  doc: {
    id: string;
    title: string;
    file_name: string;
    file_path: string;
    folder_id: string | null;
    file_size?: number | null;
    file_type?: string | null;
    expiry_date?: string | null;
    follow_up_date?: string | null;
    employee?: { first_name: string; last_name: string } | null;
  },
  deletedByName?: string,
  folderInfo?: { name: string; path: string }
): Promise<boolean> {
  try {
    // 1. Get current recycle bin
    const current = getRecycleBinDocuments();

    // 2. Build record
    const record: DeletedDocumentRecord = {
      id: doc.id,
      title: doc.title,
      file_name: doc.file_name,
      file_path: doc.file_path,
      file_size: doc.file_size,
      file_type: doc.file_type,
      folder_id: doc.folder_id,
      folder_name: folderInfo?.name || null,
      folder_path: folderInfo?.path || null,
      employee_name: doc.employee ? `${doc.employee.first_name} ${doc.employee.last_name}`.trim() : null,
      expiry_date: doc.expiry_date || null,
      follow_up_date: doc.follow_up_date || null,
      deleted_at: new Date().toISOString(),
      deleted_by_name: deletedByName || null,
    };

    // Filter out any prior entry with same id, add new record
    const updated = [record, ...current.filter(item => item.id !== doc.id)];
    localStorage.setItem(RECYCLE_BIN_STORAGE_KEY, JSON.stringify(updated));

    // 3. Remove document record from active database table (leave storage file intact for restore)
    const { error: dbError } = await supabase.from('documents').delete().eq('id', doc.id);
    if (dbError) throw dbError;

    return true;
  } catch (err) {
    console.error('Error moving document to recycle bin:', err);
    throw err;
  }
}

/**
 * Restore a document from Recycle Bin back into its original folder (or fallback root folder).
 */
export async function restoreFromRecycleBin(docId: string): Promise<boolean> {
  try {
    const list = getRecycleBinDocuments();
    const doc = list.find(d => d.id === docId);
    if (!doc) {
      throw new Error('Document not found in recycle bin');
    }

    // Check if the target folder exists, if not fallback to root
    let targetFolderId = doc.folder_id;
    if (targetFolderId) {
      const { data: folderCheck } = await supabase
        .from('folders')
        .select('id')
        .eq('id', targetFolderId)
        .maybeSingle();

      if (!folderCheck) {
        // Fallback: look for root folder
        const { data: rootFolder } = await supabase
          .from('folders')
          .select('id')
          .eq('folder_type', 'root')
          .eq('path', 'Company Documents')
          .maybeSingle();
        targetFolderId = rootFolder?.id || null;
      }
    }

    // Re-insert document row into database
    const { error: insertError } = await supabase.from('documents').insert({
      id: doc.id,
      title: doc.title,
      file_name: doc.file_name,
      file_path: doc.file_path,
      file_size: doc.file_size || null,
      file_type: doc.file_type || null,
      folder_id: targetFolderId,
      expiry_date: doc.expiry_date || null,
      follow_up_date: doc.follow_up_date || null,
    });

    if (insertError) throw insertError;

    // Remove from recycle bin
    const updated = list.filter(d => d.id !== docId);
    localStorage.setItem(RECYCLE_BIN_STORAGE_KEY, JSON.stringify(updated));

    return true;
  } catch (err) {
    console.error('Error restoring document:', err);
    throw err;
  }
}

/**
 * Permanently delete a document from both Recycle Bin and Supabase storage.
 */
export async function permanentlyDeleteFromRecycleBin(docId: string): Promise<boolean> {
  try {
    const list = getRecycleBinDocuments();
    const doc = list.find(d => d.id === docId);
    if (!doc) return true;

    // Remove file from storage
    if (doc.file_path) {
      await supabase.storage.from('documents').remove([doc.file_path]);
    }

    // Remove from recycle bin
    const updated = list.filter(d => d.id !== docId);
    localStorage.setItem(RECYCLE_BIN_STORAGE_KEY, JSON.stringify(updated));

    return true;
  } catch (err) {
    console.error('Error permanently deleting document:', err);
    throw err;
  }
}

/**
 * Empty all items from the recycle bin permanently.
 */
export async function emptyRecycleBin(): Promise<boolean> {
  try {
    const list = getRecycleBinDocuments();
    const filePaths = list.map(d => d.file_path).filter(Boolean);
    if (filePaths.length > 0) {
      await supabase.storage.from('documents').remove(filePaths);
    }
    localStorage.removeItem(RECYCLE_BIN_STORAGE_KEY);
    return true;
  } catch (err) {
    console.error('Error emptying recycle bin:', err);
    throw err;
  }
}
