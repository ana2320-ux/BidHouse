import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, usd } from '../api';
import './Perfil.css';

// Forma de la respuesta de GET /api/usuarios/perfil
interface PerfilData {
  nombre: string;
  apellido: string;
  descripcion: string;
  username: string;
  verificado: boolean;
  stats: {
    activosEnVivo: number;
    activosEnEspera: number;
    ofertasActivas: number;
    sumaOfertas: number;
    transaccionesCompletadas: number;
    volumenTotal: number;
  };
  activos: {
    id: string;
    nombre: string;
    precio_estimado: number | null;
    imagenes: string[] | null;
    esta_verificado: boolean;
    categorias: { nombre: string } | null;
    subastas: { estado: string }[];
  }[];
  actividad: {
    id: string;
    tipo: string;
    titulo: string;
    mensaje: string;
    creado_en: string;
  }[];
}

const AVATAR = 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=150';

export default function Perfil() {
  // Estado para guardar los datos. Inicia en null mientras carga.
  const [perfil, setPerfil] = useState<PerfilData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api<PerfilData>('/api/usuarios/perfil').then(setPerfil).catch(() => setError(true));
  }, []);

  if (error) {
    return <main className="bh-container profile-page"><h2>No se pudo cargar el perfil. Verifica que el backend esté corriendo.</h2></main>;
  }

  // Si aún no ha llegado la respuesta de Java, mostramos un mensaje de carga
  if (!perfil) {
    return <main className="bh-container profile-page"><h2>Cargando perfil seguro...</h2></main>;
  }

  const { stats } = perfil;
  const enSubasta = stats.activosEnVivo + stats.activosEnEspera;

  return (
    <main className="bh-container profile-page">
      {/* Encabezado del Perfil */}
      <header className="profile-header">
        <div className="profile-user">
          {/* Imagen de perfil, random por ahora*/}
          <img
            src={AVATAR}
            alt="Avatar"
            className="profile-avatar"
          />
          <div className="profile-info">
            <div className="profile-name-row">
              <h1>Hola, {perfil.nombre} {perfil.apellido}</h1>
              {perfil.verificado && <span className="badge-kyc">VERIFICADO</span>}
            </div>
            <p>{perfil.descripcion} • @{perfil.username}</p>
          </div>
        </div>
        <Link to="/vender" className="btn profile-btn-add">+ Publicar nuevo activo</Link>
      </header>

      {/* Tarjetas de Métricas */}
      <section className="profile-stats-grid">
        <article className="stat-card">
          <span className="stat-label">ACTIVOS EN SUBASTA</span>
          <h3 className="stat-value">{enSubasta} {enSubasta === 1 ? 'Activo' : 'Activos'}</h3>
          <p className="stat-desc">{stats.activosEnVivo} Activos en vivo, {stats.activosEnEspera} en espera</p>
        </article>
        <article className="stat-card">
          <span className="stat-label">OFERTAS ACTIVAS</span>
          <h3 className="stat-value">{stats.ofertasActivas} {stats.ofertasActivas === 1 ? 'Oferta' : 'Ofertas'}</h3>
          <p className="stat-desc">Suma total de {usd(stats.sumaOfertas)}</p>
        </article>
        <article className="stat-card">
          <span className="stat-label">TRANSACCIONES COMPLETADAS</span>
          <h3 className="stat-value">{stats.transaccionesCompletadas} {stats.transaccionesCompletadas === 1 ? 'Éxito' : 'Éxitos'}</h3>
          <p className="stat-desc">Como comprador o vendedor</p>
        </article>
        <article className="stat-card">
          <span className="stat-label">VOLUMEN TOTAL COMERCIALIZADO</span>
          <h3 className="stat-value">{usd(stats.volumenTotal)}</h3>
          <p className="stat-desc">Asegurado con smart contracts</p>
        </article>
      </section>

      {/* Contenido Principal: Dos Columnas */}
      <section className="profile-dashboard">
        {/* Columna Izquierda */}
        <div className="dashboard-col">
          <h2>Mis Activos en Custodia</h2>
          <div className="asset-list">
            {perfil.activos.length === 0 && <p className="stat-desc">Aún no has publicado activos.</p>}
            {perfil.activos.map((activo) => {
              const enVivo = activo.subastas.some((s) => s.estado === 'activa');
              return (
                <article key={activo.id} className="asset-item">
                  <div className="asset-item__image">
                    {activo.imagenes?.[0] && <img src={activo.imagenes[0]} alt={activo.nombre} />}
                  </div>
                  <div className="asset-item__info">
                    <h4>{activo.nombre}</h4>
                    <p>
                      {activo.categorias?.nombre ?? 'Sin categoría'}
                      {activo.precio_estimado != null && <> • <strong>{usd(activo.precio_estimado)}</strong></>}
                    </p>
                  </div>
                  {enVivo ? (
                    <span className="badge-status waiting">• En subasta</span>
                  ) : (
                    <span className="badge-status available">• {activo.esta_verificado ? 'Disponible' : 'En verificación'}</span>
                  )}
                </article>
              );
            })}
          </div>
        </div>

        {/* Columna Derecha */}
        <div className="dashboard-col">
          <h2>Actividad Reciente y Seguridad Escrow</h2>
          <div className="activity-list">
            {perfil.actividad.length === 0 && <p className="stat-desc">Sin actividad reciente.</p>}
            {perfil.actividad.map((n) => (
              <article key={n.id} className="activity-item">
                <div className="activity-item__info">
                  <h4>{n.titulo}</h4>
                  <p>{new Date(n.creado_en).toLocaleString('es-CO')} • {n.mensaje}</p>
                </div>
                <span className="badge-action neutral">{n.tipo}</span>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
