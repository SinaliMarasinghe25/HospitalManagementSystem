// Matches CurrentUserResponse in the API (Dtos/AuthDtos.cs).
export type CurrentUser = {
  id: string
  userName: string
  email: string | null
  roles: string[]
  // True after an administrator set the password: the user must choose a new one first.
  mustChangePassword: boolean
}

export type LoginRequest = {
  userName: string
  password: string
}
