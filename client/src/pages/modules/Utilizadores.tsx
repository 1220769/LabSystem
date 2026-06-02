import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import api from '../../api/axios'
import './Utilizadores.css'

type Role = 'administrador' | 'tecnico' | 'medico' | 'enfermeiro' | 'financeiro' | 'utente'
type TabUz = 'todos' | 'ativos' | 'inativos' | Role

const ROLES: Role[] = ['administrador', 'tecnico', 'medico', 'enfermeiro', 'financeiro', 'utente']

const ROLE_COLORS: Record<Role, string> = {
  administrador: '#C8A820',
  tecnico:       '#3A8ABF',
  medico:        '#4A9A5E',
  enfermeiro:    '#9060C8',
  financeiro:    '#C87830',
  utente:        '#6A6A68',
}

function initials(nome: string) {
  return nome.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()
}

function fmtDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

interface IUser {
  _id: string
  nome: string
  email: string
  role: Role
  ativo: boolean
  telefone?: string
  departamento?: string
  ultimoLogin?: string
  createdAt: string
}

interface IForm {
  nome: string
  email: string
  password: string
  role: Role
  telefone: string
  departamento: string
}

const EMPTY_FORM: IForm = {
  nome: '', email: '', password: '', role: 'tecnico', telefone: '', departamento: '',
}

export default function Utilizadores({ seg }: { seg: { color: string; name: string } }) {
  const navigate  = useNavigate()
  const [tab,      setTab]      = useState<TabUz>('todos')
  const [search,   setSearch]   = useState('')
  const [users,    setUsers]    = useState<IUser[]>([])
  const [total,    setTotal]    = useState(0)
  const [page,     setPage]     = useState(1)
  const [loading,  setLoading]  = useState(false)
  const [selected, setSelected] = useState<IUser | null>(null)
  const [editing,  setEditing]  = useState(false)
  const [creating, setCreating] = useState(false)
  const [form,     setForm]     = useState<IForm>(EMPTY_FORM)
  const [saving,   setSaving]   = useState(false)
  const [formErr,  setFormErr]  = useState('')

  const PAGES = Math.max(1, Math.ceil(total / 20))

  const activeCount   = users.filter(u => u.ativo).length
  const inactiveCount = users.filter(u => !u.ativo).length

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = { page, limit: 20 }
      if (tab === 'ativos')   params.ativo = 'true'
      if (tab === 'inativos') params.ativo = 'false'
      if (ROLES.includes(tab as Role)) params.role = tab
      if (search) params.search = search
      const r = await api.get('/users', { params })
      setUsers(r.data.data)
      setTotal(r.data.total)
    } catch { /* silêncio */ } finally { setLoading(false) }
  }, [tab, search, page])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setForm(EMPTY_FORM); setFormErr(''); setCreating(true); setEditing(false); setSelected(null)
  }

  function openEdit(u: IUser) {
    setForm({ nome: u.nome, email: u.email, password: '', role: u.role, telefone: u.telefone ?? '', departamento: u.departamento ?? '' })
    setFormErr(''); setEditing(true); setCreating(false); setSelected(u)
  }

  function openDetail(u: IUser) {
    setSelected(u); setCreating(false); setEditing(false)
  }

  function closePanel() { setSelected(null); setCreating(false); setEditing(false) }

  function setField(k: keyof IForm, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSave() {
    if (!form.nome || !form.email || !form.role) { setFormErr('Nome, email e role são obrigatórios'); return }
    if (creating && !form.password) { setFormErr('Password obrigatória para novo utilizador'); return }
    setSaving(true); setFormErr('')
    try {
      const body: Partial<IForm> = { nome: form.nome, email: form.email, role: form.role }
      if (form.telefone)    body.telefone    = form.telefone
      if (form.departamento) body.departamento = form.departamento
      if (form.password)    body.password    = form.password

      if (creating) {
        await api.post('/users', body)
      } else if (selected) {
        await api.put(`/users/${selected._id}`, body)
      }
      closePanel(); load()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      setFormErr(err.response?.data?.message ?? 'Erro ao guardar')
    } finally { setSaving(false) }
  }

  async function handleToggle(u: IUser) {
    try {
      if (u.ativo) {
        await api.delete(`/users/${u._id}`)
      } else {
        await api.put(`/users/${u._id}`, { ativo: true })
      }
      if (selected?._id === u._id) {
        setSelected(prev => prev ? { ...prev, ativo: !prev.ativo } : null)
      }
      load()
    } catch { /* */ }
  }

  const panelOpen = !!(selected || creating)

  return (
    <div className="uz-page" style={{ background: '#2A2A28' }}>
      <button className="uz-back" onClick={() => navigate('/')}>← voltar</button>

      <div className="uz-top">
        <div className="uz-identity">
          <span className="uz-num">00</span>
          <h1 className="uz-title">Utilizadores</h1>
          <p className="uz-sub">gestão de contas · roles · acessos</p>
        </div>
        <div className="uz-kpis">
          <div className="uz-kpi">
            <span className="uz-kpi-val">{total}</span>
            <span className="uz-kpi-lbl">total</span>
          </div>
          <div className="uz-kpi uz-kpi--ok">
            <span className="uz-kpi-val">{activeCount}</span>
            <span className="uz-kpi-lbl">ativos</span>
          </div>
          <div className="uz-kpi uz-kpi--off">
            <span className="uz-kpi-val">{inactiveCount}</span>
            <span className="uz-kpi-lbl">inativos</span>
          </div>
        </div>
      </div>

      <div className="uz-toolbar">
        <div className="uz-tabs">
          {(['todos','ativos','inativos'] as TabUz[]).map(t => (
            <button key={t} className={`uz-tab${tab === t ? ' uz-tab--on' : ''}`} onClick={() => { setTab(t); setPage(1) }}>
              {t}
            </button>
          ))}
          {ROLES.map(r => (
            <button key={r} className={`uz-tab${tab === r ? ' uz-tab--on' : ''}`} onClick={() => { setTab(r); setPage(1) }}>
              {r}
            </button>
          ))}
        </div>
        <input
          className="uz-search"
          placeholder="pesquisar nome ou email…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
        />
        <button className="uz-btn-new" onClick={openCreate}>+ novo utilizador</button>
      </div>

      <div className="uz-list-area">
        {loading && <div className="uz-msg">a carregar…</div>}
        {!loading && users.length === 0 && <div className="uz-msg">nenhum utilizador encontrado</div>}
        {!loading && users.length > 0 && (
          <div className="uz-list">
            {users.map(u => (
              <div key={u._id} className={`uz-row${!u.ativo ? ' uz-row--inactive' : ''}`} onClick={() => openDetail(u)}>
                <div className="uz-avatar" style={{ background: ROLE_COLORS[u.role] + '33', border: `1.5px solid ${ROLE_COLORS[u.role]}55` }}>
                  <span style={{ color: ROLE_COLORS[u.role] }}>{initials(u.nome)}</span>
                </div>
                <div className="uz-row-info">
                  <div className="uz-row-nome">{u.nome}</div>
                  <div className="uz-row-email">{u.email}</div>
                </div>
                <div className="uz-row-mid">
                  <span className={`uz-role uz-role--${u.role}`}>{u.role}</span>
                  {u.departamento && <span className="uz-dept">{u.departamento}</span>}
                </div>
                <div className="uz-row-right">
                  <span className={`uz-status uz-status--${u.ativo ? 'ativo' : 'inativo'}`}>
                    {u.ativo ? 'ativo' : 'inativo'}
                  </span>
                  <span className="uz-last">{fmtDate(u.ultimoLogin)}</span>
                  <span className="uz-arr">›</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {PAGES > 1 && (
          <div className="uz-pag">
            <button className="uz-pag-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹</button>
            <span className="uz-pag-info">{page} / {PAGES}</span>
            <button className="uz-pag-btn" disabled={page >= PAGES} onClick={() => setPage(p => p + 1)}>›</button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {panelOpen && (
          <motion.div
            className="uz-panel"
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          >
            <div className="uz-panel-hd">
              <button className="uz-back uz-back--panel" onClick={closePanel}>← fechar</button>
              <div className="uz-panel-label">
                {creating ? 'Novo Utilizador' : editing ? 'Editar' : selected?.nome}
              </div>
            </div>

            {/* ── detalhe ── */}
            {selected && !editing && !creating && (
              <div className="uz-detail">
                <div
                  className="uz-detail-avatar"
                  style={{ background: ROLE_COLORS[selected.role] + '33', border: `2px solid ${ROLE_COLORS[selected.role]}55` }}
                >
                  <span style={{ color: ROLE_COLORS[selected.role] }}>{initials(selected.nome)}</span>
                </div>
                <div className="uz-detail-nome">{selected.nome}</div>
                <div className="uz-detail-email">{selected.email}</div>
                <div className="uz-detail-badges">
                  <span className={`uz-role uz-role--${selected.role}`}>{selected.role}</span>
                  <span className={`uz-status uz-status--${selected.ativo ? 'ativo' : 'inativo'}`}>
                    {selected.ativo ? 'ativo' : 'inativo'}
                  </span>
                </div>
                <div className="uz-detail-grid">
                  <div className="uz-detail-field">
                    <div className="uz-detail-field-label">Departamento</div>
                    <div className="uz-detail-field-val">{selected.departamento || '—'}</div>
                  </div>
                  <div className="uz-detail-field">
                    <div className="uz-detail-field-label">Telefone</div>
                    <div className="uz-detail-field-val">{selected.telefone || '—'}</div>
                  </div>
                  <div className="uz-detail-field">
                    <div className="uz-detail-field-label">Último login</div>
                    <div className="uz-detail-field-val">{fmtDate(selected.ultimoLogin)}</div>
                  </div>
                  <div className="uz-detail-field">
                    <div className="uz-detail-field-label">Criado em</div>
                    <div className="uz-detail-field-val">{fmtDate(selected.createdAt)}</div>
                  </div>
                </div>
                <div className="uz-detail-actions">
                  <button className="uz-btn-edit" onClick={() => openEdit(selected)}>editar</button>
                  <button
                    className={`uz-btn-toggle${!selected.ativo ? ' uz-btn-toggle--activate' : ''}`}
                    onClick={() => handleToggle(selected)}
                  >
                    {selected.ativo ? 'desativar' : 'reativar'}
                  </button>
                </div>
              </div>
            )}

            {/* ── formulário ── */}
            {(creating || editing) && (
              <div className="uz-form">
                {formErr && <div className="uz-form-err">{formErr}</div>}

                <div className="uz-fsection">
                  <div className="uz-fsection-title">Dados Pessoais</div>
                  <div className="uz-ff">
                    <label className="uz-ff-label">Nome completo *</label>
                    <input className="uz-input" value={form.nome} onChange={e => setField('nome', e.target.value)} placeholder="Nome Apelido" />
                  </div>
                  <div className="uz-ff">
                    <label className="uz-ff-label">Email *</label>
                    <input className="uz-input" type="email" value={form.email} onChange={e => setField('email', e.target.value)} placeholder="nome@labsystem.pt" />
                  </div>
                  <div className="uz-ff">
                    <label className="uz-ff-label">Password {editing ? '(deixar em branco para não alterar)' : '*'}</label>
                    <input className="uz-input" type="password" value={form.password} onChange={e => setField('password', e.target.value)} placeholder="••••••••" />
                  </div>
                </div>

                <div className="uz-fsection">
                  <div className="uz-fsection-title">Role *</div>
                  <div className="uz-roles-grid">
                    {ROLES.map(r => (
                      <button
                        key={r}
                        className={`uz-role-btn${form.role === r ? ' uz-role-btn--on' : ''}`}
                        style={form.role === r ? { background: ROLE_COLORS[r] } : {}}
                        onClick={() => setField('role', r)}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="uz-fsection">
                  <div className="uz-fsection-title">Informação Extra</div>
                  <div className="uz-ff">
                    <label className="uz-ff-label">Departamento</label>
                    <input className="uz-input" value={form.departamento} onChange={e => setField('departamento', e.target.value)} placeholder="ex: Hematologia" />
                  </div>
                  <div className="uz-ff">
                    <label className="uz-ff-label">Telefone</label>
                    <input className="uz-input" value={form.telefone} onChange={e => setField('telefone', e.target.value)} placeholder="+351 912 345 678" />
                  </div>
                </div>

                <div className="uz-form-actions">
                  <button className="uz-btn-cancel" onClick={closePanel}>cancelar</button>
                  <button className="uz-btn-save" disabled={saving} onClick={handleSave}>
                    {saving ? 'a guardar…' : creating ? 'criar utilizador' : 'guardar alterações'}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
