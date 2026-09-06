import type { Pool } from 'pg';
import type { OutboxRow } from './types';
import type { BindingRow } from './service';
import { sign } from './protocol';
import { transact } from './service';
export async function drainOutbox(pool: Pool, limit = 25) {
  if (process.env.SCALEPLUS_AUTOMATIONS_ENABLED !== 'true') return;
  for (let i=0;i<limit;i++) {
    const processed = await transact(pool, async client => {
      const { rows: [row] } = await client.query<OutboxRow>('SELECT * FROM scaleplus_automation_outbox WHERE delivered_at IS NULL AND failed_at IS NULL AND next_attempt_at<=now() ORDER BY next_attempt_at LIMIT 1 FOR UPDATE SKIP LOCKED');
      if (!row || process.env.SCALEPLUS_AUTOMATIONS_ENABLED !== 'true') return false;
      const {rows:[owner]}=await client.query('SELECT id,"keycloakSubId" AS subject FROM "User" WHERE id=$1 FOR SHARE',[row.owner_id]);
      const {rows:[binding]}=await client.query<BindingRow>('SELECT * FROM scaleplus_automation_bindings WHERE binding_id=$1 FOR SHARE',[row.binding_id]);
      const {rows:[entry]}=await client.query('SELECT e.id,l.email FROM "LeadListEntry" e JOIN "Lead" l ON l.id=e."leadId" JOIN "LeadList" s ON s.id=e."listId" WHERE e.id=$1 AND l.id=$2 AND s.id=$3 AND s."userId"=$4 AND l."userId"=$4 AND s.status=\'ACTIVE\' FOR SHARE OF e,l,s',[row.entry_id,row.lead_id,row.scope_id,row.owner_id]);
      const labelValid=row.event_key!=='lead_label_added'||Boolean((await client.query('SELECT x.id FROM "LeadEntryLabel" x JOIN "CustomLabel" l ON l.id=x."labelId" WHERE x.id=$1 AND x."entryId"=$2 AND l.id=$3 AND l."userId"=$4 FOR SHARE OF x,l',[row.assignment_id,row.entry_id,row.label_id,row.owner_id])).rowCount);
      if(!binding?.active||binding.subject!==row.subject||binding.tenant_id!==row.tenant_id||binding.scope_id!==row.scope_id||(binding.event_keys!==null&&!binding.event_keys.includes(row.event_key))||owner?.subject!==row.subject||!entry||!labelValid||typeof entry.email!=='string'||entry.email.trim().toLowerCase()!==row.payload.contact.email){
        await client.query("UPDATE scaleplus_automation_outbox SET failed_at=now(),last_error='Delivery cancelled: source or binding no longer authorized' WHERE event_id=$1",[row.event_id]);return true;
      }
      try {
        const endpoint = new URL(process.env.PIPELEADSFINDER_AUTOMATION_WEBHOOK_URL?.trim() || process.env.MAILBASER_AUTOMATION_WEBHOOK_URL?.trim() || '');
        if (endpoint.username || endpoint.password || endpoint.hash || (endpoint.protocol!=='https:' && !(process.env.NODE_ENV!=='production' && endpoint.protocol==='http:' && ['localhost','127.0.0.1','[::1]'].includes(endpoint.hostname)))) throw new Error('HTTPS webhook URL required');
        const secret = process.env.PIPELEADSFINDER_AUTOMATION_WEBHOOK_SECRET?.trim(); if (!secret) throw new Error('Webhook secret is not configured');
        const body=JSON.stringify(row.payload), timestamp=Math.floor(Date.now()/1000).toString();
        const response=await fetch(endpoint,{method:'POST',redirect:'error',headers:{'content-type':'application/json','x-scaleplus-app':'pipeleadsfinder','x-scaleplus-request-id':row.event_id,'x-scaleplus-timestamp':timestamp,'x-scaleplus-signature':sign(secret,timestamp,body)},body,signal:AbortSignal.timeout(10000)});
        if (!response.ok) throw new Error(`Webhook returned ${response.status}`);
        const ack=await response.json().catch(()=>null);
        if (ack?.data?.accepted!==true || ack.data.mapped===false) throw new Error('Webhook did not acknowledge mapped delivery');
        await client.query('UPDATE scaleplus_automation_outbox SET delivered_at=now(),attempts=attempts+1,last_error=NULL WHERE event_id=$1',[row.event_id]);
      } catch(error) {
        await client.query('UPDATE scaleplus_automation_outbox SET attempts=attempts+1,next_attempt_at=now()+($2::integer*interval \'1 second\'),failed_at=CASE WHEN attempts+1>=8 THEN now() ELSE NULL END,last_error=$3 WHERE event_id=$1',[row.event_id,Math.min(900,30*2**row.attempts),error instanceof Error ? error.message.slice(0,300) : 'Delivery failed']);
      }
      return true;
    });
    if (!processed) break;
  }
}
const workerState=globalThis as typeof globalThis & { leadfinderAutomationTimer?: ReturnType<typeof setInterval> };
export function startAutomationWorker(pool: Pool) {
  if (process.env.SCALEPLUS_AUTOMATIONS_ENABLED!=='true' || workerState.leadfinderAutomationTimer) return;
  let running=false;
  const run=async()=>{ if(running) return; running=true; try { await drainOutbox(pool); } catch { console.error('[leadfinder-automations] Delivery cycle failed'); } finally { running=false; } };
  void run(); const timer=setInterval(run,15000); timer.unref(); workerState.leadfinderAutomationTimer=timer;
  return ()=>{clearInterval(timer); delete workerState.leadfinderAutomationTimer;};
}
