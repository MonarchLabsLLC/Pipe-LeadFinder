import { readFileSync } from 'node:fs';
import type { PoolConfig } from 'pg';
const certificatePath='/etc/ssl/digitalocean/ca-certificate.crt';
export function automationDatabaseConfig(connectionString=process.env.DATABASE_URL, environment=process.env.NODE_ENV, readCertificate=()=>readFileSync(certificatePath,'utf8')): PoolConfig {
  if (!connectionString) throw new Error('Automation database is not configured');
  const url=new URL(connectionString);
  // node-postgres connection-string TLS parameters can replace the explicit
  // SSL object. Remove every such override before enabling certificate checks.
  for(const key of ['ssl','sslmode','sslcert','sslkey','sslrootcert','uselibpqcompat']) url.searchParams.delete(key);
  const schema=url.searchParams.get('schema') || (['localhost','127.0.0.1','[::1]'].includes(url.hostname) ? 'pipeleads' : 'public');
  if(!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schema)) throw new Error('Invalid database schema');
  url.searchParams.delete('schema');
  const local=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
  const ssl=local && environment!=='production' ? false : {rejectUnauthorized:true,ca:readCertificate()};
  // Managed transaction poolers reject search_path startup options. Public is
  // already the production default; custom schemas still require explicit routing.
  return {connectionString:url.toString(),ssl,...(schema==='public'?{}:{options:`-c search_path=${schema}`}),max:4,connectionTimeoutMillis:10000};
}
