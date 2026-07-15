import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/public';
import type { Database } from '$lib/experts/types';

/** Typed via Database for documentation; runtime client stays flexible for RPC shapes. */
let client: SupabaseClient<Database> | null = null;

export function getSupabase(): SupabaseClient {
	const url = env.PUBLIC_SUPABASE_URL;
	const key = env.PUBLIC_SUPABASE_ANON_KEY;
	if (!url || !key) {
		throw new Error(
			'Missing PUBLIC_SUPABASE_URL or PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env.'
		);
	}
	if (!client) {
		// Database-parameterized client; cast outward so RPC helpers stay ergonomic.
		client = createClient<Database>(url, key);
	}
	return client as unknown as SupabaseClient;
}
