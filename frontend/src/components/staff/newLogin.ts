import type { NewLogin } from '../../types/staff'

export const emptyLogin: NewLogin = { userName: '', password: '', roles: [] }

// Checks done in the browser before sending, so the person gets a quick answer. The API checks again.
// A doctor needs no other role: the API adds Doctor to their login.
export function loginProblems(login: NewLogin, isDoctor: boolean): Record<string, string> {
  const problems: Record<string, string> = {}
  if (login.userName.trim().length < 3) problems.userName = 'Use at least 3 characters.'
  if (login.password.length < 8) problems.password = 'The password must have at least 8 characters.'
  if (login.roles.length === 0 && !isDoctor) problems.roles = 'Choose at least one role.'
  return problems
}
