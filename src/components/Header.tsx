import { Link, NavLink, useLocation } from 'react-router-dom'
import { SparkIcon } from './Icons'

export default function Header() {
  const { pathname } = useLocation()
  const inEditor = pathname.startsWith('/crea')

  return (
    <header className="header">
      <Link to="/" className="logo" aria-label="Sagoma, torna alla home">
        <span className="logo-mark" aria-hidden>
          <SparkIcon size={17} />
        </span>
        Sagoma
      </Link>
      <nav>
        <NavLink to="/" className={({ isActive }) => (isActive ? 'active' : '')} end>
          Home
        </NavLink>
        <NavLink to="/crea" className={({ isActive }) => (isActive ? 'active' : '')}>
          Crea mockup
        </NavLink>
      </nav>
      <div className="spacer" />
      {!inEditor && (
        <Link to="/crea" className="btn btn-primary btn-sm">
          Inizia ora
        </Link>
      )}
    </header>
  )
}
