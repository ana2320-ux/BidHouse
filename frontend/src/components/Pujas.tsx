import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api, ApiError, usd } from '../api';
import { leerSesion } from '../lib/sesion';
import { PagoContrato, type MiContrato } from './PagoContrato';
import PremiumModal from './PremiumModal';
import './Pujas.css';

// Lo que PanelPuja necesita de GET /api/subastas/{id} (ver ServicioSubasta.obtenerDetalle()).
export interface SubastaParaPujar {
  id: string;
  estado?: string | null;
  esta_activa?: boolean | null;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  oferta_actual_mas_alta?: number | null;
  total_pujas?: number | null;
  permite_pujas?: boolean | null;
  precio_compra_inmediata?: number | null;
  es_premium?: boolean;
  tieneMembresia?: boolean;
  esMiPublicacion?: boolean;
  voyGanando?: boolean;
  pujaMinima?: number | null;
  miContrato?: MiContrato | null; // solo si quien mira es comprador o vendedor
}

interface Puja {
  id: string;
  monto: number;
  creado_en: string;
  alias: string;
  esMia: boolean;
}

// La hora actual como estado, actualizada cada 30 s. React no permite llamar
// Date.now() directamente mientras dibuja (da un resultado distinto cada vez y
// el dibujo dejaría de ser predecible); así la hora "avanza" de forma controlada
// y los textos de "Cierra en..." y "hace X min" se refrescan solos.
function useAhora(cadaMs = 30000) {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const intervalo = setInterval(() => setAhora(Date.now()), cadaMs);
    return () => clearInterval(intervalo);
  }, [cadaMs]);
  return ahora;
}

// "Cierra en 2 d 4 h", "Cierra en 12 min".
function tiempoRestante(fin: string, ahora: number): string {
  const ms = new Date(fin).getTime() - ahora;
  if (ms <= 0) return 'Cerrada';
  const min = Math.floor(ms / 60000);
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  if (d > 0) return `Cierra en ${d} d ${h} h`;
  if (h > 0) return `Cierra en ${h} h ${min % 60} min`;
  return `Cierra en ${Math.max(min, 1)} min`;
}

function haceCuanto(fecha: string, ahora: number): string {
  const min = Math.floor((ahora - new Date(fecha).getTime()) / 60000);
  if (min < 1) return 'hace un momento';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  return new Date(fecha).toLocaleDateString('es-CO');
}

// Qué decir de una subasta que no está abierta, según quién mira.
// "finalizada" la pone el cierre automático (backend/sql/fase2_cierre.sql);
// si hay pujas es porque hubo ganador (el líder al momento del cierre).
function resultadoCierre(subasta: SubastaParaPujar, vencida: boolean): { texto: string; clase: string } {
  const precio = usd(subasta.oferta_actual_mas_alta ?? 0);
  const conGanador = (subasta.total_pujas ?? 0) > 0;

  // 'vendida' = alguien usó "Comprar ahora" / "Cómpralo ya" (backend/sql/fase3_compra.sql).
  // El comprador queda como pujador_lider_id, por eso "voyGanando" = "lo compré".
  if (subasta.estado === 'vendida') {
    if (subasta.voyGanando) {
      return {
        texto: `🛍 ¡Compraste este activo por ${precio}!`,
        clase: 'puja-panel__estado--ganando',
      };
    }
    if (subasta.esMiPublicacion) {
      return { texto: `Vendiste este activo por ${precio}. Esperando el pago del comprador.`, clase: '' };
    }
    return { texto: 'Este activo ya fue vendido.', clase: 'puja-panel__estado--cerrada' };
  }

  if (subasta.estado !== 'finalizada') {
    // Venció pero el cierre automático todavía no pasa (corre cada minuto).
    if (vencida) return { texto: 'La subasta terminó. Estamos definiendo el resultado…', clase: 'puja-panel__estado--cerrada' };
    return { texto: 'Esta subasta todavía no está abierta a pujas.', clase: 'puja-panel__estado--cerrada' };
  }
  if (subasta.voyGanando) {
    return {
      texto: `🏆 ¡Ganaste esta subasta con ${precio}!`,
      clase: 'puja-panel__estado--ganando',
    };
  }
  if (subasta.esMiPublicacion) {
    return conGanador
      ? { texto: `Tu subasta cerró en ${precio}. Esperando el pago del comprador.`, clase: '' }
      : { texto: 'Tu publicación terminó sin compradores.', clase: 'puja-panel__estado--cerrada' };
  }
  return conGanador
    ? { texto: `Subasta finalizada: se adjudicó en ${precio}.`, clase: 'puja-panel__estado--cerrada' }
    : { texto: 'Subasta finalizada sin pujas.', clase: 'puja-panel__estado--cerrada' };
}

// ── Panel para pujar ──
// Decide qué mostrar según quién mira y cómo está la subasta. Las reglas de
// verdad (monto mínimo, fechas, puja propia) las revisa la BD en pujar(); aquí
// solo se evita mostrar un formulario que de todas formas sería rechazado.
export function PanelPuja({ subasta, alPujar }: { subasta: SubastaParaPujar; alPujar: () => void }) {
  const sesion = leerSesion();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const minimo = subasta.pujaMinima ?? 0;
  const [monto, setMonto] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [premiumModal, setPremiumModal] = useState(false);
  const ahora = useAhora();

  const cerrada = !!subasta.fecha_fin && new Date(subasta.fecha_fin).getTime() <= ahora;
  const abierta = subasta.estado === 'activa' && subasta.esta_activa !== false && !cerrada
    && (!subasta.fecha_inicio || new Date(subasta.fecha_inicio).getTime() <= ahora);

  // ── Casos en los que no se puede pujar ──
  // Primero si ya no está abierta (también aplica a precio fijo vencido).
  if (!abierta) {
    const { texto, clase } = resultadoCierre(subasta, cerrada);
    return (
      <div className="puja-panel">
        <p className={`puja-panel__estado ${clase}`}>{texto}</p>
        {/* Comprador: pagar. Vendedor: en qué va el pago. */}
        {subasta.miContrato && <PagoContrato contrato={subasta.miContrato} alPagar={alPujar} />}
      </div>
    );
  }
  const precioFijo = subasta.permite_pujas === false;
  // "Cómpralo ya" del mixto: solo mientras nadie ha pujado (la BD lo vuelve a revisar).
  const compraloYa = !precioFijo && subasta.precio_compra_inmediata != null && (subasta.total_pujas ?? 0) === 0;

  if (subasta.es_premium && subasta.tieneMembresia !== true) {
    return (
      <div className="puja-panel">
        <p className="puja-panel__nota">Esta subasta está reservada para miembros BidLuxury.</p>
        <button type="button" className="detail-button detail-button--primary" onClick={() => setPremiumModal(true)}>
          Ver membresía
        </button>
        <PremiumModal abierto={premiumModal} alCerrar={() => setPremiumModal(false)} />
      </div>
    );
  }

  if (!sesion) {
    return (
      <div className="puja-panel">
        <p className="puja-panel__nota">{subasta.fecha_fin && tiempoRestante(subasta.fecha_fin, ahora)}</p>
        {/* "desde" le dice al login a dónde volver después de entrar. */}
        <Link to="/login" state={{ desde: pathname }} className="detail-button detail-button--primary">
          {precioFijo ? 'Inicia sesión para comprar' : compraloYa ? 'Inicia sesión para pujar o comprar' : 'Inicia sesión para pujar'}
        </Link>
      </div>
    );
  }
  if (subasta.esMiPublicacion) {
    return (
      <div className="puja-panel">
        <p className="puja-panel__estado">
          {precioFijo ? 'Es tu publicación: aquí verás cuando alguien la compre.' : 'Es tu publicación: aquí verás las pujas que reciba.'}
        </p>
      </div>
    );
  }
  if (precioFijo) {
    return (
      <div className="puja-panel">
        <p className="puja-panel__nota">
          Esta publicación es de <strong>precio fijo</strong>. {subasta.fecha_fin && tiempoRestante(subasta.fecha_fin, ahora)}.
        </p>
        <BotonComprar subasta={subasta} etiqueta="Comprar ahora" principal alComprar={alPujar} />
      </div>
    );
  }
  if (subasta.voyGanando) {
    return (
      <div className="puja-panel">
        <p className="puja-panel__estado puja-panel__estado--ganando">
          ✓ Vas ganando con {usd(subasta.oferta_actual_mas_alta ?? 0)}
        </p>
        {exito && <p className="puja-panel__exito">{exito}</p>}
        <p className="puja-panel__nota">
          {subasta.fecha_fin && tiempoRestante(subasta.fecha_fin, ahora)}. Si alguien te supera, podrás volver a pujar aquí.
        </p>
      </div>
    );
  }

  // ── Formulario ──
  const valor = Number(monto || minimo);

  // Primer clic: revisar y pedir confirmación. Una puja no se puede retirar,
  // así que no se envía con un solo clic.
  const revisar = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setExito('');
    if (!Number.isFinite(valor) || valor < minimo) {
      setError(`La puja mínima es ${usd(minimo)}.`);
      return;
    }
    setConfirmando(true);
  };

  const confirmar = async () => {
    setEnviando(true);
    setError('');
    try {
      await api(`/api/subastas/${encodeURIComponent(subasta.id)}/pujas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monto: valor }),
      });
      setExito(`¡Tu puja de ${usd(valor)} quedó registrada!`);
      setMonto('');
      alPujar(); // recarga la subasta y el historial: ahora "vas ganando"
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        navigate('/login', { state: { desde: pathname } });
        return;
      }
      setError(err instanceof ApiError ? err.message : 'No se pudo registrar la puja. Intenta de nuevo.');
      // 409 = alguien pujó antes o cambió la subasta: traer el mínimo nuevo.
      if (err instanceof ApiError && err.status === 409) alPujar();
    } finally {
      setEnviando(false);
      setConfirmando(false);
    }
  };

  return (
    <div className="puja-panel">
      <div className="puja-panel__resumen">
        <span>{subasta.total_pujas ?? 0} {subasta.total_pujas === 1 ? 'puja' : 'pujas'}</span>
        <span>{subasta.fecha_fin && tiempoRestante(subasta.fecha_fin, ahora)}</span>
      </div>

      {/* Modo mixto: "Cómpralo ya" solo mientras nadie ha pujado (así nadie se
          salta a quien ya está pujando). */}
      {compraloYa && <BotonComprar subasta={subasta} etiqueta="Cómpralo ya" alComprar={alPujar} />}

      {error && <p className="puja-panel__error">{error}</p>}
      {exito && <p className="puja-panel__exito">{exito}</p>}

      {confirmando ? (
        <div className="puja-panel__confirmar">
          <p>
            Vas a pujar <strong>{usd(valor)}</strong>. Si ganas, te comprometes a pagarlo.
            Una puja no se puede retirar.
          </p>
          <div className="puja-panel__acciones">
            <button type="button" className="detail-button detail-button--secondary" onClick={() => setConfirmando(false)} disabled={enviando}>
              Cancelar
            </button>
            <button type="button" className="detail-button detail-button--primary" onClick={confirmar} disabled={enviando}>
              {enviando ? 'Enviando…' : 'Confirmar puja'}
            </button>
          </div>
        </div>
      ) : (
        <form className="puja-panel__form" onSubmit={revisar} noValidate>
          <label htmlFor="monto-puja">Tu puja (USD) · mínimo {usd(minimo)}</label>
          <div className="puja-panel__fila">
            <input
              id="monto-puja"
              type="number"
              inputMode="decimal"
              min={minimo}
              step="any"
              placeholder={String(minimo)}
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
            />
            <button type="submit" className="detail-button detail-button--primary">
              Pujar {usd(valor)}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// ── Botón de compra inmediata (precio fijo o "Cómpralo ya") ──
// Igual que pujar: primer clic muestra la confirmación, el segundo compra.
// Comprar crea un compromiso de pago, así que nunca va con un solo clic.
function BotonComprar({ subasta, etiqueta, principal = false, alComprar }: {
  subasta: SubastaParaPujar;
  etiqueta: string;
  principal?: boolean;
  alComprar: () => void;
}) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const precio = usd(subasta.precio_compra_inmediata ?? 0);

  const comprar = async () => {
    setEnviando(true);
    setError('');
    try {
      await api(`/api/subastas/${encodeURIComponent(subasta.id)}/compra`, { method: 'POST' });
      alComprar(); // recarga: la publicación queda "vendida" y el panel lo muestra
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        navigate('/login', { state: { desde: pathname } });
        return;
      }
      setError(err instanceof ApiError ? err.message : 'No se pudo completar la compra. Intenta de nuevo.');
      // 409 = alguien compró o pujó antes: recargar para mostrar cómo quedó.
      if (err instanceof ApiError && err.status === 409) alComprar();
    } finally {
      setEnviando(false);
      setConfirmando(false);
    }
  };

  if (confirmando) {
    return (
      <div className="puja-panel__confirmar">
        <p>
          Vas a comprar este activo por <strong>{precio}</strong>. Tendrás 48 horas para pagarlo:
          es un compromiso de compra.
        </p>
        <div className="puja-panel__acciones">
          <button type="button" className="detail-button detail-button--secondary" onClick={() => setConfirmando(false)} disabled={enviando}>
            Cancelar
          </button>
          <button type="button" className="detail-button detail-button--primary" onClick={comprar} disabled={enviando}>
            {enviando ? 'Comprando…' : 'Confirmar compra'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {error && <p className="puja-panel__error">{error}</p>}
      <button
        type="button"
        className={`detail-button ${principal ? 'detail-button--primary' : 'detail-button--secondary puja-panel__comprar'}`}
        onClick={() => { setError(''); setConfirmando(true); }}
      >
        {etiqueta} · {precio}
      </button>
    </>
  );
}

// ── Historial de pujas ──
// "version" cambia cada vez que DetalleActivo refresca: así el historial se
// vuelve a pedir junto con la subasta (después de pujar y cada 15 s).
export function HistorialPujas({ subastaId, version }: { subastaId: string; version: number }) {
  const [pujas, setPujas] = useState<Puja[] | null>(null);
  const [error, setError] = useState(false);
  const ahora = useAhora();

  useEffect(() => {
    let vigente = true; // evita actualizar si el componente ya se desmontó
    api<Puja[]>(`/api/subastas/${encodeURIComponent(subastaId)}/pujas`)
      .then((lista) => {
        if (!vigente) return;
        setPujas(lista);
        setError(false);
      })
      .catch(() => {
        if (vigente) setError(true);
      });
    return () => {
      vigente = false;
    };
  }, [subastaId, version]);

  return (
    <section className="detail-card pujas-historial">
      <div className="detail-card__heading">
        <span className="detail-icon" aria-hidden="true">≡</span>
        <h2>Historial de pujas</h2>
      </div>
      {error && <p className="pujas-historial__vacio">No se pudo cargar el historial.</p>}
      {!error && pujas?.length === 0 && <p className="pujas-historial__vacio">Aún no hay pujas. ¡Sé el primero!</p>}
      {pujas && pujas.length > 0 && (
        <ol className="pujas-historial__lista">
          {pujas.map((p, i) => (
            <li key={p.id} className={p.esMia ? 'pujas-historial__item pujas-historial__item--mia' : 'pujas-historial__item'}>
              <span className="pujas-historial__quien">
                {p.esMia ? 'Tú' : p.alias}
                {i === 0 && <span className="pujas-historial__lider">Mayor puja</span>}
              </span>
              <strong>{usd(p.monto)}</strong>
              <span className="pujas-historial__cuando">{haceCuanto(p.creado_en, ahora)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
