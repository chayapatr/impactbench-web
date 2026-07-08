import { browser } from '$app/environment';

// ===== Gate auth =====
// The benchmark is soft-gated behind a shared passcode (see GatePage).
// Auth is per-tab: sessionStorage only, no server involvement.

const STORAGE_KEY = 'aib-auth';

export const authState = $state({
	authenticated: browser && sessionStorage.getItem(STORAGE_KEY) === '1'
});

export function unlock() {
	if (browser) sessionStorage.setItem(STORAGE_KEY, '1');
	authState.authenticated = true;
}
