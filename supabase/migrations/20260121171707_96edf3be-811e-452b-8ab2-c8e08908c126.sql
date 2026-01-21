-- Ensure leave-documents storage bucket exists
insert into storage.buckets (id, name, public)
values ('leave-documents', 'leave-documents', false)
on conflict (id) do nothing;

-- Storage policies for leave-documents
-- NOTE: policies live on storage.objects (Supabase-managed table)

-- Clean up any conflicting/old policies (safe to re-run)
drop policy if exists "Employees can upload their own leave documents" on storage.objects;
drop policy if exists "Employees can view their own leave documents" on storage.objects;
drop policy if exists "Employees can update their own leave documents" on storage.objects;
drop policy if exists "Employees can delete their own leave documents" on storage.objects;
drop policy if exists "Admins can manage all leave documents" on storage.objects;

-- Employees: INSERT
create policy "Employees can upload their own leave documents"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'leave-documents'
  and exists (
    select 1
    from public.employees e
    where e.user_id = auth.uid()
      and e.id::text = (storage.foldername(name))[1]
  )
);

-- Employees: SELECT
create policy "Employees can view their own leave documents"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'leave-documents'
  and exists (
    select 1
    from public.employees e
    where e.user_id = auth.uid()
      and e.id::text = (storage.foldername(name))[1]
  )
);

-- Employees: UPDATE
create policy "Employees can update their own leave documents"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'leave-documents'
  and exists (
    select 1
    from public.employees e
    where e.user_id = auth.uid()
      and e.id::text = (storage.foldername(name))[1]
  )
)
with check (
  bucket_id = 'leave-documents'
  and exists (
    select 1
    from public.employees e
    where e.user_id = auth.uid()
      and e.id::text = (storage.foldername(name))[1]
  )
);

-- Employees: DELETE
create policy "Employees can delete their own leave documents"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'leave-documents'
  and exists (
    select 1
    from public.employees e
    where e.user_id = auth.uid()
      and e.id::text = (storage.foldername(name))[1]
  )
);

-- Admin/HR/Manager: manage bucket
create policy "Admins can manage all leave documents"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'leave-documents'
  and exists (
    select 1
    from public.user_roles
    where user_roles.user_id = auth.uid()
      and user_roles.role = any(array['super_admin'::app_role, 'hr'::app_role, 'manager'::app_role])
  )
)
with check (
  bucket_id = 'leave-documents'
  and exists (
    select 1
    from public.user_roles
    where user_roles.user_id = auth.uid()
      and user_roles.role = any(array['super_admin'::app_role, 'hr'::app_role, 'manager'::app_role])
  )
);
