import { Pool } from 'pg';
import { automationDatabaseConfig } from './database-config';
const state=globalThis as typeof globalThis & { leadfinderAutomationPool?: Pool };
export function getAutomationPool() {
  // Use the mapped database CA and fail closed if it is missing in production.
  if (!state.leadfinderAutomationPool) {
    state.leadfinderAutomationPool = new Pool(automationDatabaseConfig());
    state.leadfinderAutomationPool.on('error',()=>console.error('[leadfinder-automations] Database connection interrupted'));
  }
  return state.leadfinderAutomationPool;
}
