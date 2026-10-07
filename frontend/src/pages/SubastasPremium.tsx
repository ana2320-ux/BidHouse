import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import PremiumBadge from '../components/PremiumBadge';
import SubastaCard, { type SubastaCardData } from '../components/SubastaCard';
import { leerSesion } from '../lib/sesion';
import './SubastasPremium.css';

export default function SubastasPremium() {
  const [subastas, setSubastas] = useState<SubastaCardData[] | null>(null);
  const haySesion = Boolean(leerSesion());
  const [membresiaActiva, setMembresiaActiva] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api<SubastaCardData[]>('/api/subastas/premium').then(setSubastas).catch(() => setError('No se pudieron cargar las subastas premium.'));
    if (haySesion) api<{ activa: boolean }>('/api/membresias/estado').then((estado) => setMembresiaActiva(estado.activa)).catch(() => undefined);
  }, [haySesion]);

  return (
    <main className="premium-page">
      <div className="bh-container">
        <header className="premium-page__header">
          <PremiumBadge />
          <h1>Subastas Premium</h1>
          <p>Descubre activos seleccionados disponibles exclusivamente para miembros BidLuxury.</p>
        </header>
        {error && <p className="premium-page__error" role="alert">{error}</p>}
        {subastas === null && !error && <p className="premium-page__loading">Cargando subastas premium...</p>}
        {subastas && subastas.length === 0 && <div className="premium-page__empty"><h2>Próximamente</h2><p>Estamos preparando nuevos activos exclusivos para miembros.</p><Link to="/catalogo" className="btn btn--outline">Explorar catálogo</Link></div>}
        {subastas && subastas.length > 0 && <div className="catalog-grid premium-page__grid">{subastas.map((subasta) => <SubastaCard key={subasta.id} subasta={subasta} bloquearPremium={Boolean(haySesion && !membresiaActiva)} />)}</div>}
      </div>
    </main>
  );
}
