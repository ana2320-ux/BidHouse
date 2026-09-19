import { Link } from 'react-router-dom';
import './ComoFunciona.css';

export default function ComoFunciona() {
  const steps = [
    {
      num: "01",
      title: "Verificación de Identidad ",
      desc: "Exigimos validación de identidad en tiempo real con documento y prueba de vida para asegurar que todos los participantes sean reales y confiables."
    },
    {
      num: "02",
      title: "Contrato Inteligente",
      desc: "Al acordar una venta, se genera un contrato inteligente inmutable en la blockchain que dicta las reglas claras de la transacción."
    },
    {
      num: "03",
      title: "Depósito en Custodia (Escrow)",
      desc: "El pago del comprador se retiene de forma segura y neutral. El dinero no llega al vendedor hasta que la entrega se complete exitosamente."
    },
    {
      num: "04",
      title: "Inspección y Liberación",
      desc: "El comprador recibe el activo y verifica su estado. Una vez confirmada la conformidad, el contrato libera automáticamente los fondos al vendedor."
    }
  ];

  return (
    <main className="bh-container how-page">
      {/* Encabezado Principal */}
      <header className="how-header">
        <div className="security-badge">
          MÁXIMA SEGURIDAD C2C
        </div>
        <h1>Cómo funciona el protocolo<br/>BidHouse</h1>
      </header>

      {/* Tarjeta CTA (Call To Action) */}
      <section className="cta-card">
        <h2>¿Listo para comerciar con seguridad real?</h2>
        <p>
          Únete a cientos de coleccionistas y entusiastas que ya compran y venden activos de lujo de forma segura y protegida.
        </p>
        <div className="cta-actions">
          <Link to="/registro" className="btn btn--primary-dark">Registrarse </Link>
          <Link to="/Catalogo" className="btn btn--outline-dark">Explorar Subastas</Link>
        </div>
      </section>

      {/* Sección del Flujo */}
      <section className="flow-section">
        <h3 className="flow-title">El Flujo de Compra y Venta Segura</h3>
        <div className="steps-grid">
          {steps.map((step) => (
            <article key={step.num} className="step-card">
              <span className="step-number">{step.num}</span>
              <h4 className="step-title">{step.title}</h4>
              <p className="step-desc">{step.desc}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}