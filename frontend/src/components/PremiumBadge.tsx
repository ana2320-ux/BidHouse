import './PremiumBadge.css';

export default function PremiumBadge({ compacto = false }: { compacto?: boolean }) {
  return (
    <span className={`premium-badge ${compacto ? 'premium-badge--compacto' : ''}`}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z" />
      </svg>
      {!compacto && <span>Premium</span>}
    </span>
  );
}
