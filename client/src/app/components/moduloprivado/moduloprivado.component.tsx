import HeaderComponent from '../header/header.component'
import type { Modulo, PaginaPrivada } from '../../interface/response/modulo'
import './moduloprivado.component.css'

interface ModuloprivadoComponentProps {
  modulo: Modulo | PaginaPrivada
}

export default function ModuloprivadoComponent({ modulo }: ModuloprivadoComponentProps) {
  return (
    <HeaderComponent titulo={modulo.titulo} subtitulo={modulo.descricao}>
      <section className="private-placeholder">
        <span>{modulo.area}</span>
        <h2>{modulo.titulo}</h2>
      </section>
    </HeaderComponent>
  )
}
