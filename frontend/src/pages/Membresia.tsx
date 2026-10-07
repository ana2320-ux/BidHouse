import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError, api } from '../api';
import { BENEFICIOS_MEMBER, dineroMembresia, PRECIO_MEMBER_FALLBACK, type EstadoMembresia, type PlanMembresia } from '../lib/membresia';
import { leerSesion } from '../lib/sesion';
import PremiumBadge from '../components/PremiumBadge';
import './Membresia.css';

const PLANES_FALLBACK: PlanMembresia[] = [
  { plan: 'bidluxury_member', periodicidad: 'mensual', precioUsd: PRECIO_MEMBER_FALLBACK.mensual, moneda: 'USD', unidad: 'mes', renovacion: 'Renovación mensual' },
  { plan: 'bidluxury_member', periodicidad: 'anual', precioUsd: PRECIO_MEMBER_FALLBACK.anual, moneda: 'USD', unidad: 'año', renovacion: 'Renovación anual' },
];

const beneficiosGratis = ['Explorar activos públicos', 'Participar en subastas estándar', 'Administrar perfil', 'Preferencias personalizadas'];

export default function Membresia() {
  const navigate = useNavigate();
  const [periodicidad, setPeriodicidad] = useState<'mensual' | 'anual'>('mensual');
  const [planes, setPlanes] = useState<PlanMembresia[]>(PLANES_FALLBACK);
  const [estado, setEstado] = useState<EstadoMembresia | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [error, setError] = useState('');
  const haySesion = Boolean(leerSesion());

  useEffect(() => {
    api<PlanMembresia[]>('/api/membresias/planes').then(setPlanes).catch(() => undefined);
    if (!haySesion) return;
    api<EstadoMembresia>('/api/membresias/estado')
      .then(setEstado)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo consultar tu membresía.'));
  }, [haySesion]);

  const planElegido = useMemo(
    () => planes.find((plan) => plan.periodicidad === periodicidad) ?? PLANES_FALLBACK.find((plan) => plan.periodicidad === periodicidad)!,
    [planes, periodicidad],
  );

  const adquirir = async () => {
    setError('');
    if (!haySesion) {
      navigate('/login', { state: { desde: '/membresia' } });
      return;
    }
    setProcesando(true);
    try {
      const respuesta = await api<{ url: string }>('/api/membresias/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodicidad }),
      });
      window.location.assign(respuesta.url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo iniciar el pago.');
      setProcesando(false);
    }
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

        {error && <p className="membresia-error" role="alert">{error}</p>}

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
            <button type="button" className="btn btn--outline" disabled>{estado?.activa ? 'Incluido en tu cuenta' : 'Plan actual'}</button>
          </article>

          <article className="membresia-plan membresia-plan--premium">
            <div className="membresia-plan__topline"><PremiumBadge /><span className="membresia-plan__estrella" aria-hidden="true">★</span></div>
            <h2>BidLuxury Member</h2>
            <strong className="membresia-plan__precio">{dineroMembresia(planElegido.precioUsd)} <small>/ {planElegido.unidad}</small></strong>
            <p className="membresia-plan__renovacion">{planElegido.renovacion}. Sin beneficios activados hasta confirmar el pago.</p>
            <ul>{BENEFICIOS_MEMBER.map((beneficio) => <li key={beneficio}>{beneficio}</li>)}</ul>
            {estado?.activa ? (
              <div className="membresia-plan__activa">
                <strong>★ Membresía activa</strong>
                <span>Vigente hasta {estado.fechaFin ? new Date(estado.fechaFin).toLocaleDateString('es-CO') : 'la próxima renovación'}.</span>
                {!estado.renovacionCancelada && <button type="button" className="membresia-link" onClick={cancelarRenovacion} disabled={cancelando}>{cancelando ? 'Cancelando…' : 'Cancelar renovación'}</button>}
                {estado.renovacionCancelada && <span className="membresia-plan__avisorenovacion">La renovación está cancelada; mantienes tus beneficios hasta la fecha indicada.</span>}
              </div>
            ) : (
              <button type="button" className="btn btn--primary membresia-plan__cta" onClick={adquirir} disabled={procesando}>
                {procesando ? 'Procesando pago…' : 'Adquirir membresía'}
              </button>
            )}
          </article>
        </section>

        <section className="membresia-comparacion">
          <h2>Compara los planes</h2>
          <div className="membresia-comparacion__tabla" role="table" aria-label="Comparación de planes">
            <div className="membresia-comparacion__fila membresia-comparacion__fila--cabecera" role="row"><span>Beneficio</span><strong>Gratis</strong><strong>Member</strong></div>
            {[
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
    </main>
  );
}
