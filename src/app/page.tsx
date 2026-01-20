import { auth } from "@/auth"

export default async function Home() {
  const session = await auth()

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <main className="flex flex-col items-center gap-8 p-8">
        <h1 className="text-4xl font-bold text-foreground">PipeDrive Suite</h1>

        {session?.user && (
          <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-card-foreground">
              Logged in as:
            </h2>
            <dl className="space-y-2 text-sm">
              <div className="flex gap-2">
                <dt className="font-medium text-muted-foreground">Email:</dt>
                <dd className="text-foreground">{session.user.email}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-medium text-muted-foreground">Name:</dt>
                <dd className="text-foreground">{session.user.name}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-medium text-muted-foreground">Role:</dt>
                <dd className="text-foreground">{session.user.role}</dd>
              </div>
            </dl>
          </div>
        )}

        <p className="text-muted-foreground">
          {process.env.NODE_ENV === "development"
            ? "Development mode - auto-login enabled"
            : "Production mode"}
        </p>
      </main>
    </div>
  )
}
