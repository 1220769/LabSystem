import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'
import { useAuthStore } from '../store/authStore'
import './NotificationBell.css'

// link da notificação → rota por papel
// (os links são o 5º argumento de notifyUser no backend)
const STAFF_NAV: Record<string, Record<string, string>> = {
  administrador: {
    financeiro:   '/modulo/6',   // nova requisição para faturar
    utilizadores: '/modulo/0',   // nova conta pendente de aprovação
  },
  medico: {
    validacao:  '/modulo/5',
    requisicao: '/modulo/2',
    resultado:  '/modulo/5',
  },
  tecnico: {
    analise:    '/modulo/4',
    resultado:  '/modulo/4',
    colheita:   '/modulo/3',
  },
  enfermeiro: {
    colheita:   '/modulo/3',
  },
}

const ROLE_HOME: Record<string, string> = {
  administrador: '/',
  medico:        '/medico',
  tecnico:       '/tecnico',
  enfermeiro:    '/private',
  utente:        '/portal',
}

type NotifTipo = 'resultado' | 'critico' | 'requisicao' | 'fatura'

interface INotification {
  _id: string
  tipo: NotifTipo
  titulo: string
  mensagem: string
  lida: boolean
  link?: string
  createdAt: string
}

const TIPO_ICON: Record<NotifTipo, string> = {
  resultado:  '📋',
  critico:    '⚠',
  requisicao: '🔬',
  fatura:     '💶',
}

const TIPO_COLOR: Record<NotifTipo, string> = {
  resultado:  '#3A8ABF',
  critico:    '#C8001A',
  requisicao: '#2E7A50',
  fatura:     '#C87830',
}

function fmtRelTime(d: string) {
  const diff = (Date.now() - new Date(d).getTime()) / 1000
  if (diff < 60)   return 'agora'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

interface Props {
  /** cor do ícone (adapta-se ao tema claro/escuro) */
  theme?: 'light' | 'dark'
}

export default function NotificationBell({ theme = 'light' }: Props) {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [open,          setOpen]          = useState(false)
  const [notifications, setNotifications] = useState<INotification[]>([])
  const [unread,        setUnread]        = useState(0)
  const [loading,       setLoading]       = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try {
      const r = await api.get('/notifications', { params: { limit: 20 } })
      setNotifications(r.data.data)
      setUnread(r.data.unread)
    } catch { /* silêncio */ }
  }, [])

  // carga inicial
  useEffect(() => { load() }, [load])

  // atualização por polling HTTP (REST, sem WebSocket) — refresca o sino
  // a cada 15s enquanto o painel está fechado
  useEffect(() => {
    if (open) return
    const id = setInterval(() => { load() }, 15000)
    return () => clearInterval(id)
  }, [open, load])

  // fechar ao clicar fora
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  async function handleOpen() {
    setOpen(o => !o)
    if (!open) {
      setLoading(true)
      await load()
      setLoading(false)
    }
  }

  async function markRead(id: string) {
    setNotifications(prev => prev.map(n => n._id === id ? { ...n, lida: true } : n))
    setUnread(u => Math.max(0, u - 1))
    await api.put(`/notifications/${id}/read`).catch(() => {})
  }

  async function markAllRead() {
    setNotifications(prev => prev.map(n => ({ ...n, lida: true })))
    setUnread(0)
    await api.put('/notifications/read-all').catch(() => {})
  }

  async function handleNotifClick(n: INotification) {
    if (!n.lida) await markRead(n._id)
    setOpen(false)
    if (!n.link) return

    const role = user?.role ?? 'utente'
    if (role === 'utente') {
      navigate('/portal', { state: { tab: n.link } })
    } else {
      const roleMap = STAFF_NAV[role] ?? {}
      const dest    = roleMap[n.link] ?? ROLE_HOME[role] ?? '/'
      navigate(dest)
    }
  }

  return (
    <div className="nb-wrap" ref={dropRef}>
      <button
        className={`nb-btn nb-btn--${theme}`}
        onClick={handleOpen}
        aria-label="Notificações"
        title="Notificações"
      >
        <svg className="nb-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 22c1.1 0 2-.9 2-2h-4a2 2 0 002 2zm6-6V11c0-3.07-1.63-5.64-4.5-6.32V4a1.5 1.5 0 00-3 0v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"
            fill="currentColor"/>
        </svg>
        {unread > 0 && (
          <span className="nb-badge">{unread > 9 ? '9+' : unread}</span>
        )}
      </button>

      {open && (
        <div className="nb-drop">
          <div className="nb-drop-hd">
            <span className="nb-drop-title">Notificações</span>
            {unread > 0 && (
              <button className="nb-mark-all" onClick={markAllRead}>
                marcar todas como lidas
              </button>
            )}
          </div>

          <div className="nb-list">
            {loading && notifications.length === 0 && (
              <div className="nb-empty">a carregar…</div>
            )}
            {!loading && notifications.length === 0 && (
              <div className="nb-empty">Sem notificações</div>
            )}
            {notifications.map(n => (
              <div
                key={n._id}
                className={`nb-item${n.lida ? '' : ' nb-item--unread'}`}
                onClick={() => handleNotifClick(n)}
              >
                <div
                  className="nb-item-icon"
                  style={{ background: TIPO_COLOR[n.tipo] + '18', color: TIPO_COLOR[n.tipo] }}
                >
                  {TIPO_ICON[n.tipo]}
                </div>
                <div className="nb-item-body">
                  <div className="nb-item-titulo">{n.titulo}</div>
                  <div className="nb-item-msg">{n.mensagem}</div>
                  <div className="nb-item-time">{fmtRelTime(n.createdAt)}</div>
                </div>
                {!n.lida && <div className="nb-item-dot" />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
