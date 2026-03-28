import { apiClient } from './client';

export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto {
  email: string;
  password: string;
  name?: string;
}

export interface RegisterResponse {
  user: {
    id: number;
    email: string;
    name?: string;
    emailVerified: boolean;
  };
  message: string;
}

export interface AuthResponse {
  user: {
    id: number;
    email: string;
    name?: string;
  };
  accessToken: string;
}

export interface VerifyEmailDto {
  email: string;
  code: string;
}

export interface ResendVerificationDto {
  email: string;
}

export interface UserProfile {
  id: number;
  email: string;
  name?: string;
  createdAt: string;
}

export const authService = {
  // Registrar usuario (no retorna JWT — requiere verificación de email)
  async register(data: RegisterDto): Promise<RegisterResponse> {
    const response = await apiClient.post<RegisterResponse>('/auth/register', data);
    return response.data;
  },

  // Verificar email con código de 6 dígitos
  async verifyEmail(data: VerifyEmailDto): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/auth/verify-email', data);
    return response.data;
  },

  // Reenviar código de verificación
  async resendVerification(data: ResendVerificationDto): Promise<{ message: string }> {
    const response = await apiClient.post<{ message: string }>('/auth/resend-verification', data);
    return response.data;
  },

  // Login
  async login(data: LoginDto): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/auth/login', data);
    return response.data;
  },

  // Obtener perfil
  async getProfile(): Promise<UserProfile> {
    const response = await apiClient.get<UserProfile>('/auth/profile');
    return response.data;
  },

  // Guardar token y usuario en localStorage
  saveAuth(authResponse: AuthResponse) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', authResponse.accessToken);
      localStorage.setItem('user', JSON.stringify(authResponse.user));
    }
  },

  // Limpiar autenticación
  clearAuth() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
    }
  },

  // Obtener usuario guardado
  getStoredUser() {
    if (typeof window !== 'undefined') {
      const userStr = localStorage.getItem('user');
      return userStr ? JSON.parse(userStr) : null;
    }
    return null;
  },

  // Verificar si está autenticado
  isAuthenticated(): boolean {
    if (typeof window !== 'undefined') {
      return !!localStorage.getItem('auth_token');
    }
    return false;
  },
};

