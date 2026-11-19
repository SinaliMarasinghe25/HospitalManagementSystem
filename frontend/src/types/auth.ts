// Matches CurrentUserResponse in the API (Dtos/AuthDtos.cs).
export type CurrentUser = {
  id: string
  userName: string
  email: string | null
  roles: string[]
}

export type LoginRequest = {
  userName: string
  password: string
}
