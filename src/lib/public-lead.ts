/** Strip provider payloads before returning a lead through an application API. */
export function publicLead<T extends { rawData?: unknown }>(lead: T): Omit<T, "rawData"> {
  const { rawData, ...result } = lead
  void rawData
  return result
}
