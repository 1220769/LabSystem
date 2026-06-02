import HeaderComponent from '../header/header.component'
import './adminmain.component.css'

export default function AdminmainComponent() {
  return (
    <HeaderComponent
      titulo="Dashboard"
      subtitulo="Area privada do LabSystem Pro."
    >
      <section className="dashboard-empty">
        <h2>Dashboard</h2>
      </section>
    </HeaderComponent>
  )
}
