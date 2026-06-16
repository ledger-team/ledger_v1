// Module augmentation so the database-session callback can surface app fields
// onto session.user (and read them off the adapter user row) type-safely.
import 'next-auth'
import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      schoolId?: string | null
      gradYear?: number | null
      onboarded: boolean
    } & DefaultSession['user']
  }
}

declare module 'next-auth/adapters' {
  interface AdapterUser {
    schoolId?: string | null
    gradYear?: number | null
  }
}
