import { Link } from 'react-router-dom';
import './Navbar.css';

export default function Navbar() {
  return (
    <header className="bh-header">
        <div className="bh-container bh-header__inner">
        <Link to="/" title="Home">
            <div className="bh-logo">
            Bid<span>House</span>
            </div>
        </Link>
          
          <nav className="bh-nav">
            
            {/* Cambiamos las <a> por <Link> y los 'href' por 'to' */}
            <Link to="/Catalogo">Catalogo</Link>
            <Link to="/como-funciona">Cómo funciona</Link>
            <Link to="/seguridad">Seguridad</Link>
            <Link to="/vender">Vender un activo</Link>
          </nav>
          {/* Ícono de perfil que redirecciona */}
          <div className="bh-user-actions">
            <Link to="/Perfil" title="Mi Perfil">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--blue-dark)' }}>
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"> </circle>
              </svg>
            </Link>
          </div>
        </div>
      </header>
  );
}