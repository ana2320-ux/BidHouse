import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { cerrarSesion, leerSesion } from '../lib/sesion';
import './Navbar.css';

export default function Navbar() {
  // Se lee en cada dibujo: App vuelve a dibujar el Navbar cada vez que cambia
  // la URL, así que después de iniciar o cerrar sesión (que navegan) ya se ve
  // el estado nuevo sin tener que avisarle a nadie.
  const sesion = leerSesion();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Cerrar el menú al hacer clic fuera de él o al presionar Escape.
  // Solo se escucha mientras está abierto, para no dejar listeners de más.
  useEffect(() => {
    if (!menuAbierto) return;
    const alClicAfuera = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuAbierto(false);
    };
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuAbierto(false);
    };
    document.addEventListener('mousedown', alClicAfuera);
    document.addEventListener('keydown', alTeclear);
    // La función que devuelve un useEffect es la "limpieza": React la llama
    // antes de volver a ejecutarlo o cuando el componente desaparece.
    return () => {
      document.removeEventListener('mousedown', alClicAfuera);
      document.removeEventListener('keydown', alTeclear);
    };
  }, [menuAbierto]);

  const salir = () => {
    cerrarSesion();
    setMenuAbierto(false);
    navigate('/');
  };

  const iniciales = sesion
    ? `${sesion.usuario.nombre.charAt(0)}${sesion.usuario.apellido.charAt(0)}`.toUpperCase()
    : '';

  return (
    <header className="bh-header">
      <div className="bh-container bh-header__inner">
        <Link to="/" title="Home" className="bh-header__logo">
          <div className="bh-logo">
            Bid<span>House</span>
          </div>
        </Link>

        {/* Los links del centro son para quien todavía no tiene cuenta. Con
            sesión se quitan: "Vender" queda en el menú del usuario y
            "Catálogo" pasa a ser un botón al lado del perfil. */}
        {!sesion && (
          <nav className="bh-nav">
            {/* Cambiamos las <a> por <Link> y los 'href' por 'to' */}
            <Link to="/catalogo">Catalogo</Link>
            <Link to="/como-funciona">Cómo funciona</Link>
            <Link to="/vender">Vender un activo</Link>
          </nav>
        )}

        {/* Lado derecho: botón de entrar, o el usuario con su menú.
            Todo va dentro de este div: un hijo extra descuadra la grilla. */}
        <div className="bh-auth-actions">
          {sesion ? (
            <>
              <Link to="/catalogo" className="btn btn--outline btn--sm">
                Catálogo
              </Link>

              <div className="bh-usuario" ref={menuRef}>
                <button
                  type="button"
                  className="bh-usuario__boton"
                  aria-haspopup="menu"
                  aria-expanded={menuAbierto}
                  onClick={() => setMenuAbierto(!menuAbierto)}
                >
                  <span className="bh-usuario__avatar" aria-hidden="true">{iniciales}</span>
                  <span className="bh-usuario__nombre">{sesion.usuario.nombre}</span>
                  <span className="bh-usuario__flecha" aria-hidden="true">▾</span>
                </button>

                {menuAbierto && (
                  <div className="bh-usuario__menu" role="menu">
                    <div className="bh-usuario__cabecera">
                      <strong>{sesion.usuario.nombre} {sesion.usuario.apellido}</strong>
                      <span>{sesion.usuario.email}</span>
                    </div>
                    <Link to="/perfil" role="menuitem" onClick={() => setMenuAbierto(false)}>
                      Mi perfil
                    </Link>
                    <Link to="/vender" role="menuitem" onClick={() => setMenuAbierto(false)}>
                      Vender un activo
                    </Link>
                    <button type="button" role="menuitem" className="bh-usuario__salir" onClick={salir}>
                      Cerrar sesión
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <Link to="/login" className="btn btn--outline btn--sm">
              Iniciar sesión
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
