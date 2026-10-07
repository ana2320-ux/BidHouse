import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './PremiumModal.css';

export default function PremiumModal({ abierto, alCerrar }: { abierto: boolean; alCerrar: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!abierto) return;
    const anterior = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const alTeclear = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') alCerrar();
    };
    document.addEventListener('keydown', alTeclear);
    return () => {
      document.removeEventListener('keydown', alTeclear);
      anterior?.focus();
    };
  }, [abierto, alCerrar]);

  if (!abierto) return null;

  return (
    <div className="premium-modal__overlay" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && alCerrar()}>
      <div
        ref={dialogRef}
        className="premium-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="premium-modal-titulo"
        tabIndex={-1}
      >
        <button type="button" className="premium-modal__cerrar" aria-label="Cerrar" onClick={alCerrar}>×</button>
        <span className="premium-modal__estrella" aria-hidden="true">★</span>
        <p className="premium-modal__eyebrow">BIDLUXURY MEMBER</p>
        <h2 id="premium-modal-titulo">Esta es una subasta exclusiva</h2>
        <p>Esta subasta está disponible para miembros BidLuxury. Mejora tu membresía para acceder a activos exclusivos y participar en subastas premium.</p>
        <ul>
          <li>Subastas exclusivas</li>
          <li>Activos premium</li>
          <li>Acceso anticipado</li>
        </ul>
        <div className="premium-modal__acciones">
          <button type="button" className="btn btn--primary" onClick={() => navigate('/membresia')}>Ver membresía</button>
          <button type="button" className="premium-modal__secundario" onClick={alCerrar}>Ahora no</button>
        </div>
      </div>
    </div>
  );
}
