import fs from 'fs'
import path from 'path'
import { XMLParser } from 'fast-xml-parser'
import type { IResultado } from '../models/resultado.model'

/* ──────────────────────────────────────────────────────────────
   Utilitários XML/XSD para RESULTADOS
   · buildResultadosXml    — gera o XML de exportação (conforme resultado.xsd)
   · validateResultadosXml — valida um XML contra o resultado.xsd (xmllint)
   · parseResultadosXml    — lê o XML já validado para objetos
   ────────────────────────────────────────────────────────────── */

// import dinâmico de módulo ESM (xmllint-wasm) a partir de CommonJS,
// sem ser reescrito para require() pelo compilador
const importESM = new Function('m', 'return import(m)') as (m: string) => Promise<any>

// localizar o resultado.xsd (funciona em dev via ts-node-dev)
function loadXsd(): string {
  const candidatos = [
    path.resolve(__dirname, '../xsd/resultado.xsd'),
    path.resolve(process.cwd(), 'xsd/resultado.xsd'),
    path.resolve(process.cwd(), 'backend/xsd/resultado.xsd'),
  ]
  for (const p of candidatos) {
    if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8')
  }
  throw new Error('resultado.xsd não encontrado')
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

export function buildResultadosXml(resultados: IResultado[]): string {
  const corpo = resultados.map(r => {
    const dataVal = r.validacaoMedica?.dataHora ?? r.validacaoTecnica?.dataHora
    // ordem dos elementos TEM de respeitar a sequence do XSD
    const linhas = [
      `      <codigoResultado>${esc(r.codigoResultado)}</codigoResultado>`,
      `      <requisicaoNumero>${esc(r.requisicaoNumero)}</requisicaoNumero>`,
      `      <amostraCodigo>${esc(r.codigoAmostra)}</amostraCodigo>`,
      `      <utenteNome>${esc(r.utenteNome)}</utenteNome>`,
      `      <analiseCodigo>${esc(r.analise?.codigo)}</analiseCodigo>`,
      `      <analiseNome>${esc(r.analise?.nome)}</analiseNome>`,
    ]
    if (r.valor != null && r.valor !== '') linhas.push(`      <valor>${esc(r.valor)}</valor>`)
    if (r.unidade) linhas.push(`      <unidade>${esc(r.unidade)}</unidade>`)
    linhas.push(`      <flag>${esc(r.flag)}</flag>`)
    linhas.push(`      <estado>${esc(r.estado)}</estado>`)
    if (dataVal) linhas.push(`      <dataValidacao>${dateTime(dataVal)}</dataValidacao>`)
    if (r.observacoes) linhas.push(`      <observacoes>${esc(r.observacoes)}</observacoes>`)
    return `    <resultado>\n${linhas.join('\n')}\n    </resultado>`
  }).join('\n')

  const exportadoEm = new Date().toISOString()
  return `<?xml version="1.0" encoding="UTF-8"?>\n<resultados exportadoEm="${exportadoEm}">\n${corpo}\n</resultados>\n`
}

/* ─── validação contra o XSD ─── */
export interface XsdError { message: string; line?: number }

export async function validateResultadosXml(xml: string): Promise<{ valid: boolean; errors: XsdError[] }> {
  const { validateXML } = await importESM('xmllint-wasm')
  const r = await validateXML({
    xml: [{ fileName: 'resultados.xml', contents: xml }],
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
export interface ResultadoXmlItem {
  codigoResultado: string
  valor?: string
  unidade?: string
  flag: string
  estado: string
  observacoes?: string
}

export function parseResultadosXml(xml: string): ResultadoXmlItem[] {
  const parser = new XMLParser({ ignoreAttributes: true, parseTagValue: false, trimValues: true })
  const doc = parser.parse(xml)
  const root = doc?.resultados
  if (!root || root.resultado == null) return []
  const arr = Array.isArray(root.resultado) ? root.resultado : [root.resultado]
  return arr.map((r: any) => ({
    codigoResultado: String(r.codigoResultado),
    valor:           r.valor != null ? String(r.valor) : undefined,
    unidade:         r.unidade != null ? String(r.unidade) : undefined,
    flag:            String(r.flag),
    estado:          String(r.estado),
    observacoes:     r.observacoes != null ? String(r.observacoes) : undefined,
  }))
}
