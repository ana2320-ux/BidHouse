import "./Home.css";
import { Link } from "react-router-dom";
import { leerSesion } from "../lib/sesion";
import HomeUsuario from "./HomeUsuario";

// ---------- Datos de ejemplo (reemplazar por datos reales / API) ----------

interface Lot {
  id: string;
  title: string;
  category: string;
  currentBid: string;
  bids: number;
  endsAt: number; // timestamp
  hash: string;
}




const steps = [
  {
    n: "01",
    title: "Verifica tu identidad",
    body: "Un solo proceso de verificación (KYC) te da acceso a todas las subastas. Tu wallet queda vinculada a una cuenta auditada.",
  },
  {
    n: "02",
    title: "Deposita en custodia",
    body: "Tus fondos se bloquean en un contrato digital usando Blockchain(escrow). Nadie, ni BidLuxury, puede moverlos fuera de las reglas del contrato.",
  },
  {
    n: "03",
    title: "Puja en tiempo real",
    body: "Cada puja se firma con tu wallet y queda registrada. El historial del lote es público y no se puede alterar.",
  },
  {
    n: "04",
    title: "Liquidación automática",
    body: "Al cerrar el lote, el contrato transfiere el activo tokenizado y libera el pago en el mismo bloque. Sin intermediarios, sin esperas bancarias ni riesgos.",
  },
];

// ---------- Íconos (SVG inline, sin dependencias externas) ----------

function IconShield() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="icon">
      <path
        d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6l7-3z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconLedger() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="icon">
      <rect x="4" y="3.5" width="16" height="17" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M7.5 8h9M7.5 12h9M7.5 16h5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconBolt() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="icon">
      <path
        d="M12.5 3L5 13.5h5.2L10.8 21 19 10h-5.4L12.5 3z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ---------- Página ----------

export default function Home() {
  // Con sesión se muestra el home personalizado; sin sesión, el público.
  const sesion = leerSesion();
  if (sesion) return <HomeUsuario sesion={sesion} />;

  return (
    <div className="bh">
      

      <main>
        {/* HERO */}
        <section className="hero">
          <div className="bh-container hero__grid">
            <div className="hero__copy">
             
              <h1>
                Subastas verificadas en blockchain.
                <br />
                El activo cambia de dueño en el mismo bloque.
              </h1>
              <p className="hero__sub">
                BidLuxury organiza subastas de relojes, arte, autos clásicos y bienes raíces de alto valor,
                con custodia en contrato inteligente y liquidación instantánea. Ninguna subasta se pierde,
                ninguna transferencia depende de un tercero.
              </p>
              <div className="hero__actions">
                <button className="btn btn--primary">Ver subastas activas</button>
                <button className="btn btn--outline">Cómo se verifica un lote</button>
              </div>

              
            </div>

            
          </div>
        </section>

        {/* BARRA DE CONFIANZA */}
        <section className="trust" id="seguridad">
          <div className="bh-container trust__grid">
            <div className="trust__item">
              <IconShield />
              <div>
                <h3>Custodia en escrow</h3>
                <p>Los fondos de cada puja quedan bloqueados en un contrato auditado hasta que cierra el lote.</p>
              </div>
            </div>
            <div className="trust__item">
              <IconLedger />
              <div>
                <h3>Procedencia pública</h3>
                <p>Cada transferencia de propiedad queda escrita en un registro que cualquiera puede consultar.</p>
              </div>
            </div>
            <div className="trust__item">
              <IconBolt />
              <div>
                <h3>Liquidación instantánea</h3>
                <p>Al ganar el lote, el activo tokenizado y el pago se intercambian en la misma transacción.</p>
              </div>
            </div>
          </div>
        </section>

        {/* CÓMO FUNCIONA */}
        <section className="how" id="como-funciona">
          <div className="bh-container">
            <h2>Cómo funciona una subasta</h2>
            <div className="how__grid">
              {steps.map((step) => (
                <div className="how__step" key={step.n}>
                  <span className="how__n">{step.n}</span>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        

        {/* CTA VENDER */}
        <section className="cta" id="vender">
          <div className="bh-container cta__inner">
            <div>
              <h2>¿Tienes un activo de alto valor?</h2>
              <p>
                Nuestro equipo de autentificación tasa la pieza, la tokeniza y la lista con su historial
                completo de procedencia verificable.
              </p>
            </div>
            <button className="btn btn--primary">Solicitar tasación</button>
          </div>
        </section>
      </main>

      
    </div>
  );
}
