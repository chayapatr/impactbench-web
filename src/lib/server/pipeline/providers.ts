import { getSupabaseAdmin } from './supabase-admin';

// config.yaml's targets/user_model/evaluator_model all reference api keys as
// "${ANTHROPIC_API_KEY}" etc, resolved from real OS environment variables by
// bench-py's lib/core/client.py::_resolve_env. This is a fixed, small set —
// one env var name per provider slug in our providers table — not something
// that needs to be user-configurable, since it mirrors literal strings
// already hardcoded in config.yaml.
// Exported so sync-config.ts can point config.yaml's user_model/
// evaluator_model at the same "${ENV_VAR}" placeholders, rather than
// duplicating this list.
export const PROVIDER_ENV_VARS: Record<string, string> = {
	anthropic: 'ANTHROPIC_API_KEY',
	openai: 'OPENAI_API_KEY',
	deepinfra: 'DEEPINFRA_TOKEN',
	xai: 'XAI_API_KEY',
	publicai: 'PUBLICAI_API_KEY'
};

/** Raw (unmasked) provider API keys, shaped as the env vars bench-py expects.
 * Only ever used to populate a child process's env — never sent to the
 * browser, never logged. Providers with no key set are simply omitted
 * (bench-py fails fast with a clear KeyError if a target actually needs one). */
export async function getPipelineEnvVars(): Promise<Record<string, string>> {
	const supabase = getSupabaseAdmin();
	const { data, error } = await supabase.from('providers').select('slug, api_key');
	if (error) throw error;

	const out: Record<string, string> = {};
	for (const p of data ?? []) {
		const varName = PROVIDER_ENV_VARS[p.slug];
		if (varName && p.api_key) out[varName] = p.api_key;
	}
	return out;
}
