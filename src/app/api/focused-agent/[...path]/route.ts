import { after } from "next/server"
import { handleNative } from "@/server/focused-agent/http"
import { runChat } from "@/server/focused-agent/runtime"

export const runtime = "nodejs"
export const maxDuration = 300
async function handler(
  request: Request,
  context: { params: Promise<{ path: string[] }> }
) {
  return handleNative(request, (await context.params).path, (id) =>
    after(() => runChat(id))
  )
}
export { handler as GET, handler as POST }
