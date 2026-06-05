/** Escapa caracteres especiais de regex para evitar injecção via campos de pesquisa */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
