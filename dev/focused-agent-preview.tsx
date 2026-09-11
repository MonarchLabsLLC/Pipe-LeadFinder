import { createRoot } from "react-dom/client"
import { AgentPanel } from "@/components/focused-agent/agent-panel"
import "@/app/globals.css"

const access = {
  userId: "fixture-user",
  workspaceId: "fixture-user",
  writesEnabled: true,
  handoffEnabled: true,
}
const thread = {
  id: "c1310696-4065-492a-83d5-48d88258bcc7",
  title: "Find marketing leads",
  resourceIds: ["list-one"],
}
const proposalId = "790b890a-e369-4c6b-a6c1-c5aacebe562e"
const original =
  '## Search preview\n\n- Selected leads: **2**\n- Maximum cost: **14 Scale Credits**\n\n| Name | Email |\n|---|---|\n| Alex | alex@example.test |\n\n```text\nNothing starts until you approve.\n```\n\n[Open list](/lead-search/saved-lists/list-one)\n\n<img src="x" onerror="window.unsafeAgentHtml=true">'
const messages = [
  { id: "user", role: "user", content: "**Find** marketing leads, please." },
  { id: "assistant", role: "assistant", content: original },
]
const resources = [
  {
    id: "list-one",
    name: "Marketing executives with an intentionally long readable list name",
    status: "ACTIVE",
    type: "PEOPLE",
    url: "/lead-search/saved-lists/list-one",
  },
]
const leads = [
  {
    id: "lead-one",
    name: "Alex Prospect",
    email: "alex@example.test",
    company: "Example Company",
  },
  {
    id: "lead-two",
    name: "Incomplete contact",
    email: null,
    company: "Second Company",
  },
]
let status = "pending"
const transfer = { id: '0bc71393-dad0-422f-9be3-8d377a31852e', status: 'pending', kind: 'transfer', approvalUrl: 'https://crm.test/admin/dashboard?agentProposal=0bc71393-dad0-422f-9be3-8d377a31852e',
  preview: { title: 'Transfer saved leads', before: leads, after: [{ sourceId: 'lead-one', decision: 'create', contact: { name: 'Alex Prospect', email: 'alex@example.test' } }, { sourceId: 'lead-two', decision: 'skip', reason: 'Missing email' }], effects: ['Existing CRM workflows may react.'] }, result: null }
window.fetch = async (input, init) => {
  const url = new URL(String(input), window.location.href)
  if (!url.pathname.startsWith("/api/focused-agent/"))
    throw new Error("Fixture cannot access service APIs")
  const path = url.pathname.replace("/api/focused-agent/", ""),
    body = init?.body ? JSON.parse(String(init.body)) : {}
  let data: unknown
  if (path === 'handoff/destinations') data = { workspaces: [{ id: 'crm-one', name: 'CRM workspace' }], workspaceId: 'crm-one', pipelines: { resources: [{ id: 'pipe-one', name: 'Sales pipeline', stages: [{ id: 'stage-one', name: 'New' }] }], hasMore: false } }
  else if (path === 'handoff/history') data = localStorage.getItem('lf-fixture-transfer') ? [{ id: 'transfer-history', metadata: { proposalId: transfer.id, listId: 'list-one', approvalUrl: transfer.approvalUrl }, createdAt: new Date().toISOString() }] : []
  else if (path === 'handoff/prepare') { localStorage.setItem('lf-fixture-transfer', '1'); data = transfer }
  else if (path === 'handoff/status') data = transfer
  else if (path === "state")
    data = {
      ...access,
      threads: [thread],
      thread: url.searchParams.get("threadId") ? thread : null,
      messages: url.searchParams.get("threadId") ? messages : [],
      resources,
      hasMore: false,
      runs: [],
      approvals: [
        {
          id: proposalId,
          proposalHash: "a".repeat(64),
          status,
          expiresAt: new Date(Date.now() + 900000).toISOString(),
          preview: {
            title: "Search for 2 people",
            before: { description: "Marketing executives in Florida" },
            after: { maximumResults: 2 },
            cost: {
              maximumCredits: 14,
              maximumUnits: 2,
              creditsPerUnit: 7,
              note: "Only returned billable records are charged.",
            },
            skipped: [],
            list: resources[0],
            effects: [
              "Runs once. Does not send messages or create a schedule.",
            ],
          },
        },
      ],
    }
  else if (path === "threads") data = { thread }
  else if (path === "chat") {
    messages.push({
      id: crypto.randomUUID(),
      role: "user",
      content: body.message,
    })
    data = { runId: "fixture-run", status: "completed" }
  } else if (path === `approvals/${proposalId}/decision`) {
    status = body.decision === "approve" ? "completed" : "rejected"
    data = { status }
  } else if (path === "context") data = { shared: body.resourceIds.length > 0 }
  else if (path === "resources") data = { resources }
  else if (path === "lists/list-one") data = { leads, nextCursor: null }
  else throw new Error(`Unexpected fixture route: ${path}`)
  return Response.json({ protocolVersion: "1", data })
}
createRoot(document.getElementById("root")!).render(
  <main className="min-h-screen p-4">
    <h1 className="mb-4 text-xl font-semibold">
      Lead Finder local Agent fixture
    </h1>
    <AgentPanel access={access} />
  </main>
)
