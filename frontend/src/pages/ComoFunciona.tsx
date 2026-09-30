import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import './ComoFunciona.css';

type IconName =
  | 'arrow' | 'badge' | 'chart' | 'check' | 'clock' | 'file' | 'gavel'
  | 'lock' | 'package' | 'search' | 'shield' | 'spark' | 'users' | 'wallet';

interface IconProps {
  name: IconName;
  size?: number;
}

function Icon({ name, size = 24 }: IconProps) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  switch (name) {
    case 'arrow': return <svg {...common}><path d="M5 12h13" /><path d="m13 6 6 6-6 6" /></svg>;
    case 'badge': return <svg {...common}><path d="m12 3 2.3 1.7 2.8-.1.9 2.6 2.2 1.8-1.2 2.5.7 2.7-2.5 1.2-1.3 2.4-2.7-.7L12 21l-2.2-1.9-2.7.7-1.3-2.4-2.5-1.2.7-2.7-1.2-2.5L5 9.2l.9-2.6 2.8.1L12 3Z" /><path d="m8.7 12 2.1 2.1 4.6-4.6" /></svg>;
    case 'chart': return <svg {...common}><path d="M4 19V5" /><path d="M4 19h16" /><path d="m7 15 3-4 3 2 5-6" /><path d="M15 7h3v3" /></svg>;
    case 'check': return <svg {...common}><path d="m5 12 4 4L19 6" /></svg>;
    case 'clock': return <svg {...common}><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.5 2" /><path d="M8 3 6.5 5M16 3l1.5 2" /></svg>;
    case 'file': return <svg {...common}><path d="M6 3.5h8l4 4V20H6z" /><path d="M14 3.5V8h4M9 12h6M9 15.5h6" /></svg>;
    case 'gavel': return <svg {...common}><path d="m14.5 5.5 4 4M12.5 7.5l4 4M15.5 4.5l-6 6M13.5 2.5l3 3M8.5 9.5l3 3M10.5 13.5l-5 5M4 20h8" /></svg>;
    case 'lock': return <svg {...common}><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v2" /></svg>;
    case 'package': return <svg {...common}><path d="m4 7 8-4 8 4-8 4-8-4Z" /><path d="M4 7v10l8 4 8-4V7M12 11v10" /></svg>;
    case 'search': return <svg {...common}><circle cx="10.8" cy="10.8" r="6.3" /><path d="m16 16 4 4M8.5 10.8h4.6" /></svg>;
    case 'shield': return <svg {...common}><path d="M12 3 19 6v5c0 4.7-3 8.1-7 10-4-1.9-7-5.3-7-10V6l7-3Z" /><path d="m9 12 2 2 4-4" /></svg>;
    case 'spark': return <svg {...common}><path d="m12 3 1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3Z" /><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z" /></svg>;
    case 'users': return <svg {...common}><circle cx="9" cy="8" r="3" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 5.5a3 3 0 0 1 0 5.8M17 14.2a5.2 5.2 0 0 1 3.5 4.8" /></svg>;
    case 'wallet': return <svg {...common}><path d="M4 6.5h14a2 2 0 0 1 2 2V19H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h12M3 7h15" /><path d="M16 13h4M17 13v.1" /></svg>;
    default: return null;
  }
}

const processSteps = [
  { number: '01', icon: 'file' as IconName, title: 'Publicas o encuentras un activo', description: 'El vendedor publica el activo con su información, imágenes y documentación disponible. Los compradores pueden explorar oportunidades por categoría.' },
  { number: '02', icon: 'badge' as IconName, title: 'Verificación del activo y del usuario', description: 'BidLuxury valida la identidad de los participantes y revisa la información disponible del activo antes de completar la operación.' },
  { number: '03', icon: 'gavel' as IconName, title: 'Participas en la compra o subasta', description: 'Los compradores pueden realizar ofertas o participar en subastas dentro de la plataforma con reglas y condiciones visibles.' },
  { number: '04', icon: 'lock' as IconName, title: 'El pago queda protegido', description: 'Los fondos se mantienen bajo un mecanismo de escrow hasta que se cumplan las condiciones acordadas por las partes.' },
  { number: '05', icon: 'package' as IconName, title: 'Se completa la entrega', description: 'Cuando el activo y la documentación son verificados, el pago se libera al vendedor y la operación queda trazable.' },
];

const services = [
  { number: '01', icon: 'search' as IconName, title: 'Comprar un activo', description: 'Explora activos verificados y participa en subastas de alto valor.' },
  { number: '02', icon: 'package' as IconName, title: 'Vender un activo', description: 'Publica tu activo y llega a compradores especializados.' },
  { number: '03', icon: 'gavel' as IconName, title: 'Participar en subastas', description: 'Realiza ofertas sobre activos seleccionados dentro de la plataforma.' },
  { number: '04', icon: 'badge' as IconName, title: 'Validar un activo', description: 'Consulta documentación, condición y estado de verificación.' },
  { number: '05', icon: 'wallet' as IconName, title: 'Comprar con pago protegido', description: 'Los fondos permanecen protegidos hasta completar la operación.' },
  { number: '06', icon: 'users' as IconName, title: 'Explorar comunidades', description: 'Conecta con usuarios interesados en categorías especializadas.' },
];

const securityPillars = [
  { icon: 'shield' as IconName, title: 'Identidad verificada', description: 'Participantes identificables y procesos pensados para operar con confianza.' },
  { icon: 'badge' as IconName, title: 'Activos validados', description: 'Información, condición y documentación visibles antes de decidir.' },
  { icon: 'lock' as IconName, title: 'Pago protegido', description: 'El escrow ayuda a mantener los fondos seguros durante la operación.' },
  { icon: 'chart' as IconName, title: 'Trazabilidad', description: 'Cada etapa tiene un estado claro para seguir el avance de la transacción.' },
];

export default function ComoFunciona() {
  const [activeStep, setActiveStep] = useState(0);

  return (
    <main className="bh-how-page">
      <section className="bh-how-hero">
        <div className="bh-container bh-how-hero__inner">
          <div className="bh-how-hero__copy bh-how-reveal">
            <span className="bh-how-kicker">CÓMO FUNCIONA</span>
            <h1>Conoce cómo funciona BidLuxury</h1>
            <p>Descubre el proceso completo para comprar y vender activos de alto valor de forma segura, transparente y verificada.</p>
          </div>
        </div>
      </section>

      <section className="bh-how-process bh-how-section">
        <div className="bh-container">
          <div className="bh-how-section-heading bh-how-reveal"><span className="bh-how-kicker">¿CÓMO FUNCIONA?</span><h2>Así funciona una transacción en BidLuxury</h2><p>Del primer clic a la entrega, cada etapa está pensada para que sepas qué ocurre y qué puedes esperar.</p></div>
          <div className="bh-how-process__layout">
            <div className="bh-how-process-visual bh-how-reveal" aria-hidden="true">
              <div className="bh-how-process-visual__grid" /><div className="bh-how-process-visual__card bh-how-process-visual__card--main"><div className="bh-how-process-visual__card-top"><span className="bh-how-status-dot" /> Flujo BidLuxury <Icon name="arrow" size={16} /></div><div className="bh-how-process-visual__big-icon"><Icon name="shield" size={46} /></div><strong>Confianza en cada etapa</strong><span>Identidad · activo · pago · entrega</span><div className="bh-how-process-visual__progress"><i /><i /><i /><i /></div></div>
              <div className="bh-how-process-visual__node bh-how-process-visual__node--top"><Icon name="badge" size={19} /><span>Verificado</span></div><div className="bh-how-process-visual__node bh-how-process-visual__node--bottom"><Icon name="lock" size={19} /><span>Protegido</span></div><span className="bh-how-process-visual__line bh-how-process-visual__line--one" /><span className="bh-how-process-visual__line bh-how-process-visual__line--two" />
            </div>
            <div className="bh-how-steps bh-how-reveal bh-how-reveal--delay-1">
              {processSteps.map((step, index) => {
                const isActive = activeStep === index;
                return <article key={step.number} className={`bh-how-step ${isActive ? 'is-active' : ''}`}><button type="button" className="bh-how-step__trigger" onClick={() => setActiveStep(index)} aria-expanded={isActive} aria-controls={`how-step-description-${step.number}`}><span className="bh-how-step__icon"><Icon name={step.icon} size={22} /></span><span className="bh-how-step__number">{step.number}</span><span className="bh-how-step__title">{step.title}</span><span className="bh-how-step__plus" aria-hidden="true">{isActive ? '−' : '+'}</span></button><div id={`how-step-description-${step.number}`} className="bh-how-step__description" hidden={!isActive}>{step.description}</div></article>;
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="bh-how-services bh-how-section">
        <div className="bh-container">
          <div className="bh-how-section-heading bh-how-section-heading--center bh-how-reveal"><span className="bh-how-kicker">SERVICIOS BIDLUXURY</span><h2>Para todo lo que necesitas</h2><p>Una plataforma para descubrir oportunidades, vender con respaldo y operar con mayor claridad.</p></div>
          <div className="bh-how-services-grid">{services.map((service, index) => <article key={service.number} className="bh-how-service-card bh-how-reveal" style={{ '--how-delay': `${index * 70}ms` } as CSSProperties}><div className="bh-how-service-card__top"><span className="bh-how-service-card__icon"><Icon name={service.icon} size={25} /></span><span className="bh-how-service-card__number">{service.number}</span></div><h3>{service.title}</h3><p>{service.description}</p></article>)}</div>
        </div>
      </section>

      <section id="seguridad" className="bh-how-security bh-how-section">
        <div className="bh-container">
          <div className="bh-how-security__heading bh-how-reveal"><span className="bh-how-kicker bh-how-kicker--light">SEGURIDAD DE PRINCIPIO A FIN</span><h2>Una transacción respaldada en cada etapa</h2><p>La confianza no depende de una sola promesa: se construye con controles claros que acompañan toda la operación.</p></div>
          <div className="bh-how-security-grid">{securityPillars.map((pillar, index) => <article key={pillar.title} className="bh-how-security-card bh-how-reveal" style={{ '--how-delay': `${index * 80}ms` } as CSSProperties}><span className="bh-how-security-card__icon"><Icon name={pillar.icon} size={25} /></span><h3>{pillar.title}</h3><p>{pillar.description}</p></article>)}</div>
          <div className="bh-how-security-flow bh-how-reveal bh-how-reveal--delay-2"><div><span><Icon name="users" size={18} /></span><b>Usuario verificado</b></div><i aria-hidden="true" /><div><span><Icon name="badge" size={18} /></span><b>Activo validado</b></div><i aria-hidden="true" /><div><span><Icon name="lock" size={18} /></span><b>Pago protegido</b></div><i aria-hidden="true" /><div><span><Icon name="check" size={18} /></span><b>Entrega confirmada</b></div></div>
        </div>
      </section>

      <section className="bh-how-final bh-how-section"><div className="bh-container bh-how-final__inner bh-how-reveal"><div><span className="bh-how-kicker">EL SIGUIENTE PASO ES TUYO</span><h2>¿Listo para comenzar con mayor confianza?</h2></div><div className="bh-how-final__actions"><Link to="/login" className="bh-how-button bh-how-button--gold">Iniciar sesión</Link><Link to="/registro" className="bh-how-button bh-how-button--outline-light">Crear cuenta</Link></div></div></section>
    </main>
  );
}
