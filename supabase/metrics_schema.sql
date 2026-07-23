-- ImpactBench metrics authoring & publishing (metrics-dashboard)
-- ─────────────────────────────────────────────────────────────────────────────
-- Scope: source-of-truth tables for benchmarks / metrics / taxonomy /
-- scenarios / scores that today live as hand-authored YAML plus
-- pipeline-generated JSON files in the impactbench-data repo. This is a new,
-- separate table set in the SAME Supabase project impactbench-web already
-- uses — it does not modify experts / expert_evaluations, and is kept in its
-- own file (rather than appended to schema.sql) so it doesn't collide with
-- in-flight work on the /admin evaluation-review dashboard branches.
--
-- This pass adds TABLES + read policies only. Write access (create/edit a
-- metric, kick off regeneration, publish) will be a set of SECURITY DEFINER
-- RPCs added once the editing UI's exact needs are settled — see the
-- "Metrics" section below for the modeling decision that unlocks that.
--
-- Security model:
--   • Read access is PUBLIC and unauthenticated, on purpose: this is the same
--     benchmark content already served as static JSON from R2 today. RLS is
--     still enabled + forced on every table (so nothing is exposed by
--     accident if a sensitive column is ever added later), with an explicit
--     `select ... using (true)` policy per table.
--   • generation_runs is the one exception: it's an internal ops/cost
--     tracking table with no public-facing use, so it gets the same
--     deny-all treatment as admin_keys instead of a public-read policy.
--   • Future write RPCs will reuse the admin capability-key mechanism that
--     already ships in schema.sql (admin_keys + public._assert_admin(uuid)),
--     merged to main in commit e2004563 ("admin"). This file depends on
--     that, and on schema.sql's public.set_updated_at() trigger helper —
--     it does NOT re-declare either, to avoid two copies of the same
--     objects existing across two files.
--
-- Prerequisite: run schema.sql first (already applied — this project already
-- has admin_keys / _assert_admin / set_updated_at live). Then run this file
-- in the Supabase SQL editor (project tsaobsvruacdusomvftf). Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists "pgcrypto";

-- ───────────────────────────── Models ────────────────────────────────────────
-- Replaces the hand-edited top-level models.yaml.

create table if not exists public.models (
	id uuid primary key default gen_random_uuid(),
	slug text not null unique,                    -- e.g. 'claude-haiku-4-5' (matches run_dir today)
	display_name text not null,
	provider text not null,                       -- 'anthropic' | 'openai' | 'deepinfra' | ...
	surfaces text[] not null default '{full}',    -- 'full' | 'nutritional-label'
	status text not null default 'active'
		check (status in ('active', 'retired')),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	constraint models_slug_len check (char_length(slug) between 1 and 120),
	constraint models_display_name_len check (char_length(display_name) between 1 and 200),
	constraint models_provider_len check (char_length(provider) between 1 and 60)
);

drop trigger if exists models_set_updated_at on public.models;
create trigger models_set_updated_at
	before update on public.models
	for each row execute function public.set_updated_at();

-- ───────────────────────────── Benchmarks ────────────────────────────────────
-- Replaces one <benchmark>/ folder's top-level identity: name/description
-- plus the optional scenario-authoring context block (seen e.g. in
-- cog-bias/benchmark.yaml's `scenario:` block).

create table if not exists public.benchmarks (
	id uuid primary key default gen_random_uuid(),
	slug text not null unique,                    -- e.g. 'cog-bias' (matches the folder name today)
	name text not null,
	description text,
	scenario_user_context text,
	scenario_implicit_context text,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	constraint benchmarks_slug_len check (char_length(slug) between 1 and 120),
	constraint benchmarks_name_len check (char_length(name) between 1 and 300)
);

drop trigger if exists benchmarks_set_updated_at on public.benchmarks;
create trigger benchmarks_set_updated_at
	before update on public.benchmarks
	for each row execute function public.set_updated_at();

-- ───────────────────────────── Taxonomy ──────────────────────────────────────
-- Replaces the hand-authored taxonomy.json (areas > subareas > metric ids).
-- Placement is a real foreign key now, so it cannot dangle the way an id
-- list in a JSON file can.

create table if not exists public.taxonomy_areas (
	id uuid primary key default gen_random_uuid(),
	slug text not null unique,
	name text not null,
	icon text,
	color text,
	sort_order integer not null default 0,
	constraint taxonomy_areas_slug_len check (char_length(slug) between 1 and 120),
	constraint taxonomy_areas_name_len check (char_length(name) between 1 and 200)
);

create table if not exists public.taxonomy_subareas (
	id uuid primary key default gen_random_uuid(),
	area_id uuid not null references public.taxonomy_areas (id) on delete cascade,
	slug text not null,
	name text not null,
	icon text,
	sort_order integer not null default 0,
	constraint taxonomy_subareas_slug_len check (char_length(slug) between 1 and 120),
	constraint taxonomy_subareas_name_len check (char_length(name) between 1 and 200),
	unique (area_id, slug)
);

-- metric_id's FK is added further down (metrics doesn't exist yet at this
-- point in the file) via a deferred alter table.
create table if not exists public.taxonomy_placements (
	metric_id uuid not null,
	subarea_id uuid not null references public.taxonomy_subareas (id) on delete cascade,
	group_name text,                              -- optional sub-grouping within a subarea
	primary key (metric_id, subarea_id),
	constraint taxonomy_placements_group_name_len check (
		group_name is null or char_length(group_name) <= 200
	)
);

-- ───────────────────────────── Nutrition label ───────────────────────────────
-- Replaces nutrition-label.json's curated category > metric-id lists. Today
-- that file COPIES each metric's text and checks it for drift against a
-- `source` pointer at publish time. Here it's a reference to the same row —
-- drift is impossible by construction, since there is only one copy of the
-- text to point at.

create table if not exists public.nutrition_categories (
	id uuid primary key default gen_random_uuid(),
	slug text not null unique,
	name text not null,
	description text,
	sort_order integer not null default 0,
	constraint nutrition_categories_slug_len check (char_length(slug) between 1 and 120),
	constraint nutrition_categories_name_len check (char_length(name) between 1 and 200)
);

create table if not exists public.nutrition_placements (
	metric_id uuid not null,                      -- fk added below, once metrics exists
	nutrition_category_id uuid not null
		references public.nutrition_categories (id) on delete cascade,
	primary key (metric_id, nutrition_category_id)
);

-- ───────────────────────────── Metrics ───────────────────────────────────────
-- `metrics` holds identity + workflow state ONLY. All content (name, type,
-- definition, examples, mattersBecause) lives exclusively on
-- metric_versions. This is the fix for the duplication problem flagged
-- during review: there is exactly one place a metric's wording can live, so
-- "edited the text but forgot to create a new version" can't happen — every
-- edit IS a new version, by construction.

create table if not exists public.metrics (
	id uuid primary key default gen_random_uuid(),
	benchmark_id uuid not null references public.benchmarks (id) on delete cascade,
	slug text not null,                           -- e.g. 'm01' (matches the id in benchmark.yaml today)
	status text not null default 'draft'
		check (status in (
			'draft', 'scenarios_generating', 'ready_to_simulate',
			'evaluating', 'ready_to_publish', 'published'
		)),
	current_version_id uuid,                      -- fk added below, once metric_versions exists
	-- Free-text placement tags a submitter proposed at intake (e.g. from an
	-- idea submission form's "area" column), before any curator has assigned
	-- a real subarea via taxonomy_placements. Deliberately unstructured: a
	-- source may mix coarse tags ('physical_health') with finer ones that
	-- read more like a subarea ('self_actualization') in the same list —
	-- that's fine, this column doesn't classify granularity, it's just
	-- material for whoever does the real placement to read. Each element is
	-- one parsed tag (split the source's ';'-joined string on import; never
	-- store it as one un-split blob). Purely a hint for triage — never used
	-- for display or filtering on the public site, and not kept in sync once
	-- real placement happens.
	suggested_placements text[],
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	constraint metrics_slug_len check (char_length(slug) between 1 and 120),
	unique (benchmark_id, slug)
);

create table if not exists public.metric_versions (
	id uuid primary key default gen_random_uuid(),
	metric_id uuid not null references public.metrics (id) on delete cascade,
	version_number integer not null,
	name text not null,
	type text not null check (type in ('positive', 'negative')),
	definition text not null,
	examples text[] not null default '{}',
	matters_because text,
	contributor text,
	-- Escape hatch for whatever a source (an import, an idea-submission form)
	-- supplies that isn't one of the columns above — e.g. KORA's rows are the
	-- only ones so far that carry a benchmark-internal organizing category
	-- ("Violence & Physical Harm"). One field used by one benchmark doesn't
	-- earn its own column (see the same reasoning on scenarios.raw below);
	-- it lands here as {"internal_category": "..."} instead, and only gets
	-- promoted to a real column once several sources actually populate it or
	-- the UI needs to filter/sort on it.
	raw jsonb not null default '{}'::jsonb,
	-- Hash of the fields that actually feed scenario generation (name + type
	-- + definition + examples). Populated by app/import code, not computed
	-- in SQL. This is the direct fix for the pipeline's cache bug: staleness
	-- becomes `scenario's generating version hash != metric's current
	-- version hash` — a cheap indexed comparison — instead of a local cache
	-- file on someone's laptop that nothing checks against the actual text.
	content_hash text not null,
	created_at timestamptz not null default now(),
	created_by text,
	constraint metric_versions_name_len check (char_length(name) between 1 and 300),
	constraint metric_versions_definition_len check (char_length(definition) <= 5000),
	constraint metric_versions_matters_because_len check (
		matters_because is null or char_length(matters_because) <= 2000
	),
	constraint metric_versions_contributor_len check (
		contributor is null or char_length(contributor) <= 300
	),
	constraint metric_versions_raw_is_object check (jsonb_typeof(raw) = 'object'),
	constraint metric_versions_version_number_positive check (version_number > 0),
	unique (metric_id, version_number)
);

-- Defensive: these columns were added after the tables above were first
-- written. `create table if not exists` skips its body entirely if the table
-- already exists, so these add the columns even on a database where this
-- file already ran once before they existed.
-- suggested_areas was this column's original, less accurate name (it was
-- assumed to hold only area-level tags before we noticed the source data
-- mixes in subarea-level ones too). Rename only if the old name is present
-- (a fresh install never had it, so a plain "rename column" would error).
do $$
begin
	if exists (
		select 1 from information_schema.columns
		where table_schema = 'public' and table_name = 'metrics' and column_name = 'suggested_areas'
	) then
		alter table public.metrics rename column suggested_areas to suggested_placements;
	end if;
end;
$$;
alter table public.metrics add column if not exists suggested_placements text[];
alter table public.metric_versions drop column if exists internal_category;
alter table public.metric_versions
	drop constraint if exists metric_versions_internal_category_len;
alter table public.metric_versions add column if not exists raw jsonb;
update public.metric_versions set raw = '{}'::jsonb where raw is null;
alter table public.metric_versions alter column raw set default '{}'::jsonb;
alter table public.metric_versions alter column raw set not null;
alter table public.metric_versions
	drop constraint if exists metric_versions_raw_is_object;
alter table public.metric_versions
	add constraint metric_versions_raw_is_object check (jsonb_typeof(raw) = 'object');

alter table public.metrics
	drop constraint if exists metrics_current_version_fk;
alter table public.metrics
	add constraint metrics_current_version_fk
	foreign key (current_version_id) references public.metric_versions (id)
	deferrable initially deferred;

alter table public.taxonomy_placements
	drop constraint if exists taxonomy_placements_metric_fk;
alter table public.taxonomy_placements
	add constraint taxonomy_placements_metric_fk
	foreign key (metric_id) references public.metrics (id) on delete cascade;

alter table public.nutrition_placements
	drop constraint if exists nutrition_placements_metric_fk;
alter table public.nutrition_placements
	add constraint nutrition_placements_metric_fk
	foreign key (metric_id) references public.metrics (id) on delete cascade;

drop trigger if exists metrics_set_updated_at on public.metrics;
create trigger metrics_set_updated_at
	before update on public.metrics
	for each row execute function public.set_updated_at();

-- ───────────────────────────── Scenarios / runs ──────────────────────────────
-- Each scenario belongs to exactly one metric VERSION (not just one metric)
-- — that's what makes staleness detection possible at all. `raw` holds
-- whatever extra fields the pipeline emits that haven't been promoted to a
-- real column yet: the "fits an evolving format" escape hatch. A new field
-- from the generation pipeline shows up in `raw` immediately, with no
-- migration required, and only gets promoted to a real column once it's
-- clear the UI actually needs to filter/sort on it.

create table if not exists public.scenarios (
	id uuid primary key default gen_random_uuid(),
	metric_version_id uuid not null references public.metric_versions (id) on delete cascade,
	age text not null default 'adult' check (age in ('adult', 'child')),
	title text not null,
	persona text,
	user_goal text,
	-- The scenario id from the source pipeline's scenarios.json (e.g.
	-- 'm01_s001_v01'). Added while wiring up the first real import: without
	-- it, re-running an import script has no natural key to upsert against
	-- and would insert duplicate scenario rows every time.
	source_id text,
	-- 'submitted' = a human's proposed example scenario, written before any
	-- simulation ever ran (e.g. scen_1/2/3 on an idea-submission form).
	-- 'generated' = real pipeline output from gen_scenarios. Keeps the two
	-- from being conflated once a submitted metric is approved and the
	-- pipeline generates its own scenarios for the same metric_version.
	source text not null default 'generated' check (source in ('generated', 'submitted')),
	raw jsonb not null default '{}'::jsonb,
	generated_at timestamptz not null default now(),
	constraint scenarios_title_len check (char_length(title) <= 500),
	constraint scenarios_source_id_len check (source_id is null or char_length(source_id) <= 200),
	constraint scenarios_raw_is_object check (jsonb_typeof(raw) = 'object'),
	unique (metric_version_id, source_id)
);

-- Defensive: 'source' was added after this table was first written (see the
-- upgrade-path note above metrics/metric_versions). Safe to re-run whether
-- or not the column already exists.
alter table public.scenarios add column if not exists source text;
update public.scenarios set source = 'generated' where source is null;
alter table public.scenarios alter column source set default 'generated';
alter table public.scenarios alter column source set not null;
alter table public.scenarios
	drop constraint if exists scenarios_source_check;
alter table public.scenarios
	add constraint scenarios_source_check check (source in ('generated', 'submitted'));

create table if not exists public.conversations (
	id uuid primary key default gen_random_uuid(),
	scenario_id uuid not null references public.scenarios (id) on delete cascade,
	model_id uuid not null references public.models (id) on delete cascade,
	transcript jsonb not null,
	generated_at timestamptz not null default now(),
	unique (scenario_id, model_id)
);

create table if not exists public.scores (
	id uuid primary key default gen_random_uuid(),
	conversation_id uuid not null references public.conversations (id) on delete cascade,
	present boolean,
	passed boolean not null,
	justification text,
	created_at timestamptz not null default now(),
	unique (conversation_id),
	constraint scores_justification_len check (
		justification is null or char_length(justification) <= 20000
	)
);

-- ───────────────────────────── Generation runs ───────────────────────────────
-- Per-(metric version, model, phase) job tracking, so the admin UI can show
-- real per-model progress ("simulating for 2 of 5 models") instead of one
-- coarse status on the metric, and so cost/token spend is queryable instead
-- of living only in a local cost.json file. Internal ops table — no
-- public-facing use, so it's locked down like admin_keys rather than given a
-- public-read policy.

create table if not exists public.generation_runs (
	id uuid primary key default gen_random_uuid(),
	metric_version_id uuid not null references public.metric_versions (id) on delete cascade,
	model_id uuid references public.models (id) on delete cascade,  -- null = benchmark-wide phase
	phase text not null check (phase in ('gen_scenarios', 'simulate', 'evaluate', 'aggregate')),
	status text not null default 'pending'
		check (status in ('pending', 'running', 'done', 'error')),
	cost numeric,
	input_tokens integer,
	output_tokens integer,
	error_message text,
	started_at timestamptz,
	finished_at timestamptz,
	created_at timestamptz not null default now()
);

alter table public.generation_runs enable row level security;
alter table public.generation_runs force row level security;

drop policy if exists generation_runs_no_direct_access on public.generation_runs;
create policy generation_runs_no_direct_access on public.generation_runs
	for all
	to anon, authenticated
	using (false)
	with check (false);

revoke all on table public.generation_runs from public, anon, authenticated;

-- ───────────────────────────── Indexes ───────────────────────────────────────

create index if not exists metrics_benchmark_idx on public.metrics (benchmark_id);
create index if not exists metric_versions_metric_idx on public.metric_versions (metric_id);
create index if not exists taxonomy_placements_subarea_idx on public.taxonomy_placements (subarea_id);
create index if not exists nutrition_placements_category_idx
	on public.nutrition_placements (nutrition_category_id);
create index if not exists scenarios_metric_version_idx on public.scenarios (metric_version_id);
create index if not exists conversations_scenario_idx on public.conversations (scenario_id);
create index if not exists conversations_model_idx on public.conversations (model_id);
create index if not exists scores_conversation_idx on public.scores (conversation_id);
create index if not exists generation_runs_metric_version_idx
	on public.generation_runs (metric_version_id);

-- ───────────────────────────── Public read access ────────────────────────────
-- These twelve tables mirror content already served as static, unauthenticated
-- JSON from R2 today, so read access is public by design — no login, no
-- capability key. Write access is deliberately absent here: no
-- insert/update/delete grants exist for anon/authenticated on any of them,
-- and none will be added directly — mutations go exclusively through
-- SECURITY DEFINER RPCs (next pass) gated by _assert_admin, exactly like the
-- experts / expert_evaluations write path.

revoke all on table public.models from public, anon, authenticated;
grant select on table public.models to anon, authenticated;
alter table public.models enable row level security;
alter table public.models force row level security;
drop policy if exists models_public_read on public.models;
create policy models_public_read on public.models for select to anon, authenticated using (true);

revoke all on table public.benchmarks from public, anon, authenticated;
grant select on table public.benchmarks to anon, authenticated;
alter table public.benchmarks enable row level security;
alter table public.benchmarks force row level security;
drop policy if exists benchmarks_public_read on public.benchmarks;
create policy benchmarks_public_read on public.benchmarks for select to anon, authenticated using (true);

revoke all on table public.taxonomy_areas from public, anon, authenticated;
grant select on table public.taxonomy_areas to anon, authenticated;
alter table public.taxonomy_areas enable row level security;
alter table public.taxonomy_areas force row level security;
drop policy if exists taxonomy_areas_public_read on public.taxonomy_areas;
create policy taxonomy_areas_public_read on public.taxonomy_areas
	for select to anon, authenticated using (true);

revoke all on table public.taxonomy_subareas from public, anon, authenticated;
grant select on table public.taxonomy_subareas to anon, authenticated;
alter table public.taxonomy_subareas enable row level security;
alter table public.taxonomy_subareas force row level security;
drop policy if exists taxonomy_subareas_public_read on public.taxonomy_subareas;
create policy taxonomy_subareas_public_read on public.taxonomy_subareas
	for select to anon, authenticated using (true);

revoke all on table public.taxonomy_placements from public, anon, authenticated;
grant select on table public.taxonomy_placements to anon, authenticated;
alter table public.taxonomy_placements enable row level security;
alter table public.taxonomy_placements force row level security;
drop policy if exists taxonomy_placements_public_read on public.taxonomy_placements;
create policy taxonomy_placements_public_read on public.taxonomy_placements
	for select to anon, authenticated using (true);

revoke all on table public.nutrition_categories from public, anon, authenticated;
grant select on table public.nutrition_categories to anon, authenticated;
alter table public.nutrition_categories enable row level security;
alter table public.nutrition_categories force row level security;
drop policy if exists nutrition_categories_public_read on public.nutrition_categories;
create policy nutrition_categories_public_read on public.nutrition_categories
	for select to anon, authenticated using (true);

revoke all on table public.nutrition_placements from public, anon, authenticated;
grant select on table public.nutrition_placements to anon, authenticated;
alter table public.nutrition_placements enable row level security;
alter table public.nutrition_placements force row level security;
drop policy if exists nutrition_placements_public_read on public.nutrition_placements;
create policy nutrition_placements_public_read on public.nutrition_placements
	for select to anon, authenticated using (true);

revoke all on table public.metrics from public, anon, authenticated;
grant select on table public.metrics to anon, authenticated;
alter table public.metrics enable row level security;
alter table public.metrics force row level security;
drop policy if exists metrics_public_read on public.metrics;
create policy metrics_public_read on public.metrics for select to anon, authenticated using (true);

revoke all on table public.metric_versions from public, anon, authenticated;
grant select on table public.metric_versions to anon, authenticated;
alter table public.metric_versions enable row level security;
alter table public.metric_versions force row level security;
drop policy if exists metric_versions_public_read on public.metric_versions;
create policy metric_versions_public_read on public.metric_versions
	for select to anon, authenticated using (true);

revoke all on table public.scenarios from public, anon, authenticated;
grant select on table public.scenarios to anon, authenticated;
alter table public.scenarios enable row level security;
alter table public.scenarios force row level security;
drop policy if exists scenarios_public_read on public.scenarios;
create policy scenarios_public_read on public.scenarios for select to anon, authenticated using (true);

revoke all on table public.conversations from public, anon, authenticated;
grant select on table public.conversations to anon, authenticated;
alter table public.conversations enable row level security;
alter table public.conversations force row level security;
drop policy if exists conversations_public_read on public.conversations;
create policy conversations_public_read on public.conversations
	for select to anon, authenticated using (true);

revoke all on table public.scores from public, anon, authenticated;
grant select on table public.scores to anon, authenticated;
alter table public.scores enable row level security;
alter table public.scores force row level security;
drop policy if exists scores_public_read on public.scores;
create policy scores_public_read on public.scores for select to anon, authenticated using (true);
