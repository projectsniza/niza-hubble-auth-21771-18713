import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

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

// Older versions kept the recycle bin in each browser. Anything still there is imported once.
const LEGACY_STORAGE_KEY = 'niza_documents_recycle_bin';
const RETENTION_DAYS = 90;

async function importLegacyBin(userId?: string | null) {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(LEGACY_STORAGE_KEY);
  } catch {
    return; // storage unavailable: nothing to import
  }
  if (!raw) return;
  try {
    const list: DeletedDocumentRecord[] = JSON.parse(raw);
    if (list.length > 0) {
      const rows = list.map(d => ({
        id: d.id,
        original: {
          id: d.id,
          title: d.title,
          file_name: d.file_name,
          file_path: d.file_path,
          file_size: d.file_size ?? null,
          file_type: d.file_type ?? null,
          folder_id: d.folder_id,
          expiry_date: d.expiry_date ?? null,
          follow_up_date: d.follow_up_date ?? null,
        } as Json,
        title: d.title,
        file_name: d.file_name,
        file_path: d.file_path,
        folder_name: d.folder_name ?? null,
        folder_path: d.folder_path ?? null,
        employee_name: d.employee_name ?? null,
        deleted_at: d.deleted_at,
        deleted_by: userId ?? null,
        deleted_by_name: d.deleted_by_name ?? null,
      }));
      const { error } = await supabase.from('deleted_documents').upsert(rows, { onConflict: 'id' });
      if (error) throw error;
    }
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch (err) {
    console.warn('Could not import the old recycle bin yet:', err);
  }
}

function toRecord(r: any): DeletedDocumentRecord {
  const o = (r.original || {}) as Record<string, any>;
  return {
    id: r.id,
    title: r.title || o.title || '',
    file_name: r.file_name || o.file_name || '',
    file_path: r.file_path || o.file_path || '',
    file_size: o.file_size ?? null,
    file_type: o.file_type ?? null,
    folder_id: o.folder_id ?? null,
    folder_name: r.folder_name,
    folder_path: r.folder_path,
    employee_id: o.employee_id ?? null,
    employee_name: r.employee_name,
    expiry_date: o.expiry_date ?? null,
    follow_up_date: o.follow_up_date ?? null,
    deleted_at: r.deleted_at,
    deleted_by_name: r.deleted_by_name,
  };
}

/** Deleted documents from the last 90 days. Older ones are purged (database row and stored file). */
export async function getRecycleBinDocuments(): Promise<DeletedDocumentRecord[]> {
  const { data: auth } = await supabase.auth.getUser();
  await importLegacyBin(auth?.user?.id);

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: expired } = await supabase.from('deleted_documents').select('id, file_path').lt('deleted_at', cutoff);
  if (expired && expired.length > 0) {
    const paths = expired.map(e => e.file_path).filter(Boolean) as string[];
    if (paths.length > 0) await supabase.storage.from('documents').remove(paths);
    await supabase.from('deleted_documents').delete().in('id', expired.map(e => e.id));
  }

  const { data, error } = await supabase
    .from('deleted_documents')
    .select('*')
    .order('deleted_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(toRecord);
}

export async function getRecycleBinCount(): Promise<number> {
  const { count } = await supabase.from('deleted_documents').select('id', { count: 'exact', head: true });
  return count || 0;
}

/**
 * Move a document to the Recycle Bin (90-day retention). The complete row is kept, so a restore
 * brings back the employee, folder, dates and everything else. The stored file is not touched.
 */
export async function moveToRecycleBin(
  doc: { id: string; [key: string]: any },
  deletedByName?: string,
  folderInfo?: { name: string; path: string }
): Promise<boolean> {
  const { data: auth } = await supabase.auth.getUser();

  // Read the full row (the screen's copy may be missing columns).
  const { data: full, error: readError } = await supabase.from('documents').select('*').eq('id', doc.id).maybeSingle();
  if (readError) throw readError;
  const row = (full || doc) as Record<string, any>;

  const employeeName = doc.employee ? `${doc.employee.first_name} ${doc.employee.last_name}`.trim() : null;
  const { error: binError } = await supabase.from('deleted_documents').upsert(
    {
      id: doc.id,
      original: row as Json,
      title: row.title,
      file_name: row.file_name,
      file_path: row.file_path,
      folder_name: folderInfo?.name || null,
      folder_path: folderInfo?.path || null,
      employee_name: employeeName,
      organization_id: row.organization_id ?? null,
      branch_id: row.branch_id ?? null,
      deleted_by: auth?.user?.id ?? null,
      deleted_by_name: deletedByName || null,
    },
    { onConflict: 'id' }
  );
  if (binError) throw binError;

  const { error: dbError } = await supabase.from('documents').delete().eq('id', doc.id);
  if (dbError) {
    // Do not leave a recycle-bin copy of a document that is still live.
    await supabase.from('deleted_documents').delete().eq('id', doc.id);
    throw dbError;
  }
  return true;
}

/** Restore a document with all its original fields, into its folder (or the root folder if that folder is gone). */
export async function restoreFromRecycleBin(docId: string): Promise<boolean> {
  const { data: bin, error } = await supabase.from('deleted_documents').select('*').eq('id', docId).maybeSingle();
  if (error) throw error;
  if (!bin) throw new Error('Document not found in recycle bin');

  const original = { ...((bin.original || {}) as Record<string, any>) };

  if (original.folder_id) {
    const { data: folderCheck } = await supabase.from('folders').select('id').eq('id', original.folder_id).maybeSingle();
    if (!folderCheck) {
      const { data: rootFolder } = await supabase
        .from('folders')
        .select('id')
        .or('folder_type.eq.root,parent_id.is.null')
        .limit(1)
        .maybeSingle();
      original.folder_id = rootFolder?.id || null;
    }
  }

  const { error: insertError } = await supabase.from('documents').insert(original as any);
  if (insertError) throw insertError;

  const { error: removeError } = await supabase.from('deleted_documents').delete().eq('id', docId);
  if (removeError) throw removeError;
  return true;
}

/** Permanently delete one document from the Recycle Bin and from storage. */
export async function permanentlyDeleteFromRecycleBin(docId: string): Promise<boolean> {
  const { data: bin } = await supabase.from('deleted_documents').select('file_path').eq('id', docId).maybeSingle();
  if (!bin) return true;
  if (bin.file_path) {
    const { error: storageError } = await supabase.storage.from('documents').remove([bin.file_path]);
    if (storageError) throw storageError;
  }
  const { error } = await supabase.from('deleted_documents').delete().eq('id', docId);
  if (error) throw error;
  return true;
}

/** Empty the Recycle Bin permanently. */
export async function emptyRecycleBin(): Promise<boolean> {
  const { data: rows, error } = await supabase.from('deleted_documents').select('id, file_path');
  if (error) throw error;
  const paths = (rows || []).map(r => r.file_path).filter(Boolean) as string[];
  if (paths.length > 0) {
    const { error: storageError } = await supabase.storage.from('documents').remove(paths);
    if (storageError) throw storageError;
  }
  if ((rows || []).length > 0) {
    const { error: delError } = await supabase.from('deleted_documents').delete().in('id', rows.map(r => r.id));
    if (delError) throw delError;
  }
  return true;
}
