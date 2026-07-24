import { createClient } from '@supabase/supabase-js';
import { env as publicEnv } from '$env/dynamic/public';

export class InvalidAdminKeyError extends Error {}

/** The bridge routes use the service_role client (bypasses RLS), so unlike
 * the browser-side db.ts calls they don't get admin-key checking for free
 * from _assert_admin inside an RPC. Re-verify the key here by calling an
 * existing admin RPC (admin_list_providers) through a normal anon-key
 * client — it throws if the key is missing/revoked, so success here is
 * exactly the same check every other admin action already relies on. */
export async function assertValidAdminKey(adminKey: string): Promise<void> {
	const url = publicEnv.PUBLIC_SUPABASE_URL;
	const anonKey = publicEnv.PUBLIC_SUPABASE_ANON_KEY;
	if (!url || !anonKey) {
		throw new Error('Missing PUBLIC_SUPABASE_URL or PUBLIC_SUPABASE_ANON_KEY.');
	}
	const client = createClient(url, anonKey);
	const { error } = await client.rpc('admin_list_providers', { p_admin_key: adminKey });
	if (error) {
		throw new InvalidAdminKeyError('Invalid or revoked admin key.');
	}
}
