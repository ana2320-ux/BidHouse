import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError, api, usd } from '../api';
import './DetalleActivo.css';

interface Categoria {
  id?: string;
  nombre?: string | null;
}

interface ActivoDetalle {
  id?: string;
  nombre?: string | null;
  descripcion?: string | null;
  condicion?: string | null;
  precio_estimado?: number | null;
  imagenes?: string[] | null;
  esta_verificado?: boolean | null;
  categorias?: Categoria | null;
}

interface SubastaDetalle {
  id: string;
  titulo: string;
  descripcion?: string | null;
  precio_base?: number | null;
  oferta_actual_mas_alta?: number | null;
  incremento_minimo?: number | null;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  estado?: string | null;
  esta_activa?: boolean | null;
  activos?: ActivoDetalle | null;
}

type EstadoPaso = 'complete' | 'current' | 'pending';

interface PasoTransaccion {
  titulo: string;
  descripcion: string;
  estado: EstadoPaso;
}

const ESTADOS_FINALES = new Set(['finalizada', 'cerrada', 'completada', 'cancelada']);

const textoEstado = (estado?: string | null) => {
  if (!estado) return 'Sin estado informado';
  return estado.charAt(0).toUpperCase() + estado.slice(1).toLowerCase();
};

const numero = (valor?: number | null) => (typeof valor === 'number' && Number.isFinite(valor) ? valor : null);

const dinero = (valor?: number | null) => {
  const valorNumerico = numero(valor);
  return valorNumerico == null ? 'No disponible' : usd(valorNumerico);
};

const fecha = (valor?: string | null) => {
  if (!valor) return 'No disponible';
  const fechaLeida = new Date(valor);
  if (Number.isNaN(fechaLeida.getTime())) return 'No disponible';
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(fechaLeida);
};

const idCorto = (id: string) => {
  const limpio = id.replace(/-/g, '').toUpperCase();
  return `#BH-${limpio.slice(0, 4)}`;
};

const esError404 = (error: unknown) =>
  error instanceof ApiError ? error.status === 404 : error instanceof Error && /\b404\b/.test(error.message);

function construirPasos(subasta: SubastaDetalle, verificado: boolean): PasoTransaccion[] {
  const estado = subasta.estado?.toLowerCase() ?? '';
  const finalizada = ESTADOS_FINALES.has(estado);
  const activa = subasta.esta_activa === true || estado === 'activa';

  return [
    {
      titulo: 'Verificación del activo',
      descripcion: verificado ? 'El activo figura como verificado.' : 'La verificación aún está pendiente.',
      estado: verificado ? 'complete' : 'current',
    },
    {
      titulo: 'Publicación de la subasta',
      descripcion: activa ? 'La subasta está publicada en el catálogo.' : 'La publicación no está marcada como activa.',
      estado: activa ? 'complete' : 'pending',
    },
    {
      titulo: 'Estado de la subasta',
      descripcion: `Estado informado: ${textoEstado(subasta.estado)}.`,
      estado: finalizada ? 'complete' : 'current',
    },
    {
      titulo: 'Cierre de subasta',
      descripcion: subasta.fecha_fin ? `Fecha registrada: ${fecha(subasta.fecha_fin)}.` : 'Sin fecha de cierre disponible.',
      estado: finalizada ? 'complete' : 'pending',
    },
    {
      titulo: 'Transferencia del activo',
      descripcion: 'Este proceso se habilitará según las condiciones de la operación.',
      estado: 'pending',
    },
  ];
}

export default function DetalleActivo() {
  const { id } = useParams<{ id: string }>();
  const [subasta, setSubasta] = useState<SubastaDetalle | null>(null);
  const [cargando, setCargando] = useState(true);
  const [idCargado, setIdCargado] = useState<string | null>(null);
  const [noEncontrado, setNoEncontrado] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id) return;
    const idSolicitado = id;
    let vigente = true;

    api<SubastaDetalle>(`/api/subastas/${encodeURIComponent(id)}`)
      .then((detalle) => {
        if (!vigente) return;
        setSubasta(detalle);
        setIdCargado(idSolicitado);
        setNoEncontrado(false);
        setError(false);
      })
      .catch((errorDeCarga: unknown) => {
        if (!vigente) return;
        setIdCargado(idSolicitado);
        if (esError404(errorDeCarga)) setNoEncontrado(true);
        else setError(true);
        setSubasta(null);
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });

    return () => {
      vigente = false;
    };
  }, [id]);

  const activo = subasta?.activos ?? null;
  const verificado = activo?.esta_verificado === true;
  const pasos = useMemo(
    () => (subasta ? construirPasos(subasta, verificado) : []),
    [subasta, verificado],
  );
  const imagen = activo?.imagenes?.[0];
  const valoracion = activo?.precio_estimado ?? subasta?.precio_base;
  const descripcion = subasta?.descripcion || activo?.descripcion;
  const estadoActivo = subasta?.estado?.toLowerCase() === 'activa' || subasta?.esta_activa === true;

  if (id && (cargando || idCargado !== id)) {
    return <main className="detail-state"><p>Consultando activo...</p></main>;
  }

  if (!id || noEncontrado) {
    return (
      <main className="detail-state">
        <div className="detail-state__card">
          <span className="detail-state__eyebrow">BidHouse</span>
          <h1>Activo no encontrado</h1>
          <p>No existe una subasta publicada con el identificador solicitado.</p>
          <Link to="/catalogo" className="detail-button detail-button--secondary">Volver al catálogo</Link>
        </div>
      </main>
    );
  }

  if (error || !subasta) {
    return (
      <main className="detail-state">
        <div className="detail-state__card">
          <span className="detail-state__eyebrow">BidHouse</span>
          <h1>No fue posible cargar este activo.</h1>
          <p>Verifica la conexión con el backend e inténtalo nuevamente.</p>
          <Link to="/catalogo" className="detail-button detail-button--secondary">Volver al catálogo</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="detail-page">
      <div className="bh-container detail-layout">
        <section className="detail-column detail-column--media" aria-label="Información visual y técnica">
          <div className="detail-hero-image">
            {imagen ? <img src={imagen} alt={subasta.titulo} /> : <div className="detail-image-fallback">BidHouse</div>}
            <span className={`detail-image-badge ${verificado ? '' : 'detail-image-badge--pending'}`}>
              <span aria-hidden="true">◉</span> {verificado ? 'Inspeccionado' : 'En verificación'}
            </span>
            <span className="detail-id-badge">ID: {idCorto(subasta.id)}</span>
          </div>

          <section className="detail-card documentation-card">
            <div className="detail-card__heading">
              <span className="detail-icon" aria-hidden="true">⌑</span>
              <h2>Documentación Autenticada</h2>
            </div>
            <p>
              {verificado
                ? 'Este activo ha sido verificado mediante los procesos de validación disponibles en BidHouse.'
                : 'La documentación de este activo se encuentra en proceso de verificación.'}
            </p>
            <div className="documentation-items">
              <span><b aria-hidden="true">✓</b> Verificación del activo</span>
              <span><b aria-hidden="true">✓</b> Información documental</span>
            </div>
          </section>

          <section className="detail-card specifications-card">
            <div className="detail-card__heading">
              <span className="detail-icon" aria-hidden="true">▦</span>
              <h2>Especificaciones Técnicas</h2>
            </div>
            <dl className="specifications-grid">
              <div><dt>Categoría</dt><dd>{activo?.categorias?.nombre || 'No disponible'}</dd></div>
              <div><dt>Condición</dt><dd>{activo?.condicion || 'No disponible'}</dd></div>
              <div><dt>Estado</dt><dd>{textoEstado(subasta.estado)}</dd></div>
              <div><dt>Fecha de inicio</dt><dd>{fecha(subasta.fecha_inicio)}</dd></div>
              <div><dt>Fecha de cierre</dt><dd>{fecha(subasta.fecha_fin)}</dd></div>
              <div><dt>Incremento mínimo</dt><dd>{dinero(subasta.incremento_minimo)}</dd></div>
            </dl>
          </section>
        </section>

        <section className="detail-column detail-column--summary" aria-label="Resumen de la subasta">
          <div className="detail-badges">
            <span className="detail-pill detail-pill--blue">{verificado ? 'Activo verificado' : 'Verificación pendiente'}</span>
            <span className="detail-pill detail-pill--gold">{textoEstado(subasta.estado)}</span>
          </div>
          <h1 className="detail-title">{subasta.titulo}</h1>
          {descripcion && <p className="detail-description">{descripcion}</p>}

          <section className="detail-card valuation-card">
            <span className="detail-label">Valoración Estimada</span>
            <strong className="valuation-card__amount">{dinero(valoracion)}</strong>
            {subasta.oferta_actual_mas_alta != null && (
              <span className="valuation-card__current">Oferta actual: {dinero(subasta.oferta_actual_mas_alta)}</span>
            )}
            <button type="button" className="detail-button detail-button--primary">
              <span aria-hidden="true">⌕</span> {estadoActivo ? 'Participar en la subasta' : 'Comprar de forma segura'}
            </button>
          </section>

          <section className="detail-card transaction-card">
            <div className="detail-card__heading">
              <span className="detail-icon" aria-hidden="true">◌</span>
              <h2>Estatus de Transacción</h2>
            </div>
            <ol className="transaction-timeline">
              {pasos.map((paso, index) => (
                <li key={paso.titulo} className={`timeline-step timeline-step--${paso.estado}`}>
                  <span className="timeline-step__marker" aria-hidden="true">{paso.estado === 'complete' ? '✓' : index + 1}</span>
                  <div>
                    <strong>{paso.titulo}</strong>
                    <p>{paso.descripcion}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </section>
      </div>
    </main>
  );
}
