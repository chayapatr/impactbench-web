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

-- ───────────────────────────── Providers ─────────────────────────────────────
-- Real-world provider identity (anthropic/openai/deepinfra/xai/publicai) --
-- deliberately separate from litellm's `source` dialect, since config.yaml
-- shows they're not the same thing: grok-4-fast and apertus-8b both use
-- `source: openai` (that's just the wire protocol litellm speaks to them
-- with) but are really xAI and PublicAI, each with their own api key and
-- base_url. Grouping models by that free-text dialect would misgroup them.
-- Holds the api key, so — like admin_keys — it's deny-all direct access;
-- read/write only via the SECURITY DEFINER RPCs below.

create table if not exists public.providers (
	id uuid primary key default gen_random_uuid(),
	slug text not null unique,                    -- e.g. 'anthropic', 'xai', 'publicai'
	display_name text not null,
	source text not null,                         -- litellm dialect: 'anthropic' | 'openai' | 'deepinfra' | ...
	base_url text,
	api_key text,
	extra_headers jsonb not null default '{}'::jsonb,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	constraint providers_slug_len check (char_length(slug) between 1 and 60),
	constraint providers_display_name_len check (char_length(display_name) between 1 and 200),
	constraint providers_source_len check (char_length(source) between 1 and 60),
	constraint providers_extra_headers_is_object check (jsonb_typeof(extra_headers) = 'object')
);

drop trigger if exists providers_set_updated_at on public.providers;
create trigger providers_set_updated_at
	before update on public.providers
	for each row execute function public.set_updated_at();

alter table public.providers enable row level security;
alter table public.providers force row level security;

drop policy if exists providers_no_direct_access on public.providers;
create policy providers_no_direct_access on public.providers
	for all
	to anon, authenticated
	using (false)
	with check (false);

revoke all on table public.providers from public, anon, authenticated;

-- ───────────────────────────── Models ────────────────────────────────────────
-- Replaces the hand-edited top-level models.yaml.

create table if not exists public.models (
	id uuid primary key default gen_random_uuid(),
	slug text not null unique,                    -- e.g. 'claude-haiku-4-5' (matches run_dir today)
	display_name text not null,
	provider_id uuid not null references public.providers (id),
	surfaces text[] not null default '{full}',    -- 'full' | 'nutritional-label'
	status text not null default 'active'
		check (status in ('active', 'retired')),
	-- The real litellm model string (config.yaml's targets[].model), which is
	-- often NOT the same as slug -- slug mirrors the short run_dir id
	-- (e.g. 'llama-4-maverick'), while this is the full identifier litellm
	-- actually calls (e.g. 'meta-llama/Llama-4-Maverick-17B-128E-Instruct-
	-- FP8'). Nullable: a model row can exist (e.g. hand-added later) before
	-- anyone's filled this in -- the Pipeline roles dropdown in Models & Ops
	-- just excludes rows where it's blank, rather than requiring it upfront.
	litellm_model text,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	constraint models_slug_len check (char_length(slug) between 1 and 120),
	constraint models_display_name_len check (char_length(display_name) between 1 and 200),
	constraint models_litellm_model_len check (
		litellm_model is null or char_length(litellm_model) between 1 and 300
	)
);

-- Defensive: litellm_model was added after this table was first written.
alter table public.models add column if not exists litellm_model text;
alter table public.models drop constraint if exists models_litellm_model_len;
alter table public.models add constraint models_litellm_model_len check (
	litellm_model is null or char_length(litellm_model) between 1 and 300
);

drop trigger if exists models_set_updated_at on public.models;
create trigger models_set_updated_at
	before update on public.models
	for each row execute function public.set_updated_at();

-- Defensive: 'provider' (free text) was replaced by 'provider_id' (real FK
-- to the new providers table above, see its comment). Auto-creates a
-- provider row named after whatever text was already there rather than
-- discarding it -- this keeps the migration self-contained regardless of
-- whether a real provider seed has been run yet; re-seeding providers with
-- the correct source/base_url afterward (on conflict (slug) do update) fixes
-- them up without touching this migration.
do $$
begin
	if exists (
		select 1 from information_schema.columns
		where table_schema = 'public' and table_name = 'models' and column_name = 'provider'
	) then
		insert into public.providers (slug, display_name, source)
		select distinct provider, provider, provider
		from public.models
		where provider is not null
		on conflict (slug) do nothing;

		alter table public.models add column if not exists provider_id uuid;
		update public.models m
		set provider_id = p.id
		from public.providers p
		where m.provider_id is null and m.provider = p.slug;

		alter table public.models drop constraint if exists models_provider_len;
		alter table public.models drop column provider;
	end if;
end;
$$;
alter table public.models add column if not exists provider_id uuid;
alter table public.models
	drop constraint if exists models_provider_id_fkey;
alter table public.models
	add constraint models_provider_id_fkey foreign key (provider_id) references public.providers (id);
alter table public.models alter column provider_id set not null;

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
-- Content (name, type, definition, examples, mattersBecause, ...) lives
-- directly on the metric row. This used to be split into a separate
-- metric_versions table so every edit became a new, immutable version —
-- that turned out not to be worth its complexity (nobody ever read old
-- version text; the only thing it bought was scenario staleness detection,
-- which was removed at the same time this collapsed back to one row per
-- metric). An edit is now just an update, in place.

create table if not exists public.metrics (
	id uuid primary key default gen_random_uuid(),
	benchmark_id uuid not null references public.benchmarks (id) on delete cascade,
	slug text not null,                           -- e.g. 'm01' (matches the id in benchmark.yaml today)
	-- Workflow order, also the order the /metrics-admin sidebar and sort use:
	-- draft -> ready_to_simulate -> ready_to_publish -> published. No
	-- separate "generating"/"simulating" in-progress status: those are
	-- transient (a modal's local progress state while the action runs), not
	-- worth persisting — the row just lands on the next at-rest status when
	-- the action completes. There is also no separate "ready to evaluate" /
	-- "evaluating" status: real per-model evaluation is inherently per-model
	-- (a metric can be evaluated against model A and not model B at the same
	-- time), so a single metric-level status can't really capture it — that
	-- needs a real design pass and has no UI action yet, so a metric that
	-- has passed its test simulation is just 'ready_to_publish' already;
	-- evaluation results, once designed, will layer on top rather than
	-- gating this status.
	status text not null default 'draft'
		check (status in (
			'draft', 'ready_to_simulate', 'ready_to_publish', 'published'
		)),
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
	-- in SQL. Lets the importer cheaply tell "content actually changed" from
	-- "re-imported the same row" without a text-by-text comparison.
	content_hash text not null,
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
	constraint metrics_name_len check (char_length(name) between 1 and 300),
	constraint metrics_definition_len check (char_length(definition) <= 5000),
	constraint metrics_matters_because_len check (
		matters_because is null or char_length(matters_because) <= 2000
	),
	constraint metrics_contributor_len check (
		contributor is null or char_length(contributor) <= 300
	),
	constraint metrics_raw_is_object check (jsonb_typeof(raw) = 'object'),
	unique (benchmark_id, slug)
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

-- Defensive: 'scenarios_generating' was removed (see the status column
-- comment above). Any row stuck in that old transient status migrates back
-- to 'draft' — the safe choice, since 'scenarios_generating' never
-- guaranteed scenarios actually existed yet; claiming 'ready_to_simulate'
-- would overstate what's really there.
update public.metrics set status = 'draft' where status = 'scenarios_generating';
-- Defensive: 'ready_to_evaluate' and 'evaluating' were collapsed into
-- 'ready_to_publish' — a metric that's passed its test simulation is
-- treated as ready to publish outright, since real per-model evaluation is
-- still undesigned (see the status column comment above). Any row in either
-- old status migrates to 'ready_to_publish'.
update public.metrics set status = 'ready_to_publish' where status in ('ready_to_evaluate', 'evaluating');
alter table public.metrics
	drop constraint if exists metrics_status_check;
alter table public.metrics
	add constraint metrics_status_check check (status in (
		'draft', 'ready_to_simulate', 'ready_to_publish', 'published'
	));

-- Defensive: content columns (name/type/definition/examples/matters_because/
-- contributor/raw/content_hash) moved off metric_versions onto metrics
-- directly (see the table comment above). Backfill each metric from its
-- current version before metric_versions is dropped further down.
alter table public.metrics add column if not exists name text;
alter table public.metrics add column if not exists type text;
alter table public.metrics add column if not exists definition text;
alter table public.metrics add column if not exists examples text[];
alter table public.metrics add column if not exists matters_because text;
alter table public.metrics add column if not exists contributor text;
alter table public.metrics add column if not exists raw jsonb;
alter table public.metrics add column if not exists content_hash text;

do $$
begin
	if exists (
		select 1 from information_schema.tables
		where table_schema = 'public' and table_name = 'metric_versions'
	) then
		update public.metrics m
		set name = v.name, type = v.type, definition = v.definition, examples = v.examples,
			matters_because = v.matters_because, contributor = v.contributor, raw = v.raw,
			content_hash = v.content_hash
		from public.metric_versions v
		where v.id = m.current_version_id and m.name is null;
	end if;
end;
$$;

-- Any metric that somehow has no version to backfill from (shouldn't happen
-- in practice — every metric gets one at creation) gets safe, well-formed
-- placeholders instead of leaving these NOT NULL columns un-settable.
update public.metrics set examples = '{}' where examples is null;
update public.metrics set raw = '{}'::jsonb where raw is null;
update public.metrics set type = 'positive' where type is null;
update public.metrics set definition = '' where definition is null;
update public.metrics set name = slug where name is null;
update public.metrics set content_hash = encode(
	digest(coalesce(name, '') || '|' || coalesce(type, '') || '|' || coalesce(definition, ''), 'sha256'),
	'hex'
) where content_hash is null;

alter table public.metrics alter column examples set default '{}';
alter table public.metrics alter column examples set not null;
alter table public.metrics alter column raw set default '{}'::jsonb;
alter table public.metrics alter column raw set not null;
alter table public.metrics alter column name set not null;
alter table public.metrics alter column type set not null;
alter table public.metrics alter column definition set not null;
alter table public.metrics alter column content_hash set not null;

alter table public.metrics drop constraint if exists metrics_type_check;
alter table public.metrics add constraint metrics_type_check check (type in ('positive', 'negative'));
alter table public.metrics drop constraint if exists metrics_name_len;
alter table public.metrics add constraint metrics_name_len check (char_length(name) between 1 and 300);
alter table public.metrics drop constraint if exists metrics_definition_len;
alter table public.metrics add constraint metrics_definition_len check (char_length(definition) <= 5000);
alter table public.metrics drop constraint if exists metrics_matters_because_len;
alter table public.metrics add constraint metrics_matters_because_len check (
	matters_because is null or char_length(matters_because) <= 2000
);
alter table public.metrics drop constraint if exists metrics_contributor_len;
alter table public.metrics add constraint metrics_contributor_len check (
	contributor is null or char_length(contributor) <= 300
);
alter table public.metrics drop constraint if exists metrics_raw_is_object;
alter table public.metrics add constraint metrics_raw_is_object check (jsonb_typeof(raw) = 'object');

-- current_version_id/its FK are gone now that content lives on metrics
-- directly.
alter table public.metrics drop constraint if exists metrics_current_version_fk;
alter table public.metrics drop column if exists current_version_id;

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
-- Each scenario belongs to one metric. `raw` holds whatever extra fields the
-- pipeline emits that haven't been promoted to a real column yet: the "fits
-- an evolving format" escape hatch. A new field from the generation pipeline
-- shows up in `raw` immediately, with no migration required, and only gets
-- promoted to a real column once it's clear the UI actually needs to
-- filter/sort on it.

create table if not exists public.scenarios (
	id uuid primary key default gen_random_uuid(),
	metric_id uuid not null references public.metrics (id) on delete cascade,
	-- Arbitrary demographic-axis -> descriptive-value map, e.g.
	-- {"age": "Adult (18+)"}. jsonb (not a fixed 'adult'/'child' enum) because
	-- config.yaml's `demographics` block is an open set of axes -- today just
	-- age, but nothing stops a second axis being added, and the real values
	-- are full descriptive strings, not two fixed short codes.
	demographic jsonb not null default '{}'::jsonb,
	title text not null,
	persona text,
	user_goal text,
	-- What the user is implicitly trying to elicit (real pipeline field, not
	-- shown to the target model) and the turn-by-turn pressure script. Real
	-- content of a generated scenario, not incidental metadata -- promoted to
	-- real columns instead of living in `raw` once the pipeline's actual
	-- scenario shape was confirmed (lib/core/generate.py).
	latent_adversarial_goal text,
	landmarks jsonb not null default '[]'::jsonb,
	-- The scenario id from the source pipeline's scenarios.json (e.g.
	-- 'm01_s001_v01'). Added while wiring up the first real import: without
	-- it, re-running an import script has no natural key to upsert against
	-- and would insert duplicate scenario rows every time.
	source_id text,
	-- 'submitted' = a human's proposed example scenario, written before any
	-- simulation ever ran (e.g. scen_1/2/3 on an idea-submission form).
	-- 'generated' = real pipeline output from gen_scenarios. Keeps the two
	-- from being conflated once a submitted metric is approved and the
	-- pipeline generates its own scenarios for the same metric.
	source text not null default 'generated' check (source in ('generated', 'submitted')),
	raw jsonb not null default '{}'::jsonb,
	generated_at timestamptz not null default now(),
	constraint scenarios_title_len check (char_length(title) <= 500),
	constraint scenarios_source_id_len check (source_id is null or char_length(source_id) <= 200),
	constraint scenarios_raw_is_object check (jsonb_typeof(raw) = 'object'),
	constraint scenarios_demographic_is_object check (jsonb_typeof(demographic) = 'object'),
	constraint scenarios_landmarks_is_array check (jsonb_typeof(landmarks) = 'array'),
	unique (metric_id, source_id)
);

-- Defensive: metric_version_id -> metric_id (see the table comment above).
-- Backfill from metric_versions before it's dropped further down, then drop
-- the old column -- Postgres cascades its FK/unique constraint away with it,
-- so there's nothing to drop by name first.
alter table public.scenarios add column if not exists metric_id uuid;
do $$
begin
	if exists (
		select 1 from information_schema.columns
		where table_schema = 'public' and table_name = 'scenarios' and column_name = 'metric_version_id'
	) then
		update public.scenarios s
		set metric_id = v.metric_id
		from public.metric_versions v
		where v.id = s.metric_version_id and s.metric_id is null;

		alter table public.scenarios drop column metric_version_id;
	end if;
end;
$$;
alter table public.scenarios alter column metric_id set not null;
alter table public.scenarios
	drop constraint if exists scenarios_metric_id_fkey;
alter table public.scenarios
	add constraint scenarios_metric_id_fkey foreign key (metric_id) references public.metrics (id) on delete cascade;
alter table public.scenarios
	drop constraint if exists scenarios_metric_id_source_id_key;
alter table public.scenarios
	add constraint scenarios_metric_id_source_id_key unique (metric_id, source_id);

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

-- Defensive: 'age' (fixed 'adult'/'child' enum) was replaced by 'demographic'
-- jsonb (see the column comment above). Preserve whatever's in the old
-- column instead of silently discarding it, then drop it.
do $$
begin
	if exists (
		select 1 from information_schema.columns
		where table_schema = 'public' and table_name = 'scenarios' and column_name = 'age'
	) then
		alter table public.scenarios add column if not exists demographic jsonb;
		update public.scenarios
		set demographic = jsonb_build_object('age', age)
		where demographic is null and age is not null;
		alter table public.scenarios drop column age;
	end if;
end;
$$;
alter table public.scenarios add column if not exists demographic jsonb;
update public.scenarios set demographic = '{}'::jsonb where demographic is null;
alter table public.scenarios alter column demographic set default '{}'::jsonb;
alter table public.scenarios alter column demographic set not null;
alter table public.scenarios
	drop constraint if exists scenarios_demographic_is_object;
alter table public.scenarios
	add constraint scenarios_demographic_is_object check (jsonb_typeof(demographic) = 'object');

alter table public.scenarios add column if not exists latent_adversarial_goal text;
alter table public.scenarios add column if not exists landmarks jsonb;
update public.scenarios set landmarks = '[]'::jsonb where landmarks is null;
alter table public.scenarios alter column landmarks set default '[]'::jsonb;
alter table public.scenarios alter column landmarks set not null;
alter table public.scenarios
	drop constraint if exists scenarios_landmarks_is_array;
alter table public.scenarios
	add constraint scenarios_landmarks_is_array check (jsonb_typeof(landmarks) = 'array');

-- sample_index: the pipeline's generation.num_samples runs multiple
-- independent conversation samples per (scenario, model) to measure
-- inter-sample agreement (see the docs' "Reliability" section) -- without
-- this column, a second sample for the same scenario+model would violate
-- the old unique(scenario_id, model_id) constraint. Default 0 covers the
-- common num_samples=1 case with no extra work at insert time.
create table if not exists public.conversations (
	id uuid primary key default gen_random_uuid(),
	scenario_id uuid not null references public.scenarios (id) on delete cascade,
	model_id uuid not null references public.models (id) on delete cascade,
	sample_index integer not null default 0,
	transcript jsonb not null,
	generated_at timestamptz not null default now(),
	unique (scenario_id, model_id, sample_index)
);

-- Defensive: sample_index/the old two-column unique constraint predate
-- num_samples support. Safe to re-run whether or not the column already
-- exists; drops whichever constraint name Postgres auto-generated for the
-- original unique(scenario_id, model_id) before adding the new one.
alter table public.conversations add column if not exists sample_index integer;
update public.conversations set sample_index = 0 where sample_index is null;
alter table public.conversations alter column sample_index set default 0;
alter table public.conversations alter column sample_index set not null;
alter table public.conversations
	drop constraint if exists conversations_scenario_id_model_id_key;
alter table public.conversations
	drop constraint if exists conversations_scenario_id_model_id_sample_index_key;
alter table public.conversations
	add constraint conversations_scenario_id_model_id_sample_index_key
	unique (scenario_id, model_id, sample_index);

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
-- Per-(metric, model, phase) job tracking, so the admin UI can show real
-- per-model progress ("simulating for 2 of 5 models") instead of one coarse
-- status on the metric, and so cost/token spend is queryable instead of
-- living only in a local cost.json file. Internal ops table — no
-- public-facing use, so it's locked down like admin_keys rather than given a
-- public-read policy.

create table if not exists public.generation_runs (
	id uuid primary key default gen_random_uuid(),
	metric_id uuid not null references public.metrics (id) on delete cascade,
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

-- Defensive: metric_version_id -> metric_id, same reasoning as scenarios above.
alter table public.generation_runs add column if not exists metric_id uuid;
do $$
begin
	if exists (
		select 1 from information_schema.columns
		where table_schema = 'public' and table_name = 'generation_runs' and column_name = 'metric_version_id'
	) then
		update public.generation_runs g
		set metric_id = v.metric_id
		from public.metric_versions v
		where v.id = g.metric_version_id and g.metric_id is null;

		alter table public.generation_runs drop column metric_version_id;
	end if;
end;
$$;
alter table public.generation_runs alter column metric_id set not null;
alter table public.generation_runs
	drop constraint if exists generation_runs_metric_id_fkey;
alter table public.generation_runs
	add constraint generation_runs_metric_id_fkey foreign key (metric_id) references public.metrics (id) on delete cascade;

alter table public.generation_runs enable row level security;
alter table public.generation_runs force row level security;

drop policy if exists generation_runs_no_direct_access on public.generation_runs;
create policy generation_runs_no_direct_access on public.generation_runs
	for all
	to anon, authenticated
	using (false)
	with check (false);

revoke all on table public.generation_runs from public, anon, authenticated;

-- metric_versions is fully superseded now: every column that mattered was
-- backfilled onto metrics (content) / scenarios / generation_runs
-- (metric_id) above. Cascade is defensive — nothing should still reference
-- it by this point.
drop table if exists public.metric_versions cascade;

-- ───────────────────────────── Indexes ───────────────────────────────────────

create index if not exists metrics_benchmark_idx on public.metrics (benchmark_id);
create index if not exists taxonomy_placements_subarea_idx on public.taxonomy_placements (subarea_id);
create index if not exists nutrition_placements_category_idx
	on public.nutrition_placements (nutrition_category_id);
create index if not exists scenarios_metric_idx on public.scenarios (metric_id);
create index if not exists conversations_scenario_idx on public.conversations (scenario_id);
create index if not exists conversations_model_idx on public.conversations (model_id);
create index if not exists scores_conversation_idx on public.scores (conversation_id);
create index if not exists generation_runs_metric_idx
	on public.generation_runs (metric_id);
create index if not exists models_provider_idx on public.models (provider_id);

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

-- ─────────────────────────────────────────────────────────────────────────────
-- CSV mass import (admin-key-gated write RPC)
--   None of the tables above grant anon/authenticated anything beyond SELECT,
--   so this SECURITY DEFINER function — same _assert_admin gate as
--   admin_overview in schema.sql — is the only way /metrics-admin's Import
--   tab can write.
--
--   Merge semantics, never a wipe: for each incoming metric, matched against
--   an existing one by (benchmark_slug, slug) —
--     • no match            -> insert a new metric (status 'draft').
--     • match, same content -> untouched, except suggested_placements is
--                               refreshed (it isn't part of content_hash).
--     • match, changed      -> the metric row is updated in place (content
--                               columns + content_hash).
--   Either way, any scenario titles in the payload are upserted by
--   (metric_id, source_id) -- re-importing the same scenario title again is
--   a no-op, a changed one updates in place.
--   Anything already in the database whose (benchmark_slug, slug) isn't in
--   this payload is never touched, let alone deleted — a subset CSV is safe
--   to import repeatedly.
--
--   The caller (src/lib/metrics-admin/csv-import.ts) does all CSV parsing,
--   slugging, and content_hash computation in the browser and sends a
--   pre-shaped payload:
--     {
--       "benchmarks": [ { "slug": "...", "name": "..." }, ... ],
--       "metrics": [
--         {
--           "benchmark_slug": "...", "slug": "...", "name": "...",
--           "type": "positive" | "negative", "definition": "...",
--           "examples": ["...", ...], "suggested_placements": ["...", ...],
--           "raw": { "internal_category": "...", "submitted_date": "..." },
--           "content_hash": "<sha256 hex>",
--           "scenarios": [ { "title": "...", "source_id": "..." }, ... ]
--         }, ...
--       ]
--     }
--   Doing the hashing/slugging client-side (rather than with pgcrypto's
--   digest() in here) sidesteps depending on which schema pgcrypto lands in
--   on a given Postgres install — Supabase-managed projects put it in
--   `extensions`, a bare local install puts it in `public`, and this
--   function runs with search_path = '' either way.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.admin_import_metrics_csv(p_admin_key uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_benchmarks_in bigint := 0;
	v_metrics_created bigint := 0;
	v_metrics_updated bigint := 0;
	v_metrics_unchanged bigint := 0;
	v_scenarios_in bigint := 0;
	v_metric jsonb;
	v_scenario jsonb;
	v_benchmark_id uuid;
	v_metric_id uuid;
	v_existing_content_hash text;
	v_examples text[];
	v_placements text[];
begin
	perform public._assert_admin(p_admin_key);

	if p_payload is null
		or jsonb_typeof(p_payload -> 'benchmarks') is distinct from 'array'
		or jsonb_typeof(p_payload -> 'metrics') is distinct from 'array'
	then
		raise exception 'payload must include benchmarks[] and metrics[] arrays';
	end if;

	with ins as (
		insert into public.benchmarks (id, slug, name)
		select gen_random_uuid(), b ->> 'slug', b ->> 'name'
		from jsonb_array_elements(p_payload -> 'benchmarks') b
		on conflict (slug) do update set name = excluded.name
		returning 1
	)
	select count(*) into v_benchmarks_in from ins;

	for v_metric in select * from jsonb_array_elements(p_payload -> 'metrics')
	loop
		select id into v_benchmark_id
		from public.benchmarks
		where slug = v_metric ->> 'benchmark_slug';

		if v_benchmark_id is null then
			continue; -- benchmark_slug not present in benchmarks[]; shouldn't happen from a valid payload
		end if;

		select coalesce(array_agg(value), '{}') into v_examples
		from jsonb_array_elements_text(coalesce(v_metric -> 'examples', '[]'::jsonb));
		select coalesce(array_agg(value), '{}') into v_placements
		from jsonb_array_elements_text(coalesce(v_metric -> 'suggested_placements', '[]'::jsonb));

		select id, content_hash into v_metric_id, v_existing_content_hash
		from public.metrics
		where benchmark_id = v_benchmark_id and slug = v_metric ->> 'slug';

		if v_metric_id is null then
			-- New metric: insert it directly, content and all.
			v_metric_id := gen_random_uuid();
			insert into public.metrics
				(id, benchmark_id, slug, status, name, type, definition, examples, raw, content_hash, suggested_placements)
			values (
				v_metric_id, v_benchmark_id, v_metric ->> 'slug', 'draft',
				v_metric ->> 'name', v_metric ->> 'type', v_metric ->> 'definition',
				v_examples, coalesce(v_metric -> 'raw', '{}'::jsonb), v_metric ->> 'content_hash', v_placements
			);
			v_metrics_created := v_metrics_created + 1;
		elsif v_existing_content_hash is not distinct from (v_metric ->> 'content_hash') then
			-- Existing metric, content unchanged: just refresh the triage hint.
			update public.metrics set suggested_placements = v_placements where id = v_metric_id;
			v_metrics_unchanged := v_metrics_unchanged + 1;
		else
			-- Existing metric, content changed: update the row in place.
			update public.metrics
			set name = v_metric ->> 'name',
				type = v_metric ->> 'type',
				definition = v_metric ->> 'definition',
				examples = v_examples,
				raw = coalesce(v_metric -> 'raw', '{}'::jsonb),
				content_hash = v_metric ->> 'content_hash',
				suggested_placements = v_placements
			where id = v_metric_id;
			v_metrics_updated := v_metrics_updated + 1;
		end if;

		for v_scenario in select * from jsonb_array_elements(coalesce(v_metric -> 'scenarios', '[]'::jsonb))
		loop
			insert into public.scenarios (id, metric_id, title, user_goal, source_id, source)
			values (
				gen_random_uuid(), v_metric_id,
				v_scenario ->> 'title', v_scenario ->> 'title', v_scenario ->> 'source_id', 'submitted'
			)
			on conflict (metric_id, source_id) do update set
				title = excluded.title, user_goal = excluded.user_goal;
			v_scenarios_in := v_scenarios_in + 1;
		end loop;
	end loop;

	return jsonb_build_object(
		'benchmarks_processed', v_benchmarks_in,
		'metrics_created', v_metrics_created,
		'metrics_updated', v_metrics_updated,
		'metrics_unchanged', v_metrics_unchanged,
		'scenarios_added', v_scenarios_in
	);
end;
$$;

revoke all on function public.admin_import_metrics_csv(uuid, jsonb) from public;
grant execute on function public.admin_import_metrics_csv(uuid, jsonb) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Provider admin RPCs (list + set api key)
--   providers holds the api key, so it's deny-all like admin_keys -- these
--   two SECURITY DEFINER functions are the only way to read or write it.
--   admin_list_providers never returns the raw key, only whether one is set,
--   so the Models & Ops UI can show "configured/missing" per provider
--   without the key ever reaching the browser.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.admin_list_providers(p_admin_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	result jsonb;
begin
	perform public._assert_admin(p_admin_key);

	select coalesce(jsonb_agg(row_to_json(t) order by t.display_name), '[]'::jsonb)
	into result
	from (
		select
			id, slug, display_name, source, base_url, extra_headers,
			(api_key is not null and char_length(api_key) > 0) as api_key_set,
			created_at, updated_at
		from public.providers
	) t;

	return result;
end;
$$;

create or replace function public.admin_set_provider_api_key(p_admin_key uuid, p_provider_id uuid, p_api_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
	perform public._assert_admin(p_admin_key);

	update public.providers
	set api_key = nullif(trim(p_api_key), '')
	where id = p_provider_id;

	if not found then
		raise exception 'provider not found';
	end if;
end;
$$;

revoke all on function public.admin_list_providers(uuid) from public;
grant execute on function public.admin_list_providers(uuid) to anon, authenticated;
revoke all on function public.admin_set_provider_api_key(uuid, uuid, text) from public;
grant execute on function public.admin_set_provider_api_key(uuid, uuid, text) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Pipeline role models (which model generates, which model evaluates)
--   config.yaml's user_model (gen_metrics, gen_scenarios, demographic
--   expansion, and the adversarial "user" simulator in `simulate`) and
--   evaluator_model (evaluate) are hand-edited YAML today. This table makes
--   them editable from Models & Ops instead -- the /metrics-admin bridge
--   reads it before every pipeline run and rewrites those two keys in the
--   pipeline repo's config.yaml to match (see src/lib/server/pipeline/sync-
--   config.ts), the same "auto-sync on every run" treatment benchmark.yaml
--   already gets.
--
--   No secrets live here -- just which provider + model string plays each
--   role. Base URL and auth come from the provider row (providers.base_url,
--   resolved to a real env var by the bridge), not duplicated here, so
--   there's exactly one place each provider's connection details live.
--   Public-read like models/benchmarks (no secret exposure); write goes
--   through admin_set_pipeline_role_model like every other admin mutation.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.pipeline_role_models (
	role text primary key check (role in ('user_model', 'evaluator_model')),
	provider_id uuid not null references public.providers (id),
	model text not null,
	updated_at timestamptz not null default now(),
	constraint pipeline_role_models_model_len check (char_length(model) between 1 and 200)
);

drop trigger if exists pipeline_role_models_set_updated_at on public.pipeline_role_models;
create trigger pipeline_role_models_set_updated_at
	before update on public.pipeline_role_models
	for each row execute function public.set_updated_at();

create index if not exists pipeline_role_models_provider_idx
	on public.pipeline_role_models (provider_id);

revoke all on table public.pipeline_role_models from public, anon, authenticated;
grant select on table public.pipeline_role_models to anon, authenticated;
alter table public.pipeline_role_models enable row level security;
alter table public.pipeline_role_models force row level security;
drop policy if exists pipeline_role_models_public_read on public.pipeline_role_models;
create policy pipeline_role_models_public_read on public.pipeline_role_models
	for select to anon, authenticated using (true);

create or replace function public.admin_set_pipeline_role_model(
	p_admin_key uuid, p_role text, p_provider_id uuid, p_model text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
	perform public._assert_admin(p_admin_key);

	if p_role not in ('user_model', 'evaluator_model') then
		raise exception 'role must be user_model or evaluator_model';
	end if;
	if p_model is null or char_length(trim(p_model)) = 0 then
		raise exception 'model must not be blank';
	end if;

	insert into public.pipeline_role_models (role, provider_id, model)
	values (p_role, p_provider_id, trim(p_model))
	on conflict (role) do update set
		provider_id = excluded.provider_id, model = excluded.model, updated_at = now();
end;
$$;

revoke all on function public.admin_set_pipeline_role_model(uuid, text, uuid, text) from public;
grant execute on function public.admin_set_pipeline_role_model(uuid, text, uuid, text) to anon, authenticated;
