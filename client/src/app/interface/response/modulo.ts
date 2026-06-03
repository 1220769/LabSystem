export type Perfil =
  | 'administrador'
  | 'tecnico'
  | 'medico'
  | 'enfermeiro'
  | 'financeiro'
  | 'utente'

export interface Modulo {
  id: string
  rota: string
  titulo: string
  area: string
  descricao: string
  estado: 'activo' | 'planeado' | 'restrito'
  perfis: Perfil[]
}

export interface PaginaPrivada {
  id: string
  rota: string
  titulo: string
  area: string
  descricao: string
  perfis: Perfil[]
}

export const nomesPerfis: Record<Perfil, string> = {
  administrador: 'Administrador',
  tecnico: 'Tecnico',
  medico: 'Medico',
  enfermeiro: 'Enfermeiro',
  financeiro: 'Financeiro',
  utente: 'Utente',
}

export const modulos: Modulo[] = [
  {
    id: 'perfis',
    rota: '/private/perfis',
    titulo: 'Autenticacao & Perfis',
    area: 'Acessos',
    descricao: 'Login, contas internas e perfis de acesso ao sistema.',
    estado: 'activo',
    perfis: ['administrador'],
  },
  {
    id: 'utentes',
    rota: '/private/utentes',
    titulo: 'Utentes & Agendamento',
    area: 'Recepcao clinica',
    descricao: 'Ficha clinica, portal do utente, agendamento de colheitas e notificacoes.',
    estado: 'activo',
    perfis: ['administrador', 'tecnico', 'medico', 'enfermeiro', 'utente'],
  },
  {
    id: 'requisicoes',
    rota: '/private/requisicoes',
    titulo: 'Requisicoes',
    area: 'Pedidos analiticos',
    descricao: 'Criacao de pedidos, perfis predefinidos, urgencias e prescricoes electronicas.',
    estado: 'planeado',
    perfis: ['administrador', 'tecnico', 'medico', 'enfermeiro', 'utente'],
  },
  {
    id: 'colheita',
    rota: '/private/colheita',
    titulo: 'Colheita & Amostras',
    area: 'Operacao',
    descricao: 'Etiquetas QR, guia de tubos, rastreamento e recolhas domiciliarias.',
    estado: 'activo',
    perfis: ['administrador', 'tecnico', 'enfermeiro'],
  },
  {
    id: 'analise',
    rota: '/private/analise',
    titulo: 'Processamento Analitico',
    area: 'Laboratorio',
    descricao: 'Worklists, importacao de resultados e calculos derivados por area tecnica.',
    estado: 'planeado',
    perfis: ['administrador', 'tecnico', 'medico'],
  },
  {
    id: 'qualidade',
    rota: '/private/qualidade',
    titulo: 'Controlo de Qualidade',
    area: 'Conformidade',
    descricao: 'Calibracoes, qualidade interna e conformidade ISO.',
    estado: 'planeado',
    perfis: ['administrador', 'tecnico'],
  },
  {
    id: 'validacao',
    rota: '/private/validacao',
    titulo: 'Validacao & Relatorios',
    area: 'Medico',
    descricao: 'Validacao tecnica e medica, alertas criticos, assinatura digital e envio.',
    estado: 'planeado',
    perfis: ['administrador', 'tecnico', 'medico', 'utente'],
  },
  {
    id: 'financeiro',
    rota: '/private/financeiro',
    titulo: 'Financeiro & Faturacao',
    area: 'Backoffice',
    descricao: 'Facturacao electronica, SNS, seguradoras, pagamentos e integracao SAP.',
    estado: 'restrito',
    perfis: ['administrador', 'financeiro', 'utente'],
  },
  {
    id: 'equipamentos',
    rota: '/private/equipamentos',
    titulo: 'Equipamentos & Stock',
    area: 'Inventario',
    descricao: 'Manutencao, reagentes por lote, stock minimo e encomendas automaticas.',
    estado: 'planeado',
    perfis: ['administrador', 'tecnico'],
  },
  {
    id: 'analytics',
    rota: '/private/analytics',
    titulo: 'Analytics & BI',
    area: 'Gestao',
    descricao: 'KPIs de qualidade e produtividade, relatorios agendados e exportacao.',
    estado: 'planeado',
    perfis: ['administrador', 'tecnico', 'medico'],
  },
  {
    id: 'integracoes',
    rota: '/private/integracoes',
    titulo: 'Integracoes',
    area: 'Sistemas externos',
    descricao: 'Prescricao electronica nacional, API REST documentada e webhooks.',
    estado: 'planeado',
    perfis: ['administrador', 'tecnico'],
  },
  {
    id: 'seguranca',
    rota: '/private/seguranca',
    titulo: 'Seguranca & Auditoria',
    area: 'Sistema',
    descricao: 'Logs de auditoria, RGPD, backups, integracoes REST e webhooks.',
    estado: 'restrito',
    perfis: ['administrador'],
  },
]

export function modulosPorPerfil(perfil?: string) {
  return modulos.filter((modulo) => modulo.perfis.includes(perfil as Perfil))
}

export function moduloPorId(id?: string) {
  return modulos.find((modulo) => modulo.id === id)
}

export const paginasPrivadas: PaginaPrivada[] = [
  {
    id: 'admin-utilizadores',
    rota: '/private/admin/utilizadores',
    titulo: 'Utilizadores',
    area: 'Administrador',
    descricao: 'Criacao, edicao e gestao dos perfis de acesso.',
    perfis: ['administrador'],
  },
  {
    id: 'admin-perfis',
    rota: '/private/admin/perfis',
    titulo: 'Perfis & Permissoes',
    area: 'Administrador',
    descricao: 'Permissoes para administrador, tecnico, medico, enfermeiro e utente.',
    perfis: ['administrador'],
  },
  {
    id: 'admin-auditoria',
    rota: '/private/admin/auditoria',
    titulo: 'Seguranca & Auditoria',
    area: 'Administrador',
    descricao: 'Logs de auditoria, RGPD, backups e disaster recovery.',
    perfis: ['administrador'],
  },
  {
    id: 'admin-integracoes',
    rota: '/private/admin/integracoes',
    titulo: 'Integracoes',
    area: 'Administrador',
    descricao: 'API REST, webhooks e prescricao electronica nacional.',
    perfis: ['administrador'],
  },
  {
    id: 'admin-financeiro',
    rota: '/private/admin/financeiro',
    titulo: 'Financeiro & Faturacao',
    area: 'Administrador',
    descricao: 'Facturacao electronica, SNS, seguradoras e pagamentos.',
    perfis: ['administrador'],
  },
  {
    id: 'admin-sap',
    rota: '/private/admin/sap',
    titulo: 'Integracao SAP',
    area: 'Administrador',
    descricao: 'Integracao contabilistica e exportacao financeira.',
    perfis: ['administrador'],
  },
  {
    id: 'admin-analytics',
    rota: '/private/admin/analytics',
    titulo: 'Analytics & BI',
    area: 'Administrador',
    descricao: 'Dashboard executivo, KPIs e relatorios agendados.',
    perfis: ['administrador'],
  },
  {
    id: 'tecnico-requisicoes',
    rota: '/private/tecnico/requisicoes',
    titulo: 'Requisicoes',
    area: 'Tecnico',
    descricao: 'Pedidos analiticos, perfis predefinidos e urgencias.',
    perfis: ['tecnico'],
  },
  {
    id: 'tecnico-colheita',
    rota: '/private/tecnico/colheita',
    titulo: 'Colheita & Amostras',
    area: 'Tecnico',
    descricao: 'Etiquetas QR, guia de tubos e rastreamento em tempo real.',
    perfis: ['tecnico'],
  },
  {
    id: 'tecnico-analise',
    rota: '/private/tecnico/analise',
    titulo: 'Processamento Analitico',
    area: 'Tecnico',
    descricao: 'Worklist, importacao de resultados e calculos derivados.',
    perfis: ['tecnico'],
  },
  {
    id: 'tecnico-qualidade',
    rota: '/private/tecnico/qualidade',
    titulo: 'Controlo de Qualidade',
    area: 'Tecnico',
    descricao: 'Calibracoes, qualidade interna e conformidade ISO.',
    perfis: ['tecnico'],
  },
  {
    id: 'tecnico-equipamentos',
    rota: '/private/tecnico/equipamentos',
    titulo: 'Equipamentos & Stock',
    area: 'Tecnico',
    descricao: 'Manutencao, reagentes por lote, stock minimo e encomendas.',
    perfis: ['tecnico'],
  },
  {
    id: 'medico-utentes',
    rota: '/private/medico/utentes',
    titulo: 'Utentes',
    area: 'Medico',
    descricao: 'Consulta de ficha clinica e historico do utente.',
    perfis: ['medico'],
  },
  {
    id: 'medico-requisicoes',
    rota: '/private/medico/requisicoes',
    titulo: 'Requisicoes',
    area: 'Medico',
    descricao: 'Criacao de pedidos analiticos e prescricoes electronicas.',
    perfis: ['medico'],
  },
  {
    id: 'medico-validacao',
    rota: '/private/medico/validacao',
    titulo: 'Validacao Medica',
    area: 'Medico',
    descricao: 'Validacao medica, alertas de valores criticos e assinatura digital.',
    perfis: ['medico'],
  },
  {
    id: 'medico-relatorios',
    rota: '/private/medico/relatorios',
    titulo: 'Relatorios',
    area: 'Medico',
    descricao: 'Emissao e consulta de relatorios clinicos.',
    perfis: ['medico'],
  },
  {
    id: 'medico-analytics',
    rota: '/private/medico/analytics',
    titulo: 'Analytics Clinico',
    area: 'Medico',
    descricao: 'Indicadores clinicos e produtividade.',
    perfis: ['medico'],
  },
  {
    id: 'enfermeiro-utentes',
    rota: '/private/enfermeiro/utentes',
    titulo: 'Utentes',
    area: 'Enfermeiro',
    descricao: 'Consulta de utentes e apoio ao agendamento.',
    perfis: ['enfermeiro'],
  },
  {
    id: 'enfermeiro-agendamento',
    rota: '/private/enfermeiro/agendamento',
    titulo: 'Agendamento',
    area: 'Enfermeiro',
    descricao: 'Agendamento de colheitas e organizacao da agenda.',
    perfis: ['enfermeiro'],
  },
  {
    id: 'enfermeiro-colheita',
    rota: '/private/enfermeiro/colheita',
    titulo: 'Colheita',
    area: 'Enfermeiro',
    descricao: 'Colheitas, recolhas domiciliarias e rastreamento de amostras.',
    perfis: ['enfermeiro'],
  },
  {
    id: 'enfermeiro-amostras',
    rota: '/private/enfermeiro/amostras',
    titulo: 'Amostras',
    area: 'Enfermeiro',
    descricao: 'Etiquetagem por codigo de barras/QR e controlo de temperatura.',
    perfis: ['enfermeiro'],
  },
  {
    id: 'financeiro-faturas',
    rota: '/private/financeiro/faturas',
    titulo: 'Faturas & Faturacao',
    area: 'Financeiro',
    descricao: 'Gestao de faturas, emissao, cobranças e controlo de pagamentos.',
    perfis: ['financeiro'],
  },
  {
    id: 'utente-portal',
    rota: '/private/utente/portal',
    titulo: 'Portal do Utente',
    area: 'Utente',
    descricao: 'Area pessoal para consulta dos dados do utente.',
    perfis: ['utente'],
  },
  {
    id: 'utente-agendamento',
    rota: '/private/utente/agendamento',
    titulo: 'Agendamentos',
    area: 'Utente',
    descricao: 'Marcacao e consulta de colheitas.',
    perfis: ['utente'],
  },
  {
    id: 'utente-resultados',
    rota: '/private/utente/resultados',
    titulo: 'Resultados',
    area: 'Utente',
    descricao: 'Consulta de resultados online e relatorios.',
    perfis: ['utente'],
  },
  {
    id: 'utente-notificacoes',
    rota: '/private/utente/notificacoes',
    titulo: 'Notificacoes',
    area: 'Utente',
    descricao: 'Alertas por SMS/e-mail e mensagens do laboratorio.',
    perfis: ['utente'],
  },
  {
    id: 'utente-pagamentos',
    rota: '/private/utente/pagamentos',
    titulo: 'Pagamentos',
    area: 'Utente',
    descricao: 'Consulta de facturas, pagamentos e comparticipacoes.',
    perfis: ['utente'],
  },
]

export function paginasPorPerfil(perfil?: string) {
  return paginasPrivadas.filter((pagina) => pagina.perfis.includes(perfil as Perfil))
}
