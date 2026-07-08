import type { RequestHandler } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';

const DOCS_ORIGIN = 'https://impactbench-docs.pages.dev';

export const GET: RequestHandler = async ({ params, request, url }) => {
	const path = params.path ?? '';

	// Directory paths need trailing slash; file paths (with extension) do not
	const hasExtension = /\.[a-zA-Z0-9]+$/.test(path);
	if (!hasExtension && path !== '' && !url.pathname.endsWith('/')) {
		redirect(308, url.pathname + '/');
	}

	const response = await fetch(`${DOCS_ORIGIN}/${path}`, {
		headers: {
			Accept: request.headers.get('accept') ?? '*/*',
			'Accept-Encoding': 'identity'
		}
	});

	const contentType = response.headers.get('content-type') ?? '';
	return new Response(response.body, {
		status: response.status,
		headers: { 'content-type': contentType }
	});
};
