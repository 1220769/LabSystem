import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import api from '../api/axios'
import { useAuthStore } from '../store/authStore'
import NotificationBell from '../components/NotificationBell'
import './PortalMedico.css'

/* ─────────────────────────────── CATÁLOGO ─────────────────────────────── */
interface Analise { codigo: string; nome: string; categoria: string }
const CATALOGO: Analise[] = [
  { codigo: 'HEM01', nome: 'Hemograma Completo',           categoria: 'hematologia'    },
  { codigo: 'HEM02', nome: 'Reticulócitos',                categoria: 'hematologia'    },
  { codigo: 'COA01', nome: 'Coagulação (TP, APTT)',        categoria: 'coagulação'     },
  { codigo: 'COA02', nome: 'D-Dímero',                     categoria: 'coagulação'     },
  { codigo: 'BIO01', nome: 'Glicose',                      categoria: 'bioquímica'     },
  { codigo: 'BIO02', nome: 'Ureia',                        categoria: 'bioquímica'     },
  { codigo: 'BIO03', nome: 'Creatinina',                   categoria: 'bioquímica'     },
  { codigo: 'BIO04', nome: 'Ácido Úrico',                  categoria: 'bioquímica'     },
  { codigo: 'BIO05', nome: 'Ionograma (Na, K, Cl)',        categoria: 'bioquímica'     },
  { codigo: 'BIO06', nome: 'PCR',                          categoria: 'bioquímica'     },
  { codigo: 'BIO07', nome: 'ALT / AST',                    categoria: 'bioquímica'     },
  { codigo: 'BIO08', nome: 'GGT / ALP',                    categoria: 'bioquímica'     },
  { codigo: 'BIO09', nome: 'Bilirrubina Total / Direta',   categoria: 'bioquímica'     },
  { codigo: 'BIO10', nome: 'Proteína Total / Albumina',    categoria: 'bioquímica'     },
  { codigo: 'BIO11', nome: 'LDH',                          categoria: 'bioquímica'     },
  { codigo: 'BIO12', nome: 'CK Total',                     categoria: 'bioquímica'     },
  { codigo: 'BIO13', nome: 'Colesterol Total / LDL / HDL', categoria: 'bioquímica'     },
  { codigo: 'BIO14', nome: 'Triglicéridos',                categoria: 'bioquímica'     },
  { codigo: 'END01', nome: 'TSH',                          categoria: 'endocrinologia' },
  { codigo: 'END02', nome: 'T3 / T4 Livre',                categoria: 'endocrinologia' },
  { codigo: 'END03', nome: 'Cortisol',                     categoria: 'endocrinologia' },
  { codigo: 'END04', nome: 'Insulina',                     categoria: 'endocrinologia' },
  { codigo: 'IMU01', nome: 'IgA / IgG / IgM',             categoria: 'imunologia'     },
  { codigo: 'IMU02', nome: 'Complemento C3 / C4',          categoria: 'imunologia'     },
  { codigo: 'IMU03', nome: 'ANA / Anti-dsDNA',             categoria: 'imunologia'     },
  { codigo: 'MIC01', nome: 'Urocultura',                   categoria: 'microbiologia'  },
  { codigo: 'MIC02', nome: 'Hemocultura',                  categoria: 'microbiologia'  },
  { codigo: 'URI01', nome: 'Urina Tipo II',                categoria: 'urina'          },
  { codigo: 'URI02', nome: 'Microalbuminúria',             categoria: 'urina'          },
  { codigo: 'MAR01', nome: 'PSA Total / Livre',            categoria: 'marcadores'     },
  { codigo: 'MAR02', nome: 'CA 125',                       categoria: 'marcadores'     },
  { codigo: 'MAR03', nome: 'CA 19-9',                      categoria: 'marcadores'     },
  { codigo: 'MAR04', nome: 'CEA',                          categoria: 'marcadores'     },
]
const CATEGORIAS = [...new Set(CATALOGO.map(a => a.categoria))]
const PERFIS = [
  { nome: 'Check-up Geral',      codigos: ['HEM01','BIO01','BIO02','BIO03','BIO05','BIO06','BIO07','BIO13','BIO14','END01','URI01'] },
  { nome: 'Hemograma + Bio',     codigos: ['HEM01','BIO01','BIO02','BIO03','BIO06'] },
  { nome: 'Painel Hepático',     codigos: ['BIO07','BIO08','BIO09','BIO10','BIO11'] },
  { nome: 'Painel Cardíaco',     codigos: ['BIO11','BIO12','BIO06','BIO13','BIO14'] },
  { nome: 'Tiroide',             codigos: ['END01','END02'] },
  { nome: 'Coagulação',          codigos: ['COA01','COA02'] },
  { nome: 'Marcadores Tumorais', codigos: ['MAR01','MAR02','MAR03','MAR04'] },
]

/* ─────────────────────────────── TYPES ─────────────────────────────── */
type Tab = 'validacao' | 'requisicoes' | 'utentes' | 'criticos'
type Flag = 'pendente' | 'normal' | 'alto' | 'baixo' | 'critico_alto' | 'critico_baixo'
type EstadoReq = 'todas' | 'pendente' | 'em_curso' | 'concluida' | 'cancelada'

interface IResultado {
  _id: string; codigoResultado: string; codigoAmostra: string
  requisicaoNumero: string; requisicao?: string
  utenteNome: string; utente: string
  analise: { codigo: string; nome: string; categoria: string }
  valor?: string; unidade?: string; refMin?: number; refMax?: number
  flag: Flag; estado: string; observacoes?: string
  validacaoTecnica?: { nome: string; dataHora: string; observacoes?: string }
  validacaoMedica?:  { nome: string; dataHora: string; observacoes?: string }
  relatorioEmitido: boolean; relatorioDataHora?: string
  createdAt: string
}

interface IRequisicao {
  _id: string; numeroRequisicao: string
  utente: string; utenteNome: string; utenteProcesso: string
  medicoSolicitante: string; analises: Analise[]
  urgente: boolean; prioridade: 'normal' | 'urgente' | 'stat'
  estado: 'pendente' | 'em_curso' | 'concluida' | 'cancelada'
  prescricaoRef?: string; observacoes?: string; createdAt: string
}

interface IUtente {
  _id: string; numeroProcesso: string; nome: string
  dataNascimento: string; genero: string; nif: string; sns: string
  contacto: string; email?: string; medico?: string
  morada: { rua: string; codigoPostal: string; localidade: string }
  observacoes?: string; ativo: boolean
}

interface IUtenteOpt { _id: string; nome: string; numeroProcesso: string; sns: string }

interface IStats {
  aguardamMedica: number; criticos: number
  minhasReqs: number; criticosPorValidar: number
}

/* ─────────────────────────────── HELPERS ─────────────────────────────── */
const FLAG_LABEL: Record<Flag, string> = {
  pendente: 'Pendente', normal: 'Normal',
  alto: 'Alto ↑', baixo: 'Baixo ↓',
  critico_alto: '⬆ Crítico', critico_baixo: '⬇ Crítico',
}
const FLAG_COLOR: Record<Flag, string> = {
  pendente: '#888', normal: '#2E7A50',
  alto: '#C87800', baixo: '#0064B4',
  critico_alto: '#C8001A', critico_baixo: '#C8001A',
}
const CAT_COLOR: Record<string, string> = {
  hematologia: '#5A64C8', bioquímica: '#3A8ABF', endocrinologia: '#C87800',
  imunologia: '#9060C8', microbiologia: '#C8001A', urina: '#2E7A50',
  coagulação: '#C87830', marcadores: '#6A6A68', urina2: '#4A9A5E',
}
const ESTADO_LABEL: Record<string, string> = {
  pendente: 'Registada', em_curso: 'Em curso', concluida: 'Concluída', cancelada: 'Cancelada',
}

const isCrit = (f: Flag) => f === 'critico_alto' || f === 'critico_baixo'

function fmt(d: string)  { return new Date(d).toLocaleDateString('pt-PT') }
function fmtH(d: string) { return new Date(d).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' }) }

/** extrai o primeiro nome próprio, ignorando prefixos académicos */
function primeiroNome(nome: string): string {
  return nome.replace(/^(Dr\.|Dra\.|Prof\.|Enf\.|Sr\.|Sra\.)\s+/i, '').split(' ')[0]
}

function saudacao(): string {
  const h = new Date().getHours()
  return h < 12 ? 'Bom dia' : h < 19 ? 'Boa tarde' : 'Boa noite'
}

function dataHoje(): string {
  return new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })
}

/* ══════════════════════════════ COMPONENT ══════════════════════════════ */
export default function PortalMedico() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()

  const [tab, setTab] = useState<Tab>('validacao')
  const [stats, setStats] = useState<IStats>({ aguardamMedica: 0, criticos: 0, minhasReqs: 0, criticosPorValidar: 0 })

  /* ── VALIDAÇÃO state ── */
  const [valList, setValList]     = useState<IResultado[]>([])
  const [valTotal, setValTotal]   = useState(0)
  const [valLoading, setValLoad]  = useState(false)
  const [valSearch, setValSearch] = useState('')
  const [valDebSearch, setValDeb] = useState('')
  /* req panel */
  const [reqPanel,  setReqPanel]  = useState<string | null>(null)
  const [valObs,    setValObs]    = useState('')
  const [valSaving, setValSaving] = useState<'all' | string | null>(null)
  const [valSuccess, setValSuccess] = useState('')
  const [valErr,    setValErr]    = useState('')
  /* individual result panel (críticos / utentes) */
  const [panel, setPanel]         = useState<'validar' | 'relatorio' | null>(null)
  const [selRes, setSelRes]       = useState<IResultado | null>(null)
  const [fObs, setFObs]           = useState('')
  const [fEmitir, setFEmitir]     = useState(false)
  const [saving, setSaving]       = useState(false)
  const [panelErr, setPanelErr]   = useState('')

  /* ── REQUISIÇÕES state ── */
  const [reqs, setReqs]           = useState<IRequisicao[]>([])
  const [reqTotal, setReqTotal]   = useState(0)
  const [reqPage, setReqPage]     = useState(1)
  const [reqLoading, setReqLoad]  = useState(false)
  const [reqEstado, setReqEstado] = useState<EstadoReq>('todas')
  const [showReqForm, setShowReqForm] = useState(false)
  const [selReq, setSelReq]       = useState<IRequisicao | null>(null)
  const [rfUtente, setRfUtente]   = useState<IUtenteOpt | null>(null)
  const [rfUSearch, setRfUSearch] = useState('')
  const [rfUOpts, setRfUOpts]     = useState<IUtenteOpt[]>([])
  const [rfAnalises, setRfAnalises] = useState<Analise[]>([])
  const [rfUrgente, setRfUrgente] = useState(false)
  const [rfPrior, setRfPrior]     = useState<'normal'|'urgente'|'stat'>('normal')
  const [rfObs, setRfObs]         = useState('')
  const [rfPrescricao, setRfPrescricao] = useState('')
  const [rfSaving, setRfSaving]   = useState(false)
  const [rfErr, setRfErr]         = useState('')

  /* ── UTENTES state ── */
  const [utSearch, setUtSearch]   = useState('')
  const [utDebSearch, setUtDeb]   = useState('')
  const [utList, setUtList]       = useState<IUtente[]>([])
  const [utTotal, setUtTotal]     = useState(0)
  const [utLoading, setUtLoad]    = useState(false)
  const [selUt, setSelUt]         = useState<IUtente | null>(null)
  const [utResultados, setUtResultados] = useState<IResultado[]>([])
  const [utReqs, setUtReqs]       = useState<IRequisicao[]>([])
  const [utDetailLoad, setUtDetailLoad] = useState(false)

  /* ── CRÍTICOS state ── */
  const [critList, setCritList]   = useState<IResultado[]>([])
  const [critLoading, setCritLoad] = useState(false)

  const valTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const utTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* ── loaders ── */
  const loadStats = useCallback(async () => {
    try {
      const [rs, rqs] = await Promise.all([
        api.get('/resultados/stats'),
        api.get('/requisicoes', { params: { medicoId: 'mine', limit: 1 } }),
      ])
      setStats({
        aguardamMedica:    rs.data.validado_tecnico ?? 0,
        criticos:          rs.data.criticos ?? 0,
        criticosPorValidar: rs.data.criticosPorValidar ?? 0,
        minhasReqs:        rqs.data.total ?? 0,
      })
    } catch { /* */ }
  }, [])

  const loadValidacao = useCallback(() => {
    setValLoad(true)
    // só mostra requisições onde TODOS os resultados foram validados tecnicamente
    api.get('/resultados/requisicoes-prontas', { params: { estado: 'validado_tecnico' } })
      .then(({ data }) => {
        const flat: IResultado[] = []
        ;(data.data ?? []).forEach((g: any) => flat.push(...(g.items ?? [])))
        setValList(flat)
        setValTotal(data.data?.length ?? 0)
      })
      .finally(() => setValLoad(false))
  }, [])

  const loadReqs = useCallback(() => {
    setReqLoad(true)
    api.get('/requisicoes', { params: { medicoId: 'mine', estado: reqEstado !== 'todas' ? reqEstado : undefined, page: reqPage, limit: 15 } })
      .then(({ data }) => { setReqs(data.data); setReqTotal(data.total) })
      .finally(() => setReqLoad(false))
  }, [reqEstado, reqPage])

  const loadUtentes = useCallback(() => {
    setUtLoad(true)
    const params: Record<string, string | number> = { medicoId: 'mine', limit: 20 }
    if (utDebSearch) params.search = utDebSearch
    api.get('/utentes', { params })
      .then(({ data }) => { setUtList(data.data); setUtTotal(data.total) })
      .finally(() => setUtLoad(false))
  }, [utDebSearch])

  const loadCriticos = useCallback(() => {
    setCritLoad(true)
    api.get('/resultados', { params: { flagIn: 'critico_alto,critico_baixo', limit: 30 } })
      .then(({ data }) => setCritList(data.data))
      .finally(() => setCritLoad(false))
  }, [])

  /* ── effects ── */
  useEffect(() => { loadStats(); const id = setInterval(loadStats, 60_000); return () => clearInterval(id) }, [loadStats])
  useEffect(() => { if (tab === 'validacao')   loadValidacao() }, [tab, loadValidacao])
  useEffect(() => { if (tab === 'requisicoes') loadReqs() },      [tab, loadReqs])
  useEffect(() => { if (tab === 'utentes')     loadUtentes() },   [tab, loadUtentes])
  useEffect(() => { if (tab === 'criticos')    loadCriticos() },  [tab, loadCriticos])

  useEffect(() => {
    if (valTimer.current) clearTimeout(valTimer.current)
    valTimer.current = setTimeout(() => { setValDeb(valSearch); setValPage(1) }, 300)
    return () => { if (valTimer.current) clearTimeout(valTimer.current) }
  }, [valSearch])

  useEffect(() => {
    if (utTimer.current) clearTimeout(utTimer.current)
    utTimer.current = setTimeout(() => { setUtDeb(utSearch) }, 350)
    return () => { if (utTimer.current) clearTimeout(utTimer.current) }
  }, [utSearch])

  /* ── validação médica ── */
  const openValidar = (r: IResultado) => {
    setSelRes(r); setFObs(''); setFEmitir(isCrit(r.flag)); setPanelErr(''); setValSuccess(''); setPanel('validar')
  }
  const openRelatorio = (r: IResultado) => { setSelRes(r); setPanelErr(''); setValSuccess(''); setPanel('relatorio') }
  const closePanel = () => { setPanel(null); setSelRes(null); setPanelErr(''); setValSuccess('') }

  const handleValidarMedico = async () => {
    if (!selRes) return
    setSaving(true); setPanelErr('')
    try {
      await api.post(`/resultados/${selRes._id}/validar-medico`, {
        observacoes: fObs || undefined,
        emitirRelatorio: fEmitir,
      })
      setValSuccess('Resultado validado com sucesso.')
      setTimeout(() => { closePanel(); loadValidacao(); loadStats(); if (tab === 'criticos') loadCriticos() }, 1200)
    } catch (e: any) { setPanelErr(e.response?.data?.message ?? 'Erro ao validar') }
    finally { setSaving(false) }
  }

  const handleEmitirRelatorio = async () => {
    if (!selRes) return
    setSaving(true); setPanelErr('')
    try {
      await api.post(`/resultados/${selRes._id}/emitir-relatorio`)
      printRelatorio(selRes)
      closePanel(); loadValidacao()
    } catch (e: any) { setPanelErr(e.response?.data?.message ?? 'Erro ao emitir relatório') }
    finally { setSaving(false) }
  }

  /* ── criar requisição ── */
  const resetReqForm = () => {
    setRfUtente(null); setRfUSearch(''); setRfUOpts([])
    setRfAnalises([]); setRfUrgente(false); setRfPrior('normal')
    setRfObs(''); setRfPrescricao(''); setRfErr('')
  }

  const handleCreateReq = async () => {
    if (!rfUtente)           return setRfErr('Selecione um utente')
    if (rfAnalises.length === 0) return setRfErr('Selecione pelo menos uma análise')
    setRfSaving(true); setRfErr('')
    try {
      await api.post('/requisicoes', {
        utente:            rfUtente._id,
        utenteNome:        rfUtente.nome,
        utenteProcesso:    rfUtente.numeroProcesso,
        medicoSolicitante: user?.nome ?? '',
        analises:          rfAnalises,
        urgente:           rfUrgente,
        prioridade:        rfPrior,
        observacoes:       rfObs || undefined,
        prescricaoRef:     rfPrescricao || undefined,
      })
      resetReqForm(); setShowReqForm(false); loadReqs(); loadStats()
    } catch (e: any) { setRfErr(e.response?.data?.message ?? 'Erro ao criar requisição') }
    finally { setRfSaving(false) }
  }

  const toggleAnalise = (a: Analise) =>
    setRfAnalises(prev => prev.find(x => x.codigo === a.codigo) ? prev.filter(x => x.codigo !== a.codigo) : [...prev, a])

  const applyPerfil = (codigos: string[]) => {
    const novas = CATALOGO.filter(a => codigos.includes(a.codigo))
    setRfAnalises(prev => { const ex = prev.map(x => x.codigo); return [...prev, ...novas.filter(a => !ex.includes(a.codigo))] })
  }

  /* ── utente detail ── */
  const openUtenteDetail = async (u: IUtente) => {
    setSelUt(u); setUtDetailLoad(true); setUtResultados([]); setUtReqs([])
    try {
      const [res, reqs] = await Promise.all([
        api.get('/resultados', { params: { utente: u._id, limit: 8 } }),
        api.get('/requisicoes', { params: { search: u.nome, limit: 5 } }),
      ])
      setUtResultados(res.data.data)
      setUtReqs(reqs.data.data.filter((r: IRequisicao) => r.utente === u._id))
    } catch { /* */ } finally { setUtDetailLoad(false) }
  }

  /* ── print ── */
  const printRelatorio = (r: IResultado) => {
    const fc = FLAG_COLOR[r.flag]
    const html = `<!DOCTYPE html><html lang="pt"><head><meta charset="UTF-8"/>
<title>Relatório ${r.codigoResultado}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=GFS+Didot&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'GFS Didot',Georgia,serif;color:#1A1208;background:#fff;padding:40px 60px;max-width:700px;margin:0 auto}
  .logo{font-size:16px;letter-spacing:.16em;text-transform:uppercase;margin-bottom:4px}
  .sub{font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:#888;margin-bottom:28px}
  hr{border:none;border-top:1px solid #e8e4dc;margin:18px 0}
  .sec{font-size:9px;letter-spacing:.18em;text-transform:uppercase;color:#999;margin-bottom:6px}
  .patient{font-size:18px;margin-bottom:2px}
  .meta{font-size:10px;letter-spacing:.06em;color:#999;margin-bottom:16px}
  .box{background:#F8F5EF;border-radius:6px;padding:20px 24px;margin:18px 0}
  .analise{font-size:14px;letter-spacing:.06em;text-transform:uppercase;margin-bottom:8px}
  .val{font-size:38px;font-style:italic;color:${fc}}
  .unit{font-size:16px;color:#666}
  .flag-pill{font-size:9px;letter-spacing:.14em;text-transform:uppercase;padding:3px 10px;border-radius:3px;background:rgba(200,0,26,.08);color:${fc}}
  .ref{font-size:11px;color:#888;margin-top:5px}
  .vblock{margin:8px 0;padding:10px 14px;border-left:3px solid #e8e4dc;background:#faf8f4}
  .vlbl{font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:#aaa;margin-bottom:3px}
  .vsig{font-size:13px;color:#333}
  .vwhen{font-size:10px;color:#aaa}
  .obs{font-style:italic;font-size:12px;color:#888;margin-top:5px}
  .footer{margin-top:32px;padding-top:16px;border-top:1px solid #e8e4dc;font-size:9px;color:#bbb;letter-spacing:.1em}
  @media print{body{padding:20px 30px}}
</style></head><body>
<div class="logo">LabSystem Pro</div>
<div class="sub">Resultado Clínico · Validado Medicamente</div>
<hr/>
<div class="sec">Utente</div><div class="patient">${r.utenteNome}</div>
<div class="meta">${r.requisicaoNumero} · ${r.codigoAmostra} · ${fmt(r.createdAt)}</div>
<hr/><div class="sec">Resultado</div>
<div class="box">
  <div class="analise">${r.analise.nome} <span style="font-size:11px;color:#999">${r.analise.codigo}</span></div>
  ${r.valor ? `<div style="display:flex;align-items:baseline;gap:12px;margin-bottom:6px"><span class="val">${r.valor}</span><span class="unit">${r.unidade??''}</span><span class="flag-pill">${r.flag.replace(/_/g,' ')}</span></div>` : '<p style="color:#aaa;font-style:italic">Sem valor registado</p>'}
  ${(r.refMin!==undefined||r.refMax!==undefined)?`<div class="ref">Ref: ${r.refMin??'–'} – ${r.refMax??'–'} ${r.unidade??''}</div>`:''}
</div>
${r.observacoes?`<div class="obs">${r.observacoes}</div><hr/>`:'<hr/>'}
<div class="sec">Validações</div>
${r.validacaoTecnica?`<div class="vblock"><div class="vlbl">Validação Técnica</div><div class="vsig">${r.validacaoTecnica.nome}</div><div class="vwhen">${fmtH(r.validacaoTecnica.dataHora)}</div></div>`:''}
${r.validacaoMedica?`<div class="vblock"><div class="vlbl">Validação Médica</div><div class="vsig">${r.validacaoMedica.nome}</div><div class="vwhen">${fmtH(r.validacaoMedica.dataHora)}</div>${r.validacaoMedica.observacoes?`<div class="obs">${r.validacaoMedica.observacoes}</div>`:''}</div>`:''}
<div class="footer">${r.codigoResultado} · Emitido ${new Date().toLocaleString('pt-PT')} · LabSystem Pro</div>
<script>window.onload=()=>window.print()</script></body></html>`
    const w = window.open('', '_blank', 'width=760,height=900')
    if (w) { w.document.write(html); w.document.close() }
  }

  const handleLogout = () => { logout(); navigate('/login') }

  /* ── agrupamento por requisição ── */
  function groupByReqPM(list: IResultado[]) {
    return list.reduce<Record<string, IResultado[]>>((acc, r) => {
      if (!acc[r.requisicaoNumero]) acc[r.requisicaoNumero] = []
      acc[r.requisicaoNumero].push(r)
      return acc
    }, {})
  }

  const byReqVal = groupByReqPM(
    valList.filter(r =>
      !valDebSearch ||
      r.utenteNome.toLowerCase().includes(valDebSearch.toLowerCase()) ||
      r.requisicaoNumero.toLowerCase().includes(valDebSearch.toLowerCase()) ||
      r.codigoAmostra.toLowerCase().includes(valDebSearch.toLowerCase()) ||
      r.analise.nome.toLowerCase().includes(valDebSearch.toLowerCase())
    )
  )

  const validarTodosReq = async () => {
    if (!reqPanel) return
    setValSaving('all'); setValErr(''); setValSuccess('')
    try {
      await api.post(`/resultados/requisicao/${encodeURIComponent(reqPanel)}/validar-medico`, {
        observacoes: valObs || undefined,
      })
      const n = (byReqVal[reqPanel] ?? []).length
      setValSuccess(`✓ ${n} resultado${n !== 1 ? 's' : ''} validados — disponível ao utente`)
      setValList(prev => prev.filter(r => r.requisicaoNumero !== reqPanel))
      await loadStats()
      setTimeout(() => { setReqPanel(null); setValObs(''); setValSuccess('') }, 2000)
    } catch (e: any) {
      setValErr(e.response?.data?.message ?? 'Erro ao validar')
    } finally { setValSaving(null) }
  }

  const validarUmRes = async (r: IResultado) => {
    setValSaving(r._id); setValErr('')
    try {
      await api.post(`/resultados/${r._id}/validar-medico`, { observacoes: valObs || undefined })
      setValList(prev => prev.filter(x => x._id !== r._id))
      const remaining = (byReqVal[reqPanel!] ?? []).filter(x => x._id !== r._id)
      if (remaining.length === 0) {
        await loadStats()
        setTimeout(() => { setReqPanel(null); setValObs('') }, 800)
      }
    } catch (e: any) {
      setValErr(e.response?.data?.message ?? 'Erro ao validar')
    } finally { setValSaving(null) }
  }

  const printReqPDF = (reqNum: string, items: IResultado[]) => {
    const utente  = items[0]?.utenteNome ?? ''
    const amostra = items[0]?.codigoAmostra ?? ''
    const date    = items[0] ? fmt(items[0].createdAt) : ''
    const rows = items.map(r => `
      <tr>
        <td>${r.analise.nome}</td>
        <td>${r.analise.categoria}</td>
        <td style="font-weight:600;color:${FLAG_COLOR[r.flag]}">${r.valor ?? '—'} ${r.unidade ?? ''}</td>
        <td>${r.refMin !== undefined && r.refMax !== undefined ? `${r.refMin} – ${r.refMax} ${r.unidade ?? ''}` : '—'}</td>
        <td style="color:${FLAG_COLOR[r.flag]}">${FLAG_LABEL[r.flag]}</td>
        <td>${r.observacoes ?? '—'}</td>
      </tr>`).join('')
    const html = `<!DOCTYPE html><html lang="pt"><head><meta charset="utf-8"/>
      <title>Relatório ${reqNum}</title>
      <style>
        body{font-family:Georgia,serif;padding:40px;color:#1A1208;font-size:13px}
        h1{font-size:22px;letter-spacing:.02em;margin-bottom:4px}
        .sub{font-size:11px;color:#888;margin-bottom:32px}
        table{width:100%;border-collapse:collapse}
        th{text-align:left;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:#888;padding:6px 10px;border-bottom:2px solid #eee}
        td{padding:8px 10px;border-bottom:1px solid #f0ede8;font-size:12px;vertical-align:top}
        tr:last-child td{border-bottom:none}
        .footer{margin-top:40px;font-size:10px;color:#aaa;font-style:italic}
      </style></head><body>
      <h1>Relatório de Resultados</h1>
      <div class="sub">${reqNum} · ${utente} · ${amostra} · ${date}</div>
      <table>
        <thead><tr><th>Análise</th><th>Categoria</th><th>Resultado</th><th>Referência</th><th>Flag</th><th>Observações</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="footer">Validado por ${user?.nome} · ${new Date().toLocaleString('pt-PT')}</div>
      <script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}<\/script>
    </body></html>`
    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close() }
  }

  const reqPages = Math.ceil(reqTotal / 15)

  /* ════════════════════════════ RENDER ════════════════════════════ */
  return (
    <div className="pm-page">

      {/* ── HEADER ── */}
      <header className="pm-hd">
        <div className="pm-logo">Lab<strong>System</strong> Pro</div>
        <div className="pm-hd-center">
          <span className="pm-hd-tag">Portal Clínico</span>
        </div>
        <div className="pm-hd-right">
          <div className="pm-hd-user">
            <div className="pm-hd-nome">{user?.nome}</div>
            <div className="pm-hd-role">médico · {dataHoje()}</div>
          </div>
          <NotificationBell theme="light" />
          <button className="pm-logout" onClick={handleLogout}>sair</button>
        </div>
      </header>

      {/* ── HERO ── */}
      <div className="pm-hero">
        <div className="pm-hero-left">
          <div className="pm-greeting">
            {saudacao()}, <em>{primeiroNome(user?.nome ?? '')}</em>
          </div>
          <div className="pm-hero-actions">
            <button className="pm-hero-btn pm-hero-btn--primary"
              onClick={() => { resetReqForm(); setShowReqForm(true); setTab('requisicoes') }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
              Nova requisição
            </button>
            <button className="pm-hero-btn" onClick={() => { setTab('utentes') }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.5 6.5 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
              Pesquisar utente
            </button>
          </div>
        </div>

        <div className="pm-kpis">
          <div className={`pm-kpi${stats.aguardamMedica > 0 ? ' pm-kpi--warn' : ''}`}
            onClick={() => setTab('validacao')}>
            <div className="pm-kpi-icon">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
            </div>
            <div className="pm-kpi-val">{stats.aguardamMedica}</div>
            <div className="pm-kpi-lbl">aguardam validação</div>
            {stats.aguardamMedica > 0 && <div className="pm-kpi-hint">clique para validar →</div>}
          </div>

          <div className={`pm-kpi${stats.criticosPorValidar > 0 ? ' pm-kpi--crit' : ''}`}
            onClick={() => setTab('criticos')}>
            <div className="pm-kpi-icon">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
            </div>
            <div className="pm-kpi-val">{stats.criticosPorValidar}</div>
            <div className="pm-kpi-lbl">críticos por validar</div>
            {stats.criticosPorValidar > 0 && <div className="pm-kpi-hint">atenção imediata</div>}
          </div>

          <div className="pm-kpi" onClick={() => setTab('requisicoes')}>
            <div className="pm-kpi-icon">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.89 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
            </div>
            <div className="pm-kpi-val">{stats.minhasReqs}</div>
            <div className="pm-kpi-lbl">minhas requisições</div>
          </div>

          <div className="pm-kpi pm-kpi--search" onClick={() => setTab('utentes')}>
            <div className="pm-kpi-icon">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
            </div>
            <div className="pm-kpi-val pm-kpi-val--sm">Utentes</div>
            <div className="pm-kpi-lbl">pesquisar ficha clínica</div>
          </div>
        </div>
      </div>

      {/* ── ALERTA CRÍTICOS ── */}
      <AnimatePresence>
        {stats.criticosPorValidar > 0 && (
          <motion.div className="pm-alert"
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <span className="pm-alert-pulse" />
            <strong>{stats.criticosPorValidar}</strong> resultado{stats.criticosPorValidar > 1 ? 's' : ''} com valor crítico aguarda{stats.criticosPorValidar > 1 ? 'm' : ''} a sua validação médica
            <button className="pm-alert-btn" onClick={() => setTab('criticos')}>ver agora →</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── TABS ── */}
      <div className="pm-tabs">
        {([
          { key: 'validacao',   label: 'Validação',   count: stats.aguardamMedica,     icon: '✓' },
          { key: 'requisicoes', label: 'Requisições', count: null,                     icon: '≡' },
          { key: 'utentes',     label: 'Utentes',     count: null,                     icon: '◉' },
          { key: 'criticos',    label: 'Críticos',    count: stats.criticosPorValidar, icon: '!' },
        ] as { key: Tab; label: string; count: number | null; icon: string }[]).map(t => (
          <button key={t.key}
            className={`pm-tab${tab === t.key ? ' pm-tab--on' : ''}${t.key === 'criticos' && (t.count ?? 0) > 0 ? ' pm-tab--crit' : ''}`}
            onClick={() => setTab(t.key)}>
            <span className="pm-tab-icon">{t.icon}</span>
            {t.label}
            {t.count !== null && t.count > 0 && (
              <span className={`pm-tab-badge${t.key === 'criticos' ? ' pm-tab-badge--crit' : ''}`}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ════════════════ CONTENT ════════════════ */}
      <div className="pm-content">

        {/* ── TAB VALIDAÇÃO ── */}
        {tab === 'validacao' && (
          <div className="pm-section">
            <div className="pm-section-toolbar">
              <div>
                <div className="pm-section-title">Resultados aguardando validação médica</div>
                <div className="pm-section-sub">Clique numa requisição para rever todos os resultados e assinar</div>
              </div>
              <input className="pm-search" placeholder="utente · requisição · amostra · análise…"
                value={valSearch} onChange={e => setValSearch(e.target.value)} />
              <span className="pm-count">{Object.keys(byReqVal).length} requisição{Object.keys(byReqVal).length !== 1 ? 'ões' : ''}</span>
            </div>

            {valLoading && <div className="pm-loading"><div className="pm-loading-bar" /></div>}

            {!valLoading && Object.keys(byReqVal).length === 0 && (
              <div className="pm-empty-state">
                <div className="pm-empty-icon">✓</div>
                <div className="pm-empty-title">Tudo validado</div>
                <div className="pm-empty-sub">Não há requisições pendentes de validação médica neste momento.</div>
              </div>
            )}

            <div className="pm-valreq-list">
              {Object.entries(byReqVal).map(([reqNum, items], i) => {
                const hasCrit = items.some(r => isCrit(r.flag))
                const utente  = items[0]?.utenteNome ?? ''
                const amostra = items[0]?.codigoAmostra ?? ''
                return (
                  <motion.div key={reqNum}
                    className={`pm-valreq-card${hasCrit ? ' pm-valreq-card--crit' : ''}`}
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => { setReqPanel(reqNum); setValObs(''); setValErr(''); setValSuccess('') }}>

                    <div className="pm-valreq-hd">
                      <div className="pm-valreq-left">
                        <span className="pm-valreq-num">{reqNum}</span>
                        <span className="pm-valreq-utente">{utente}</span>
                        <span className="pm-valreq-amostra">{amostra}</span>
                      </div>
                      <div className="pm-valreq-right">
                        {hasCrit && <span className="pm-valreq-crit">⬆ crítico</span>}
                        <span className="pm-valreq-count">{items.length} ANÁLISES</span>
                        <span className="pm-valreq-arrow">→</span>
                      </div>
                    </div>

                    <div className="pm-valreq-tags">
                      {items.map(r => (
                        <span key={r._id} className="pm-valreq-tag"
                          style={{ background: (CAT_COLOR[r.analise.categoria] ?? '#888') + '14', color: CAT_COLOR[r.analise.categoria] ?? '#888' }}>
                          {r.analise.nome}
                        </span>
                      ))}
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── TAB REQUISIÇÕES ── */}
        {tab === 'requisicoes' && (
          <div className="pm-section">
            <div className="pm-section-toolbar">
              <div>
                <div className="pm-section-title">As minhas requisições</div>
                <div className="pm-section-sub">Requisições criadas por si, filtradas por estado</div>
              </div>
              <div className="pm-req-estado-tabs">
                {(['todas','pendente','em_curso','concluida','cancelada'] as EstadoReq[]).map(e => (
                  <button key={e}
                    className={`pm-req-etab${reqEstado === e ? ' pm-req-etab--on' : ''} pm-req-etab--${e}`}
                    onClick={() => { setReqEstado(e); setReqPage(1) }}>
                    {e === 'todas' ? 'todas' : ESTADO_LABEL[e]}
                  </button>
                ))}
              </div>
              <button className="pm-btn-new" onClick={() => { resetReqForm(); setShowReqForm(true); setSelReq(null) }}>
                + nova requisição
              </button>
            </div>

            {reqLoading && <div className="pm-loading"><div className="pm-loading-bar" /></div>}

            {!reqLoading && reqs.length === 0 && (
              <div className="pm-empty-state">
                <div className="pm-empty-icon">≡</div>
                <div className="pm-empty-title">Sem requisições</div>
                <div className="pm-empty-sub">
                  {reqEstado === 'todas' ? 'Ainda não criou nenhuma requisição.' : `Sem requisições com estado "${ESTADO_LABEL[reqEstado]}".`}
                </div>
                <button className="pm-empty-cta" onClick={() => { resetReqForm(); setShowReqForm(true) }}>+ criar primeira requisição</button>
              </div>
            )}

            {!reqLoading && reqs.map(r => (
              <div key={r._id}>
                <div className={`pm-req-row${selReq?._id === r._id ? ' pm-req-row--open' : ''}${r.urgente ? ' pm-req-row--urgent' : ''}`}
                  onClick={() => setSelReq(selReq?._id === r._id ? null : r)}>
                  {r.urgente && <span className="pm-req-urgente-bar" />}
                  <div className="pm-req-row-left">
                    <div className="pm-req-num">
                      {r.numeroRequisicao}
                      {r.urgente && <span className="pm-req-urgente">urgente</span>}
                      {r.prioridade === 'stat' && <span className="pm-req-stat">STAT</span>}
                    </div>
                    <div className="pm-req-utente">{r.utenteNome} · {r.utenteProcesso}</div>
                    <div className="pm-req-analises">
                      {r.analises.slice(0,3).map(a => a.nome).join(' · ')}
                      {r.analises.length > 3 && <span className="pm-req-mais"> +{r.analises.length - 3}</span>}
                    </div>
                  </div>
                  <div className="pm-req-row-right">
                    <span className="pm-req-date">{fmt(r.createdAt)}</span>
                    <span className={`pm-req-badge pm-req-badge--${r.estado}`}>{ESTADO_LABEL[r.estado]}</span>
                    <span className="pm-arr">{selReq?._id === r._id ? '↑' : '↓'}</span>
                  </div>
                </div>
                <AnimatePresence>
                  {selReq?._id === r._id && (
                    <motion.div className="pm-req-detail"
                      initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}>
                      <div className="pm-req-detail-grid">
                        <DField l="Utente" v={r.utenteNome} />
                        <DField l="Processo" v={r.utenteProcesso} />
                        <DField l="Prioridade" v={r.prioridade} />
                        <DField l="Médico" v={r.medicoSolicitante} />
                        {r.prescricaoRef && <DField l="Prescrição" v={r.prescricaoRef} />}
                        {r.observacoes   && <DField l="Observações" v={r.observacoes} />}
                      </div>
                      <div className="pm-req-analises-chips">
                        {r.analises.map(a => (
                          <span key={a.codigo} className="pm-chip"
                            style={{ background: (CAT_COLOR[a.categoria]??'#888')+'12', borderColor: (CAT_COLOR[a.categoria]??'#888')+'30', color: CAT_COLOR[a.categoria]??'#888' }}>
                            {a.nome}
                          </span>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}

            {reqPages > 1 && <Pag page={reqPage} pages={reqPages} onPrev={() => setReqPage(p=>p-1)} onNext={() => setReqPage(p=>p+1)} />}
          </div>
        )}

        {/* ── TAB UTENTES ── */}
        {tab === 'utentes' && (
          <div className="pm-section">
            <div className="pm-section-toolbar pm-section-toolbar--search">
              <div>
                <div className="pm-section-title">Pesquisar utentes</div>
                <div className="pm-section-sub">Acesso à ficha clínica, resultados históricos e requisições</div>
              </div>
              <div className="pm-search-wrap">
                <svg className="pm-search-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.5 6.5 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
                <input className="pm-search pm-search--icon" placeholder="nome · SNS · NIF · nº processo…"
                  value={utSearch} onChange={e => setUtSearch(e.target.value)} autoFocus />
              </div>
              {utTotal > 0 && <span className="pm-count">{utTotal} utente{utTotal !== 1 ? 's' : ''}</span>}
            </div>

            {!utDebSearch && utList.length === 0 && !utLoading && (
              <div className="pm-empty-state pm-empty-state--search">
                <div className="pm-empty-icon">◉</div>
                <div className="pm-empty-title">Sem utentes atribuídos</div>
                <div className="pm-empty-sub">Ainda não tem utentes atribuídos. Pesquise pelo nome ou SNS para encontrar um utente e atribuí-lo a si.</div>
              </div>
            )}

            {utLoading && <div className="pm-loading"><div className="pm-loading-bar" /></div>}

            {!utLoading && utDebSearch && utList.length === 0 && (
              <div className="pm-empty-state">
                <div className="pm-empty-icon">◉</div>
                <div className="pm-empty-title">Nenhum utente encontrado</div>
                <div className="pm-empty-sub">Tente pesquisar por nome completo, NIF ou número de SNS</div>
              </div>
            )}

            {utList.map(u => (
              <div key={u._id}>
                <motion.div
                  className={`pm-ut-row${selUt?._id === u._id ? ' pm-ut-row--open' : ''}`}
                  initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                  onClick={() => selUt?._id === u._id ? setSelUt(null) : openUtenteDetail(u)}>
                  <div className="pm-ut-avatar">
                    {u.nome.split(' ').filter(Boolean).slice(0,2).map(p=>p[0]).join('').toUpperCase()}
                  </div>
                  <div className="pm-ut-info">
                    <div className="pm-ut-nome">{u.nome}</div>
                    <div className="pm-ut-meta">
                      Proc. {u.numeroProcesso} · SNS {u.sns} · {new Date(u.dataNascimento).toLocaleDateString('pt-PT')} · {u.genero}
                    </div>
                  </div>
                  <div className="pm-ut-right">
                    {u.medico && <span className="pm-ut-medico">{u.medico}</span>}
                    <span className={`pm-ut-status ${u.ativo ? 'pm-ut-status--ok' : 'pm-ut-status--off'}`}>
                      {u.ativo ? 'ativo' : 'inativo'}
                    </span>
                    <span className="pm-arr">{selUt?._id === u._id ? '↑' : '↓'}</span>
                  </div>
                </motion.div>

                <AnimatePresence>
                  {selUt?._id === u._id && (
                    <motion.div className="pm-ut-detail"
                      initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}>
                      {utDetailLoad ? (
                        <div className="pm-loading" style={{ margin: '16px 0' }}><div className="pm-loading-bar" /></div>
                      ) : (
                        <>
                          <div className="pm-ut-detail-grid">
                            <DField l="NIF" v={u.nif} />
                            <DField l="Nr. SNS" v={u.sns} />
                            <DField l="Contacto" v={u.contacto} />
                            {u.email && <DField l="Email" v={u.email} />}
                            <DField l="Morada" v={`${u.morada.rua}, ${u.morada.codigoPostal} ${u.morada.localidade}`} />
                            <DField l="Médico atribuído" v={(u as any).medicoNome || u.medico || '—'} />
                            {u.observacoes && <DField l="Observações" v={u.observacoes} />}
                          </div>


                          {utResultados.length > 0 && (
                            <div className="pm-ut-section">
                              <div className="pm-ut-section-title">Últimos resultados</div>
                              {utResultados.slice(0,6).map(r => (
                                <div key={r._id} className="pm-ut-res-row">
                                  <span className="pm-cat-dot" style={{ background: CAT_COLOR[r.analise.categoria] ?? '#888' }} />
                                  <span className="pm-ut-res-nome">{r.analise.nome}</span>
                                  <span className="pm-ut-res-val" style={{ color: FLAG_COLOR[r.flag] }}>
                                    {r.valor ? `${r.valor} ${r.unidade ?? ''}` : '—'}
                                  </span>
                                  <span className="pm-flag-pill pm-flag-pill--sm"
                                    style={{ background: FLAG_COLOR[r.flag]+'18', color: FLAG_COLOR[r.flag] }}>
                                    {FLAG_LABEL[r.flag]}
                                  </span>
                                  <span className="pm-ut-res-date">{fmt(r.createdAt)}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {utReqs.length > 0 && (
                            <div className="pm-ut-section">
                              <div className="pm-ut-section-title">Últimas requisições</div>
                              {utReqs.map(r => (
                                <div key={r._id} className="pm-ut-req-row">
                                  <span className="pm-ut-req-num">{r.numeroRequisicao}</span>
                                  <span className="pm-ut-req-analises">{r.analises.map(a=>a.nome).join(', ')}</span>
                                  <span className={`pm-req-badge pm-req-badge--${r.estado}`}>{ESTADO_LABEL[r.estado]}</span>
                                  <span className="pm-ut-res-date">{fmt(r.createdAt)}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {utResultados.length === 0 && utReqs.length === 0 && (
                            <div className="pm-ut-sem-hist">Sem histórico clínico registado</div>
                          )}

                          <div className="pm-ut-actions">
                            <button className="pm-btn-req-utente" onClick={() => {
                              resetReqForm()
                              setRfUtente({ _id: u._id, nome: u.nome, numeroProcesso: u.numeroProcesso, sns: u.sns })
                              setTab('requisicoes'); setShowReqForm(true)
                            }}>
                              + criar requisição para este utente
                            </button>
                          </div>
                        </>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        )}

        {/* ── TAB CRÍTICOS ── */}
        {tab === 'criticos' && (
          <div className="pm-section">
            <div className="pm-section-toolbar">
              <div>
                <div className="pm-section-title">Resultados com valor crítico</div>
                <div className="pm-section-sub">Valores clinicamente significativos — requerem atenção imediata</div>
              </div>
              <span className="pm-count">{critList.length} resultado{critList.length !== 1 ? 's' : ''}</span>
            </div>

            {critLoading && <div className="pm-loading"><div className="pm-loading-bar" /></div>}

            {!critLoading && critList.length === 0 && (
              <div className="pm-empty-state">
                <div className="pm-empty-icon pm-empty-icon--ok">✓</div>
                <div className="pm-empty-title pm-empty-title--ok">Sem resultados críticos</div>
                <div className="pm-empty-sub">Não existem valores críticos pendentes neste momento.</div>
              </div>
            )}

            {!critLoading && critList.map((r, i) => (
              <motion.div key={r._id}
                className="pm-crit-row"
                initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.02 }}
                onClick={() => r.estado === 'validado_tecnico' ? openValidar(r) : openRelatorio(r)}>
                <span className="pm-crit-pulse" />
                <div className="pm-crit-info">
                  <div className="pm-crit-top">
                    <span className="pm-crit-analise">{r.analise.nome}</span>
                    <span className="pm-cat-tag" style={{ background: (CAT_COLOR[r.analise.categoria]??'#888')+'18', color: CAT_COLOR[r.analise.categoria]??'#888' }}>
                      {r.analise.categoria}
                    </span>
                  </div>
                  <div className="pm-crit-utente">{r.utenteNome} · {r.codigoAmostra} · {fmt(r.createdAt)}</div>
                </div>
                <div className="pm-crit-val" style={{ color: FLAG_COLOR[r.flag] }}>
                  {r.valor ?? '—'} <span className="pm-val-unit">{r.unidade}</span>
                </div>
                <div className="pm-crit-estado">
                  <span className={`pm-crit-estado-badge${r.estado === 'validado_tecnico' ? ' pm-crit-estado-badge--pending' : ' pm-crit-estado-badge--done'}`}>
                    {r.estado === 'validado_tecnico' ? 'aguarda validação' : r.estado === 'validado_medico' ? '✓ validado' : r.estado.replace(/_/g,' ')}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        )}

      </div>

      {/* ════════ FORM NOVA REQUISIÇÃO ════════ */}
      <AnimatePresence>
        {showReqForm && (
          <motion.div className="pm-overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowReqForm(false)}>
            <motion.aside className="pm-req-form-panel"
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 280 }}
              onClick={e => e.stopPropagation()}>

              <div className="pm-panel-hd">
                <button className="pm-panel-back" onClick={() => setShowReqForm(false)}>← fechar</button>
                <div className="pm-panel-label">Nova Requisição</div>
                <div className="pm-panel-sub">Dr. {user?.nome}</div>
              </div>

              <div className="pm-req-form">
                {rfErr && <div className="pm-form-err">{rfErr}</div>}

                {/* utente */}
                <div className="pm-ff">
                  <label className="pm-ff-lbl">Utente *</label>
                  {rfUtente ? (
                    <div className="pm-rf-utente-linked">
                      <div className="pm-rf-utente-avatar">{rfUtente.nome.split(' ').slice(0,2).map(p=>p[0]).join('').toUpperCase()}</div>
                      <div>
                        <div className="pm-rf-utente-nome">{rfUtente.nome}</div>
                        <div className="pm-rf-utente-meta">{rfUtente.numeroProcesso} · SNS {rfUtente.sns}</div>
                      </div>
                      <button className="pm-rf-clear" onClick={() => { setRfUtente(null); setRfUSearch('') }}>×</button>
                    </div>
                  ) : (
                    <div style={{ position: 'relative' }}>
                      <input className="pm-input" placeholder="pesquisar por nome, SNS ou NIF…"
                        value={rfUSearch}
                        onChange={e => {
                          setRfUSearch(e.target.value)
                          if (e.target.value.length >= 2) {
                            api.get('/utentes', { params: { search: e.target.value, limit: 6 } })
                              .then(r => setRfUOpts(r.data.data)).catch(() => {})
                          } else setRfUOpts([])
                        }} />
                      {rfUOpts.length > 0 && (
                        <div className="pm-utente-drop">
                          {rfUOpts.map(u => (
                            <div key={u._id} className="pm-utente-opt"
                              onClick={() => { setRfUtente(u); setRfUSearch(''); setRfUOpts([]) }}>
                              <div className="pm-utente-opt-avatar">{u.nome.split(' ').slice(0,2).map(p=>p[0]).join('').toUpperCase()}</div>
                              <div>
                                <div className="pm-utente-opt-nome">{u.nome}</div>
                                <div className="pm-utente-opt-meta">{u.numeroProcesso} · SNS {u.sns}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* prioridade */}
                <div className="pm-ff">
                  <label className="pm-ff-lbl">Prioridade</label>
                  <div className="pm-prioridade">
                    {(['normal','urgente','stat'] as const).map(p => (
                      <button key={p}
                        className={`pm-prior-btn${rfPrior === p ? ' pm-prior-btn--on' : ''}${p==='stat' ? ' pm-prior-btn--stat' : p==='urgente' ? ' pm-prior-btn--urg' : ''}`}
                        onClick={() => { setRfPrior(p); if (p !== 'normal') setRfUrgente(true); else setRfUrgente(false) }}>
                        {p === 'normal' ? 'Normal' : p === 'urgente' ? '⬆ Urgente' : '⬆⬆ STAT'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* perfis rápidos */}
                <div className="pm-ff">
                  <label className="pm-ff-lbl">Perfis clínicos rápidos</label>
                  <div className="pm-perfis">
                    {PERFIS.map(p => (
                      <button key={p.nome} className="pm-perfil-btn" onClick={() => applyPerfil(p.codigos)}>
                        {p.nome}
                      </button>
                    ))}
                  </div>
                </div>

                {/* selecionadas */}
                {rfAnalises.length > 0 && (
                  <div className="pm-ff">
                    <label className="pm-ff-lbl">Análises selecionadas ({rfAnalises.length})</label>
                    <div className="pm-analises-chips">
                      {rfAnalises.map(a => (
                        <span key={a.codigo} className="pm-chip pm-chip--sel"
                          style={{ background: (CAT_COLOR[a.categoria]??'#888')+'12', borderColor: (CAT_COLOR[a.categoria]??'#888')+'30', color: CAT_COLOR[a.categoria]??'#888' }}
                          onClick={() => toggleAnalise(a)}>
                          {a.nome} ×
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* catálogo */}
                <div className="pm-ff">
                  <label className="pm-ff-lbl">Catálogo</label>
                  {CATEGORIAS.map(cat => (
                    <div key={cat} className="pm-cat-group">
                      <div className="pm-cat-title" style={{ color: CAT_COLOR[cat] ?? '#888' }}>
                        <span className="pm-cat-dot" style={{ background: CAT_COLOR[cat] ?? '#888' }} />
                        {cat}
                      </div>
                      <div className="pm-cat-analises">
                        {CATALOGO.filter(a => a.categoria === cat).map(a => {
                          const sel = !!rfAnalises.find(x => x.codigo === a.codigo)
                          return (
                            <button key={a.codigo}
                              className={`pm-analise-btn${sel ? ' pm-analise-btn--on' : ''}`}
                              style={sel ? { background: (CAT_COLOR[cat]??'#888')+'18', borderColor: (CAT_COLOR[cat]??'#888')+'40', color: CAT_COLOR[cat]??'#888' } : {}}
                              onClick={() => toggleAnalise(a)}>
                              {a.nome}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pm-ff">
                  <label className="pm-ff-lbl">Nº prescrição (opcional)</label>
                  <input className="pm-input" placeholder="RCM-2026-XXXXX"
                    value={rfPrescricao} onChange={e => setRfPrescricao(e.target.value)} />
                </div>

                <div className="pm-ff">
                  <label className="pm-ff-lbl">Observações clínicas</label>
                  <textarea className="pm-input pm-textarea" rows={3}
                    placeholder="Contexto clínico relevante, hipóteses diagnósticas…"
                    value={rfObs} onChange={e => setRfObs(e.target.value)} />
                </div>

                <div className="pm-form-actions">
                  <button className="pm-btn-cancel" onClick={() => setShowReqForm(false)}>cancelar</button>
                  <button className="pm-btn-save" disabled={rfSaving} onClick={handleCreateReq}>
                    {rfSaving ? 'a criar…' : `criar requisição ${rfAnalises.length > 0 ? `(${rfAnalises.length})` : ''}`}
                  </button>
                </div>
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════════ PAINEL VALIDAÇÃO POR REQUISIÇÃO ════════ */}
      <AnimatePresence>
        {reqPanel && (
          <motion.aside className="pm-reqval-panel"
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 280 }}>

            <div className={`pm-panel-hd${(byReqVal[reqPanel] ?? []).some(r => isCrit(r.flag)) ? ' pm-panel-hd--crit' : ''}`}>
              <button className="pm-panel-back" onClick={() => { setReqPanel(null); setValObs(''); setValErr(''); setValSuccess('') }}>← fechar</button>
              <div className="pm-panel-label">Validação médica</div>
              <div className="pm-panel-sub">{reqPanel} · {(byReqVal[reqPanel] ?? [])[0]?.utenteNome}</div>
            </div>

            <div className="pm-val-detail">
              <div className="pm-reqval-results">
                {(byReqVal[reqPanel] ?? []).map(r => {
                  const isCritR = isCrit(r.flag)
                  return (
                    <div key={r._id} className={`pm-result-card pm-result-card--${r.flag}${isCritR ? ' pm-result-card--crit' : ''}`}>
                      <div className="pm-result-top">
                        <span className="pm-cat-tag" style={{ background: (CAT_COLOR[r.analise.categoria] ?? '#888') + '18', color: CAT_COLOR[r.analise.categoria] ?? '#888' }}>
                          {r.analise.categoria}
                        </span>
                        <span className="pm-flag-pill pm-flag-pill--lg"
                          style={{ background: FLAG_COLOR[r.flag] + '18', color: FLAG_COLOR[r.flag] }}>
                          {FLAG_LABEL[r.flag]}
                        </span>
                        <button className="pm-btn-validar-um" title="Validar este resultado"
                          disabled={valSaving !== null}
                          onClick={e => { e.stopPropagation(); validarUmRes(r) }}>
                          {valSaving === r._id ? '…' : '✓'}
                        </button>
                      </div>
                      <div className="pm-result-nome">{r.analise.nome}</div>
                      <div className="pm-result-valor" style={{ color: FLAG_COLOR[r.flag] }}>
                        {r.valor ?? '—'}
                        {r.unidade && <span className="pm-result-unit"> {r.unidade}</span>}
                      </div>
                      {(r.refMin !== undefined || r.refMax !== undefined) && (
                        <div className="pm-result-ref">
                          Ref: {r.refMin ?? '–'} – {r.refMax ?? '–'} {r.unidade}
                        </div>
                      )}
                      {r.validacaoTecnica && (
                        <div className="pm-val-hist pm-val-hist--tec" style={{ marginTop: 8 }}>
                          <div className="pm-val-hist-lbl">✓ Validação técnica</div>
                          <div className="pm-val-hist-who">{r.validacaoTecnica.nome}</div>
                        </div>
                      )}
                      {r.observacoes && <div className="pm-result-obs">{r.observacoes}</div>}
                    </div>
                  )
                })}
              </div>

              {valSuccess && (
                <motion.div className="pm-success" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
                  {valSuccess}
                </motion.div>
              )}
              {valErr && <div className="pm-form-err">{valErr}</div>}

              {!valSuccess && (
                <div className="pm-val-action">
                  <div className="pm-val-action-title">Observações clínicas <span style={{ fontWeight: 400, fontSize: 10, opacity: 0.5 }}>(opcional)</span></div>
                  <textarea className="pm-input pm-textarea" rows={3}
                    value={valObs} onChange={e => setValObs(e.target.value)}
                    placeholder="Contexto clínico, interpretação, recomendações…" />
                  <button className="pm-btn-validar" disabled={valSaving !== null} onClick={validarTodosReq}>
                    {valSaving === 'all' ? 'a validar…'
                      : `✓ Validar e assinar todos (${(byReqVal[reqPanel] ?? []).length}) — ${user?.nome}`}
                  </button>
                  <button className="pm-btn-relatorio" style={{ marginTop: 8 }}
                    onClick={() => printReqPDF(reqPanel!, byReqVal[reqPanel] ?? [])}>
                    ↓ Exportar PDF com todos os resultados
                  </button>
                </div>
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ════════ PANEL VALIDAÇÃO INDIVIDUAL (críticos) ════════ */}
      <AnimatePresence>
        {panel && selRes && (
          <motion.aside className="pm-val-panel"
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 280 }}>

            <div className={`pm-panel-hd${isCrit(selRes.flag) ? ' pm-panel-hd--crit' : ''}`}>
              <button className="pm-panel-back" onClick={closePanel}>← fechar</button>
              <div className="pm-panel-label">{selRes.analise.nome}</div>
              <div className="pm-panel-sub">{selRes.utenteNome} · {selRes.requisicaoNumero}</div>
              {isCrit(selRes.flag) && (
                <div className="pm-panel-crit-tag">
                  <span className="pm-crit-pulse pm-crit-pulse--sm" />{FLAG_LABEL[selRes.flag]}
                </div>
              )}
            </div>

            <div className="pm-val-detail">
              {/* resultado destaque */}
              <div className={`pm-result-card pm-result-card--${selRes.flag}`}>
                <div className="pm-result-top">
                  <span className="pm-cat-tag" style={{ background: (CAT_COLOR[selRes.analise.categoria]??'#888')+'18', color: CAT_COLOR[selRes.analise.categoria]??'#888' }}>
                    {selRes.analise.categoria}
                  </span>
                  <span className="pm-flag-pill pm-flag-pill--lg"
                    style={{ background: FLAG_COLOR[selRes.flag]+'18', color: FLAG_COLOR[selRes.flag] }}>
                    {FLAG_LABEL[selRes.flag]}
                  </span>
                </div>
                <div className="pm-result-valor" style={{ color: FLAG_COLOR[selRes.flag] }}>
                  {selRes.valor ?? '—'}
                  {selRes.unidade && <span className="pm-result-unit"> {selRes.unidade}</span>}
                </div>
                {(selRes.refMin !== undefined || selRes.refMax !== undefined) && (
                  <div className="pm-result-ref">
                    Ref: {selRes.refMin ?? '–'} – {selRes.refMax ?? '–'} {selRes.unidade}
                  </div>
                )}
              </div>

              {/* info */}
              <div className="pm-val-info-grid">
                <DField l="Utente"     v={selRes.utenteNome} />
                <DField l="Amostra"    v={selRes.codigoAmostra} />
                <DField l="Requisição" v={selRes.requisicaoNumero} />
                <DField l="Código"     v={selRes.codigoResultado} />
                <DField l="Data"       v={fmt(selRes.createdAt)} />
                {selRes.observacoes && <DField l="Obs. técnico" v={selRes.observacoes} />}
              </div>

              {/* histórico validação técnica */}
              {selRes.validacaoTecnica && (
                <div className="pm-val-hist pm-val-hist--tec">
                  <div className="pm-val-hist-lbl">✓ Validação técnica</div>
                  <div className="pm-val-hist-who">{selRes.validacaoTecnica.nome}</div>
                  <div className="pm-val-hist-when">{fmtH(selRes.validacaoTecnica.dataHora)}</div>
                  {selRes.validacaoTecnica.observacoes && (
                    <div className="pm-val-hist-obs">"{selRes.validacaoTecnica.observacoes}"</div>
                  )}
                </div>
              )}

              {/* sucesso */}
              {valSuccess && (
                <motion.div className="pm-success" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
                  ✓ {valSuccess}
                </motion.div>
              )}

              {panelErr && <div className="pm-form-err">{panelErr}</div>}

              {/* acção: validar médico */}
              {panel === 'validar' && selRes.estado === 'validado_tecnico' && !valSuccess && (
                <div className="pm-val-action">
                  <div className="pm-val-action-title">Validação Médica</div>
                  <div className="pm-ff">
                    <label className="pm-ff-lbl">Observações clínicas (opcional)</label>
                    <textarea className="pm-input pm-textarea" rows={3}
                      value={fObs} onChange={e => setFObs(e.target.value)}
                      placeholder="Contexto clínico, interpretação do resultado, recomendações…" />
                  </div>
                  <label className="pm-emit-wrap">
                    <input type="checkbox" checked={fEmitir} onChange={e => setFEmitir(e.target.checked)} />
                    <span>Emitir relatório automaticamente ao utente</span>
                  </label>
                  <button className="pm-btn-validar" disabled={saving} onClick={handleValidarMedico}>
                    {saving ? 'a validar…' : `✓ Assinar e Validar — ${user?.nome}`}
                  </button>
                </div>
              )}

              {/* acção: emitir relatório */}
              {(panel === 'relatorio' || (selRes.estado === 'validado_medico' && !selRes.relatorioEmitido)) && !valSuccess && (
                <div className="pm-val-action">
                  <button className="pm-btn-relatorio" disabled={saving} onClick={handleEmitirRelatorio}>
                    {saving ? 'a emitir…' : '↓ Emitir relatório em PDF'}
                  </button>
                </div>
              )}

              {selRes.relatorioEmitido && (
                <div className="pm-val-action">
                  <div className="pm-val-hist pm-val-hist--rel">
                    <div className="pm-val-hist-lbl">✓ Relatório emitido</div>
                    {selRes.relatorioDataHora && <div className="pm-val-hist-when">{fmtH(selRes.relatorioDataHora)}</div>}
                  </div>
                  <button className="pm-btn-outline" onClick={() => printRelatorio(selRes)}>↓ reimprimir relatório</button>
                </div>
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

    </div>
  )
}

function DField({ l, v }: { l: string; v: string }) {
  return (
    <div className="pm-dfield">
      <div className="pm-dfield-l">{l}</div>
      <div className="pm-dfield-v">{v}</div>
    </div>
  )
}

function Pag({ page, pages, onPrev, onNext }: { page: number; pages: number; onPrev: ()=>void; onNext: ()=>void }) {
  return (
    <div className="pm-pag">
      <button className="pm-pag-btn" disabled={page<=1} onClick={onPrev}>‹</button>
      <span className="pm-pag-info">{page} / {pages}</span>
      <button className="pm-pag-btn" disabled={page>=pages} onClick={onNext}>›</button>
    </div>
  )
}
