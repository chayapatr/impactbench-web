import path from 'node:path';
import fs from 'node:fs';
import { env } from '$env/dynamic/private';

export class PipelineNotConfiguredError extends Error {}

/** Absolute path to the sibling bench-py repo. Local-dev-only feature — unset
 * (and this throws) in any deployed environment, since it spawns a local
 * python subprocess against a git checkout that only exists on a dev
 * machine. Configured via PIPELINE_REPO_PATH in .env (see .env.example). */
export function getPipelineRepoPath(): string {
	const configured = env.PIPELINE_REPO_PATH;
	if (!configured) {
		throw new PipelineNotConfiguredError(
			'PIPELINE_REPO_PATH is not set — the pipeline bridge only works in local dev with the impactbench repo checked out beside impactbench-web.'
		);
	}
	const resolved = path.resolve(configured);
	if (!fs.existsSync(path.join(resolved, 'main.py'))) {
		throw new PipelineNotConfiguredError(
			`PIPELINE_REPO_PATH (${resolved}) doesn't look like the impactbench repo — main.py not found.`
		);
	}
	return resolved;
}

export function getPipelinePython(): string {
	const repoPath = getPipelineRepoPath();
	const candidates = ['bin/python3', 'bin/python', 'Scripts/python.exe'].map((p) =>
		path.join(repoPath, '.venv', p)
	);
	const found = candidates.find((p) => fs.existsSync(p));
	if (!found) {
		throw new PipelineNotConfiguredError(
			`No .venv python found under ${repoPath} — run "uv sync --extra dev" in the impactbench repo first.`
		);
	}
	return found;
}

/** Cheap availability check for the UI: is the bridge configured at all,
 * without needing a valid admin key. Never throws. */
export function isPipelineConfigured(): boolean {
	try {
		getPipelineRepoPath();
		getPipelinePython();
		return true;
	} catch {
		return false;
	}
}
