import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const calls=vi.hoisted(()=>({jobs:vi.fn(),automation:vi.fn(),pool:vi.fn(()=>({synthetic:true}))}));
vi.mock('@/lib/jobs/runtime',()=>({startJobRuntime:calls.jobs}));
vi.mock('./runtime',()=>({getAutomationPool:calls.pool}));
vi.mock('./delivery',()=>({startAutomationWorker:calls.automation}));
import {register} from '@/instrumentation';
import {automationDatabaseConfig} from './database-config';
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('NEXT_RUNTIME','nodejs');vi.stubEnv('PIPELEADS_JOBS_ENABLED','true');vi.stubEnv('SCALEPLUS_AUTOMATIONS_ENABLED','false');});
afterEach(()=>vi.unstubAllEnvs());
it('preserves ordinary job startup when the automation adapter is disabled',async()=>{await register();expect(calls.jobs).toHaveBeenCalledTimes(1);expect(calls.automation).not.toHaveBeenCalled();});
it('starts both runtimes when configured',async()=>{vi.stubEnv('SCALEPLUS_AUTOMATIONS_ENABLED','true');await register();expect(calls.jobs).toHaveBeenCalledTimes(1);expect(calls.automation).toHaveBeenCalledWith({synthetic:true});});
it('ordinary job flag does not silently disable the independent automation worker',async()=>{vi.stubEnv('PIPELEADS_JOBS_ENABLED','false');vi.stubEnv('SCALEPLUS_AUTOMATIONS_ENABLED','true');await register();expect(calls.jobs).not.toHaveBeenCalled();expect(calls.automation).toHaveBeenCalledTimes(1);});
it('does not start server jobs in another runtime',async()=>{vi.stubEnv('NEXT_RUNTIME','edge');await register();expect(calls.jobs).not.toHaveBeenCalled();expect(calls.pool).not.toHaveBeenCalled();});
it('verifies production CA and removes TLS URL overrides without losing source schema',()=>{const config=automationDatabaseConfig('postgresql://synthetic:password@db.example.test/source?schema=custom_schema&sslmode=no-verify&sslcert=bad&sslkey=bad&sslrootcert=bad','production',()=> 'synthetic CA');expect(config.ssl).toEqual({rejectUnauthorized:true,ca:'synthetic CA'});expect(config.options).toBe('-c search_path=custom_schema');expect(new URL(config.connectionString!).search).toBe('');});
it('fails closed on missing CA or unsafe schema and permits only local nonproduction plaintext',()=>{expect(()=>automationDatabaseConfig('postgresql://synthetic:password@db.example.test/source','production',()=>{throw new Error('missing CA');})).toThrow('missing CA');expect(()=>automationDatabaseConfig('postgresql://synthetic:password@localhost/source?schema=public%3Bdrop','test')).toThrow('Invalid database schema');expect(automationDatabaseConfig('postgresql://synthetic:password@localhost/source','test').ssl).toBe(false);});

it('default public schema is compatible with transaction poolers while retaining verified TLS',()=>{const config=automationDatabaseConfig('postgresql://synthetic:password@db.example.test/source','production',()=> 'synthetic CA');expect(config.options).toBeUndefined();expect(config.ssl).toEqual({rejectUnauthorized:true,ca:'synthetic CA'});});
