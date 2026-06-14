import fs from 'fs'
import path from 'path'
import { XMLParser } from 'fast-xml-parser'
import type { IRequisicao } from '../models/requisicao.model'

/* ──────────────────────────────────────────────────────────────
   Utilitários XML/XSD para REQUISIÇÕES
   · buildRequisicoesXml    — gera o XML de exportação (conforme requisicao.xsd)
   · validateRequisicoesXml — valida um XML contra o requisicao.xsd (xmllint)
   · parseRequisicoesXml    — lê o XML já validado para objetos
   ────────────────────────────────────────────────────────────── */

// import dinâmico de módulo ESM (xmllint-wasm) a partir de CommonJS,
// sem ser reescrito para require() pelo compilador
const importESM = new Function('m', 'return import(m)') as (m: string) => Promise<any>

// localizar o requisicao.xsd (funciona em dev via ts-node-dev)
function loadXsd(): string {
  const candidatos = [
    path.resolve(__dirname, '../xsd/requisicao.xsd'),
    path.resolve(process.cwd(), 'xsd/requisicao.xsd'),
    path.resolve(process.cwd(), 'backend/xsd/requisicao.xsd'),
  ]
  for (const p of candidatos) {
    if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8')
  }
  throw new Error('requisicao.xsd não encontrado')
}

/* ─── exportação ─── */
function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}
function dateTime(d?: Date | string | null): string {
  return new Date(d ?? Date.now()).toISOString()
}

export function buildRequisicoesXml(requisicoes: IRequisicao[]): string {
  const corpo = requisicoes.map(r => {
    // ordem dos elementos TEM de respeitar a sequence do XSD
    const linhas = [
      `      <numeroRequisicao>${esc(r.numeroRequisicao)}</numeroRequisicao>`,
      `      <dataEmissao>${dateTime(r.createdAt)}</dataEmissao>`,
      `      <urgente>${r.urgente ? 'true' : 'false'}</urgente>`,
      `      <estado>${esc(r.estado)}</estado>`,
      `      <utente>`,
      `        <numeroProcesso>${esc(r.utenteProcesso)}</numeroProcesso>`,
      `        <nome>${esc(r.utenteNome)}</nome>`,
      `      </utente>`,
    ]
    if (r.medicoSolicitante) linhas.push(`      <medico>${esc(r.medicoSolicitante)}</medico>`)
    const analises = (r.analises ?? []).map(a =>
      `        <analise>\n          <codigo>${esc(a.codigo)}</codigo>\n          <nome>${esc(a.nome)}</nome>\n        </analise>`
    ).join('\n')
    linhas.push(`      <analises>\n${analises}\n      </analises>`)
    if (r.observacoes) linhas.push(`      <observacoes>${esc(r.observacoes)}</observacoes>`)
    return `    <requisicao>\n${linhas.join('\n')}\n    </requisicao>`
  }).join('\n')

  const exportadoEm = new Date().toISOString()
  return `<?xml version="1.0" encoding="UTF-8"?>\n<requisicoes exportadoEm="${exportadoEm}">\n${corpo}\n</requisicoes>\n`
}

/* ─── validação contra o XSD ─── */
export interface XsdError { message: string; line?: number }

export async function validateRequisicoesXml(xml: string): Promise<{ valid: boolean; errors: XsdError[] }> {
  const { validateXML } = await importESM('xmllint-wasm')
  const r = await validateXML({
    xml: [{ fileName: 'requisicoes.xml', contents: xml }],
    schema: [loadXsd()],
  })
  if (r.valid) return { valid: true, errors: [] }
  const errors: XsdError[] = (r.errors || []).map((e: any) => ({
    message: String(e.message || e.rawMessage || e).replace(/^Schemas validity error\s*:\s*/i, ''),
    line: e.loc?.lineNumber,
  }))
  return { valid: false, errors }
}

/* ─── leitura do XML ─── */
export interface RequisicaoXmlItem {
  numeroRequisicao: string
  estado: string
  urgente: boolean
  medico?: string
  observacoes?: string
}

export function parseRequisicoesXml(xml: string): RequisicaoXmlItem[] {
  const parser = new XMLParser({ ignoreAttributes: true, parseTagValue: false, trimValues: true })
  const doc = parser.parse(xml)
  const root = doc?.requisicoes
  if (!root || root.requisicao == null) return []
  const arr = Array.isArray(root.requisicao) ? root.requisicao : [root.requisicao]
  return arr.map((r: any) => ({
    numeroRequisicao: String(r.numeroRequisicao),
    estado:           String(r.estado),
    urgente:          String(r.urgente) === 'true',
    medico:           r.medico != null ? String(r.medico) : undefined,
    observacoes:      r.observacoes != null ? String(r.observacoes) : undefined,
  }))
}
