import type { RequestHandler } from '@sveltejs/kit';

const DOCS_ORIGIN = 'https://impactbench-docs.pages.dev';

export const GET: RequestHandler = async ({ params, request }) => {
	const path = params.path ?? '';
	const url = `${DOCS_ORIGIN}/docs/${path}`;

	const response = await fetch(url, {
		headers: {
			'Accept': request.headers.get('accept') ?? '*/*',
			'Accept-Encoding': 'identity',
		},
	});

	const contentType = response.headers.get('content-type') ?? '';

	// rewrite absolute URLs in HTML so asset paths resolve correctly
	if (contentType.includes('text/html')) {
		let html = await response.text();
		html = html.replaceAll(DOCS_ORIGIN, '');
		return new Response(html, {
			status: response.status,
			headers: { 'content-type': contentType },
		});
	}

	return new Response(response.body, {
		status: response.status,
		headers: { 'content-type': contentType },
	});
};
