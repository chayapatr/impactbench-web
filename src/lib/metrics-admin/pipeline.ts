// Thin client for the /metrics-admin/api/pipeline/* server routes (see
// src/lib/server/pipeline/*) — the real bench-py bridge, as opposed to
// db.ts's direct-to-Supabase calls. Local-dev-only: checkPipelineHealth()
// tells the UI whether to offer a real run at all.

export interface PipelineJobStatus {
	id: string;
	benchmark_slug: string;
	phase: string;
	status: 'running' | 'done' | 'error';
	error?: string;
	metric_count?: number;
	seed_count?: number;
	scenarios_upserted?: number;
	log_tail: string;
	started_at: number;
	finished_at?: number;
}

export async function checkPipelineHealth(): Promise<boolean> {
	try {
		const res = await fetch('/metrics-admin/api/pipeline/health');
		if (!res.ok) return false;
		const data = await res.json();
		return Boolean(data.available);
	} catch {
		return false;
	}
}

async function readError(res: Response): Promise<string> {
	try {
		const data = await res.json();
		return data.message ?? `${res.status} ${res.statusText}`;
	} catch {
		return `${res.status} ${res.statusText}`;
	}
}

export async function startScenarioGeneration(
	adminKey: string,
	benchmarkSlug: string
): Promise<{ job_id: string; metric_count: number; seed_count: number }> {
	const res = await fetch('/metrics-admin/api/pipeline/run', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({
			admin_key: adminKey,
			benchmark_slug: benchmarkSlug,
			phase: 'gen_scenarios_from_seeds'
		})
	});
	if (!res.ok) throw new Error(await readError(res));
	return res.json();
}

export async function pollPipelineJob(adminKey: string, jobId: string): Promise<PipelineJobStatus> {
	const res = await fetch(
		`/metrics-admin/api/pipeline/run/${jobId}?admin_key=${encodeURIComponent(adminKey)}`
	);
	if (!res.ok) throw new Error(await readError(res));
	return res.json();
}
