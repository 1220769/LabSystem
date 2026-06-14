import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface User {
  _id: string
  nome: string
  email: string
  role: string
}

interface AuthState {
  user: User | null
  token: string | null
  setAuth: (user: User, token: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      setAuth: (user, token) => set({ user, token }),
      logout: () => set({ user: null, token: null }),
    }),
    {
      name: 'labsystem-auth',
      // sessão (não persiste entre arranques): ao iniciar a app numa nova
      // aba/sessão o utilizador começa sempre no login; um refresh dentro
      // da mesma sessão mantém a autenticação
      storage: createJSONStorage(() => sessionStorage),
    }
  )
)