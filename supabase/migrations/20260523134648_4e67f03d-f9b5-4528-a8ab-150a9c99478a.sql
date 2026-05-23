-- Extend niza_email_agents
alter table public.niza_email_agents
  add column if not exists subject_filters text[],
  add column if not exists sender_filters text[],
  add column if not exists attachment_types text[] default array['pdf']::text[],
  add column if not exists max_emails_per_run integer default 50,
  add column if not exists paused boolean default false,
  add column if not exists prompt_override text,
  add column if not exists temperature numeric default 0.1;

-- 1. Per-agent rule rows
create table if not exists public.niza_agent_rules (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.niza_email_agents(id) on delete cascade,
  rule_type text not null, -- subject_contains | subject_excludes | sender_contains | sender_excludes | supplier_whitelist | attachment_required
  rule_value text not null,
  is_active boolean default true,
  created_at timestamptz not null default now()
);
alter table public.niza_agent_rules enable row level security;
create policy "super admin manage agent rules" on public.niza_agent_rules
  for all using (public.has_role(auth.uid(),'super_admin'))
  with check (public.has_role(auth.uid(),'super_admin'));

-- 2. Field mapping per agent
create table if not exists public.niza_agent_field_mappings (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.niza_email_agents(id) on delete cascade,
  source_field text not null, -- supplier | invoice_date | invoice_number | net | vat | gross | category | currency
  target_column text not null,
  default_value text,
  is_required boolean default false,
  created_at timestamptz not null default now(),
  unique (agent_id, source_field)
);
alter table public.niza_agent_field_mappings enable row level security;
create policy "super admin manage field mappings" on public.niza_agent_field_mappings
  for all using (public.has_role(auth.uid(),'super_admin'))
  with check (public.has_role(auth.uid(),'super_admin'));

-- 3. Central category mapping library (till category -> Xero account)
create table if not exists public.niza_category_mappings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  branch_id uuid references public.branches(id) on delete cascade,
  till_category text not null,
  xero_account_code text not null,
  xero_account_name text,
  tax_rate text,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists niza_category_mappings_branch_idx on public.niza_category_mappings(branch_id);
alter table public.niza_category_mappings enable row level security;
create policy "view category mappings own branch or super admin" on public.niza_category_mappings
  for select using (
    public.has_role(auth.uid(),'super_admin')
    or branch_id in (select branch_id from public.profiles where id = auth.uid())
    or branch_id is null
  );
create policy "super admin manage category mappings" on public.niza_category_mappings
  for all using (public.has_role(auth.uid(),'super_admin'))
  with check (public.has_role(auth.uid(),'super_admin'));

-- 4. Alert thresholds & recipients
create table if not exists public.niza_alert_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid unique,
  variance_threshold_gbp numeric default 5,
  missing_day_alert boolean default true,
  new_category_alert boolean default true,
  recipients text[] default array[]::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.niza_alert_settings enable row level security;
create policy "view alert settings" on public.niza_alert_settings
  for select using (
    public.has_role(auth.uid(),'super_admin')
    or organization_id in (select organization_id from public.profiles where id = auth.uid())
  );
create policy "super admin manage alert settings" on public.niza_alert_settings
  for all using (public.has_role(auth.uid(),'super_admin'))
  with check (public.has_role(auth.uid(),'super_admin'));

-- 5. Export presets
create table if not exists public.niza_export_presets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  name text not null,
  preset_type text not null default 'xero', -- xero | excel | custom
  config jsonb not null default '{}'::jsonb,
  is_default boolean default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.niza_export_presets enable row level security;
create policy "view export presets own org or super admin" on public.niza_export_presets
  for select using (
    public.has_role(auth.uid(),'super_admin')
    or organization_id in (select organization_id from public.profiles where id = auth.uid())
    or organization_id is null
  );
create policy "super admin manage export presets" on public.niza_export_presets
  for all using (public.has_role(auth.uid(),'super_admin'))
  with check (public.has_role(auth.uid(),'super_admin'));

-- 6. AI settings (per org per task)
create table if not exists public.niza_ai_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  task_key text not null, -- invoice_extract | category_match | anomaly | summary
  provider text not null default 'openai', -- openai | gemini
  model text,
  prompt text,
  temperature numeric default 0.1,
  max_tokens integer default 1500,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, task_key)
);
alter table public.niza_ai_settings enable row level security;
create policy "view ai settings own org or super admin" on public.niza_ai_settings
  for select using (
    public.has_role(auth.uid(),'super_admin')
    or organization_id in (select organization_id from public.profiles where id = auth.uid())
    or organization_id is null
  );
create policy "super admin manage ai settings" on public.niza_ai_settings
  for all using (public.has_role(auth.uid(),'super_admin'))
  with check (public.has_role(auth.uid(),'super_admin'));

-- Triggers
drop trigger if exists trg_niza_cat_map_touch on public.niza_category_mappings;
create trigger trg_niza_cat_map_touch before update on public.niza_category_mappings
  for each row execute function public.touch_updated_at();
drop trigger if exists trg_niza_alert_settings_touch on public.niza_alert_settings;
create trigger trg_niza_alert_settings_touch before update on public.niza_alert_settings
  for each row execute function public.touch_updated_at();
drop trigger if exists trg_niza_export_presets_touch on public.niza_export_presets;
create trigger trg_niza_export_presets_touch before update on public.niza_export_presets
  for each row execute function public.touch_updated_at();
drop trigger if exists trg_niza_ai_settings_touch on public.niza_ai_settings;
create trigger trg_niza_ai_settings_touch before update on public.niza_ai_settings
  for each row execute function public.touch_updated_at();