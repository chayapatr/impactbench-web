import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isPipelineConfigured } from '$lib/server/pipeline/env';

// No admin-key check: this only reveals whether the local pipeline bridge is
// configured at all (a sibling repo + venv exist on this machine), not
// anything about the data. Lets the UI show/hide the real-run option before
// the user has even entered an admin key.
export const GET: RequestHandler = async () => {
	return json({ available: isPipelineConfigured() });
};
