import { handleService } from "@/server/focused-agent/http"
export const runtime = "nodejs"
export const maxDuration = 300
async function handler(
  request: Request,
  context: { params: Promise<{ path: string[] }> }
) {
  return handleService(request, (await context.params).path)
}
export { handler as GET, handler as POST }
