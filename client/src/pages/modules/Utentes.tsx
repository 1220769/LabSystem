import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import api from '../../api/axios'
import { useAuthStore } from '../../store/authStore'
import './Utentes.css'

interface Utente {
  _id: string
  numeroProcesso: string
  nome: string
  dataNascimento: string
  genero: 'masculino' | 'feminino' | 'outro'
  nif: string
  sns: string
  contacto: string
  email?: string
  morada: { rua: string; codigoPostal: string; localidade: string }
  medico?: string
  observacoes?: string
  ativo: boolean
  createdAt: string
}

interface Seg {
  id: number; name: string; sub: string; color: string
  stat: string; statLabel: string
}

const EMPTY: Omit<Utente, '_id' | 'ativo' | 'createdAt'> = {
  numeroProcesso: '', nome: '', dataNascimento: '',
  genero: 'masculino', nif: '', sns: '',
  contacto: '', email: '',
  morada: { rua: '', codigoPostal: '', localidade: '' },
  medico: '', observacoes: '',
}

export default function Utentes({ seg }: { seg: Seg }) {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [utentes, setUtentes] = useState<Utente[]>([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const [panel, setPanel] = useState<'detail' | 'edit' | 'create' | null>(null)
  const [selected, setSelected] = useState<Utente | null>(null)
  const [form, setForm] = useState({ ...EMPTY })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const canCreate = ['administrador', 'tecnico', 'medico', 'enfermeiro'].includes(user?.role ?? '')
  const canEdit   = ['administrador', 'tecnico', 'medico'].includes(user?.role ?? '')
  const canDelete = user?.role === 'administrador'

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [search])

  useEffect(() => {
    setLoading(true)
    api.get('/utentes', { params: { search: debouncedSearch, page, limit: 20 } })
      .then(({ data }) => {
        setUtentes(data.data)
        setTotal(data.total)
        setPages(data.pages)
      })
      .finally(() => setLoading(false))
  }, [debouncedSearch, page])

  const reload = () => {
    setLoading(true)
    api.get('/utentes', { params: { search: debouncedSearch, page, limit: 20 } })
      .then(({ data }) => {
        setUtentes(data.data)
        setTotal(data.total)
        setPages(data.pages)
      })
      .finally(() => setLoading(false))
  }

  const openCreate = () => {
    setForm({ ...EMPTY })
    setSelected(null)
    setFormError('')
    setPanel('create')
  }

  const openDetail = (u: Utente) => {
    setSelected(u)
    setPanel('detail')
  }

  const openEdit = (u: Utente) => {
    setForm({
      numeroProcesso: u.numeroProcesso,
      nome:           u.nome,
      dataNascimento: u.dataNascimento.slice(0, 10),
      genero:         u.genero,
      nif:            u.nif,
      sns:            u.sns,
      contacto:       u.contacto,
      email:          u.email ?? '',
      morada:         { ...u.morada },
      medico:         u.medico ?? '',
      observacoes:    u.observacoes ?? '',
    })
    setSelected(u)
    setFormError('')
    setPanel('edit')
  }

  const closePanel = () => { setPanel(null); setSelected(null); setFormError('') }

  const handleSave = async () => {
    setSaving(true)
    setFormError('')
    try {
      if (panel === 'create') {
        await api.post('/utentes', form)
      } else if (panel === 'edit' && selected) {
        await api.put(`/utentes/${selected._id}`, form)
      }
      closePanel()
      reload()
    } catch (err: any) {
      setFormError(err.response?.data?.message ?? 'Erro ao guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (u: Utente) => {
    if (!window.confirm(`Desativar ${u.nome}?`)) return
    try {
      await api.delete(`/utentes/${u._id}`)
      closePanel()
      reload()
    } catch (err: any) {
      setFormError(err.response?.data?.message ?? 'Erro ao eliminar')
    }
  }

  const fmt = (d: string) => new Date(d).toLocaleDateString('pt-PT')

  const setMorada = (k: keyof typeof form.morada, v: string) =>
    setForm(f => ({ ...f, morada: { ...f.morada, [k]: v } }))

  return (
    <motion.div
      className="ut-page"
      style={{ background: seg.color }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35, delay: 0.45 }}
    >
      {/* top */}
      <div className="ut-top">
        <button className="ut-back" onClick={() => navigate('/')}>← voltar</button>

        <div className="ut-identity">
          <span className="ut-num">01</span>
          <h1 className="ut-title">Utentes</h1>
          <p className="ut-sub">{seg.sub}</p>
        </div>

        <div className="ut-topright">
          <div className="ut-live-stat">
            <span className="ut-live-val">{total}</span>
            <span className="ut-live-lbl">registos activos</span>
          </div>
        </div>
      </div>

      {/* toolbar */}
      <div className="ut-toolbar">
        <input
          className="ut-search"
          placeholder="pesquisar nome · SNS · NIF · processo…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {canCreate && (
          <button className="ut-btn-new" onClick={openCreate}>+ novo utente</button>
        )}
      </div>

      {/* list */}
      <div className="ut-list-area">
        {loading ? (
          <div className="ut-msg">a carregar…</div>
        ) : utentes.length === 0 ? (
          <div className="ut-msg">sem resultados</div>
        ) : (
          <>
            <div className="ut-list">
              {utentes.map((u, i) => (
                <motion.div
                  key={u._id}
                  className="ut-row"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.025 }}
                  onClick={() => openDetail(u)}
                >
                  <span className={`ut-dot ${u.ativo ? 'ut-dot--ok' : 'ut-dot--off'}`} />
                  <div className="ut-row-body">
                    <div className="ut-row-nome">{u.nome}</div>
                    <div className="ut-row-meta">
                      <span>{u.numeroProcesso}</span>
                      <span className="ut-sep">·</span>
                      <span>SNS {u.sns}</span>
                      <span className="ut-sep">·</span>
                      <span>{fmt(u.dataNascimento)}</span>
                    </div>
                  </div>
                  <span className="ut-arr">→</span>
                </motion.div>
              ))}
            </div>

            {pages > 1 && (
              <div className="ut-pag">
                <button className="ut-pag-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
                <span className="ut-pag-info">{page} / {pages}</span>
                <button className="ut-pag-btn" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>›</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* slide panel */}
      <AnimatePresence>
        {panel && (
          <motion.aside
            className="ut-panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 280 }}
          >
            <div className="ut-panel-hd">
              <button className="ut-back" onClick={closePanel}>← fechar</button>
              <div className="ut-panel-label">
                {panel === 'detail' ? selected?.nome
                  : panel === 'edit' ? 'editar utente'
                  : 'novo utente'}
              </div>
            </div>

            {/* ── DETAIL ── */}
            {panel === 'detail' && selected && (
              <div className="ut-detail">
                <div className="ut-detail-proc">{selected.numeroProcesso}</div>
                <div className={`ut-badge ${selected.ativo ? 'ut-badge--ok' : 'ut-badge--off'}`}>
                  {selected.ativo ? 'Ativo' : 'Inativo'}
                </div>

                <div className="ut-grid">
                  <DField l="Data de nascimento" v={fmt(selected.dataNascimento)} />
                  <DField l="Género"             v={selected.genero} />
                  <DField l="NIF"                v={selected.nif} />
                  <DField l="Nr. SNS"            v={selected.sns} />
                  <DField l="Contacto"           v={selected.contacto} />
                  {selected.email    && <DField l="E-mail"   v={selected.email} />}
                  <DField l="Morada"
                    v={`${selected.morada.rua}, ${selected.morada.codigoPostal} ${selected.morada.localidade}`}
                  />
                  {selected.medico      && <DField l="Médico"       v={selected.medico} />}
                  {selected.observacoes && <DField l="Observações"  v={selected.observacoes} />}
                </div>

                <div className="ut-detail-actions">
                  {canEdit   && <button className="ut-btn-edit" onClick={() => openEdit(selected)}>Editar</button>}
                  {canDelete && <button className="ut-btn-del"  onClick={() => handleDelete(selected)}>Desativar</button>}
                </div>
              </div>
            )}

            {/* ── FORM ── */}
            {(panel === 'create' || panel === 'edit') && (
              <div className="ut-form">
                {formError && <div className="ut-form-err">{formError}</div>}

                <Section title="Identificação">
                  <FF label="Nome completo *">
                    <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
                  </FF>
                  <div className="ut-row2">
                    <FF label="Data de nascimento *">
                      <input type="date" value={form.dataNascimento}
                        onChange={e => setForm(f => ({ ...f, dataNascimento: e.target.value }))} />
                    </FF>
                    <FF label="Género *">
                      <select value={form.genero} onChange={e => setForm(f => ({ ...f, genero: e.target.value as any }))}>
                        <option value="masculino">Masculino</option>
                        <option value="feminino">Feminino</option>
                        <option value="outro">Outro</option>
                      </select>
                    </FF>
                  </div>
                  {panel === 'create' && (
                    <FF label="Nº processo *">
                      <input value={form.numeroProcesso}
                        onChange={e => setForm(f => ({ ...f, numeroProcesso: e.target.value }))} />
                    </FF>
                  )}
                </Section>

                <Section title="Documentos">
                  <div className="ut-row2">
                    <FF label="NIF *">
                      <input value={form.nif} onChange={e => setForm(f => ({ ...f, nif: e.target.value }))} />
                    </FF>
                    <FF label="Nr. SNS *">
                      <input value={form.sns} onChange={e => setForm(f => ({ ...f, sns: e.target.value }))} />
                    </FF>
                  </div>
                </Section>

                <Section title="Contacto">
                  <div className="ut-row2">
                    <FF label="Telemóvel *">
                      <input value={form.contacto} onChange={e => setForm(f => ({ ...f, contacto: e.target.value }))} />
                    </FF>
                    <FF label="E-mail">
                      <input type="email" value={form.email}
                        onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                    </FF>
                  </div>
                </Section>

                <Section title="Morada">
                  <FF label="Rua *">
                    <input value={form.morada.rua} onChange={e => setMorada('rua', e.target.value)} />
                  </FF>
                  <div className="ut-row2">
                    <FF label="Código postal *">
                      <input value={form.morada.codigoPostal}
                        onChange={e => setMorada('codigoPostal', e.target.value)} />
                    </FF>
                    <FF label="Localidade *">
                      <input value={form.morada.localidade}
                        onChange={e => setMorada('localidade', e.target.value)} />
                    </FF>
                  </div>
                </Section>

                <Section title="Clínica">
                  <FF label="Médico de família">
                    <input value={form.medico} onChange={e => setForm(f => ({ ...f, medico: e.target.value }))} />
                  </FF>
                  <FF label="Observações">
                    <textarea rows={3} value={form.observacoes}
                      onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} />
                  </FF>
                </Section>

                <div className="ut-form-actions">
                  <button className="ut-btn-cancel" onClick={closePanel}>Cancelar</button>
                  <button className="ut-btn-save" onClick={handleSave} disabled={saving}>
                    {saving ? 'a guardar…' : 'Guardar'}
                  </button>
                </div>
              </div>
            )}
          </motion.aside>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function DField({ l, v }: { l: string; v: string }) {
  return (
    <div className="ut-dfield">
      <div className="ut-dfield-l">{l}</div>
      <div className="ut-dfield-v">{v}</div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="ut-section">
      <div className="ut-section-title">{title}</div>
      {children}
    </div>
  )
}

function FF({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="ut-ff">
      <label className="ut-ff-label">{label}</label>
      {children}
    </div>
  )
}
