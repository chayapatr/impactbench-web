import type { RequestHandler } from '@sveltejs/kit';

export const trailingSlash = 'always';

const DOCS_ORIGIN = 'https://impactbench-docs.pages.dev';

export const GET: RequestHandler = async ({ params, request }) => {
	const path = params.path ?? '';
	const response = await fetch(`${DOCS_ORIGIN}/${path}`, {
		headers: {
			'Accept': request.headers.get('accept') ?? '*/*',
			'Accept-Encoding': 'identity',
		},
	});

	const contentType = response.headers.get('content-type') ?? '';
	return new Response(response.body, {
		status: response.status,
		headers: { 'content-type': contentType },
	});
};
