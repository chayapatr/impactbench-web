-- ImpactBench expert forms
-- Capability access via SECURITY DEFINER RPCs (no direct anon table DML).
-- Run in the Supabase SQL editor for project tsaobsvruacdusomvftf.

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

-- Remove open table policies / grants from earlier schema revisions.
drop policy if exists "experts_anon_insert" on public.experts;
drop policy if exists "experts_anon_select" on public.experts;
drop policy if exists "experts_anon_update" on public.experts;
drop policy if exists "expert_evaluations_anon_select" on public.expert_evaluations;
drop policy if exists "expert_evaluations_anon_insert" on public.expert_evaluations;
drop policy if exists "expert_evaluations_anon_update" on public.expert_evaluations;

revoke all on table public.experts from anon, authenticated, public;
revoke all on table public.expert_evaluations from anon, authenticated, public;

grant usage on schema public to anon, authenticated;

-- ── Capability RPCs (SECURITY DEFINER; UUID is the capability) ───────────

create or replace function public.create_expert(
	p_name text,
	p_email text,
	p_job_title text default null,
	p_website text default null,
	p_cv_filename text default null,
	p_expertise_description text default null,
	p_expertise_subarea_ids text[] default '{}',
	p_subarea_id text default null,
	p_subarea_label text default null
)
returns public.experts
language plpgsql
security definer
set search_path = public
as $$
declare
	r public.experts;
begin
	if p_name is null or trim(p_name) = '' then
		raise exception 'name is required';
	end if;
	if p_email is null or trim(p_email) = '' then
		raise exception 'email is required';
	end if;
	if p_subarea_id is null or trim(p_subarea_id) = '' then
		raise exception 'subarea_id is required';
	end if;
	if p_subarea_label is null or trim(p_subarea_label) = '' then
		raise exception 'subarea_label is required';
	end if;

	insert into public.experts (
		name,
		email,
		job_title,
		website,
		cv_filename,
		expertise_description,
		expertise_subarea_ids,
		subarea_id,
		subarea_label,
		form_state,
		status
	) values (
		trim(p_name),
		trim(p_email),
		p_job_title,
		nullif(trim(coalesce(p_website, '')), ''),
		nullif(trim(coalesce(p_cv_filename, '')), ''),
		p_expertise_description,
		coalesce(p_expertise_subarea_ids, '{}'),
		p_subarea_id,
		p_subarea_label,
		'{}'::jsonb,
		'in_progress'
	)
	returning * into r;

	return r;
end;
$$;

create or replace function public.get_expert(p_id uuid)
returns public.experts
language plpgsql
security definer
set search_path = public
as $$
declare
	r public.experts;
begin
	select * into r from public.experts where id = p_id;
	if not found then
		return null;
	end if;
	return r;
end;
$$;

create or replace function public.update_expert_draft(
	p_id uuid,
	p_expected_updated_at timestamptz,
	p_form_state jsonb default null,
	p_model_mapping jsonb default null,
	p_pre_read_acknowledged boolean default null,
	p_pre_read_signer_name text default null
)
returns public.experts
language plpgsql
security definer
set search_path = public
as $$
declare
	r public.experts;
begin
	update public.experts
	set
		form_state = coalesce(p_form_state, form_state),
		model_mapping = coalesce(p_model_mapping, model_mapping),
		pre_read_acknowledged = coalesce(p_pre_read_acknowledged, pre_read_acknowledged),
		pre_read_signer_name = coalesce(p_pre_read_signer_name, pre_read_signer_name),
		updated_at = now()
	where id = p_id
		and status = 'in_progress'
		and updated_at = p_expected_updated_at
	returning * into r;

	if not found then
		raise exception 'expert_draft_conflict'
			using errcode = 'P0001';
	end if;

	return r;
end;
$$;

create or replace function public.claim_expert_model_mapping(
	p_id uuid,
	p_mapping jsonb
)
returns public.experts
language plpgsql
security definer
set search_path = public
as $$
declare
	r public.experts;
begin
	update public.experts
	set model_mapping = p_mapping, updated_at = now()
	where id = p_id and model_mapping is null
	returning * into r;

	if found then
		return r;
	end if;

	select * into r from public.experts where id = p_id;
	return r;
end;
$$;

create or replace function public.acknowledge_expert_pre_read(
	p_id uuid,
	p_signed_name text,
	p_expected_updated_at timestamptz
)
returns public.experts
language plpgsql
security definer
set search_path = public
as $$
begin
	return public.update_expert_draft(
		p_id,
		p_expected_updated_at,
		null,
		null,
		true,
		p_signed_name
	);
end;
$$;

-- Drop prior 1-arg signature so clients must supply required evaluation coverage.
drop function if exists public.mark_expert_completed(uuid);

create or replace function public.mark_expert_completed(
	p_id uuid,
	p_required_evaluations jsonb
)
returns public.experts
language plpgsql
security definer
set search_path = public
as $$
declare
	r public.experts;
	required_count integer;
	matched_count integer;
	metric_ids text[];
	metric_id text;
	feedback_submitted boolean;
begin
	if p_required_evaluations is null
		or jsonb_typeof(p_required_evaluations) <> 'array'
		or jsonb_array_length(p_required_evaluations) = 0 then
		raise exception 'required evaluations missing';
	end if;

	select * into r from public.experts where id = p_id for update;
	if not found then
		raise exception 'expert not found';
	end if;

	if r.status <> 'in_progress' then
		raise exception 'expert is not in progress';
	end if;

	if not r.pre_read_acknowledged then
		raise exception 'pre-read not acknowledged';
	end if;

	-- Validate each required (metric_id, scenario_id, model_id) has a submitted row.
	select count(*)::integer
	into required_count
	from jsonb_array_elements(p_required_evaluations) as elem;

	select count(*)::integer
	into matched_count
	from jsonb_array_elements(p_required_evaluations) as elem
	join public.expert_evaluations e
		on e.expert_id = p_id
		and e.metric_id = elem->>'metric_id'
		and e.scenario_id = elem->>'scenario_id'
		and e.model_id = elem->>'model_id'
		and e.submitted = true;

	if matched_count <> required_count then
		raise exception 'required evaluations incomplete';
	end if;

	-- Metric feedback must be marked submitted in form_state for every required metric.
	select array_agg(distinct elem->>'metric_id')
	into metric_ids
	from jsonb_array_elements(p_required_evaluations) as elem;

	foreach metric_id in array metric_ids
	loop
		feedback_submitted := coalesce(
			(r.form_state #>> array['progress', metric_id, 'feedback', 'submitted'])::boolean,
			false
		);
		if not feedback_submitted then
			raise exception 'metric feedback incomplete for %', metric_id;
		end if;
	end loop;

	update public.experts
	set
		status = 'completed',
		completed_at = coalesce(completed_at, now()),
		updated_at = now()
	where id = p_id
		and status = 'in_progress'
	returning * into r;

	if not found then
		raise exception 'expert is not in progress';
	end if;

	return r;
end;
$$;

create or replace function public.upsert_expert_evaluation(
	p_expert_id uuid,
	p_metric_id text,
	p_metric_name text,
	p_scenario_id text,
	p_scenario_title text,
	p_model_id text,
	p_masked_model_label text,
	p_scenario_accurate text,
	p_scenario_accurate_edit text,
	p_scenario_realistic text,
	p_scenario_realistic_edit text,
	p_rating text,
	p_influenced_aspects text,
	p_influenced_aspects_other text,
	p_confidence text,
	p_main_challenge text,
	p_main_challenge_other text,
	p_justification text,
	p_other_feedback text,
	p_submitted_at timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
	expert_status text;
begin
	select status into expert_status
	from public.experts
	where id = p_expert_id
	for update;

	if not found then
		raise exception 'expert not found';
	end if;

	if expert_status <> 'in_progress' then
		raise exception 'expert is not in progress';
	end if;

	insert into public.expert_evaluations (
		expert_id,
		metric_id,
		metric_name,
		scenario_id,
		scenario_title,
		model_id,
		masked_model_label,
		scenario_accurate,
		scenario_accurate_edit,
		scenario_realistic,
		scenario_realistic_edit,
		rating,
		influenced_aspects,
		influenced_aspects_other,
		confidence,
		main_challenge,
		main_challenge_other,
		justification,
		other_feedback,
		submitted,
		submitted_at
	) values (
		p_expert_id,
		p_metric_id,
		p_metric_name,
		p_scenario_id,
		p_scenario_title,
		p_model_id,
		p_masked_model_label,
		p_scenario_accurate,
		p_scenario_accurate_edit,
		p_scenario_realistic,
		p_scenario_realistic_edit,
		p_rating,
		p_influenced_aspects,
		p_influenced_aspects_other,
		p_confidence,
		p_main_challenge,
		p_main_challenge_other,
		p_justification,
		p_other_feedback,
		true,
		coalesce(p_submitted_at, now())
	)
	on conflict (expert_id, metric_id, scenario_id, model_id) do update set
		metric_name = excluded.metric_name,
		scenario_title = excluded.scenario_title,
		masked_model_label = excluded.masked_model_label,
		scenario_accurate = excluded.scenario_accurate,
		scenario_accurate_edit = excluded.scenario_accurate_edit,
		scenario_realistic = excluded.scenario_realistic,
		scenario_realistic_edit = excluded.scenario_realistic_edit,
		rating = excluded.rating,
		influenced_aspects = excluded.influenced_aspects,
		influenced_aspects_other = excluded.influenced_aspects_other,
		confidence = excluded.confidence,
		main_challenge = excluded.main_challenge,
		main_challenge_other = excluded.main_challenge_other,
		justification = excluded.justification,
		other_feedback = excluded.other_feedback,
		submitted = true,
		submitted_at = excluded.submitted_at,
		updated_at = now();
end;
$$;

grant execute on function public.create_expert(
	text, text, text, text, text, text, text[], text, text
) to anon, authenticated;

grant execute on function public.get_expert(uuid) to anon, authenticated;
grant execute on function public.update_expert_draft(
	uuid, timestamptz, jsonb, jsonb, boolean, text
) to anon, authenticated;
grant execute on function public.claim_expert_model_mapping(uuid, jsonb) to anon, authenticated;
grant execute on function public.acknowledge_expert_pre_read(uuid, text, timestamptz)
	to anon, authenticated;
grant execute on function public.mark_expert_completed(uuid, jsonb) to anon, authenticated;
grant execute on function public.upsert_expert_evaluation(
	uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, timestamptz
) to anon, authenticated;
