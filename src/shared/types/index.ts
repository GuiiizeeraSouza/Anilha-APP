export interface AppUser {
  id: string;
  email: string;
  name?: string;
  createdAt: string;
}

export interface ApiError {
  message: string;
  code?: string;
}
