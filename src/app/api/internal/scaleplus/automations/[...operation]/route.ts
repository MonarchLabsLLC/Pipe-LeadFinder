import { handleAutomation } from '@/lib/scaleplus-automations/handler';
import { getAutomationPool } from '@/lib/scaleplus-automations/runtime';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request: Request, {params}: {params: Promise<{operation:string[]}>}) {
  return handleAutomation(request,(await params).operation.join('/'),getAutomationPool);
}
