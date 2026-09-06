import type { Pool } from 'pg';
import { ZodError } from 'zod';
import { AutomationError, verify } from './protocol';
import { executeAutomation } from './service';
// Request.text()/json() must not run before authentication of the exact bytes.
export async function handleAutomation(request: Request, endpoint: string, getPool: () => Pool): Promise<Response> {
  const respond = (status: number, message: string) => Response.json({ message }, { status });
  if (request.method !== 'POST') return respond(405, 'POST required');
  const secret = process.env.SCALEPLUS_AUTOMATION_SERVICE_SECRET?.trim();
  if (process.env.SCALEPLUS_AUTOMATIONS_ENABLED !== 'true' || !secret) return respond(503, 'LeadFinder automations are not configured');
  const requestId = request.headers.get('x-scaleplus-request-id') || '';
  if (request.headers.get('x-scaleplus-app') !== 'mailbaser' || !/^[\w:.-]{1,200}$/.test(requestId)) return respond(401, 'Unauthorized automation request');
  // Stream with a hard cap rather than allocating an unbounded request first.
  const reader=request.body?.getReader(); const chunks: Uint8Array[]=[]; let size=0;
  if (reader) {
    try { while (true) { const chunk=await reader.read(); if (chunk.done) break; size+=chunk.value.length; if (size>65536) { await reader.cancel(); return respond(413,'Request body too large'); } chunks.push(chunk.value); } }
    catch { return respond(400,'Invalid request body'); }
  }
  const raw=Buffer.concat(chunks);
  if (!verify(secret,request.headers.get('x-scaleplus-timestamp')||'',request.headers.get('x-scaleplus-signature')||'',raw)) return respond(401,'Unauthorized automation request');
  try {
    const body=JSON.parse(raw.toString('utf8'));
    if (!body || typeof body!=='object' || Array.isArray(body) || body.requestId!==requestId) throw new AutomationError(400,'Request ID does not match');
    return Response.json(await executeAutomation(getPool(),endpoint,body,requestId,raw));
  } catch (error) {
    if (error instanceof AutomationError) return respond(error.status,error.message);
    if (error instanceof ZodError || error instanceof SyntaxError) return respond(400,'Invalid automation request');
    console.error('[leadfinder-automations] Request failed', {requestId});
    return respond(503,'Automation service is temporarily unavailable; retry with the same request ID');
  }
}
