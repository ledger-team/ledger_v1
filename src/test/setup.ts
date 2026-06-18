// Vitest setup. Loads .env for integration tests that need DB / API credentials.
// Pure unit tests don't depend on this — they shouldn't read process.env at all.
import 'dotenv/config'

// Component-render harness (Milestone G2): jest-dom matchers + auto-cleanup.
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => cleanup())
