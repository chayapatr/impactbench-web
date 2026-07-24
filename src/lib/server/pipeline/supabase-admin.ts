import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env as privateEnv } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';

// Server-only client using the service_role key, which bypasses RLS entirely
// — unlike src/lib/supabase.ts's anon-key client, which can only read public
// tables and write through admin-key-gated RPCs. The pipeline bridge already
// requires trusting the Node server (it spawns local subprocesses and reads
// provider API keys in the clear to inject into their environment), so using
// service_role here is consistent with that trust boundary rather than
// inventing a new RPC that would make raw provider keys reachable from the
// browser via anon/authenticated roles. Never import this module from
// anything that reaches the client bundle.
let client: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
	const url = publicEnv.PUBLIC_SUPABASE_URL;
	const key = privateEnv.SUPABASE_SERVICE_ROLE_KEY;
	if (!url || !key) {
		throw new Error(
			'Missing PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — copy .env.example to .env and fill in the service_role key from Supabase Settings -> API.'
		);
	}
	if (!client) {
		client = createClient(url, key, { auth: { persistSession: false } });
	}
	return client;
}
