import { buildCorsHeaders, jsonResponse, type CfPagesContext } from '../../shared/cfHelpers.ts';

export async function onRequestOptions(context: CfPagesContext): Promise<Response> {
  return new Response(null, { status: 204, headers: buildCorsHeaders(context.request) });
}

export async function onRequestGet(context: CfPagesContext): Promise<Response> {
  return jsonResponse(context.request, {
    ok: true,
    service: 'sinar-warna',
    runtime: 'cloudflare-pages',
  });
}
