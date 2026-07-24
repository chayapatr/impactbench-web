import fs from 'node:fs';
import path from 'node:path';
import { load, dump } from 'js-yaml';
import { getSupabaseAdmin } from './supabase-admin';
import { getPipelineRepoPath } from './env';
import { PROVIDER_ENV_VARS } from './providers';

interface RoleModelRow {
	role: 'user_model' | 'evaluator_model';
	model: string;
	provider: { slug: string; source: string; base_url: string | null } | null;
}

/** Rewrites config.yaml's user_model/evaluator_model keys from whatever's
 * configured in Models & Ops (pipeline_role_models), same "auto-sync on
 * every run" treatment as benchmark.yaml. Every other key (targets,
 * generation, demographics, run, ...) round-trips untouched. If a role has
 * no row yet, that key in config.yaml is left as-is rather than cleared —
 * an unconfigured role should fall back to whatever's already on disk, not
 * break the file.
 *
 * apikey is written as the same "${ANTHROPIC_API_KEY}"-style placeholder
 * config.yaml already uses everywhere else, resolved at call time by
 * bench-py's lib/core/client.py::_resolve_env — never a raw secret written
 * to disk here.
 */
export async function syncConfigRoleModels(): Promise<void> {
	const supabase = getSupabaseAdmin();
	const { data, error } = await supabase
		.from('pipeline_role_models')
		.select('role, model, provider:providers(slug, source, base_url)');
	if (error) throw error;

	const rows = (data ?? []) as unknown as RoleModelRow[];
	if (rows.length === 0) return;

	const configPath = path.join(getPipelineRepoPath(), 'config.yaml');
	const cfg = load(fs.readFileSync(configPath, 'utf-8')) as Record<string, unknown>;

	for (const row of rows) {
		if (!row.provider) continue;
		const envVar = PROVIDER_ENV_VARS[row.provider.slug];
		cfg[row.role] = {
			model: row.model,
			source: row.provider.source,
			...(envVar ? { apikey: `\${${envVar}}` } : {}),
			...(row.provider.base_url ? { base_url: row.provider.base_url } : {})
		};
	}

	fs.writeFileSync(configPath, dump(cfg, { lineWidth: -1 }));
}
