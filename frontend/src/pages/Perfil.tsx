import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api, ApiError, usd } from '../api';
import { leerSesion } from '../lib/sesion';
import './Perfil.css';

// Forma de la respuesta de GET /api/usuarios/perfil (ver ServicioUsuario.perfil()).
interface PerfilData {
  nombre: string;
  apellido: string;
  username: string;
  resumen: string;             // lo arma el sistema: "Comprador verificado • Bogotá"
  descripcion: string | null;  // la escribe el usuario
  imagenUrl: string | null;
  verificado: boolean;
  stats: {
    activosEnVivo: number;
    activosEnEspera: number;
    ofertasRealizadas: number;
    subastasConOfertas: number;
    transaccionesCompletadas: number;
    contratosEnProceso: number;
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
  transacciones: {
    id: string;
    estado: string;
    monto: number;
    creado_en: string;
    rol: 'comprador' | 'vendedor';
    subastas: { titulo: string } | null;
  }[];
  contratosPorEstado: Record<string, number>;
}

// Etapas de un contrato de garantía (escrow), en orden.
// ponytail: solo "pendiente" (valor por defecto) y "completada" existen hoy en la
// BD; los del medio son supuestos. Ajustarlos al CHECK de transacciones.estado
// cuando se implementen los contratos.
const ETAPAS = [
  { estado: 'pendiente', nombre: 'Pago pendiente' },
  { estado: 'en_custodia', nombre: 'En custodia' },
  { estado: 'enviado', nombre: 'Enviado' },
  { estado: 'recibido', nombre: 'Recibido' },
  { estado: 'completada', nombre: 'Liberado' },
];

const MAX_DESCRIPCION = 300;          // igual que ServicioUsuario
const MAX_FOTO = 2 * 1024 * 1024;     // 2 MB, igual que el bucket "avatares"

// El perfil es solo para quien inició sesión. Este "guardia" va aparte para
// no romper la regla de los hooks: no se puede hacer un return antes de un
// useState, así que la página real (con sus hooks) vive en PerfilConSesion.
export default function Perfil() {
  if (!leerSesion()) return <Navigate to="/login" replace />;
  return <PerfilConSesion />;
}

function PerfilConSesion() {
  const navigate = useNavigate();
  const [perfil, setPerfil] = useState<PerfilData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<PerfilData>('/api/usuarios/perfil')
      .then(setPerfil)
      .catch((err) => {
        // Token vencido: api() ya borró la sesión; toca volver a entrar.
        if (err instanceof ApiError && err.status === 401) navigate('/login', { replace: true });
        else setError(err instanceof ApiError ? err.message : 'No se pudo cargar el perfil. Verifica que el backend esté corriendo.');
      });
  }, [navigate]);

  if (error) {
    return <main className="bh-container profile-page"><h2>{error}</h2></main>;
  }
  if (!perfil) {
    return <main className="bh-container profile-page"><h2>Cargando perfil seguro...</h2></main>;
  }

  const { stats } = perfil;
  const enSubasta = stats.activosEnVivo + stats.activosEnEspera;

  return (
    <main className="bh-container profile-page">
      {/* ── Encabezado: foto, nombre y descripción ── */}
      <header className="profile-header">
        <div className="profile-user">
          <FotoPerfil perfil={perfil} alCambiar={(imagenUrl) => setPerfil({ ...perfil, imagenUrl })} />
          <div className="profile-info">
            <div className="profile-name-row">
              <h1>Hola, {perfil.nombre} {perfil.apellido}</h1>
              {perfil.verificado && <span className="badge-kyc">VERIFICADO</span>}
            </div>
            <p>{perfil.resumen} • @{perfil.username}</p>
            <Descripcion
              actual={perfil.descripcion}
              alGuardar={(descripcion) => setPerfil({ ...perfil, descripcion })}
            />
          </div>
        </div>
        <Link to="/vender" className="btn profile-btn-add">+ Publicar nuevo activo</Link>
      </header>

      {/* ── Tarjetas de métricas ──
          ponytail: los botones "Ver ..." llevan a pantallas que todavía no
          existen; por eso están deshabilitados con la marca "Pronto". */}
      <section className="profile-stats-grid">
        <article className="stat-card">
          <span className="stat-label">ACTIVOS EN SUBASTA</span>
          <h3 className="stat-value">{enSubasta} {enSubasta === 1 ? 'Activo' : 'Activos'}</h3>
          <p className="stat-desc">{stats.activosEnVivo} en vivo, {stats.activosEnEspera} en espera</p>
          <BotonPronto texto="Ver subastas activas" />
        </article>
        <article className="stat-card">
          <span className="stat-label">OFERTAS REALIZADAS</span>
          <h3 className="stat-value">{stats.ofertasRealizadas} {stats.ofertasRealizadas === 1 ? 'Oferta' : 'Ofertas'}</h3>
          <p className="stat-desc">
            En {stats.subastasConOfertas} {stats.subastasConOfertas === 1 ? 'subasta' : 'subastas'}
          </p>
          <BotonPronto texto="Ver mis ofertas" />
        </article>
        <article className="stat-card">
          <span className="stat-label">TRANSACCIONES COMPLETADAS</span>
          <h3 className="stat-value">{stats.transaccionesCompletadas} {stats.transaccionesCompletadas === 1 ? 'Éxito' : 'Éxitos'}</h3>
          <p className="stat-desc">Como comprador o vendedor</p>
        </article>
        <article className="stat-card">
          <span className="stat-label">CONTRATOS EN PROCESO</span>
          <h3 className="stat-value">{stats.contratosEnProceso} {stats.contratosEnProceso === 1 ? 'Contrato' : 'Contratos'}</h3>
          <p className="stat-desc">Garantías en las que participas</p>
          <BotonPronto texto="Ver contratos" />
        </article>
      </section>

      {/* ── Contenido principal: dos columnas ── */}
      <section className="profile-dashboard">
        {/* Columna izquierda: resumen de lo publicado (sin cambios) */}
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

        {/* Columna derecha: en qué va cada contrato de garantía */}
        <div className="dashboard-col">
          <h2>Transacciones Recientes</h2>
          <ResumenContratos porEstado={perfil.contratosPorEstado} />
          <div className="activity-list">
            {perfil.transacciones.length === 0 && (
              <p className="stat-desc contratos-vacio">
                Aún no tienes contratos de garantía. Cuando ganes o vendas una subasta, aquí verás en qué etapa va.
              </p>
            )}
            {perfil.transacciones.map((t) => (
              <Contrato key={t.id} transaccion={t} />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

// ── Botón de una pantalla que todavía no existe ──
function BotonPronto({ texto }: { texto: string }) {
  return (
    <button type="button" className="stat-card__boton" disabled title="Próximamente">
      {texto} <span className="stat-card__pronto">Pronto</span>
    </button>
  );
}

// ── Foto de perfil con botón para cambiarla ──
function FotoPerfil({ perfil, alCambiar }: { perfil: PerfilData; alCambiar: (url: string) => void }) {
  // El <input type="file"> real está oculto (se ve feo y no se puede estilizar);
  // el botón de la cámara le "hace clic" a través de esta referencia.
  const inputRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState('');

  const alElegir = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    e.target.value = ''; // permite volver a elegir el mismo archivo después
    if (!archivo) return;
    setError('');

    // Revisión rápida aquí para no subir 10 MB y enterarse al final. La que
    // manda es la del backend (tipo real por sus bytes, no por el nombre).
    if (archivo.size > MAX_FOTO) {
      setError('La foto no puede pesar más de 2 MB.');
      return;
    }

    // FormData arma un cuerpo multipart/form-data, el formato para subir
    // archivos. No se pone Content-Type a mano: el navegador lo agrega con
    // el "boundary" que separa las partes.
    const datos = new FormData();
    datos.append('foto', archivo);

    setSubiendo(true);
    try {
      const { imagenUrl } = await api<{ imagenUrl: string }>('/api/usuarios/perfil/foto', {
        method: 'POST',
        body: datos,
      });
      alCambiar(imagenUrl);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo subir la foto.');
    } finally {
      setSubiendo(false);
    }
  };

  const iniciales = `${perfil.nombre.charAt(0)}${perfil.apellido.charAt(0)}`.toUpperCase();

  return (
    <div className="perfil-foto">
      {perfil.imagenUrl ? (
        <img src={perfil.imagenUrl} alt="Foto de perfil" className="profile-avatar" />
      ) : (
        <div className="profile-avatar perfil-foto__iniciales" aria-hidden="true">{iniciales}</div>
      )}
      <button
        type="button"
        className="perfil-foto__boton"
        onClick={() => inputRef.current?.click()}
        disabled={subiendo}
        title={perfil.imagenUrl ? 'Cambiar foto' : 'Agregar foto'}
      >
        {subiendo ? '…' : <IconoCamara />}
        <span className="sr-solo">{perfil.imagenUrl ? 'Cambiar foto' : 'Agregar foto'}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={alElegir}
        hidden
      />
      {error && <p className="perfil-foto__error">{error}</p>}
    </div>
  );
}

// ── Descripción: se ve como texto y se edita en el mismo lugar ──
function Descripcion({ actual, alGuardar }: { actual: string | null; alGuardar: (d: string | null) => void }) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(actual ?? '');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const empezar = () => {
    setTexto(actual ?? '');
    setError('');
    setEditando(true);
  };

  const guardar = async () => {
    setGuardando(true);
    setError('');
    try {
      const { descripcion } = await api<{ descripcion: string | null }>('/api/usuarios/perfil', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descripcion: texto }),
      });
      alGuardar(descripcion);
      setEditando(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar la descripción.');
    } finally {
      setGuardando(false);
    }
  };

  if (!editando) {
    return (
      <div className="perfil-descripcion">
        {actual
          ? <p className="perfil-descripcion__texto">{actual}</p>
          : <p className="perfil-descripcion__vacia">Cuéntale a los compradores quién eres y qué te interesa.</p>}
        <button type="button" className="perfil-descripcion__editar" onClick={empezar}>
          {actual ? 'Editar descripción' : 'Agregar descripción'}
        </button>
      </div>
    );
  }

  return (
    <div className="perfil-descripcion perfil-descripcion--editando">
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        maxLength={MAX_DESCRIPCION}
        rows={3}
        autoFocus
        placeholder="Ej: Coleccionista de relojes vintage desde 2015."
      />
      <div className="perfil-descripcion__acciones">
        <span className="perfil-descripcion__contador">{texto.length}/{MAX_DESCRIPCION}</span>
        <button type="button" className="perfil-descripcion__cancelar" onClick={() => setEditando(false)} disabled={guardando}>
          Cancelar
        </button>
        <button type="button" className="perfil-descripcion__guardar" onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
      {error && <p className="perfil-foto__error">{error}</p>}
    </div>
  );
}

// ── Resumen visual: cuántos contratos hay en cada etapa ──
function ResumenContratos({ porEstado }: { porEstado: Record<string, number> }) {
  return (
    <ol className="contratos-etapas">
      {ETAPAS.map((etapa, i) => {
        const cantidad = porEstado[etapa.estado] ?? 0;
        return (
          <li key={etapa.estado} className={cantidad > 0 ? 'contratos-etapa contratos-etapa--activa' : 'contratos-etapa'}>
            <span className="contratos-etapa__numero">{cantidad}</span>
            <span className="contratos-etapa__nombre">{etapa.nombre}</span>
            {i < ETAPAS.length - 1 && <span className="contratos-etapa__flecha" aria-hidden="true">→</span>}
          </li>
        );
      })}
    </ol>
  );
}

// ── Un contrato con su barra de progreso por etapas ──
function Contrato({ transaccion: t }: { transaccion: PerfilData['transacciones'][number] }) {
  // Posición de su estado en ETAPAS; si es uno desconocido (ej. "cancelada"),
  // -1: no se marca ninguna etapa y se muestra el estado tal cual.
  const actual = ETAPAS.findIndex((e) => e.estado === t.estado);
  return (
    <article className="activity-item contrato">
      <div className="activity-item__info">
        <h4>{t.subastas?.titulo ?? 'Subasta'}</h4>
        <p>
          {t.rol === 'comprador' ? 'Compra' : 'Venta'} • <strong>{usd(t.monto)}</strong> •{' '}
          {new Date(t.creado_en).toLocaleDateString('es-CO')}
        </p>
        <div className="contrato__progreso" aria-label={`Etapa: ${ETAPAS[actual]?.nombre ?? t.estado}`}>
          {ETAPAS.map((e, i) => (
            <span key={e.estado} className={i <= actual ? 'contrato__paso contrato__paso--hecho' : 'contrato__paso'} />
          ))}
        </div>
      </div>
      <span className="badge-action neutral">{ETAPAS[actual]?.nombre ?? t.estado}</span>
    </article>
  );
}

function IconoCamara() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}
