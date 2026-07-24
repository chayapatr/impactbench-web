import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertValidAdminKey, InvalidAdminKeyError } from '$lib/server/pipeline/auth';
import { PipelineNotConfiguredError } from '$lib/server/pipeline/env';
import { startPhaseJob } from '$lib/server/pipeline/jobs';

// Only phases the UI actually has a wired-up action for so far. simulate /
// evaluate / aggregate call real target models across 16 configs and cost
// real money — those get their own review before being exposed here.
const ALLOWED_PHASES = new Set(['gen_scenarios_from_seeds']);

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const { admin_key, benchmark_slug, phase, model } = body ?? {};

	if (typeof admin_key !== 'string' || !admin_key) {
		error(401, 'Missing admin_key.');
	}
	if (typeof benchmark_slug !== 'string' || !benchmark_slug) {
		error(400, 'Missing benchmark_slug.');
	}
	if (typeof phase !== 'string' || !ALLOWED_PHASES.has(phase)) {
		error(400, `phase must be one of: ${[...ALLOWED_PHASES].join(', ')}`);
	}

	try {
		await assertValidAdminKey(admin_key);
	} catch (e) {
		if (e instanceof InvalidAdminKeyError) error(401, e.message);
		throw e;
	}

	try {
		const job = await startPhaseJob(benchmark_slug, phase, typeof model === 'string' ? model : undefined);
		return json({
			job_id: job.id,
			metric_count: job.metricCount,
			seed_count: job.seedCount
		});
	} catch (e) {
		if (e instanceof PipelineNotConfiguredError) error(503, e.message);
		error(500, e instanceof Error ? e.message : String(e));
	}
};
