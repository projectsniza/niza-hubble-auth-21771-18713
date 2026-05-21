
-- 1. Branch categories memory
create table if not exists public.niza_branch_categories (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  category_code text not null,
  raw_label text,
  display_name text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (branch_id, category_code)
);
alter table public.niza_branch_categories enable row level security;

create policy "branch members can view their branch categories"
  on public.niza_branch_categories for select
  using (
    public.has_role(auth.uid(),'super_admin')
    or branch_id in (select branch_id from public.profiles where id = auth.uid())
  );
create policy "super admin manage branch categories"
  on public.niza_branch_categories for all
  using (public.has_role(auth.uid(),'super_admin'))
  with check (public.has_role(auth.uid(),'super_admin'));
create policy "system insert branch categories"
  on public.niza_branch_categories for insert
  with check (auth.uid() is not null);

-- 2. Category alerts (unknown till department detected)
create table if not exists public.niza_category_alerts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  branch_id uuid references public.branches(id) on delete cascade,
  raw_label text not null,
  sample_amount numeric,
  source_filename text,
  sale_date date,
  status text not null default 'pending', -- pending | mapped | ignored
  mapped_to_code text,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  resolved_by uuid,
  resolved_at timestamptz
);
alter table public.niza_category_alerts enable row level security;

create policy "view alerts for own branch or super admin"
  on public.niza_category_alerts for select
  using (
    public.has_role(auth.uid(),'super_admin')
    or branch_id in (select branch_id from public.profiles where id = auth.uid())
  );
create policy "branch users create alerts"
  on public.niza_category_alerts for insert
  with check (auth.uid() is not null);
create policy "super admin manage alerts"
  on public.niza_category_alerts for update
  using (public.has_role(auth.uid(),'super_admin'))
  with check (public.has_role(auth.uid(),'super_admin'));
create policy "super admin delete alerts"
  on public.niza_category_alerts for delete
  using (public.has_role(auth.uid(),'super_admin'));

-- 3. Invoices (manual + AI agent)
create table if not exists public.niza_invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  branch_id uuid references public.branches(id) on delete set null,
  invoice_date date,
  supplier text,
  invoice_number text,
  category text,
  net numeric,
  vat numeric,
  gross numeric,
  currency text default 'GBP',
  source text not null default 'manual', -- manual | email_agent
  file_path text,
  email_message_id text,
  raw_extracted jsonb,
  extraction_status text default 'pending', -- pending | extracted | failed | review
  extraction_error text,
  ai_model text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists niza_invoices_branch_date_idx on public.niza_invoices(branch_id, invoice_date);
alter table public.niza_invoices enable row level security;

create policy "view invoices for own branch or super admin"
  on public.niza_invoices for select
  using (
    public.has_role(auth.uid(),'super_admin')
    or branch_id in (select branch_id from public.profiles where id = auth.uid())
  );
create policy "branch users create invoices"
  on public.niza_invoices for insert
  with check (auth.uid() is not null);
create policy "branch users update own branch invoices"
  on public.niza_invoices for update
  using (
    public.has_role(auth.uid(),'super_admin')
    or branch_id in (select branch_id from public.profiles where id = auth.uid())
  );
create policy "super admin delete invoices"
  on public.niza_invoices for delete
  using (public.has_role(auth.uid(),'super_admin'));

-- 4. AI Email Agents (super admin only)
create table if not exists public.niza_email_agents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  branch_id uuid references public.branches(id) on delete set null,
  organization_id uuid,
  ai_provider text not null default 'openai', -- openai | gemini
  ai_model text,
  ai_api_key text, -- super admin only, used server-side
  mailbox_type text not null default 'imap', -- imap | outlook | gmail
  imap_host text,
  imap_port integer default 993,
  imap_user text,
  imap_password text,
  imap_use_tls boolean default true,
  outlook_connection_id text,
  gmail_connection_id text,
  folder text default 'INBOX',
  supplier_filters text[],
  schedule_cron text,
  is_active boolean default true,
  last_run_at timestamptz,
  last_status text,
  last_error text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.niza_email_agents enable row level security;

create policy "super admin manage email agents"
  on public.niza_email_agents for all
  using (public.has_role(auth.uid(),'super_admin'))
  with check (public.has_role(auth.uid(),'super_admin'));

-- 5. AI Email Agent Runs
create table if not exists public.niza_email_agent_runs (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.niza_email_agents(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  status text default 'running',
  emails_scanned integer default 0,
  invoices_extracted integer default 0,
  error_message text,
  log_text text
);
alter table public.niza_email_agent_runs enable row level security;

create policy "super admin view agent runs"
  on public.niza_email_agent_runs for select
  using (public.has_role(auth.uid(),'super_admin'));
create policy "super admin insert agent runs"
  on public.niza_email_agent_runs for insert
  with check (public.has_role(auth.uid(),'super_admin'));
create policy "super admin update agent runs"
  on public.niza_email_agent_runs for update
  using (public.has_role(auth.uid(),'super_admin'));

-- 6. Storage bucket for invoices
insert into storage.buckets (id, name, public)
values ('niza-invoices','niza-invoices', false)
on conflict (id) do nothing;

create policy "niza-invoices: view own branch or super admin"
  on storage.objects for select
  using (
    bucket_id = 'niza-invoices' and (
      public.has_role(auth.uid(),'super_admin')
      or (split_part(name, '/', 1))::uuid in (select branch_id from public.profiles where id = auth.uid())
    )
  );
create policy "niza-invoices: upload by auth users"
  on storage.objects for insert
  with check (bucket_id='niza-invoices' and auth.uid() is not null);
create policy "niza-invoices: delete super admin"
  on storage.objects for delete
  using (bucket_id='niza-invoices' and public.has_role(auth.uid(),'super_admin'));

-- 7. updated_at trigger helper
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_niza_invoices_touch on public.niza_invoices;
create trigger trg_niza_invoices_touch before update on public.niza_invoices
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_niza_email_agents_touch on public.niza_email_agents;
create trigger trg_niza_email_agents_touch before update on public.niza_email_agents
  for each row execute function public.touch_updated_at();
