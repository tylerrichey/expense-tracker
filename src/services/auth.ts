export interface AuthResponse {
  success: boolean
  token?: string
  message?: string
  error?: string
}

export class AuthService {
  private static readonly TOKEN_KEY = 'expense_tracker_auth_token'
  private static readonly API_BASE = '/api'

  static getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY)
  }

  static setToken(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token)
  }

  static removeToken(): void {
    localStorage.removeItem(this.TOKEN_KEY)
  }

  static isAuthenticated(): boolean {
    return this.getToken() !== null
  }

  static async login(password: string): Promise<AuthResponse> {
    try {
      const response = await fetch(`${this.API_BASE}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        this.setToken(data.token)
        return { success: true, token: data.token, message: data.message }
      } else {
        return { success: false, error: data.error || 'Login failed' }
      }
    } catch (error) {
      return { success: false, error: 'Network error occurred' }
    }
  }

  static logout(): void {
    this.removeToken()
  }

  static getAuthHeaders(): Record<string, string> {
    const token = this.getToken()
    return token ? { Authorization: `Bearer ${token}` } : {}
  }
}