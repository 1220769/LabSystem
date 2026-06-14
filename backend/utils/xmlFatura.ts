import fs from 'fs'
import path from 'path'
import { XMLParser } from 'fast-xml-parser'
import type { IFatura } from '../models/fatura.model'

/* ──────────────────────────────────────────────────────────────
   Utilitários XML/XSD para FATURAS
   · buildFaturasXml   — gera o XML de exportação (conforme fatura.xsd)
   · validateFaturasXml — valida um XML contra o fatura.xsd (xmllint)
   · parseFaturasXml   — lê o XML já validado para objetos
   ────────────────────────────────────────────────────────────── */

// import dinâmico de módulo ESM (xmllint-wasm) a partir de CommonJS,
// sem ser reescrito para require() pelo compilador
const importESM = new Function('m', 'return import(m)') as (m: string) => Promise<any>

// localizar o fatura.xsd (funciona em dev via ts-node-dev)
function loadXsd(): string {
  const candidatos = [
    path.resolve(__dirname, '../xsd/fatura.xsd'),
    path.resolve(process.cwd(), 'xsd/fatura.xsd'),
    path.resolve(process.cwd(), 'backend/xsd/fatura.xsd'),
  ]
  for (const p of candidatos) {
    if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8')
  }
  throw new Error('fatura.xsd não encontrado')
}

/* ─── exportação ─── */
function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}
function d2(n: unknown): string { return (Number(n) || 0).toFixed(2) }
function dateOnly(d?: Date | string | null): string {
  return new Date(d ?? Date.now()).toISOString().slice(0, 10)
}

export function buildFaturasXml(faturas: IFatura[]): string {
  const now = new Date()
  const periodo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const corpo = faturas.map(f => {
    // ordem dos elementos TEM de respeitar a sequence do XSD
    const linhas = [
      `      <numeroFatura>${esc(f.numeroFatura)}</numeroFatura>`,
      `      <dataEmissao>${dateOnly(f.dataEmissao ?? f.createdAt)}</dataEmissao>`,
      `      <utenteNome>${esc(f.utenteNome)}</utenteNome>`,
      `      <tipo>${esc(f.tipo)}</tipo>`,
    ]
    if (f.seguradora) linhas.push(`      <seguradora>${esc(f.seguradora)}</seguradora>`)
    linhas.push(`      <valorBruto>${d2(f.valorBruto)}</valorBruto>`)
    if (f.percentComparticipacao && f.percentComparticipacao > 0)
      linhas.push(`      <percentComparticipacao>${d2(f.percentComparticipacao)}</percentComparticipacao>`)
    linhas.push(`      <valorLiquido>${d2(f.valorLiquido)}</valorLiquido>`)
    linhas.push(`      <estado>${esc(f.estado)}</estado>`)
    return `    <fatura>\n${linhas.join('\n')}\n    </fatura>`
  }).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>\n<faturas periodo="${periodo}">\n${corpo}\n</faturas>\n`
}

/* ─── validação contra o XSD ─── */
export interface XsdError { message: string; line?: number }

export async function validateFaturasXml(xml: string): Promise<{ valid: boolean; errors: XsdError[] }> {
  const { validateXML } = await importESM('xmllint-wasm')
  const r = await validateXML({
    xml: [{ fileName: 'faturas.xml', contents: xml }],
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
export interface FaturaXmlItem {
  numeroFatura: string
  dataEmissao: string
  utenteNome: string
  tipo: string
  seguradora?: string
  valorBruto: number
  percentComparticipacao?: number
  valorLiquido: number
  estado: string
}

export function parseFaturasXml(xml: string): FaturaXmlItem[] {
  const parser = new XMLParser({ ignoreAttributes: true, parseTagValue: false, trimValues: true })
  const doc = parser.parse(xml)
  const root = doc?.faturas
  if (!root || root.fatura == null) return []
  const arr = Array.isArray(root.fatura) ? root.fatura : [root.fatura]
  return arr.map((f: any) => ({
    numeroFatura:           String(f.numeroFatura),
    dataEmissao:            String(f.dataEmissao),
    utenteNome:             String(f.utenteNome ?? ''),
    tipo:                   String(f.tipo),
    seguradora:             f.seguradora != null ? String(f.seguradora) : undefined,
    valorBruto:             Number(f.valorBruto),
    percentComparticipacao: f.percentComparticipacao != null ? Number(f.percentComparticipacao) : undefined,
    valorLiquido:           Number(f.valorLiquido),
    estado:                 String(f.estado),
  }))
}
