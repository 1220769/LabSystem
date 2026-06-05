import { useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '../store/authStore'

const SERVER_URL = import.meta.env.VITE_API_URL?.replace('/api', '') ?? 'http://localhost:4000'

let globalSocket: Socket | null = null

export function useSocket(
  event: string,
  handler: (data: unknown) => void
) {
  const { token } = useAuthStore()
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    if (!token) return

    if (!globalSocket || !globalSocket.connected) {
      globalSocket = io(SERVER_URL, {
        auth: { token },
        transports: ['websocket'],
        reconnectionAttempts: 5,
      })
    }

    const cb = (data: unknown) => handlerRef.current(data)
    globalSocket.on(event, cb)

    return () => {
      globalSocket?.off(event, cb)
    }
  }, [token, event])
}
