import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertValidAdminKey, InvalidAdminKeyError } from '$lib/server/pipeline/auth';
import { getJob } from '$lib/server/pipeline/jobs';

export const GET: RequestHandler = async ({ params, url }) => {
	const adminKey = url.searchParams.get('admin_key');
	if (!adminKey) error(401, 'Missing admin_key.');

	try {
		await assertValidAdminKey(adminKey);
	} catch (e) {
		if (e instanceof InvalidAdminKeyError) error(401, e.message);
		throw e;
	}

	const job = getJob(params.jobId);
	if (!job) error(404, 'Unknown job id.');

	// Tail only — a long-running gen_scenarios call across many metrics can
	// produce a lot of stdout, and the poller re-fetches this repeatedly.
	const logTail = job.log.join('').split('\n').slice(-200).join('\n');

	return json({
		id: job.id,
		benchmark_slug: job.benchmarkSlug,
		phase: job.phase,
		status: job.status,
		error: job.error,
		metric_count: job.metricCount,
		seed_count: job.seedCount,
		scenarios_upserted: job.scenariosUpserted,
		log_tail: logTail,
		started_at: job.startedAt,
		finished_at: job.finishedAt
	});
};
