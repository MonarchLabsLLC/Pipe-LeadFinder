import { redirect } from "next/navigation"

/** Short, shareable address for the in-app User Guide. */
export default function UserGuidePage() {
  redirect("/resources/tutorials")
}
