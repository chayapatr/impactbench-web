-- ImpactBench expert forms (capability-URL access via UUID)
-- Run this in the Supabase SQL editor for project tsaobsvruacdusomvftf.

create extension if not exists "pgcrypto";

create table if not exists public.experts (
	id uuid primary key default gen_random_uuid(),
	name text not null,
	email text not null,
	job_title text,
	website text,
	cv_filename text,
	expertise_description text,
	expertise_subarea_ids text[] not null default '{}',
	subarea_id text not null,
	subarea_label text not null,
	model_mapping jsonb,
	form_state jsonb not null default '{}'::jsonb,
	pre_read_acknowledged boolean not null default false,
	pre_read_signer_name text,
	status text not null default 'in_progress'
		check (status in ('in_progress', 'completed')),
	completed_at timestamptz,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create table if not exists public.expert_evaluations (
	expert_id uuid not null references public.experts (id) on delete cascade,
	metric_id text not null,
	metric_name text,
	scenario_id text not null,
	scenario_title text,
	model_id text not null,
	masked_model_label text,
	scenario_accurate text,
	scenario_accurate_edit text,
	scenario_realistic text,
	scenario_realistic_edit text,
	rating text,
	influenced_aspects text,
	influenced_aspects_other text,
	confidence text,
	main_challenge text,
	main_challenge_other text,
	justification text,
	other_feedback text,
	submitted boolean not null default true,
	submitted_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	primary key (expert_id, metric_id, scenario_id, model_id)
);

create index if not exists experts_email_idx on public.experts (email);
create index if not exists experts_status_idx on public.experts (status);
create index if not exists expert_evaluations_expert_idx on public.expert_evaluations (expert_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
	new.updated_at = now();
	return new;
end;
$$;

drop trigger if exists experts_set_updated_at on public.experts;
create trigger experts_set_updated_at
	before update on public.experts
	for each row execute function public.set_updated_at();

drop trigger if exists expert_evaluations_set_updated_at on public.expert_evaluations;
create trigger expert_evaluations_set_updated_at
	before update on public.expert_evaluations
	for each row execute function public.set_updated_at();

alter table public.experts enable row level security;
alter table public.expert_evaluations enable row level security;

-- Capability URL model: anyone who knows the UUID can read/update that row.
-- No list UI; UUIDv4 is the access boundary.
drop policy if exists "experts_anon_insert" on public.experts;
create policy "experts_anon_insert"
	on public.experts for insert
	to anon, authenticated
	with check (true);

drop policy if exists "experts_anon_select" on public.experts;
create policy "experts_anon_select"
	on public.experts for select
	to anon, authenticated
	using (true);

drop policy if exists "experts_anon_update" on public.experts;
create policy "experts_anon_update"
	on public.experts for update
	to anon, authenticated
	using (true)
	with check (true);

drop policy if exists "expert_evaluations_anon_select" on public.expert_evaluations;
create policy "expert_evaluations_anon_select"
	on public.expert_evaluations for select
	to anon, authenticated
	using (true);

drop policy if exists "expert_evaluations_anon_insert" on public.expert_evaluations;
create policy "expert_evaluations_anon_insert"
	on public.expert_evaluations for insert
	to anon, authenticated
	with check (true);

drop policy if exists "expert_evaluations_anon_update" on public.expert_evaluations;
create policy "expert_evaluations_anon_update"
	on public.expert_evaluations for update
	to anon, authenticated
	using (true)
	with check (true);

grant usage on schema public to anon, authenticated;
grant select, insert, update on public.experts to anon, authenticated;
grant select, insert, update on public.expert_evaluations to anon, authenticated;
