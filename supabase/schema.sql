-- ImpactBench expert forms
-- ─────────────────────────────────────────────────────────────────────────────
-- Security model (capability URL + RPC-only access):
--   • Tables are NOT exposed to PostgREST clients: RLS on + FORCE RLS,
--     no permissive policies, and all table privileges revoked from
--     anon / authenticated / PUBLIC.
--   • Browser clients call only the SECURITY DEFINER RPCs granted below.
--     Knowing an expert UUID is the capability token for that row.
--   • Every SECURITY DEFINER function pins search_path = '' and uses
--     fully-qualified names (blocks search_path injection / pg_temp hijacks).
--   • EXECUTE is revoked from PUBLIC (Postgres default) then granted only
--     to anon + authenticated for the listed RPCs.
--
-- Re-run this whole file in the Supabase SQL editor after changes
-- (project tsaobsvruacdusomvftf). Also confirm in Dashboard → Settings → API
-- that only intended schemas are exposed, and Realtime is off for these tables.
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists "pgcrypto";

-- Default: new functions in public are not executable by API roles until granted.
alter default privileges in schema public
	revoke execute on functions from public;
alter default privileges in schema public
	revoke execute on functions from anon, authenticated;

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
	updated_at timestamptz not null default now(),
	-- Basic integrity / abuse bounds (defense in depth; RPCs also validate).
	constraint experts_name_len check (char_length(name) between 1 and 200),
	constraint experts_email_len check (char_length(email) between 3 and 320),
	constraint experts_email_format check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
	constraint experts_job_title_len check (job_title is null or char_length(job_title) <= 200),
	constraint experts_website_len check (website is null or char_length(website) <= 500),
	constraint experts_cv_filename_len check (cv_filename is null or char_length(cv_filename) <= 260),
	constraint experts_expertise_desc_len check (
		expertise_description is null or char_length(expertise_description) <= 10000
	),
	constraint experts_subarea_id_len check (char_length(subarea_id) between 1 and 120),
	constraint experts_subarea_label_len check (char_length(subarea_label) between 1 and 200),
	constraint experts_signer_len check (
		pre_read_signer_name is null or char_length(pre_read_signer_name) <= 200
	),
	constraint experts_form_state_is_object check (jsonb_typeof(form_state) = 'object')
);

create table if not exists public.expert_evaluations (
	expert_id uuid not null references public.experts (id) on delete cascade,
	metric_id text not null,
	metric_name text,
	scenario_id text not null,
	scenario_title text,
	model_id text not null,
	masked_model_label text,
	scenario_question_appropriate text,
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
	primary key (expert_id, metric_id, scenario_id, model_id),
	constraint eval_metric_id_len check (char_length(metric_id) between 1 and 200),
	constraint eval_scenario_id_len check (char_length(scenario_id) between 1 and 200),
	constraint eval_model_id_len check (char_length(model_id) between 1 and 200),
	constraint eval_justification_len check (
		justification is null or char_length(justification) <= 20000
	),
	constraint eval_other_feedback_len check (
		other_feedback is null or char_length(other_feedback) <= 20000
	)
);

create index if not exists experts_email_idx on public.experts (email);
create index if not exists experts_status_idx on public.experts (status);
create index if not exists expert_evaluations_expert_idx on public.expert_evaluations (expert_id);

-- Trigger helper: SECURITY INVOKER (default). Never elevate privileges here.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
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

-- RLS: deny-by-default for API roles. FORCE so even the table owner is subject
-- to policies (SECURITY DEFINER RPCs still work because they are owned by a
-- BYPASSRLS role in Supabase and authorize via UUID capability checks).
alter table public.experts enable row level security;
alter table public.experts force row level security;
alter table public.expert_evaluations enable row level security;
alter table public.expert_evaluations force row level security;

-- Remove legacy open policies from earlier schema revisions.
drop policy if exists "experts_anon_insert" on public.experts;
drop policy if exists "experts_anon_select" on public.experts;
drop policy if exists "experts_anon_update" on public.experts;
drop policy if exists "expert_evaluations_anon_select" on public.expert_evaluations;
drop policy if exists "expert_evaluations_anon_insert" on public.expert_evaluations;
drop policy if exists "expert_evaluations_anon_update" on public.expert_evaluations;
drop policy if exists experts_no_direct_access on public.experts;
drop policy if exists expert_evaluations_no_direct_access on public.expert_evaluations;

-- Explicit deny-all for API roles (defense in depth; table grants are also revoked).
create policy experts_no_direct_access on public.experts
	for all
	to anon, authenticated
	using (false)
	with check (false);

create policy expert_evaluations_no_direct_access on public.expert_evaluations
	for all
	to anon, authenticated
	using (false)
	with check (false);

revoke all on table public.experts from public, anon, authenticated;
revoke all on table public.expert_evaluations from public, anon, authenticated;

grant usage on schema public to anon, authenticated;

-- ── Shared validators (SECURITY INVOKER; not granted to API roles) ───────────

create or replace function public._assert_nonempty_text(p_value text, p_label text, p_max int)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
	v text := trim(coalesce(p_value, ''));
begin
	if v = '' then
		raise exception '% is required', p_label;
	end if;
	if char_length(v) > p_max then
		raise exception '% exceeds max length %', p_label, p_max;
	end if;
	return v;
end;
$$;

create or replace function public._assert_json_object_size(p_value jsonb, p_label text, p_max_bytes int)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
	if p_value is null then
		return null;
	end if;
	if jsonb_typeof(p_value) <> 'object' and jsonb_typeof(p_value) <> 'array' then
		raise exception '% must be a json object or array', p_label;
	end if;
	if pg_column_size(p_value) > p_max_bytes then
		raise exception '% exceeds max size', p_label;
	end if;
	return p_value;
end;
$$;

revoke all on function public._assert_nonempty_text(text, text, int) from public, anon, authenticated;
revoke all on function public._assert_json_object_size(jsonb, text, int) from public, anon, authenticated;

-- ── Capability RPCs (SECURITY DEFINER; UUID is the capability) ───────────────

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
set search_path = ''
as $$
declare
	r public.experts;
	v_name text;
	v_email text;
	v_subarea_id text;
	v_subarea_label text;
	v_job text;
	v_website text;
	v_cv text;
	v_expertise text;
begin
	v_name := public._assert_nonempty_text(p_name, 'name', 200);
	v_email := lower(public._assert_nonempty_text(p_email, 'email', 320));
	if v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
		raise exception 'email is invalid';
	end if;
	v_subarea_id := public._assert_nonempty_text(p_subarea_id, 'subarea_id', 120);
	v_subarea_label := public._assert_nonempty_text(p_subarea_label, 'subarea_label', 200);

	v_job := nullif(trim(coalesce(p_job_title, '')), '');
	if v_job is not null and char_length(v_job) > 200 then
		raise exception 'job_title exceeds max length';
	end if;
	v_website := nullif(trim(coalesce(p_website, '')), '');
	if v_website is not null and char_length(v_website) > 500 then
		raise exception 'website exceeds max length';
	end if;
	v_cv := nullif(trim(coalesce(p_cv_filename, '')), '');
	if v_cv is not null and char_length(v_cv) > 260 then
		raise exception 'cv_filename exceeds max length';
	end if;
	v_expertise := nullif(p_expertise_description, '');
	if v_expertise is not null and char_length(v_expertise) > 10000 then
		raise exception 'expertise_description exceeds max length';
	end if;
	if coalesce(cardinality(p_expertise_subarea_ids), 0) > 32 then
		raise exception 'too many expertise_subarea_ids';
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
		v_name,
		v_email,
		v_job,
		v_website,
		v_cv,
		v_expertise,
		coalesce(p_expertise_subarea_ids, '{}'),
		v_subarea_id,
		v_subarea_label,
		'{}'::jsonb,
		'in_progress'
	)
	returning * into r;

	-- Applicant just submitted these values; returning the row (incl. id) is OK.
	return r;
end;
$$;

create or replace function public.get_expert(p_id uuid)
returns public.experts
language plpgsql
security definer
set search_path = ''
as $$
declare
	r public.experts;
begin
	if p_id is null then
		return null;
	end if;

	select * into r from public.experts where id = p_id;
	if not found then
		return null;
	end if;

	-- Capability URL holders need form state, not contact PII.
	r.email := null;
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
set search_path = ''
as $$
declare
	r public.experts;
	v_form jsonb;
	v_mapping jsonb;
	v_signer text;
begin
	if p_id is null or p_expected_updated_at is null then
		raise exception 'id and expected_updated_at are required';
	end if;

	v_form := public._assert_json_object_size(p_form_state, 'form_state', 524288);
	if v_form is not null and jsonb_typeof(v_form) <> 'object' then
		raise exception 'form_state must be a json object';
	end if;
	v_mapping := public._assert_json_object_size(p_model_mapping, 'model_mapping', 65536);

	v_signer := nullif(trim(coalesce(p_pre_read_signer_name, '')), '');
	if p_pre_read_signer_name is not null and v_signer is null then
		raise exception 'pre_read_signer_name is required when provided';
	end if;
	if v_signer is not null and char_length(v_signer) > 200 then
		raise exception 'pre_read_signer_name exceeds max length';
	end if;

	update public.experts
	set
		form_state = coalesce(v_form, form_state),
		model_mapping = coalesce(v_mapping, model_mapping),
		pre_read_acknowledged = coalesce(p_pre_read_acknowledged, pre_read_acknowledged),
		pre_read_signer_name = coalesce(v_signer, pre_read_signer_name),
		updated_at = now()
	where id = p_id
		and status = 'in_progress'
		and updated_at = p_expected_updated_at
	returning * into r;

	if not found then
		raise exception 'expert_draft_conflict'
			using errcode = 'P0001';
	end if;

	r.email := null;
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
set search_path = ''
as $$
declare
	r public.experts;
	v_mapping jsonb;
begin
	if p_id is null then
		raise exception 'id is required';
	end if;
	v_mapping := public._assert_json_object_size(p_mapping, 'mapping', 65536);
	if v_mapping is null or jsonb_typeof(v_mapping) <> 'array' then
		raise exception 'mapping must be a json array';
	end if;

	update public.experts
	set model_mapping = v_mapping, updated_at = now()
	where id = p_id
		and status = 'in_progress'
		and model_mapping is null
	returning * into r;

	if found then
		r.email := null;
		return r;
	end if;

	select * into r from public.experts where id = p_id;
	if found then
		r.email := null;
	end if;
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
set search_path = ''
as $$
declare
	v_signer text;
begin
	v_signer := public._assert_nonempty_text(p_signed_name, 'signed_name', 200);
	return public.update_expert_draft(
		p_id,
		p_expected_updated_at,
		null,
		null,
		true,
		v_signer
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
set search_path = ''
as $$
declare
	r public.experts;
	required_count integer;
	matched_count integer;
	metric_ids text[];
	metric_id text;
	feedback_submitted boolean;
begin
	if p_id is null then
		raise exception 'id is required';
	end if;
	if p_required_evaluations is null
		or jsonb_typeof(p_required_evaluations) <> 'array'
		or jsonb_array_length(p_required_evaluations) = 0 then
		raise exception 'required evaluations missing';
	end if;
	if jsonb_array_length(p_required_evaluations) > 500 then
		raise exception 'required evaluations list too large';
	end if;
	perform public._assert_json_object_size(p_required_evaluations, 'required_evaluations', 65536);

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

	r.email := null;
	return r;
end;
$$;

-- Drop prior signature so create-or-replace doesn't leave an overload behind
-- when we add scenario_question_appropriate.
drop function if exists public.upsert_expert_evaluation(
	uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, timestamptz
);

create or replace function public.upsert_expert_evaluation(
	p_expert_id uuid,
	p_metric_id text,
	p_metric_name text,
	p_scenario_id text,
	p_scenario_title text,
	p_model_id text,
	p_masked_model_label text,
	p_scenario_question_appropriate text,
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
set search_path = ''
as $$
declare
	expert_status text;
	v_metric_id text;
	v_scenario_id text;
	v_model_id text;
begin
	if p_expert_id is null then
		raise exception 'expert_id is required';
	end if;

	v_metric_id := public._assert_nonempty_text(p_metric_id, 'metric_id', 200);
	v_scenario_id := public._assert_nonempty_text(p_scenario_id, 'scenario_id', 200);
	v_model_id := public._assert_nonempty_text(p_model_id, 'model_id', 200);

	if p_justification is not null and char_length(p_justification) > 20000 then
		raise exception 'justification exceeds max length';
	end if;
	if p_other_feedback is not null and char_length(p_other_feedback) > 20000 then
		raise exception 'other_feedback exceeds max length';
	end if;

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
		scenario_question_appropriate,
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
		v_metric_id,
		left(p_metric_name, 300),
		v_scenario_id,
		left(p_scenario_title, 500),
		v_model_id,
		left(p_masked_model_label, 64),
		left(p_scenario_question_appropriate, 64),
		left(p_scenario_accurate, 64),
		left(p_scenario_accurate_edit, 5000),
		left(p_scenario_realistic, 64),
		left(p_scenario_realistic_edit, 5000),
		left(p_rating, 64),
		left(p_influenced_aspects, 2000),
		left(p_influenced_aspects_other, 2000),
		left(p_confidence, 64),
		left(p_main_challenge, 120),
		left(p_main_challenge_other, 2000),
		p_justification,
		p_other_feedback,
		true,
		coalesce(p_submitted_at, now())
	)
	on conflict (expert_id, metric_id, scenario_id, model_id) do update set
		metric_name = excluded.metric_name,
		scenario_title = excluded.scenario_title,
		masked_model_label = excluded.masked_model_label,
		scenario_question_appropriate = excluded.scenario_question_appropriate,
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

-- Strip default PUBLIC execute, then grant only the public API surface.
revoke all on function public.set_updated_at() from public, anon, authenticated;

revoke all on function public.create_expert(
	text, text, text, text, text, text, text[], text, text
) from public;
revoke all on function public.get_expert(uuid) from public;
revoke all on function public.update_expert_draft(
	uuid, timestamptz, jsonb, jsonb, boolean, text
) from public;
revoke all on function public.claim_expert_model_mapping(uuid, jsonb) from public;
revoke all on function public.acknowledge_expert_pre_read(uuid, text, timestamptz) from public;
revoke all on function public.mark_expert_completed(uuid, jsonb) from public;
revoke all on function public.upsert_expert_evaluation(
	uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, timestamptz
) from public;

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
	uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, timestamptz
) to anon, authenticated;

-- ── Ensure constraints on already-created tables (CREATE TABLE IF NOT EXISTS
-- does not add new CHECKs to an existing relation). ─────────────────────────

alter table public.experts drop constraint if exists experts_name_len;
alter table public.experts add constraint experts_name_len
	check (char_length(name) between 1 and 200);

alter table public.experts drop constraint if exists experts_email_len;
alter table public.experts add constraint experts_email_len
	check (char_length(email) between 3 and 320);

alter table public.experts drop constraint if exists experts_email_format;
alter table public.experts add constraint experts_email_format
	check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');

alter table public.experts drop constraint if exists experts_job_title_len;
alter table public.experts add constraint experts_job_title_len
	check (job_title is null or char_length(job_title) <= 200);

alter table public.experts drop constraint if exists experts_website_len;
alter table public.experts add constraint experts_website_len
	check (website is null or char_length(website) <= 500);

alter table public.experts drop constraint if exists experts_cv_filename_len;
alter table public.experts add constraint experts_cv_filename_len
	check (cv_filename is null or char_length(cv_filename) <= 260);

alter table public.experts drop constraint if exists experts_expertise_desc_len;
alter table public.experts add constraint experts_expertise_desc_len
	check (expertise_description is null or char_length(expertise_description) <= 10000);

alter table public.experts drop constraint if exists experts_subarea_id_len;
alter table public.experts add constraint experts_subarea_id_len
	check (char_length(subarea_id) between 1 and 120);

alter table public.experts drop constraint if exists experts_subarea_label_len;
alter table public.experts add constraint experts_subarea_label_len
	check (char_length(subarea_label) between 1 and 200);

alter table public.experts drop constraint if exists experts_signer_len;
alter table public.experts add constraint experts_signer_len
	check (pre_read_signer_name is null or char_length(pre_read_signer_name) <= 200);

alter table public.experts drop constraint if exists experts_form_state_is_object;
alter table public.experts add constraint experts_form_state_is_object
	check (jsonb_typeof(form_state) = 'object');

alter table public.experts drop constraint if exists experts_form_state_size;
alter table public.experts drop constraint if exists experts_model_mapping_size;

alter table public.expert_evaluations drop constraint if exists eval_metric_id_len;
alter table public.expert_evaluations add constraint eval_metric_id_len
	check (char_length(metric_id) between 1 and 200);

alter table public.expert_evaluations drop constraint if exists eval_scenario_id_len;
alter table public.expert_evaluations add constraint eval_scenario_id_len
	check (char_length(scenario_id) between 1 and 200);

alter table public.expert_evaluations drop constraint if exists eval_model_id_len;
alter table public.expert_evaluations add constraint eval_model_id_len
	check (char_length(model_id) between 1 and 200);

alter table public.expert_evaluations drop constraint if exists eval_justification_len;
alter table public.expert_evaluations add constraint eval_justification_len
	check (justification is null or char_length(justification) <= 20000);

alter table public.expert_evaluations drop constraint if exists eval_other_feedback_len;
alter table public.expert_evaluations add constraint eval_other_feedback_len
	check (other_feedback is null or char_length(other_feedback) <= 20000);

-- Additive column for existing databases (CREATE TABLE IF NOT EXISTS won't add it).
alter table public.expert_evaluations
	add column if not exists scenario_question_appropriate text;

-- ─────────────────────────────────────────────────────────────────────────────
-- Admin read dashboard (capability UUID, same security model as above)
--   • admin_keys holds the set of valid admin capability UUIDs. Knowing a
--     non-revoked UUID is the permission to read aggregated evaluation data.
--   • The table is locked down exactly like experts/expert_evaluations: RLS
--     forced, deny-all policy, all API-role grants revoked.
--   • Read-only SECURITY DEFINER RPCs below validate the key via _assert_admin
--     before returning anything. _assert_admin is NOT granted to API roles, so
--     it can only run from inside these definer functions.
--
-- Mint a key once (run in the SQL editor, keep the returned UUID secret):
--   insert into public.admin_keys (label) values ('primary') returning id;
-- Revoke a key later:
--   update public.admin_keys set revoked = true where id = '<uuid>';
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.admin_keys (
	id uuid primary key default gen_random_uuid(),
	label text not null default 'admin',
	revoked boolean not null default false,
	created_at timestamptz not null default now(),
	last_used_at timestamptz,
	constraint admin_keys_label_len check (char_length(label) between 1 and 120)
);

alter table public.admin_keys enable row level security;
alter table public.admin_keys force row level security;

drop policy if exists admin_keys_no_direct_access on public.admin_keys;
create policy admin_keys_no_direct_access on public.admin_keys
	for all
	to anon, authenticated
	using (false)
	with check (false);

revoke all on table public.admin_keys from public, anon, authenticated;

-- Validator: raises unless a live (non-revoked) key is supplied. SECURITY
-- DEFINER so it can read admin_keys; never granted to API roles directly.
create or replace function public._assert_admin(p_admin_key uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
	if p_admin_key is null then
		raise exception 'admin key required' using errcode = '28000';
	end if;

	update public.admin_keys
	set last_used_at = now()
	where id = p_admin_key and revoked = false;

	if not found then
		raise exception 'invalid admin key' using errcode = '28000';
	end if;
end;
$$;

create or replace function public.admin_overview(p_admin_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	result jsonb;
begin
	perform public._assert_admin(p_admin_key);

	select jsonb_build_object(
		'experts_total', (select count(*) from public.experts),
		'experts_completed',
			(select count(*) from public.experts where status = 'completed'),
		'experts_in_progress',
			(select count(*) from public.experts where status = 'in_progress'),
		'evaluations_total',
			(select count(*) from public.expert_evaluations where submitted),
		'metrics_covered',
			(select count(distinct metric_id) from public.expert_evaluations where submitted),
		'scenarios_covered',
			(select count(distinct scenario_id) from public.expert_evaluations where submitted),
		'last_submission_at',
			(select max(submitted_at) from public.expert_evaluations where submitted)
	) into result;

	return result;
end;
$$;

-- One row per metric: coverage counts + a rating distribution, ordered by
-- how much evaluation data exists. This drives the clickable dashboard list.
create or replace function public.admin_metrics_summary(p_admin_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	result jsonb;
begin
	perform public._assert_admin(p_admin_key);

	select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
	into result
	from (
		select
			e.metric_id,
			max(e.metric_name) as metric_name,
			count(*) as evaluation_count,
			count(distinct e.expert_id) as expert_count,
			count(distinct e.scenario_id) as scenario_count,
			max(e.submitted_at) as last_submitted_at,
			(
				select jsonb_object_agg(rb.rating_key, rb.n)
				from (
					select
						coalesce(nullif(trim(e2.rating), ''), '(unrated)') as rating_key,
						count(*) as n
					from public.expert_evaluations e2
					where e2.submitted and e2.metric_id = e.metric_id
					group by 1
				) rb
			) as rating_breakdown
		from public.expert_evaluations e
		where e.submitted
		group by e.metric_id
		order by count(*) desc, max(e.metric_name)
	) t;

	return result;
end;
$$;

-- Full evaluation detail for a single metric (joined with the submitting
-- expert's name + subarea) so the admin can drill into individual reviews.
create or replace function public.admin_metric_evaluations(
	p_admin_key uuid,
	p_metric_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	result jsonb;
begin
	perform public._assert_admin(p_admin_key);

	if p_metric_id is null or char_length(trim(p_metric_id)) = 0 then
		raise exception 'metric_id required';
	end if;

	select coalesce(jsonb_agg(row_to_json(t) order by t.submitted_at desc), '[]'::jsonb)
	into result
	from (
		select
			e.expert_id,
			x.name as expert_name,
			x.subarea_label as expert_subarea,
			e.metric_id,
			e.metric_name,
			e.scenario_id,
			e.scenario_title,
			e.model_id,
			e.masked_model_label,
			e.scenario_accurate,
			e.scenario_accurate_edit,
			e.scenario_realistic,
			e.scenario_realistic_edit,
			e.rating,
			e.influenced_aspects,
			e.influenced_aspects_other,
			e.confidence,
			e.main_challenge,
			e.main_challenge_other,
			e.justification,
			e.other_feedback,
			e.submitted_at
		from public.expert_evaluations e
		left join public.experts x on x.id = e.expert_id
		where e.submitted and e.metric_id = p_metric_id
	) t;

	return result;
end;
$$;

-- Per-metric feedback (the form experts fill once before scenarios), pulled
-- from experts.form_state.progress[<metric_id>].feedback where submitted.
create or replace function public.admin_metric_feedback(
	p_admin_key uuid,
	p_metric_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	result jsonb;
begin
	perform public._assert_admin(p_admin_key);

	if p_metric_id is null or char_length(trim(p_metric_id)) = 0 then
		raise exception 'metric_id required';
	end if;

	select coalesce(jsonb_agg(row_to_json(t) order by t.updated_at desc), '[]'::jsonb)
	into result
	from (
		select
			x.id as expert_id,
			x.name as expert_name,
			x.subarea_label as expert_subarea,
			p_metric_id as metric_id,
			x.form_state #>> array['progress', p_metric_id, 'feedback', 'relevance'] as relevance,
			x.form_state #>> array['progress', p_metric_id, 'feedback', 'relevanceEdit'] as relevance_edit,
			x.form_state #>> array['progress', p_metric_id, 'feedback', 'labelDifferent'] as label_different,
			x.form_state #>> array['progress', p_metric_id, 'feedback', 'labelEdit'] as label_edit,
			x.form_state #>> array['progress', p_metric_id, 'feedback', 'examplesAdequate'] as examples_adequate,
			x.form_state #>> array['progress', p_metric_id, 'feedback', 'examplesEdit'] as examples_edit,
			x.form_state #>> array['progress', p_metric_id, 'feedback', 'other'] as other_feedback,
			x.updated_at
		from public.experts x
		where coalesce(
			(x.form_state #>> array['progress', p_metric_id, 'feedback', 'submitted'])::boolean,
			false
		)
	) t;

	return result;
end;
$$;

-- Lock down + expose only the read RPCs. _assert_admin stays private.
revoke all on function public._assert_admin(uuid) from public, anon, authenticated;
revoke all on function public.admin_overview(uuid) from public;
revoke all on function public.admin_metrics_summary(uuid) from public;
revoke all on function public.admin_metric_evaluations(uuid, text) from public;
revoke all on function public.admin_metric_feedback(uuid, text) from public;

grant execute on function public.admin_overview(uuid) to anon, authenticated;
grant execute on function public.admin_metrics_summary(uuid) to anon, authenticated;
grant execute on function public.admin_metric_evaluations(uuid, text) to anon, authenticated;
grant execute on function public.admin_metric_feedback(uuid, text) to anon, authenticated;

-- Ask PostgREST to pick up newly created/replaced RPCs immediately.
notify pgrst, 'reload schema';

