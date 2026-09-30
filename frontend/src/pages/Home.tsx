import "./Home.css";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { leerSesion } from "../lib/sesion";
import HomeUsuario from "./HomeUsuario";
import daytona from "../assets/daytona.jpg";

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

const categorias = ["Relojes", "Arte", "Autos clásicos", "Inmuebles", "Joyería", "Coleccionables"];

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

// ---------- Animaciones ----------

// Agrega la clase "visible" a los .reveal cuando entran en pantalla; el CSS hace
// la transición. Se observa una sola vez por elemento para no re-animar al subir.
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("visible");
            obs.unobserve(e.target);
          }
        }),
      { threshold: 0.15 },
    );
    ref.current?.querySelectorAll(".reveal").forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);
  return ref;
}

// ponytail: lote de muestra solo decorativo; si se quiere real, tomar la primera de GET /api/subastas.
function TicketDemo() {
  const [segundos, setSegundos] = useState(2 * 3600 + 14 * 60 + 37);
  const [oferta, setOferta] = useState(48500);
  const [pulso, setPulso] = useState(false);

  useEffect(() => {
    const reloj = setInterval(() => setSegundos((s) => (s > 0 ? s - 1 : 0)), 1000);
    // Simula una puja nueva cada pocos segundos para que el hero "viva".
    const pujas = setInterval(() => {
      setOferta((o) => o + 500 * (1 + Math.floor(Math.random() * 3)));
      setPulso(true);
      setTimeout(() => setPulso(false), 700);
    }, 4500);
    return () => {
      clearInterval(reloj);
      clearInterval(pujas);
    };
  }, []);

  const hh = String(Math.floor(segundos / 3600)).padStart(2, "0");
  const mm = String(Math.floor((segundos % 3600) / 60)).padStart(2, "0");
  const ss = String(segundos % 60).padStart(2, "0");

  return (
    <div className="ticket" aria-hidden="true">
      <div className="ticket__head">
        <span className="ticket__lot">LOTE Nº 0142</span>
        <span className="ticket__live">
          <i className="dot" /> EN VIVO
        </span>
      </div>
      <div className="ticket__image">
        {/* Foto de Cash Macanaya en Unsplash (licencia libre, sin atribución obligatoria). */}
        <img src={daytona} alt="" />
      </div>
      <h3 className="ticket__title">Rolex Daytona Cosmograph</h3>
      <p className="ticket__category">Relojes · Pieza certificada</p>
      <div className="ticket__row">
        <div>
          <span className="ticket__label">Oferta actual</span>
          <span className={`ticket__bid ${pulso ? "ticket__bid--pulso" : ""}`}>
            US$ {oferta.toLocaleString("es-CO")}
          </span>
        </div>
        <div>
          <span className="ticket__label">Cierra en</span>
          <span className="ticket__timer">
            {hh}:{mm}:{ss}
          </span>
        </div>
      </div>
      <div className="ticket__foot">
        <span>Verificado en cadena</span>
        <span className="ticket__hash">0x7a3f…e91c</span>
      </div>
    </div>
  );
}

// ---------- Página ----------

export default function Home() {
  const ref = useReveal();

  // Con sesión se muestra el home personalizado; sin sesión, el público.
  const sesion = leerSesion();
  if (sesion) return <HomeUsuario sesion={sesion} />;

  return (
    <div className="bh" ref={ref}>
      <main>
        {/* HERO */}
        <section className="hero">
          <div className="hero__aurora" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="bh-container hero__grid">
            <div className="hero__copy">
              <p className="hero__kicker fade-up">Subastas de alto valor · Custodia en escrow</p>
              <h1 className="fade-up" style={{ animationDelay: "0.1s" }}>
                Subastas verificadas en <span className="shimmer">blockchain</span>.
                <br />
                El activo cambia de dueño en el mismo bloque.
              </h1>
              <p className="hero__sub fade-up" style={{ animationDelay: "0.2s" }}>
                BidLuxury organiza subastas de relojes, arte, autos clásicos y bienes raíces de alto valor,
                con custodia en contrato inteligente y liquidación instantánea. Ninguna subasta se pierde,
                ninguna transferencia depende de un tercero.
              </p>
              <div className="hero__actions fade-up" style={{ animationDelay: "0.3s" }}>
                <Link to="/catalogo" className="btn btn--primary">
                  Ver subastas activas
                </Link>
                <Link to="/como-funciona" className="btn btn--light">
                  Cómo se verifica un lote
                </Link>
              </div>
            </div>

            <div className="hero__ticket fade-up" style={{ animationDelay: "0.4s" }}>
              <TicketDemo />
            </div>
          </div>
        </section>

        {/* CINTA DE CATEGORÍAS */}
        <div className="marquee" aria-hidden="true">
          <div className="marquee__track">
            {/* Se duplica la lista para que el desplazamiento sea continuo. */}
            {[...categorias, ...categorias].map((c, i) => (
              <span key={i}>
                {c} <b>✦</b>
              </span>
            ))}
          </div>
        </div>

        {/* BARRA DE CONFIANZA */}
        <section className="trust" id="seguridad">
          <div className="bh-container trust__grid">
            {[
              { Icon: IconShield, t: "Custodia en escrow", p: "Los fondos de cada puja quedan bloqueados en un contrato auditado hasta que cierra el lote." },
              { Icon: IconLedger, t: "Procedencia pública", p: "Cada transferencia de propiedad queda escrita en un registro que cualquiera puede consultar." },
              { Icon: IconBolt, t: "Liquidación instantánea", p: "Al ganar el lote, el activo tokenizado y el pago se intercambian en la misma transacción." },
            ].map(({ Icon, t, p }, i) => (
              <div className="trust__item reveal" key={t} style={{ transitionDelay: `${i * 0.12}s` }}>
                <div className="trust__icon">
                  <Icon />
                </div>
                <div>
                  <h3>{t}</h3>
                  <p>{p}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CÓMO FUNCIONA */}
        <section className="how" id="como-funciona">
          <div className="bh-container">
            <h2 className="reveal">Cómo funciona una subasta</h2>
            <div className="how__grid">
              {steps.map((step, i) => (
                <div className="how__step reveal" key={step.n} style={{ transitionDelay: `${i * 0.12}s` }}>
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
          <div className="bh-container">
            <div className="cta__inner reveal">
              <div>
                <h2>¿Tienes un activo de alto valor?</h2>
                <p>
                  Nuestro equipo de autentificación tasa la pieza, la tokeniza y la lista con su historial
                  completo de procedencia verificable.
                </p>
              </div>
              <Link to="/vender" className="btn btn--primary">
                Solicitar tasación
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
