import { ApifyClient } from "apify-client"

const apifyClient = new ApifyClient({
  token: process.env.APIFY_API_KEY,
})

// Phone and email lookups run in their own Apify account (an organization),
// because the finders they use ask for full access to whichever account runs
// them. Keeping them apart caps what they can reach to that account and its
// balance. Without APIFY_ENRICH_API_KEY they use the main account, as before.
const enrichApifyClient = process.env.APIFY_ENRICH_API_KEY?.trim()
  ? new ApifyClient({ token: process.env.APIFY_ENRICH_API_KEY.trim() })
  : apifyClient

export { apifyClient, enrichApifyClient }
