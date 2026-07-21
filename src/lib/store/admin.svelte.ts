// ===== Admin capability key (non-persistent) =====
// Unlike the shared passcode gate (auth.svelte.ts), the admin key is a
// capability UUID that is enforced server-side by the admin_* RPCs.
//
// It is deliberately NOT persisted: never written to sessionStorage or
// localStorage. It lives only in memory for the lifetime of the page, so
// access ends on reload / tab-close and must be re-supplied (via the ?key=
// URL param or by pasting it into the admin screen).
//
// Preview handoff: Test form must not put the capability UUID in the URL
// (history / logs / Referer). Instead the admin page parks the key in
// memory and navigates to /experts/{slug}/preview; ExpertsPage consumes it.

/** Path segment used instead of embedding the admin capability UUID. */
export const ADMIN_PREVIEW_PATH_ID = 'preview';

export const adminState = $state<{ key: string | null }>({ key: null });

/** One-shot in-memory handoff for admin → expert form preview navigation. */
let previewHandoffKey: string | null = null;

export function setAdminKey(key: string | null) {
	adminState.key = key && key.trim() ? key.trim() : null;
}

export function clearAdminKey() {
	adminState.key = null;
	previewHandoffKey = null;
}

/** Park the live admin key for the next /experts/.../preview navigation. */
export function armAdminPreviewHandoff() {
	previewHandoffKey = adminState.key;
}

/**
 * Consume (and clear) a pending preview handoff. Returns null if none is
 * armed — e.g. hard refresh or deep-link without coming from the admin UI.
 */
export function takeAdminPreviewHandoff(): string | null {
	const key = previewHandoffKey;
	previewHandoffKey = null;
	return key;
}
