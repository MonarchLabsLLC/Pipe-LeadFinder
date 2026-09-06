-- Run in the configured application schema, in an explicit transaction.
CREATE TABLE IF NOT EXISTS scaleplus_automation_bindings(binding_id text PRIMARY KEY,subject text NOT NULL,tenant_id text NOT NULL,scope_id text NOT NULL,active boolean NOT NULL DEFAULT true,event_keys jsonb,updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS scaleplus_automation_bindings_scope ON scaleplus_automation_bindings(scope_id,subject);
CREATE TABLE IF NOT EXISTS scaleplus_automation_requests(request_id text PRIMARY KEY,request_hash text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS scaleplus_automation_actions(binding_id text NOT NULL,idempotency_key text NOT NULL,request_hash text NOT NULL,response jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(binding_id,idempotency_key));
CREATE TABLE IF NOT EXISTS scaleplus_automation_outbox(event_id text PRIMARY KEY,source_event_id text NOT NULL,binding_id text NOT NULL,subject text NOT NULL,tenant_id text NOT NULL,scope_id text NOT NULL,entry_id text NOT NULL,lead_id text NOT NULL,label_id text,assignment_id text,owner_id text NOT NULL,event_key text NOT NULL,payload jsonb NOT NULL,attempts integer NOT NULL DEFAULT 0,next_attempt_at timestamptz NOT NULL DEFAULT now(),delivered_at timestamptz,failed_at timestamptz,last_error text,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS scaleplus_automation_outbox_due ON scaleplus_automation_outbox(next_attempt_at) WHERE delivered_at IS NULL AND failed_at IS NULL;
CREATE OR REPLACE FUNCTION leadfinder_capture_automation() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
DECLARE source_id text:=gen_random_uuid()::text;delivery_id text;event_key text;entry_id text;label_id text;assignment_id text;owned record;binding record;
BEGIN
 IF coalesce(current_setting('leadfinder.automation_origin',true),'')<>'' THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='LeadListEntry' THEN entry_id:=NEW.id;event_key:='lead_added_to_list'; ELSE entry_id:=NEW."entryId";label_id:=NEW."labelId";assignment_id:=NEW.id;event_key:='lead_label_added'; END IF;
 SELECT e.id,l.id AS lead_id,s.id AS list_id,u.id AS owner_id,u."keycloakSubId" AS subject,l.email,coalesce(nullif(l."fullName",''),concat_ws(' ',l."firstName",l."lastName")) AS name INTO owned FROM "LeadListEntry" e JOIN "Lead" l ON l.id=e."leadId" JOIN "LeadList" s ON s.id=e."listId" JOIN "User" u ON u.id=s."userId" AND u.id=l."userId" WHERE e.id=entry_id AND s.status='ACTIVE';
 IF NOT FOUND OR owned.subject IS NULL OR trim(owned.subject)='' OR owned.email IS NULL OR owned.email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RETURN NEW; END IF;
 IF label_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM "CustomLabel" c WHERE c.id=label_id AND c."userId"=owned.owner_id) THEN RETURN NEW; END IF;
 FOR binding IN SELECT * FROM scaleplus_automation_bindings b WHERE b.scope_id=owned.list_id AND b.subject=owned.subject AND b.active AND (b.event_keys IS NULL OR b.event_keys ? event_key)
 LOOP
  delivery_id:=md5(source_id||'|'||binding.binding_id);
  INSERT INTO scaleplus_automation_outbox(event_id,source_event_id,binding_id,subject,tenant_id,scope_id,entry_id,lead_id,label_id,assignment_id,owner_id,event_key,payload)
  VALUES(delivery_id,source_id,binding.binding_id,owned.subject,binding.tenant_id,owned.list_id,entry_id,owned.lead_id,label_id,assignment_id,owned.owner_id,event_key,
   jsonb_build_object('eventId',delivery_id,'version',1,'app','pipeleadsfinder','eventKey',event_key,'occurredAt',to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'bindingId',binding.binding_id,'scopeId',owned.list_id,'contact',jsonb_build_object('externalId',owned.lead_id,'email',lower(trim(owned.email)),'name',owned.name),'resource',jsonb_build_object('type','lead','id',owned.lead_id),'data',jsonb_build_object('sourceEventId',source_id,'identityKind','prospect','listId',owned.list_id,'entryId',entry_id,'leadId',owned.lead_id,'labelId',label_id)));
 END LOOP;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS leadfinder_entry_automation_capture ON "LeadListEntry";
CREATE TRIGGER leadfinder_entry_automation_capture AFTER INSERT ON "LeadListEntry" FOR EACH ROW EXECUTE FUNCTION leadfinder_capture_automation();
DROP TRIGGER IF EXISTS leadfinder_label_automation_capture ON "LeadEntryLabel";
CREATE TRIGGER leadfinder_label_automation_capture AFTER INSERT ON "LeadEntryLabel" FOR EACH ROW EXECUTE FUNCTION leadfinder_capture_automation();
