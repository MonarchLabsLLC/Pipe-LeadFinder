import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
const id=z.string().trim().min(1).max(200);
export const events=['lead_added_to_list','lead_label_added'] as const;
export const identitySchema=z.object({subject:id,tenantId:id,scopeId:id.optional()});
export const bindingSchema=identitySchema.extend({scopeId:id,bindingId:id,active:z.boolean().default(true),eventKeys:z.array(z.enum(events)).nullable().optional()});
const contact=z.object({email:z.string().trim().email()});
export const conditionSchema=bindingSchema.omit({active:true}).extend({operation:z.enum(['lead_in_list','lead_has_label']),contact,filters:z.object({entryId:id.optional(),labelId:id.optional()})}).refine(v=>v.operation!=='lead_has_label'||v.filters.labelId!==undefined,{message:'Label is required'});
export const actionSchema=bindingSchema.omit({active:true}).extend({operation:z.literal('apply_existing_label'),contact,idempotencyKey:id,config:z.object({entryId:id.optional(),labelId:id}).strict()});
const entryField={key:'entryId',type:'select',catalogKey:'entries',required:false};
const labelField={key:'labelId',type:'select',catalogKey:'labels',required:true};
export const capabilities={app:'pipeleadsfinder',name:'PipeLeads LeadFinder',identityKind:'prospect',description:'Saved prospects only. These events do not grant email permission.',triggers:[{type:'lead_added_to_list',label:'Lead added to list',fields:[entryField]},{type:'lead_label_added',label:'Label added to lead',fields:[entryField,{...labelField,required:false}]}],conditions:[{type:'lead_in_list',label:'Lead is in list',fields:[entryField]},{type:'lead_has_label',label:'Lead has label',fields:[entryField,labelField]}],actions:[{type:'apply_existing_label',label:'Apply existing label',description:'Applies an owned existing label to this contact’s existing entry in the selected list. Does not search, enrich, send, or spend credits.',fields:[entryField,labelField]}]};
export const hash=(text:string)=>createHash('sha256').update(text).digest('hex');
export const sign=(secret:string,timestamp:string,body:string|Buffer)=>createHmac('sha256',secret).update(timestamp).update('.').update(body).digest('hex');
export function verify(secret:string,timestamp:string,signature:string,body:Buffer,now=Date.now()){
 if(!/^\d{10}$/.test(timestamp)||Math.abs(now-Number(timestamp)*1000)>300000)return false;
 const value=signature.replace(/^sha256=/,'');return /^[a-f0-9]{64}$/i.test(value)&&timingSafeEqual(Buffer.from(value,'hex'),Buffer.from(sign(secret,timestamp,body),'hex'));
}
export class AutomationError extends Error {constructor(public status:number,message:string){super(message);}}
