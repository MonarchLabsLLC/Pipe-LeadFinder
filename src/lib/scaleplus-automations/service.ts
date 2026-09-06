import type {Pool,PoolClient} from 'pg';
import {randomUUID} from 'node:crypto';
import {actionSchema,AutomationError,bindingSchema,capabilities,conditionSchema,hash,identitySchema} from './protocol';
export interface BindingRow {binding_id:string;subject:string;tenant_id:string;scope_id:string;active:boolean;event_keys:string[]|null;}
export async function transact<T>(pool:Pool,callback:(client:PoolClient)=>Promise<T>):Promise<T>{const client=await pool.connect();try{await client.query('BEGIN');const result=await callback(client);await client.query('COMMIT');return result;}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}}
const lock=(client:PoolClient,key:string)=>client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[key]);
export async function resolveEntry(client:PoolClient,ownerId:string,listId:string,email:string,entryId?:string){
 const {rows}=await client.query<{id:string;lead_id:string;email:string}>(`SELECT e.id,l.id AS lead_id,l.email FROM "LeadListEntry" e JOIN "Lead" l ON l.id=e."leadId" WHERE e."listId"=$1 AND l."userId"=$2 AND lower(trim(l.email))=$3 AND ($4::text IS NULL OR e.id=$4) ORDER BY e.id LIMIT 2 FOR SHARE OF e,l`,[listId,ownerId,email.trim().toLowerCase(),entryId??null]);
 if(rows.length>1)throw new AutomationError(409,'Several entries match this email; select the intended entry');
 return rows[0];
}
export async function executeAutomation(pool:Pool,endpoint:string,body:unknown,requestId:string,rawBody:Buffer){
 const identity=identitySchema.parse(body);
 return transact(pool,async client=>{
  const {rows:[owner]}=await client.query<{id:string}>('SELECT id FROM "User" WHERE "keycloakSubId"=$1 FOR SHARE',[identity.subject]);
  if(!owner)throw new AutomationError(403,'A connected LeadFinder account is required');
  const {rows:lists}=await client.query<{id:string;name:string}>('SELECT id,name FROM "LeadList" WHERE "userId"=$1 AND status=\'ACTIVE\' ORDER BY id FOR SHARE',[owner.id]);
  const list=lists.find(row=>row.id===identity.scopeId);
  if(identity.scopeId&&!list)throw new AutomationError(403,'List is not owned and active');
  if(endpoint==='catalog'){
   const {rows:entries}=list?await client.query('SELECT e.id,coalesce(nullif(l."fullName",\'\'),l.email,e.id) AS name FROM "LeadListEntry" e JOIN "Lead" l ON l.id=e."leadId" WHERE e."listId"=$1 AND l."userId"=$2 ORDER BY e.id',[list.id,owner.id]):{rows:[]};
   const {rows:labels}=await client.query('SELECT id,name FROM "CustomLabel" WHERE "userId"=$1 ORDER BY id',[owner.id]);
   return {...capabilities,scopes:lists.map(row=>({...row,active:true})),selectedScopeId:list?.id??null,resources:{entries,labels}};
  }
  if(!list)throw new AutomationError(400,'Choose an owned active list');
  if(endpoint==='bindings'){
   const input=bindingSchema.parse(body);await lock(client,`request:${requestId}`);const requestHash=hash(`${endpoint}\n${rawBody.toString()}`);
   const {rows:[receipt]}=await client.query('SELECT request_hash FROM scaleplus_automation_requests WHERE request_id=$1',[requestId]);
   if(receipt){if(receipt.request_hash!==requestHash)throw new AutomationError(409,'Request ID content changed');const {rows:[current]}=await client.query<BindingRow>('SELECT * FROM scaleplus_automation_bindings WHERE binding_id=$1 AND subject=$2 AND tenant_id=$3 AND scope_id=$4',[input.bindingId,input.subject,input.tenantId,list.id]);if(!current)throw new AutomationError(403,'Binding identity changed');return bindingResponse(current);}
   const {rows:[binding]}=await client.query<BindingRow>(`INSERT INTO scaleplus_automation_bindings(binding_id,subject,tenant_id,scope_id,active,event_keys) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(binding_id) DO UPDATE SET active=EXCLUDED.active,event_keys=EXCLUDED.event_keys,updated_at=now() WHERE scaleplus_automation_bindings.subject=EXCLUDED.subject AND scaleplus_automation_bindings.tenant_id=EXCLUDED.tenant_id AND scaleplus_automation_bindings.scope_id=EXCLUDED.scope_id RETURNING *`,[input.bindingId,input.subject,input.tenantId,list.id,input.active,input.eventKeys==null?null:JSON.stringify(input.eventKeys)]);
   if(!binding)throw new AutomationError(403,'Binding belongs to another destination');await client.query('INSERT INTO scaleplus_automation_requests(request_id,request_hash) VALUES($1,$2)',[requestId,requestHash]);return bindingResponse(binding);
  }
  if(!['conditions/evaluate','actions/execute'].includes(endpoint))throw new AutomationError(404,'Unknown automation operation');
  const input=endpoint==='conditions/evaluate'?conditionSchema.parse(body):actionSchema.parse(body);
  const {rowCount}=await client.query('SELECT binding_id FROM scaleplus_automation_bindings WHERE binding_id=$1 AND subject=$2 AND tenant_id=$3 AND scope_id=$4 AND active FOR SHARE',[input.bindingId,input.subject,input.tenantId,list.id]);
  if(!rowCount)throw new AutomationError(403,'Binding is inactive or belongs to another destination');
  if(endpoint==='conditions/evaluate'){
   const condition=conditionSchema.parse(body),entry=await resolveEntry(client,owner.id,list.id,condition.contact.email,condition.filters.entryId);
   if(!entry)return {matched:false};if(condition.operation==='lead_in_list')return {matched:true};
   const {rowCount}=await client.query('SELECT x.id FROM "LeadEntryLabel" x JOIN "CustomLabel" l ON l.id=x."labelId" WHERE x."entryId"=$1 AND x."labelId"=$2 AND l."userId"=$3',[entry.id,condition.filters.labelId,owner.id]);return {matched:Boolean(rowCount)};
  }
  const action=actionSchema.parse(body);await lock(client,`action:${action.bindingId}:${action.idempotencyKey}`);
  const entry=await resolveEntry(client,owner.id,list.id,action.contact.email,action.config.entryId);
  if(!entry)throw new AutomationError(404,'Owned existing entry matching this contact was not found');
  const {rowCount:ownedLabel}=await client.query('SELECT id FROM "CustomLabel" WHERE id=$1 AND "userId"=$2 FOR SHARE',[action.config.labelId,owner.id]);
  if(!ownedLabel)throw new AutomationError(404,'Owned label was not found');
  const actionHash=hash(JSON.stringify({subject:action.subject,tenantId:action.tenantId,scopeId:list.id,operation:action.operation,email:action.contact.email.toLowerCase(),config:action.config}));
  const {rows:[receipt]}=await client.query('SELECT request_hash,response FROM scaleplus_automation_actions WHERE binding_id=$1 AND idempotency_key=$2',[action.bindingId,action.idempotencyKey]);
  if(receipt){if(receipt.request_hash!==actionHash)throw new AutomationError(409,'Idempotency key content changed');const {rowCount}=await client.query('SELECT id FROM "LeadEntryLabel" WHERE id=$1 AND "entryId"=$2 AND "labelId"=$3 FOR SHARE',[receipt.response.assignmentId,entry.id,action.config.labelId]);if(!rowCount||receipt.response.leadId!==entry.lead_id)throw new AutomationError(409,'Previously applied label is no longer present on this entry');return receipt.response;}
  await client.query("SELECT set_config('leadfinder.automation_origin','mailbaser',true)");
  const {rows:[created]}=await client.query('INSERT INTO "LeadEntryLabel"(id,"entryId","labelId","createdAt") VALUES($1,$2,$3,now()) ON CONFLICT("entryId","labelId") DO NOTHING RETURNING id',[randomUUID(),entry.id,action.config.labelId]);
  const {rows:[assignment]}=await client.query('SELECT id FROM "LeadEntryLabel" WHERE "entryId"=$1 AND "labelId"=$2 FOR SHARE',[entry.id,action.config.labelId]);
  if(!assignment)throw new AutomationError(409,'Label assignment changed concurrently');
  const response={success:true,resource:{type:'lead_entry_label',id:assignment.id},assignmentId:assignment.id,entryId:entry.id,leadId:entry.lead_id,labelId:action.config.labelId,alreadyApplied:!created};
  await client.query('INSERT INTO scaleplus_automation_actions(binding_id,idempotency_key,request_hash,response) VALUES($1,$2,$3,$4)',[action.bindingId,action.idempotencyKey,actionHash,JSON.stringify(response)]);return response;
 });
}
function bindingResponse(b:BindingRow){return {bindingId:b.binding_id,scopeId:b.scope_id,active:b.active,eventKeys:b.event_keys};}
