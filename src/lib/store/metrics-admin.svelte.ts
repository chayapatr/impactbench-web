// ===== Admin capability key for /metrics-admin =====
// Same capability-key model as store/admin.svelte.ts (reuses the same
// admin_keys / _assert_admin mechanism in schema.sql) — a non-revoked
// admin UUID is the only credential. Kept as a separate store/route rather
// than folded into the existing /admin dashboard so this tool's write RPCs
// (once added) stay independent of that dashboard's code.
//
// Deliberately NOT persisted: never written to sessionStorage or
// localStorage, and never accepted from the URL (query or fragment). It
// lives only in memory for the lifetime of the page, so access ends on
// reload / tab-close and must be re-entered.

export const metricsAdminState = $state<{ key: string | null }>({ key: null });

export function setMetricsAdminKey(key: string | null) {
	metricsAdminState.key = key && key.trim() ? key.trim() : null;
}

export function clearMetricsAdminKey() {
	metricsAdminState.key = null;
}
