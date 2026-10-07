import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiError, api } from '../api';
import { leerSesion } from '../lib/sesion';
import './MembresiaResultado.css';

type Resultado = { activa: boolean; estado: string };

export default function MembresiaResultado() {
  const [params] = useSearchParams();
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const id = params.get('preapproval_id') ?? params.get('preapprovalId') ?? params.get('id');
  const puedeConfirmar = Boolean(leerSesion() && id);
  const [error, setError] = useState(() => {
    if (!leerSesion()) return 'Inicia sesión para confirmar el estado de tu membresía.';
    if (!id) return 'No encontramos el identificador de la membresía en el retorno de Mercado Pago.';
    return '';
  });

  useEffect(() => {
    if (!puedeConfirmar) return;
    api<Resultado>('/api/membresias/confirmar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preapprovalId: id }),
    })
      .then(setResultado)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No pudimos confirmar la membresía.'));
  }, [id, puedeConfirmar]);

  return (
    <main className="membresia-resultado">
      <section className="membresia-resultado__card">
        {!resultado && !error && <><h1>Confirmando tu membresía...</h1><p>Estamos verificando la respuesta de Mercado Pago.</p></>}
        {resultado?.activa && <><span className="membresia-resultado__icono">★</span><h1>¡Ya eres BidLuxury Member!</h1><p>Tu membresía fue confirmada y ya puedes participar en subastas premium.</p></>}
        {resultado && !resultado.activa && !error && <><h1>Estamos confirmando tu pago</h1><p>La membresía todavía no está activa. Puedes revisar nuevamente desde tu perfil.</p></>}
        {error && <><h1>No pudimos confirmar la membresía</h1><p>{error}</p></>}
        <Link to="/perfil" className="btn btn--primary">Ir a mi perfil</Link>
      </section>
    </main>
  );
}
