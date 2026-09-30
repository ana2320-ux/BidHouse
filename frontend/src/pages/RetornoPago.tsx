import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { api, ApiError, usd } from '../api';
import { leerSesion } from '../lib/sesion';
import './RetornoPago.css';

// Respuesta de POST /api/pagos/confirmar (ServicioPagos.confirmar()).
interface Confirmacion {
  estadoPago: string;              // approved | pending | in_process | rejected ...
  tipo?: 'contrato' | 'recarga';
  subastaId?: string;
  monto?: number;
  saldo?: number;
}

// A esta página vuelve el comprador desde Mercado Pago ("Volver al sitio").
// Mercado Pago agrega a la URL ?payment_id=...&status=...&external_reference=...
// El "status" de la URL NO se cree: solo se usa el payment_id para que el
// backend le pregunte a Mercado Pago cómo quedó el pago de verdad.
export default function RetornoPago() {
  const { pathname, search } = useLocation();
  // Si la sesión venció mientras pagaba (dura 1 h), entrar y volver aquí con los mismos datos.
  if (!leerSesion()) return <Navigate to="/login" replace state={{ desde: pathname + search }} />;
  return <Confirmar search={search} />;
}

function Confirmar({ search }: { search: string }) {
  const params = new URLSearchParams(search);
  // Mercado Pago manda el id como payment_id y también como collection_id.
  const idPago = params.get('payment_id') || params.get('collection_id');
  const hayPago = !!idPago && idPago !== 'null';

  const [resultado, setResultado] = useState<Confirmacion | null>(null);
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0); // subirlo vuelve a verificar

  useEffect(() => {
    if (!hayPago) return;
    let vigente = true;
    api<Confirmacion>('/api/pagos/confirmar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idPago }),
    })
      .then((r) => { if (vigente) { setResultado(r); setError(''); } })
      .catch((err) => { if (vigente) setError(err instanceof ApiError ? err.message : 'No pudimos verificar el pago.'); });
    return () => { vigente = false; };
  }, [idPago, hayPago, intento]);

  let contenido;
  if (!hayPago) {
    // El comprador volvió sin pagar (canceló o cerró la página de Mercado Pago).
    contenido = (
      <>
        <span className="retorno__icono">↩</span>
        <h1>No se completó el pago</h1>
        <p>No se cobró nada. Puedes intentarlo de nuevo cuando quieras.</p>
        <Link to="/perfil" className="btn btn--primary retorno__boton">Ir a mi perfil</Link>
      </>
    );
  } else if (error) {
    contenido = (
      <>
        <span className="retorno__icono">⚠</span>
        <h1>No pudimos verificar el pago</h1>
        <p>{error}</p>
        <button type="button" className="btn btn--primary retorno__boton" onClick={() => setIntento((n) => n + 1)}>
          Volver a verificar
        </button>
      </>
    );
  } else if (!resultado) {
    contenido = (
      <>
        <span className="retorno__icono retorno__icono--girando">◌</span>
        <h1>Verificando tu pago…</h1>
        <p>Estamos confirmando con Mercado Pago.</p>
      </>
    );
  } else if (resultado.estadoPago === 'approved' && resultado.tipo === 'contrato') {
    contenido = (
      <>
        <span className="retorno__icono retorno__icono--ok">✓</span>
        <h1>¡Pago recibido!</h1>
        <p>Pagaste {usd(resultado.monto ?? 0)}. El dinero queda en custodia hasta que confirmes que recibiste el activo.</p>
        <Link to={`/activo/${resultado.subastaId}`} className="btn btn--primary retorno__boton">Ver el activo</Link>
      </>
    );
  } else if (resultado.estadoPago === 'approved' && resultado.tipo === 'recarga') {
    contenido = (
      <>
        <span className="retorno__icono retorno__icono--ok">✓</span>
        <h1>¡Recarga exitosa!</h1>
        <p>Se agregaron {usd(resultado.monto ?? 0)} a tu saldo. Saldo disponible: {usd(resultado.saldo ?? 0)}.</p>
        <Link to="/perfil" className="btn btn--primary retorno__boton">Ir a mi perfil</Link>
      </>
    );
  } else if (resultado.estadoPago === 'pending' || resultado.estadoPago === 'in_process') {
    // Sin webhooks (necesitan una URL pública), hay que volver a preguntar.
    contenido = (
      <>
        <span className="retorno__icono">⏳</span>
        <h1>Tu pago está en proceso</h1>
        <p>Mercado Pago todavía no lo aprueba. Vuelve a verificar en unos minutos.</p>
        <button type="button" className="btn btn--primary retorno__boton" onClick={() => setIntento((n) => n + 1)}>
          Volver a verificar
        </button>
      </>
    );
  } else {
    contenido = (
      <>
        <span className="retorno__icono">✕</span>
        <h1>El pago fue rechazado</h1>
        <p>Mercado Pago no aprobó el pago ({resultado.estadoPago}). No se cobró nada: prueba con otro medio.</p>
        <Link to="/perfil" className="btn btn--primary retorno__boton">Ir a mi perfil</Link>
      </>
    );
  }

  return (
    <main className="retorno">
      <div className="retorno__card">{contenido}</div>
    </main>
  );
}
