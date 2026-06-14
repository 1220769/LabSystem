import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

/* ══════════════════════════════════════════════════════════
   Geração de relatórios em PDF — LabSystem
   Faz DOWNLOAD real do ficheiro (vai para as Transferências)
   via doc.save(...). Usado pelo portal do Médico e do Utente.
   ══════════════════════════════════════════════════════════ */

const INK    = '#1A1208'
const MUTED  = '#8A857C'
const LINE   = '#E2DDD3'
const CREAM  = '#F8F5EF'

const FLAG_HEX: Record<string, string> = {
  normal: '#2E7A50', alto: '#C87830', baixo: '#3A7AB0',
  critico_alto: '#C8001A', critico_baixo: '#C8001A', pendente: '#8A857C',
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}
function setColor(doc: jsPDF, hex: string) { const [r, g, b] = hexToRgb(hex); doc.setTextColor(r, g, b) }
function setFill(doc: jsPDF, hex: string)  { const [r, g, b] = hexToRgb(hex); doc.setFillColor(r, g, b) }
function setDraw(doc: jsPDF, hex: string)  { const [r, g, b] = hexToRgb(hex); doc.setDrawColor(r, g, b) }

/* limpa o nome de ficheiro */
function slug(s: string) {
  return (s || 'relatorio').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 60)
}

/* ── cabeçalho comum ── */
function cabecalho(doc: jsPDF, subtitulo: string): number {
  const M = 20
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); setColor(doc, INK)
  doc.text('LabSystem', M, 22)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); setColor(doc, MUTED)
  doc.text(subtitulo.toUpperCase(), M, 28)
  setDraw(doc, LINE); doc.setLineWidth(0.3); doc.line(M, 32, 190, 32)
  return 40 // y inicial do conteúdo
}

function rodape(doc: jsPDF, texto: string) {
  const M = 20
  const y = 282
  setDraw(doc, LINE); doc.setLineWidth(0.3); doc.line(M, y - 5, 190, y - 5)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); setColor(doc, MUTED)
  doc.text(texto, M, y)
}

export interface ResultadoPDF {
  codigoResultado: string
  analiseNome: string
  analiseCodigo?: string
  valor?: string | number | null
  unidade?: string
  flag: string
  flagLabel?: string
  refMin?: number
  refMax?: number
  observacoes?: string
  utenteNome?: string
  meta?: string                 // ex: "REQ-2026-0001 · AM-0001 · 12/06/2026"
  subtitulo?: string            // ex: "Resultado Clínico · Validado Medicamente"
  validacoes?: { label: string; nome: string; quando: string; obs?: string }[]
}

/* ════════ relatório de UM resultado ════════ */
export function downloadResultadoPDF(r: ResultadoPDF) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const M = 20
  let y = cabecalho(doc, r.subtitulo ?? 'Resultado Clínico')
  const fcHex = FLAG_HEX[r.flag] ?? INK

  // utente
  if (r.utenteNome) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); setColor(doc, MUTED)
    doc.text('UTENTE', M, y); y += 6
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15); setColor(doc, INK)
    doc.text(r.utenteNome, M, y); y += 6
    if (r.meta) { doc.setFont('helvetica', 'normal'); doc.setFontSize(9); setColor(doc, MUTED); doc.text(r.meta, M, y); y += 6 }
    setDraw(doc, LINE); doc.line(M, y, 190, y); y += 8
  }

  // resultado
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); setColor(doc, MUTED)
  doc.text('RESULTADO', M, y); y += 5

  // caixa
  const boxY = y, boxH = 34
  setFill(doc, CREAM); doc.roundedRect(M, boxY, 170, boxH, 2, 2, 'F')
  let yb = boxY + 9
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); setColor(doc, INK)
  doc.text(`${r.analiseNome}${r.analiseCodigo ? `   ${r.analiseCodigo}` : ''}`, M + 8, yb)
  yb += 12
  if (r.valor !== undefined && r.valor !== null && r.valor !== '') {
    doc.setFont('helvetica', 'bolditalic'); doc.setFontSize(26); setColor(doc, fcHex)
    const valTxt = `${r.valor}`
    doc.text(valTxt, M + 8, yb)
    const vw = doc.getTextWidth(valTxt)
    if (r.unidade) { doc.setFont('helvetica', 'normal'); doc.setFontSize(12); setColor(doc, MUTED); doc.text(r.unidade, M + 8 + vw + 3, yb) }
    // flag pill
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); setColor(doc, fcHex)
    doc.text((r.flagLabel ?? r.flag.replace(/_/g, ' ')).toUpperCase(), M + 70, yb - 2)
  } else {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(11); setColor(doc, MUTED)
    doc.text('Sem valor registado', M + 8, yb)
  }
  y = boxY + boxH + 7

  if (r.refMin !== undefined || r.refMax !== undefined) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); setColor(doc, MUTED)
    doc.text(`Referência: ${r.refMin ?? '–'} – ${r.refMax ?? '–'} ${r.unidade ?? ''}`, M, y); y += 7
  }
  if (r.observacoes) {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(10); setColor(doc, MUTED)
    const lines = doc.splitTextToSize(r.observacoes, 170)
    doc.text(lines, M, y); y += lines.length * 5 + 3
  }

  // validações
  if (r.validacoes?.length) {
    setDraw(doc, LINE); doc.line(M, y, 190, y); y += 7
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); setColor(doc, MUTED)
    doc.text('VALIDAÇÕES', M, y); y += 6
    for (const v of r.validacoes) {
      setDraw(doc, LINE); doc.setLineWidth(1); doc.line(M, y - 3.5, M, y + 4)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); setColor(doc, MUTED)
      doc.text(v.label.toUpperCase(), M + 4, y)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); setColor(doc, INK)
      doc.text(v.nome, M + 4, y + 5)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); setColor(doc, MUTED)
      doc.text(v.quando, M + 4, y + 9.5)
      y += 14
      if (v.obs) { doc.setFont('helvetica', 'italic'); doc.setFontSize(9); setColor(doc, MUTED); const l = doc.splitTextToSize(v.obs, 165); doc.text(l, M + 4, y); y += l.length * 4 + 3 }
    }
  }

  rodape(doc, `${r.codigoResultado} · Emitido ${new Date().toLocaleString('pt-PT')} · LabSystem`)
  doc.save(`Resultado_${slug(r.codigoResultado)}.pdf`)
}

/* ════════ relatório COMPLETO de uma requisição (tabela) ════════ */
export function downloadRelatorioPDF(opts: {
  subtitulo: string
  utenteNome: string
  metaLinha: string
  colunas: string[]
  linhas: (string | number)[][]
  corFlagPorLinha?: string[]    // hex por linha, para colorir a coluna do resultado
  ficheiro: string
}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const M = 20
  let y = cabecalho(doc, opts.subtitulo)

  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); setColor(doc, INK)
  doc.text(opts.utenteNome, M, y); y += 6
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); setColor(doc, MUTED)
  doc.text(opts.metaLinha, M, y); y += 4

  autoTable(doc, {
    startY: y + 3,
    head: [opts.colunas],
    body: opts.linhas.map(l => l.map(c => String(c))),
    margin: { left: M, right: M },
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 2.5, textColor: hexToRgb(INK), lineColor: hexToRgb(LINE), lineWidth: 0.1 },
    headStyles: { fillColor: hexToRgb(CREAM), textColor: hexToRgb(MUTED), fontSize: 8, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [252, 251, 248] },
  })

  rodape(doc, `Relatório gerado em ${new Date().toLocaleString('pt-PT')} · LabSystem`)
  doc.save(opts.ficheiro)
}

export { FLAG_HEX }
