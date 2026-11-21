// Runs before every test file (see "test" in vite.config.ts).
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Adds checks such as expect(button).toBeDisabled() and expect(text).toBeInTheDocument().
import '@testing-library/jest-dom/vitest'

// Removes what a test drew on the pretend page, so the next test starts empty.
afterEach(() => {
  cleanup()
})
