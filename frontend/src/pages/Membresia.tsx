import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError, api } from '../api';
import { BENEFICIOS_MEMBER, COMISION_GRATIS, COMISION_MEMBER, dineroMembresia, porcentaje, PRECIO_MEMBER_FALLBACK, type EstadoMembresia, type PlanMembresia } from '../lib/membresia';
import { useMembresia } from '../lib/useMembresia';
import { leerSesion } from '../lib/sesion';
import PremiumBadge from '../components/PremiumBadge';
import CompraMembresiaModal from '../components/CompraMembresiaModal';
import './Membresia.css';

const PLANES_FALLBACK: PlanMembresia[] = [
  { plan: 'bidluxury_member', periodicidad: 'mensual', precioUsd: PRECIO_MEMBER_FALLBACK.mensual, moneda: 'USD', unidad: 'mes', renovacion: 'Renovación mensual' },
  { plan: 'bidluxury_member', periodicidad: 'anual', precioUsd: PRECIO_MEMBER_FALLBACK.anual, moneda: 'USD', unidad: 'año', renovacion: 'Renovación anual' },
];

const beneficiosGratis = ['Explorar activos públicos', 'Participar en subastas estándar', 'Administrar perfil', 'Preferencias personalizadas', `Comisión por venta del ${porcentaje(COMISION_GRATIS)}`];

// Venta de ejemplo para que el ahorro se vea en dinero y no solo en porcentaje.
const VENTA_EJEMPLO = 10000;
const usd = (valor: number) => `$${Math.round(valor).toLocaleString('en-US')} USD`;

export default function Membresia() {
  const navigate = useNavigate();
  const [periodicidad, setPeriodicidad] = useState<'mensual' | 'anual'>('mensual');
  const [planes, setPlanes] = useState<PlanMembresia[]>(PLANES_FALLBACK);
  const [procesando, setProcesando] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [saldoDisponible, setSaldoDisponible] = useState<number | null>(null);
  const [cargandoSaldo, setCargandoSaldo] = useState(false);
  const [errorCompra, setErrorCompra] = useState('');
  const compraVersion = useRef(0);
  const haySesion = Boolean(leerSesion());
  const { estado, cargando: cargandoEstado, error: errorEstado, setEstado } = useMembresia(haySesion);

  useEffect(() => {
    api<PlanMembresia[]>('/api/membresias/planes').then(setPlanes).catch(() => undefined);
  }, [haySesion]);

  const planElegido = useMemo(
    () => planes.find((plan) => plan.periodicidad === periodicidad) ?? PLANES_FALLBACK.find((plan) => plan.periodicidad === periodicidad)!,
    [planes, periodicidad],
  );

  const adquirir = () => {
    setError('');
    setAviso('');
    setErrorCompra('');
    if (!haySesion) {
      navigate('/login', { state: { desde: '/membresia' } });
      return;
    }
    if (cargandoEstado || errorEstado || !estado) {
      setError(errorEstado || 'Espera a que podamos verificar tu membresía antes de iniciar el pago.');
      return;
    }
    if (estado.activa) {
      setError('Ya tienes una membresía activa.');
      return;
    }

    compraVersion.current += 1;
    setProcesando(false);
    setSaldoDisponible(null);
    setCargandoSaldo(false);
    setErrorCompra('');
    setModalAbierto(true);
  };

  const elegirSaldo = async () => {
    const version = compraVersion.current;
    setErrorCompra('');
    setCargandoSaldo(true);
    try {
      const respuesta = await api<{ disponible: number }>('/api/pagos/saldo');
      if (version !== compraVersion.current) return;
      setSaldoDisponible(respuesta.disponible);
    } catch (err) {
      if (version !== compraVersion.current) return;
      setErrorCompra(err instanceof ApiError ? err.message : 'No se pudo consultar tu saldo.');
    } finally {
      if (version === compraVersion.current) setCargandoSaldo(false);
    }
  };

  const confirmarCompra = async () => {
    const version = compraVersion.current;
    setProcesando(true);
    setErrorCompra('');
    try {
      const respuesta = await api<{ estado: EstadoMembresia; saldoDisponible: number }>('/api/membresias/comprar-con-saldo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodicidad }),
      });
      if (version !== compraVersion.current) return;
      setEstado(respuesta.estado);
      setSaldoDisponible(respuesta.saldoDisponible);
      setModalAbierto(false);
      setAviso(`Membresía Premium activada. Nuevo saldo disponible: $${respuesta.saldoDisponible.toLocaleString('en-US')} USD.`);
    } catch (err) {
      if (version !== compraVersion.current) return;
      setErrorCompra(err instanceof ApiError ? err.message : 'No se pudo completar la compra.');
    } finally {
      if (version === compraVersion.current) setProcesando(false);
    }
  };

  const pagarConMercadoPago = async () => {
    const version = compraVersion.current;
    setProcesando(true);
    setErrorCompra('');
    try {
      const respuesta = await api<{ url: string }>('/api/membresias/checkout-mercadopago', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodicidad }),
      });
      if (version !== compraVersion.current) return;
      window.location.assign(respuesta.url);
    } catch (err) {
      if (version !== compraVersion.current) return;
      setErrorCompra(err instanceof ApiError ? err.message : 'No se pudo iniciar el pago con Mercado Pago.');
      setProcesando(false);
    }
  };

  const cerrarModal = () => {
    compraVersion.current += 1;
    setModalAbierto(false);
    setProcesando(false);
    setCargandoSaldo(false);
    setSaldoDisponible(null);
    setErrorCompra('');
  };

  const irARecargar = () => {
    cerrarModal();
    navigate('/perfil#saldo');
  };

  const cancelarRenovacion = async () => {
    setError('');
    setCancelando(true);
    try {
      setEstado(await api<EstadoMembresia>('/api/membresias/cancelar', { method: 'POST' }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cancelar la renovación.');
    } finally {
      setCancelando(false);
    }
  };

  return (
    <main className="membresia-page">
      <div className="bh-container">
        <header className="membresia-header">
          <p className="membresia-eyebrow">EXPERIENCIA EXCLUSIVA</p>
          <h1>Mejora tu experiencia en BidLuxury</h1>
          <p>Accede a activos exclusivos y participa en subastas reservadas para miembros.</p>
        </header>

        <section className="membresia-comision" aria-label={`Comisión por venta: ${porcentaje(COMISION_GRATIS)} sin membresía, ${porcentaje(COMISION_MEMBER)} con membresía`}>
          <div>
            <p className="membresia-comision__etiqueta">Comisión por venta</p>
            <h2>Vende pagando la mitad de comisión</h2>
            <p>
              En una venta de {usd(VENTA_EJEMPLO)} pagas {usd(VENTA_EJEMPLO * COMISION_MEMBER)} en vez
              de {usd(VENTA_EJEMPLO * COMISION_GRATIS)}. La tasa se fija al crear cada contrato de venta.
            </p>
          </div>
          <div className="membresia-comision__tasas" aria-hidden="true">
            <span className="membresia-comision__antes">{porcentaje(COMISION_GRATIS)}</span>
            <span>→</span>
            <span className="membresia-comision__despues">{porcentaje(COMISION_MEMBER)}</span>
          </div>
        </section>

        {(error || errorEstado) && <p className="membresia-error" role="alert">{error || errorEstado}</p>}
        {aviso && <p className="membresia-aviso" role="status">{aviso}</p>}

        <div className="membresia-toggle" role="group" aria-label="Periodicidad de la membresía">
          <button type="button" className={periodicidad === 'mensual' ? 'activo' : ''} onClick={() => setPeriodicidad('mensual')}>Mensual</button>
          <button type="button" className={periodicidad === 'anual' ? 'activo' : ''} onClick={() => setPeriodicidad('anual')}>Anual <span>Ahorra con el plan anual</span></button>
        </div>

        <section className="membresia-planes" aria-label="Planes disponibles">
          <article className="membresia-plan">
            <p className="membresia-plan__eyebrow">PLAN GRATUITO</p>
            <h2>Explora BidLuxury</h2>
            <strong className="membresia-plan__precio">$0 <small>USD</small></strong>
            <ul>{beneficiosGratis.map((beneficio) => <li key={beneficio}>{beneficio}</li>)}</ul>
            <button type="button" className="btn btn--outline" disabled>
              {cargandoEstado ? 'Consultando…' : errorEstado ? 'No disponible' : estado?.activa ? 'No es tu plan actual' : 'Plan actual'}
            </button>
          </article>

          <article className="membresia-plan membresia-plan--premium">
            <div className="membresia-plan__topline"><PremiumBadge /><span className="membresia-plan__estrella" aria-hidden="true">★</span></div>
            <h2>BidLuxury Member</h2>
            <strong className="membresia-plan__precio">{dineroMembresia(planElegido.precioUsd)} <small>/ {planElegido.unidad}</small></strong>
            <p className="membresia-plan__renovacion">{planElegido.renovacion}. Sin beneficios activados hasta confirmar el pago.</p>
            <ul>{BENEFICIOS_MEMBER.map((beneficio) => <li key={beneficio}>{beneficio}</li>)}</ul>
            {cargandoEstado ? (
              <div className="membresia-plan__activa" aria-live="polite">
                <strong>Consultando tu membresía…</strong>
                <span>No se habilitará una nueva compra hasta verificar el estado actual.</span>
              </div>
            ) : estado?.activa ? (
              <div className="membresia-plan__activa">
                <strong>★ Membresía activa</strong>
                <span>Vigente hasta {estado.fechaFin ? new Date(estado.fechaFin).toLocaleDateString('es-CO') : 'la próxima renovación'}.</span>
                {!estado.renovacionCancelada && <button type="button" className="membresia-link" onClick={cancelarRenovacion} disabled={cancelando}>{cancelando ? 'Cancelando…' : 'Cancelar renovación'}</button>}
                {estado.renovacionCancelada && <span className="membresia-plan__avisorenovacion">La renovación está cancelada; mantienes tus beneficios hasta la fecha indicada.</span>}
              </div>
            ) : (
              <button
                type="button"
                className="btn btn--primary membresia-plan__cta"
                onClick={adquirir}
                disabled={procesando || (haySesion && (Boolean(errorEstado) || !estado))}
              >
                {errorEstado ? 'Verificación no disponible' : 'Adquirir membresía'}
              </button>
            )}
          </article>
        </section>

        <section className="membresia-comparacion">
          <h2>Compara los planes</h2>
          <div className="membresia-comparacion__tabla" role="table" aria-label="Comparación de planes">
            <div className="membresia-comparacion__fila membresia-comparacion__fila--cabecera" role="row"><span>Beneficio</span><strong>Gratis</strong><strong>Member</strong></div>
            {[
              ['Comisión por venta', porcentaje(COMISION_GRATIS), porcentaje(COMISION_MEMBER)],
              ['Subastas públicas', '✓', '✓'],
              ['Preferencias', '✓', '✓'],
              ['Subastas premium', '—', '✓'],
              ['Pujas premium', '—', '✓'],
              ['Acceso anticipado', '—', '✓'],
              ['Distintivo Member', '—', '✓'],
            ].map(([nombre, gratis, member]) => <div className="membresia-comparacion__fila" role="row" key={nombre}><span>{nombre}</span><span>{gratis}</span><span>{member}</span></div>)}
          </div>
          {!haySesion && <p className="membresia-login">¿Ya tienes una cuenta? <Link to="/login">Inicia sesión para continuar.</Link></p>}
        </section>
      </div>
      <CompraMembresiaModal
        key={modalAbierto ? 'modal-abierto' : 'modal-cerrado'}
        abierto={modalAbierto}
        plan={planElegido}
        saldoDisponible={saldoDisponible}
        cargandoSaldo={cargandoSaldo}
        procesando={procesando}
        error={errorCompra}
        alCerrar={cerrarModal}
        alElegirSaldo={elegirSaldo}
        alConfirmar={confirmarCompra}
        alPagarMercadoPago={pagarConMercadoPago}
        alRecargar={irARecargar}
      />
    </main>
  );
}
