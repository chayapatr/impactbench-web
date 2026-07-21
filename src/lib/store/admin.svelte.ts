// ===== Admin capability key (non-persistent) =====
// Unlike the shared passcode gate (auth.svelte.ts), the admin key is a
// capability UUID that is enforced server-side by the admin_* RPCs.
//
// It is deliberately NOT persisted: never written to sessionStorage or
// localStorage. It lives only in memory for the lifetime of the page, so
// access ends on reload / tab-close and must be re-supplied (via the ?key=
// URL param or by pasting it into the admin screen).

export const adminState = $state<{ key: string | null }>({ key: null });

export function setAdminKey(key: string | null) {
	adminState.key = key && key.trim() ? key.trim() : null;
}

export function clearAdminKey() {
	adminState.key = null;
}
