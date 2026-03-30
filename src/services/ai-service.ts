import { prisma } from "@/lib/prisma"
import { AiActionType } from "@/generated/prisma"

const SYSTEM_PROMPTS: Record<string, string> = {
  SIMILAR_PEOPLE:
    "You are a sales intelligence assistant. Based on the prospect profile, suggest 3-5 search criteria combinations to find similar professionals. Format as a bulleted list with reasoning.",
  DIRECT_MESSAGE:
    "You are a personalized outreach expert. Write a short, compelling direct message (under 200 words) that references specific details about the prospect. Use the business context to explain how you can help them. Be conversational, not salesy.",
  SUMMARY:
    "You are a sales research assistant. Provide a concise research summary of this prospect including their role, company, potential pain points, and why they might be a good fit. Keep it under 150 words.",
  SUBJECT_LINE:
    "You are an email marketing expert. Generate 5 compelling email subject lines for cold outreach to this prospect. Each should be under 60 characters, personalized, and curiosity-driven.",
  INTRO:
    "You are a copywriting expert. Write a personalized email opening paragraph (2-3 sentences) that hooks the prospect by referencing their specific role, company, or industry. Lead into how your product/service helps.",
  CUSTOM:
    "You are a helpful AI assistant for sales and outreach. Follow the user's instructions carefully using the provided lead context.",
  LIBRARY:
    "You are a helpful AI assistant for sales and outreach. Use the provided template and lead data to generate personalized content.",
}

export async function getBusinessContext(userId: string): Promise<string> {
  const profile = await prisma.businessProfile.findUnique({
    where: { userId },
    include: { dataSources: true },
  })

  if (!profile) {
    return "No business profile configured yet."
  }

  const parts: string[] = []

  if (profile.businessName) parts.push(`Business Name: ${profile.businessName}`)
  if (profile.businessWebsite) parts.push(`Website: ${profile.businessWebsite}`)
  if (profile.whatYouSell) parts.push(`What we sell: ${profile.whatYouSell}`)
  if (profile.whoItHelps) parts.push(`Who it helps: ${profile.whoItHelps}`)
  if (profile.whatItDoes) parts.push(`What it does for them: ${profile.whatItDoes}`)
  if (profile.contactPerson) parts.push(`Contact person: ${profile.contactPerson}`)
  if (profile.personality) parts.push(`Communication style: ${profile.personality}`)

  if (profile.dataSources.length > 0) {
    parts.push("\n--- Additional Knowledge Base ---")
    for (const ds of profile.dataSources) {
      const label = ds.name || ds.sourceUrl || ds.type
      parts.push(`[${label}]: ${ds.content}`)
    }
  }

  return parts.length > 0 ? parts.join("\n") : "No business profile configured yet."
}

export async function getLeadContext(leadId: string): Promise<string> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
  })

  if (!lead) {
    throw new Error(`Lead not found: ${leadId}`)
  }

  const parts: string[] = []

  // Identity
  if (lead.fullName || lead.firstName) {
    parts.push(`Name: ${lead.fullName || [lead.firstName, lead.lastName].filter(Boolean).join(" ")}`)
  }
  if (lead.title) parts.push(`Job Title: ${lead.title}`)
  if (lead.headline) parts.push(`Headline: ${lead.headline}`)

  // Location
  const loc = lead.location || [lead.city, lead.state, lead.country].filter(Boolean).join(", ")
  if (loc) parts.push(`Location: ${loc}`)

  // Contact
  if (lead.email) parts.push(`Email: ${lead.email}`)
  if (lead.phone) parts.push(`Phone: ${lead.phone}`)

  // Social
  if (lead.linkedinUrl) parts.push(`LinkedIn: ${lead.linkedinUrl}`)
  if (lead.facebookUrl) parts.push(`Facebook: ${lead.facebookUrl}`)
  if (lead.twitterUrl) parts.push(`Twitter: ${lead.twitterUrl}`)
  if (lead.instagramUrl) parts.push(`Instagram: ${lead.instagramUrl}`)

  // Company
  if (lead.companyName) parts.push(`Company: ${lead.companyName}`)
  if (lead.companyWebsite) parts.push(`Company Website: ${lead.companyWebsite}`)
  if (lead.companyIndustry) parts.push(`Industry: ${lead.companyIndustry}`)
  if (lead.companySize) parts.push(`Company Size: ${lead.companySize}`)
  if (lead.companyRevenue) parts.push(`Company Revenue: ${lead.companyRevenue}`)

  // Influencer
  if (lead.platform) parts.push(`Platform: ${lead.platform}`)
  if (lead.username) parts.push(`Username: ${lead.username}`)
  if (lead.followerCount) parts.push(`Followers: ${lead.followerCount.toLocaleString()}`)
  if (lead.engagementRate) parts.push(`Engagement Rate: ${lead.engagementRate}%`)
  if (lead.bio) parts.push(`Bio: ${lead.bio}`)

  return parts.join("\n")
}

export function buildSystemPrompt(
  actionType: AiActionType,
  businessContext: string
): string {
  const base = SYSTEM_PROMPTS[actionType] || SYSTEM_PROMPTS.CUSTOM

  return `${base}

--- Your Business Context ---
${businessContext}`
}

export function buildUserPrompt(
  actionType: AiActionType,
  leadContext: string,
  customPrompt?: string
): string {
  if (actionType === "CUSTOM" && customPrompt) {
    return `Here is the prospect's information:

${leadContext}

---

User's request: ${customPrompt}`
  }

  if (actionType === "LIBRARY" && customPrompt) {
    // Replace placeholder variables in the template
    return `Here is the prospect's information:

${leadContext}

---

Template to use: ${customPrompt}`
  }

  const actionLabels: Record<string, string> = {
    SIMILAR_PEOPLE: "Suggest search criteria to find professionals similar to this prospect.",
    DIRECT_MESSAGE: "Write a personalized direct message to this prospect.",
    SUMMARY: "Provide a research summary of this prospect.",
    SUBJECT_LINE: "Generate 5 email subject lines for outreach to this prospect.",
    INTRO: "Write a personalized email opening paragraph for this prospect.",
  }

  const instruction = actionLabels[actionType] || "Analyze this prospect."

  return `Here is the prospect's information:

${leadContext}

---

${instruction}`
}
