import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api, ApiError, usd } from '../api';
import { ETIQUETA_MODO, type Modo } from '../lib/modos';
import { leerSesion } from '../lib/sesion';
import './Catalogo.css';
import './Vender.css';

interface Categoria {
  id: string;
  nombre: string;
}

const CONDICIONES = [
  { valor: 'nuevo', etiqueta: 'Nuevo' },
  { valor: 'como_nuevo', etiqueta: 'Como nuevo' },
  { valor: 'buen_estado', etiqueta: 'Buen estado' },
  { valor: 'aceptable', etiqueta: 'Aceptable' },
];

const DURACIONES = [3, 5, 7, 14, 30];

// Los tres modos de venta. El backend los guarda como permite_pujas +
// precio_compra_inmediata (ver NuevaSubasta.java). Los nombres salen de
// lib/modos.ts para que sean los mismos que ve el catálogo.
const MODOS: { valor: Modo; titulo: string; descripcion: string; icono: string }[] = [
  {
    valor: 'subasta',
    titulo: ETIQUETA_MODO.subasta,
    descripcion: 'Recibe pujas hasta la fecha de cierre. Gana la oferta más alta.',
    icono: '⚖',
  },
  {
    valor: 'precio_fijo',
    titulo: ETIQUETA_MODO.precio_fijo,
    descripcion: 'Pones un precio y el primero que lo pague se lo lleva.',
    icono: '🏷',
  },
  {
    valor: 'mixto',
    titulo: ETIQUETA_MODO.mixto,
    descripcion: 'Recibe pujas y ofrece "Cómpralo ya" hasta que llegue la primera puja.',
    icono: '⚡',
  },
];

// Publicar exige sesión: el backend vende a nombre de quien trae el token.
// El guardia va aparte por la regla de los hooks (no se puede hacer return
// antes de un useState), igual que en Perfil.
export default function Vender() {
  if (!leerSesion()) return <Navigate to="/login" replace state={{ desde: '/vender' }} />;
  return <FormularioVenta />;
}

function FormularioVenta() {
  const navigate = useNavigate();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [modo, setModo] = useState<Modo>('subasta');
  const [form, setForm] = useState({
    nombre: '',
    categoriaId: '',
    descripcion: '',
    condicion: 'nuevo',
    precioBase: '',
    precioCompraInmediata: '',
    incrementoMinimo: '0',
    duracionDias: '7',
    imagenUrl: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    api<Categoria[]>('/api/categorias')
      .then(setCategorias)
      .catch(() => setError('No se pudieron cargar las categorías. ¿Está corriendo el backend?'));
  }, []);

  const cambiar = (campo: keyof typeof form) =>
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const valor = e.target.value;
      setForm((f) => ({ ...f, [campo]: valor }));
    };

  // Qué pide cada modo. Se deriva del modo en cada dibujo en vez de guardarlo
  // en el estado, así nunca se desincroniza.
  const conPujas = modo !== 'precio_fijo';
  const conCompraloYa = modo !== 'subasta';

  const base = Number(form.precioBase);
  const ya = Number(form.precioCompraInmediata);

  async function publicar(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    // Aviso rápido antes de ir al backend (que igual revisa todo en NuevaSubasta.validar()).
    if (modo === 'mixto' && ya <= base) {
      setError('El precio de "Cómpralo ya" debe ser mayor al precio base.');
      return;
    }

    setEnviando(true);
    try {
      const creada = await api<{ id: string }>('/api/subastas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: form.nombre,
          categoriaId: form.categoriaId || null,
          descripcion: form.descripcion,
          condicion: form.condicion,
          modo,
          // Solo se mandan los precios que usa el modo elegido.
          precioBase: conPujas ? base : null,
          precioCompraInmediata: conCompraloYa ? ya : null,
          incrementoMinimo: conPujas ? Number(form.incrementoMinimo || 0) : 0,
          duracionDias: Number(form.duracionDias),
          imagenUrl: form.imagenUrl.trim() || null,
        }),
      });
      // Directo a la publicación recién creada, para verla como la verán los demás.
      navigate(`/activo/${creada.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        navigate('/login', { state: { desde: '/vender' } });
        return;
      }
      setError(err instanceof Error ? err.message : 'No se pudo publicar el activo');
      setEnviando(false);
    }
  }

  const categoria = categorias.find((c) => c.id === form.categoriaId)?.nombre;
  const imagenUrl = form.imagenUrl.trim();

  // Texto de precio de la vista previa según el modo.
  const precioVista =
    modo === 'precio_fijo'
      ? (ya > 0 ? usd(ya) : 'Precio de venta')
      : base > 0
        ? `Desde ${usd(base)}${modo === 'mixto' && ya > 0 ? ` · Cómpralo ya ${usd(ya)}` : ''}`
        : 'Precio base';

  return (
    <main className="bh-container sell-page">
      <header className="sell-header">
        <h1>Vender un activo</h1>
        <p>Elige cómo quieres venderlo. Tu publicación sale al catálogo apenas la publiques.</p>
      </header>

      <div className="sell-layout">
        <form className="sell-form" onSubmit={publicar}>
          {/* ── Modo de venta ── */}
          <fieldset className="sell-field--full sell-modos">
            <legend>¿Cómo quieres venderlo?</legend>
            {MODOS.map((m) => (
              <label key={m.valor} className={`sell-modo ${modo === m.valor ? 'sell-modo--activo' : ''}`}>
                {/* Radio real (accesible con teclado), oculto: se ve la tarjeta. */}
                <input
                  type="radio"
                  name="modo"
                  value={m.valor}
                  checked={modo === m.valor}
                  onChange={() => setModo(m.valor)}
                />
                <span className="sell-modo__icono" aria-hidden="true">{m.icono}</span>
                <strong>{m.titulo}</strong>
                <span className="sell-modo__desc">{m.descripcion}</span>
              </label>
            ))}
          </fieldset>

          {/* ── El activo ── */}
          <div className="sell-field sell-field--full">
            <label htmlFor="nombre">Nombre del activo</label>
            <input id="nombre" required maxLength={150} placeholder="Ej: Rolex Daytona Cosmograph" value={form.nombre} onChange={cambiar('nombre')} />
          </div>

          <div className="sell-field">
            <label htmlFor="categoria">Categoría</label>
            <select id="categoria" required value={form.categoriaId} onChange={cambiar('categoriaId')}>
              <option value="">Selecciona una categoría</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>

          <div className="sell-field">
            <label htmlFor="condicion">Condición</label>
            <select id="condicion" value={form.condicion} onChange={cambiar('condicion')}>
              {CONDICIONES.map((c) => (
                <option key={c.valor} value={c.valor}>{c.etiqueta}</option>
              ))}
            </select>
          </div>

          <div className="sell-field sell-field--full">
            <label htmlFor="descripcion">Descripción</label>
            <textarea id="descripcion" placeholder="Estado, historial, documentos, detalles relevantes..." value={form.descripcion} onChange={cambiar('descripcion')} />
          </div>

          {/* ── Precios: cambian según el modo ── */}
          {conPujas && (
            <div className="sell-field">
              <label htmlFor="precio">Precio base (USD)</label>
              <input id="precio" type="number" required min="1" step="any" placeholder="28500" value={form.precioBase} onChange={cambiar('precioBase')} />
              <span className="sell-ayuda">La primera puja debe ser al menos este valor.</span>
            </div>
          )}

          {conCompraloYa && (
            <div className="sell-field">
              <label htmlFor="compraloYa">{modo === 'precio_fijo' ? 'Precio de venta (USD)' : 'Precio "Cómpralo ya" (USD)'}</label>
              <input id="compraloYa" type="number" required min="1" step="any" placeholder={modo === 'precio_fijo' ? '28500' : '35000'} value={form.precioCompraInmediata} onChange={cambiar('precioCompraInmediata')} />
              <span className="sell-ayuda">
                {modo === 'precio_fijo'
                  ? 'Quien pague este precio se lo lleva.'
                  : 'Mayor al precio base. Desaparece cuando llega la primera puja.'}
              </span>
            </div>
          )}

          {conPujas && (
            <div className="sell-field">
              <label htmlFor="incremento">Incremento mínimo de puja (USD)</label>
              <input id="incremento" type="number" min="0" step="any" value={form.incrementoMinimo} onChange={cambiar('incrementoMinimo')} />
              <span className="sell-ayuda">Cuánto debe subir cada puja sobre la anterior.</span>
            </div>
          )}

          <div className="sell-field">
            <label htmlFor="duracion">{conPujas ? 'Duración de la subasta' : 'Tiempo publicado'}</label>
            <select id="duracion" value={form.duracionDias} onChange={cambiar('duracionDias')}>
              {DURACIONES.map((d) => (
                <option key={d} value={d}>{d} días</option>
              ))}
            </select>
          </div>

          <SubirImagen
            url={form.imagenUrl}
            alCambiar={(url) => setForm((f) => ({ ...f, imagenUrl: url }))}
          />

          {error && <p className="sell-error" role="alert">{error}</p>}

          <div className="sell-actions">
            <Link to="/perfil" className="sell-cancel">Cancelar</Link>
            <button type="submit" className="btn sell-btn" disabled={enviando}>
              {enviando ? 'Publicando...' : 'Publicar activo'}
            </button>
          </div>
        </form>

        <aside className="sell-preview">
          <h2>Así se verá en el catálogo</h2>
          <article className="catalog-card">
            <div className="catalog-card__image-wrapper sell-preview__imagen">
              {!imagenUrl && <span className="sell-preview__sin-imagen">Sin imagen</span>}
              {imagenUrl && (
                <img
                  key={imagenUrl}
                  src={imagenUrl}
                  alt={form.nombre || 'Vista previa'}
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              )}
            </div>
            <div className="catalog-card__content">
              <div className="catalog-card__meta">
                <span className="category">{(categoria ?? 'CATEGORÍA').toUpperCase()}</span>
                <span className={`status status--${modo}`}>{ETIQUETA_MODO[modo]}</span>
              </div>
              <h3 className="catalog-card__title">{form.nombre || 'Nombre del activo'}</h3>
              <div className="catalog-card__hash">{precioVista}</div>
            </div>
          </article>
        </aside>
      </div>
    </main>
  );
}

// ── Imagen del activo ──
// Se sube apenas se elige (POST /api/activos/imagenes) y el formulario guarda
// solo la URL que devuelve el backend; publicar manda esa URL como antes.
const MAX_IMAGEN = 5 * 1024 * 1024; // 5 MB, igual que el bucket "activos"

function SubirImagen({ url, alCambiar }: { url: string; alCambiar: (url: string) => void }) {
  // El <input type="file"> real va oculto; el botón le "hace clic" por esta referencia.
  const inputRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState('');

  const alElegir = async (e: ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    e.target.value = ''; // permite volver a elegir el mismo archivo
    if (!archivo) return;
    setError('');
    if (archivo.size > MAX_IMAGEN) {
      setError('La imagen no puede pesar más de 5 MB.');
      return;
    }

    // multipart/form-data: el navegador arma el Content-Type con su "boundary".
    const datos = new FormData();
    datos.append('imagen', archivo);
    setSubiendo(true);
    try {
      const { url: subida } = await api<{ url: string }>('/api/activos/imagenes', { method: 'POST', body: datos });
      alCambiar(subida);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo subir la imagen.');
    } finally {
      setSubiendo(false);
    }
  };

  return (
    <div className="sell-field sell-field--full">
      <span className="sell-imagen__titulo">Imagen del activo</span>
      <div className="sell-imagen">
        <div className="sell-imagen__miniatura">
          {url ? <img src={url} alt="Imagen del activo" /> : <span aria-hidden="true">🖼</span>}
        </div>
        <div className="sell-imagen__acciones">
          <button type="button" className="sell-imagen__boton" onClick={() => inputRef.current?.click()} disabled={subiendo}>
            {subiendo ? 'Subiendo…' : url ? 'Cambiar imagen' : 'Subir imagen'}
          </button>
          {url && !subiendo && (
            <button type="button" className="sell-imagen__quitar" onClick={() => alCambiar('')}>
              Quitar
            </button>
          )}
          <span className="sell-ayuda">JPG, PNG o WEBP · máximo 5 MB</span>
        </div>
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={alElegir} hidden />
      {error && <p className="sell-imagen__error">{error}</p>}
    </div>
  );
}
