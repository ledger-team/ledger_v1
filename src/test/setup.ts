// Vitest setup. Loads .env for integration tests that need DB / API credentials.
// Pure unit tests don't depend on this — they shouldn't read process.env at all.
import 'dotenv/config'
