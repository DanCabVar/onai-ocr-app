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

export interface AuthResponse {
  user: {
    id: number;
    email: string;
    name?: string;
  };
  accessToken: string;
}

export interface UserProfile {
  id: number;
  email: string;
  name?: string;
  createdAt: string;
}

export const authService = {
  // Registrar usuario
  async register(data: RegisterDto): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/auth/register', data);
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

