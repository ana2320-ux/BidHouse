import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ETIQUETA_MODO, modoDe } from '../lib/modos';
import PremiumBadge from './PremiumBadge';
import PremiumModal from './PremiumModal';
import '../pages/Catalogo.css';

export type SubastaCardData = {
  id: string;
  titulo: string;
  activos: {
    imagenes: string[] | null;
    esta_verificado?: boolean;
    categorias: { id: string; nombre: string } | null;
  } | null;
  permite_pujas: boolean | null;
  precio_compra_inmediata: number | null;
  es_premium?: boolean;
};

const hashCorto = (id: string) => {
  const hex = id.replace(/-/g, '').toUpperCase();
  return `0x${hex.slice(0, 6)} ... ${hex.slice(-4)}`;
};

export default function SubastaCard({ subasta, bloquearPremium = false }: { subasta: SubastaCardData; bloquearPremium?: boolean }) {
  const [modalAbierto, setModalAbierto] = useState(false);
  const modo = modoDe(subasta.permite_pujas, subasta.precio_compra_inmediata);
  const imagen = subasta.activos?.imagenes?.[0];

  return (
    <>
    <Link
      to={`/activo/${subasta.id}`}
      className="catalog-card-link"
      aria-label={bloquearPremium ? `${subasta.titulo}, requiere membresía BidLuxury` : subasta.titulo}
      onClick={(e) => {
        if (!bloquearPremium) return;
        e.preventDefault();
        setModalAbierto(true);
      }}
    >
      <article className="catalog-card">
        <div className="catalog-card__image-wrapper">
          {imagen && <img src={imagen} alt={subasta.titulo} />}
          {subasta.es_premium && <span className="catalog-card__premium"><PremiumBadge /></span>}
        </div>
        <div className="catalog-card__content">
          <div className="catalog-card__meta">
            <span className="category">{(subasta.activos?.categorias?.nombre ?? 'SIN CATEGORÍA').toUpperCase()}</span>
            <span className={`status status--${modo}`}>{ETIQUETA_MODO[modo]}</span>
          </div>
          <h3 className="catalog-card__title">{subasta.titulo}</h3>
          <div className="catalog-card__hash">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            {hashCorto(subasta.id)}
          </div>
        </div>
      </article>
    </Link>
    <PremiumModal abierto={modalAbierto} alCerrar={() => setModalAbierto(false)} />
    </>
  );
}
