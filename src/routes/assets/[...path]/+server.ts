import type { RequestHandler } from '@sveltejs/kit';

const DOCS_ORIGIN = 'https://impactbench-docs.pages.dev';

export const GET: RequestHandler = async ({ params }) => {
	const response = await fetch(`${DOCS_ORIGIN}/assets/${params.path}`);
	return new Response(response.body, {
		status: response.status,
		headers: { 'content-type': response.headers.get('content-type') ?? '' },
	});
};
