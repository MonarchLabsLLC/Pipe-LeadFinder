import { describe, expect, it } from "vitest"
import { extractPrimaryEmail } from "./contact-info"

describe("extractPrimaryEmail", () => {
  it("reads the email the TikTok actor returns on emailInBio", () => {
    expect(extractPrimaryEmail({
      username: "jennlashley_",
      bio: "Posture coach",
      emailInBio: "jenn@posturealignmentacademy.com",
      emailSource: "followed_link",
    })).toBe("jenn@posturealignmentacademy.com")
  })
})
