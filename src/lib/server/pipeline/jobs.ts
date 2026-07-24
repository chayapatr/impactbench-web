import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { getPipelineRepoPath, getPipelinePython } from './env';
import { getPipelineEnvVars } from './providers';
import { writeBenchmarkYaml } from './sync-out';
import { syncScenariosBack } from './sync-in';
import { syncConfigRoleModels } from './sync-config';

export type JobStatus = 'running' | 'done' | 'error';

export interface Job {
	id: string;
	benchmarkSlug: string;
	phase: string;
	status: JobStatus;
	log: string[];
	error?: string;
	metricCount?: number;
	seedCount?: number;
	scenariosUpserted?: number;
	startedAt: number;
	finishedAt?: number;
}

// In-memory only — this is a local single-process dev server, not a
// deployed backend, so a job registry that resets on restart is fine (mirrors
// the existing MassActionModal/RegenerateModal pattern of local, ephemeral
// progress state).
const jobs = new Map<string, Job>();

export function getJob(id: string): Job | undefined {
	return jobs.get(id);
}

const PHASES_THAT_SYNC_SCENARIOS_BACK = new Set(['gen_scenarios', 'gen_scenarios_from_seeds']);

/** Always syncs Supabase -> benchmark.yaml immediately before spawning, per
 * the "auto-sync on every run" decision — a run never operates on stale,
 * manually-exported content. For scenario-generation phases, also syncs the
 * result back into Supabase once the process exits successfully. */
export async function startPhaseJob(
	benchmarkSlug: string,
	phase: string,
	model?: string
): Promise<Job> {
	const repoPath = getPipelineRepoPath();
	const pythonBin = getPipelinePython();

	const { metricCount, seedCount } = await writeBenchmarkYaml(benchmarkSlug);
	await syncConfigRoleModels();

	const id = randomUUID();
	const job: Job = {
		id,
		benchmarkSlug,
		phase,
		status: 'running',
		log: [],
		metricCount,
		seedCount,
		startedAt: Date.now()
	};
	jobs.set(id, job);

	const envVars = await getPipelineEnvVars();
	const args = ['main.py', benchmarkSlug, phase, ...(model ? [model] : [])];
	const child = spawn(pythonBin, args, {
		cwd: repoPath,
		env: { ...process.env, ...envVars }
	});

	child.stdout.on('data', (d: Buffer) => job.log.push(d.toString()));
	child.stderr.on('data', (d: Buffer) => job.log.push(d.toString()));

	child.on('error', (err) => {
		job.status = 'error';
		job.error = err.message;
		job.finishedAt = Date.now();
	});

	child.on('close', (code) => {
		if (code !== 0) {
			job.status = 'error';
			job.error = `python exited with code ${code}`;
			job.finishedAt = Date.now();
			return;
		}
		if (!PHASES_THAT_SYNC_SCENARIOS_BACK.has(phase)) {
			job.status = 'done';
			job.finishedAt = Date.now();
			return;
		}
		syncScenariosBack(benchmarkSlug)
			.then(({ upserted }) => {
				job.scenariosUpserted = upserted;
				job.status = 'done';
				job.finishedAt = Date.now();
			})
			.catch((err) => {
				job.status = 'error';
				job.error = `pipeline succeeded but syncing scenarios back into Supabase failed: ${err instanceof Error ? err.message : String(err)}`;
				job.finishedAt = Date.now();
			});
	});

	return job;
}
