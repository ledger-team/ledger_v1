export default function CheckEmailPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">Check your inbox</h1>
      <p className="text-sm text-gray-500">
        We sent you a magic link. Click it to finish signing in. The link expires in 10 minutes.
      </p>
      <p className="text-xs text-gray-400">You can close this tab once you&apos;ve clicked the link.</p>
    </main>
  )
}
