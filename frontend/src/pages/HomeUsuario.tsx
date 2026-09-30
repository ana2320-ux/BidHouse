import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import type { Sesion } from '../lib/sesion';
import './HomeUsuario.css';

type Categoria = { id: string; nombre: string };

type SubastaCatalogo = {
  id: string;
  activos: {
    imagenes: string[] | null;
    categorias: { nombre: string } | null;
  } | null;
};

type TarjetaCategoria = Categoria & { imagen: string | null; total: number };

function armarTarjetas(categorias: Categoria[], subastas: SubastaCatalogo[]): TarjetaCategoria[] {
  return categorias
    .map((c) => {
      const deEsta = subastas.filter((s) => s.activos?.categorias?.nombre === c.nombre);
      const imagen = deEsta.map((s) => s.activos?.imagenes?.[0]).find(Boolean) ?? null;
      return { ...c, imagen, total: deEsta.length };
    })
    .sort((a, b) => b.total - a.total);
}

export default function HomeUsuario({ sesion }: { sesion: Sesion }) {
  const { usuario } = sesion;
  const [tarjetas, setTarjetas] = useState<TarjetaCategoria[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    Promise.all([
      api<Categoria[]>('/api/categorias'),
      api<SubastaCatalogo[]>('/api/subastas'),
    ])
      .then(([categorias, subastas]) => setTarjetas(armarTarjetas(categorias, subastas)))
      .catch(() => setError(true));
  }, []);

  return (
    <main className="inicio">
      {/* ── Saludo + panel de categorías (Hero) ── */}
      <section className="inicio-hero">
        <div className="bh-container">
          <h1 className="inicio-hero__saludo">Bienvenido, {usuario.nombre}</h1>
          <p className="inicio-hero__sub">¿Qué activo quieres encontrar hoy?</p>

          {error && (
            <p className="inicio-hero__error">
              No pudimos cargar las categorías. Verifica que el backend esté corriendo.
            </p>
          )}

          <div className="inicio-categorias">
            {tarjetas === null && !error &&
              Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="inicio-categoria inicio-categoria--cargando" />
              ))}

            {tarjetas?.map((c) => (
              <Link
                key={c.id}
                to={`/catalogo?categoria=${encodeURIComponent(c.nombre)}`}
                className="inicio-categoria"
              >
                {c.imagen && <img src={c.imagen} alt="" loading="lazy" />}
                <div className="inicio-categoria__texto">
                  <strong>{c.nombre}</strong>
                  <span>{c.total} {c.total === 1 ? 'subasta' : 'subastas'}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Accesos principales ── */}
      <section className="bh-container inicio-accesos">
        <article className="inicio-acceso">
          <h2>Mis pujas</h2>
          <IconoMartillo />
          <p>Aún no tienes pujas. Cuando pujes, aquí verás si vas ganando o si alguien te superó.</p>
          <Link to="/catalogo" className="inicio-acceso__boton">Explorar subastas</Link>
        </article>

        <article className="inicio-acceso">
          <h2>Mis ventas</h2>
          <IconoEtiqueta />
          <p>Publica un activo y sigue sus pujas en tiempo real desde aquí.</p>
          <Link to="/vender" className="inicio-acceso__boton">Vender un activo</Link>
        </article>

        <article className="inicio-acceso">
          <h2>Tu identidad</h2>
          <IconoEscudo />
          {usuario.esta_verificado ? (
            <>
              <p>Tu identidad está verificada. Puedes pujar y vender sin restricciones.</p>
              <span className="inicio-acceso__ok">✓ Verificada</span>
            </>
          ) : (
            <>
              <p>Verifica tu identidad para poder pujar y vender en BidHouse.</p>
              <Link to="/verificacion-kyc" className="inicio-acceso__boton">Verificar identidad</Link>
            </>
          )}
        </article>

        <article className="inicio-acceso">
          <h2>Custodia segura</h2>
          <IconoCandado />
          <p>Tu dinero queda en custodia hasta que confirmes que recibiste el activo.</p>
          <Link to="/como-funciona" className="inicio-acceso__boton">Cómo funciona</Link>
        </article>
      </section>

      {/* ── Servicios ── */}
      <section className="bh-container inicio-servicios">
        <h2 className="inicio-servicios__titulo">Servicios para vender mejor</h2>

        <div className="inicio-plus">
          <div>
            <span className="inicio-plus__etiqueta">BidHouse Plus · Suscripción</span>
            <h3>Paga menos comisión en cada venta</h3>
            <p>Para vendedores frecuentes: tu comisión por venta baja del 3% al 1%.</p>
          </div>
          <div className="inicio-plus__comision" aria-label="Comisión del 3% al 1%">
            <span className="inicio-plus__antes">3%</span>
            <span aria-hidden="true">→</span>
            <span className="inicio-plus__despues">1%</span>
          </div>
          <button type="button" className="btn btn--primary inicio-plus__boton" disabled>Próximamente</button>
        </div>

        <div className="inicio-servicios__grid">
          <article className="inicio-servicio">
            <IconoCohete />
            <div>
              <h3>Destaca tu publicación</h3>
              <p>Tu subasta aparece primero en el catálogo y en la página de inicio, para llegar a más compradores.</p>
              <button type="button" className="inicio-servicio__boton" disabled>Próximamente</button>
            </div>
          </article>

          <article className="inicio-servicio">
            <IconoLupa />
            <div>
              <h3>Peritaje certificado</h3>
              <p>Un experto inspecciona y certifica tu activo. Los compradores pujan con más confianza y mejor precio.</p>
              <button type="button" className="inicio-servicio__boton" disabled>Próximamente</button>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}

function IconoMartillo() {
  return (
    <svg viewBox="0 0 48 48" className="inicio-acceso__icono" aria-hidden="true">
      <rect x="10" y="9" width="18" height="10" rx="2" transform="rotate(-35 19 14)" />
      <path d="M22 20l14 14" />
      <path d="M10 40h16" />
    </svg>
  );
}

function IconoEtiqueta() {
  return (
    <svg viewBox="0 0 48 48" className="inicio-acceso__icono" aria-hidden="true">
      <path d="M8 24V10a2 2 0 012-2h14l16 16-16 16L8 24z" />
      <circle cx="16" cy="16" r="3" />
    </svg>
  );
}

function IconoEscudo() {
  return (
    <svg viewBox="0 0 48 48" className="inicio-acceso__icono" aria-hidden="true">
      <path d="M24 6l14 6v10c0 9-6 16.5-14 20-8-3.5-14-11-14-20V12l14-6z" />
      <path d="M18 24l4 4 8-8" />
    </svg>
  );
}

function IconoCandado() {
  return (
    <svg viewBox="0 0 48 48" className="inicio-acceso__icono" aria-hidden="true">
      <rect x="11" y="21" width="26" height="19" rx="3" />
      <path d="M17 21v-5a7 7 0 0114 0v5" />
      <path d="M24 29v4" />
    </svg>
  );
}

function IconoCohete() {
  return (
    <svg viewBox="0 0 48 48" className="inicio-servicio__icono" aria-hidden="true">
      <path d="M24 6c7 5 10 12 9 22l-5 5h-8l-5-5c-1-10 2-17 9-22z" />
      <circle cx="24" cy="19" r="3.5" />
      <path d="M20 38l4 5 4-5" />
    </svg>
  );
}

function IconoLupa() {
  return (
    <svg viewBox="0 0 48 48" className="inicio-servicio__icono" aria-hidden="true">
      <circle cx="21" cy="21" r="12" />
      <path d="M30 30l10 10" />
      <path d="M16 21l4 4 6-7" />
    </svg>
  );
}