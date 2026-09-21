import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, usd } from '../api';
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

export default function Vender() {
  const navigate = useNavigate();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [form, setForm] = useState({
    nombre: '',
    categoriaId: '',
    descripcion: '',
    condicion: 'nuevo',
    precioBase: '',
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

  async function publicar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      await api('/api/subastas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: form.nombre,
          categoriaId: form.categoriaId || null,
          descripcion: form.descripcion,
          condicion: form.condicion,
          precioBase: Number(form.precioBase),
          incrementoMinimo: Number(form.incrementoMinimo || 0),
          duracionDias: Number(form.duracionDias),
          imagenUrl: form.imagenUrl.trim() || null,
        }),
      });
      navigate('/perfil');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo publicar el activo');
      setEnviando(false);
    }
  }

  const categoria = categorias.find((c) => c.id === form.categoriaId)?.nombre;
  const imagenUrl = form.imagenUrl.trim();

  return (
    <main className="bh-container sell-page">
      <header className="sell-header">
        <h1>Vender un activo</h1>
        <p>Publica tu activo de alto valor. Será verificado antes de salir a subasta.</p>
      </header>

      <div className="sell-layout">
        <form className="sell-form" onSubmit={publicar}>
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

          <div className="sell-field">
            <label htmlFor="precio">Precio base (USD)</label>
            <input id="precio" type="number" required min="1" step="any" placeholder="28500" value={form.precioBase} onChange={cambiar('precioBase')} />
          </div>

          <div className="sell-field">
            <label htmlFor="incremento">Incremento mínimo de puja (USD)</label>
            <input id="incremento" type="number" min="0" step="any" value={form.incrementoMinimo} onChange={cambiar('incrementoMinimo')} />
          </div>

          <div className="sell-field">
            <label htmlFor="duracion">Duración de la subasta</label>
            <select id="duracion" value={form.duracionDias} onChange={cambiar('duracionDias')}>
              {DURACIONES.map((d) => (
                <option key={d} value={d}>{d} días</option>
              ))}
            </select>
          </div>

          <div className="sell-field">
            <label htmlFor="imagen">URL de la imagen</label>
            <input id="imagen" type="url" placeholder="https://..." value={form.imagenUrl} onChange={cambiar('imagenUrl')} />
          </div>

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
            <div className="catalog-card__image-wrapper">
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
                <span className="status status--pending">• En verificación</span>
              </div>
              <h3 className="catalog-card__title">{form.nombre || 'Nombre del activo'}</h3>
              <div className="catalog-card__hash">
                {Number(form.precioBase) > 0 ? usd(Number(form.precioBase)) : 'Precio base'}
              </div>
            </div>
          </article>
        </aside>
      </div>
    </main>
  );
}
