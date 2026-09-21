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
            
          </nav>
          {/* Botones de autenticación */}
          <div className="bh-auth-actions">
            <Link to="/login" className="btn btn--outline btn--sm">
              Iniciar sesión
            </Link>
            <Link to="/registro" className="btn btn--primary btn--sm">
              Crear cuenta
            </Link>
          </div>
        </div>
      </header>
  );
}