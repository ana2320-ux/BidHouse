import { Navigate, useNavigate } from 'react-router-dom';
import PreferenciasPanel from '../components/PreferenciasPanel';
import { leerSesion } from '../lib/sesion';
import './Preferencias.css';

export default function Preferencias() {
  const navigate = useNavigate();
  if (!leerSesion()) return <Navigate to="/login" replace />;

  return (
    <main className="preferencias-page">
      <div className="preferencias-page__logo bh-logo">Bid<span>Luxury</span></div>
      <div className="preferencias-page__card">
        <span className="preferencias-page__paso">UN ÚLTIMO PASO</span>
        <h1>Personaliza tu experiencia</h1>
        <p>Cuéntanos qué categorías te interesan. Podrás cambiarlas cuando quieras desde tu perfil.</p>
        <PreferenciasPanel modoInicial="edicion" onSaved={() => window.setTimeout(() => navigate('/perfil'), 650)} />
        <button type="button" className="preferencias-page__omitir" onClick={() => navigate('/perfil')}>Configurar más tarde</button>
      </div>
    </main>
  );
}
