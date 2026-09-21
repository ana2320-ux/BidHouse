import { useEffect, useState } from 'react';
import { api } from '../api';
import './Catalogo.css';

interface Categoria {
  id: string;
  nombre: string;
}

interface Subasta {
  id: string;
  titulo: string;
  activos: {
    imagenes: string[] | null;
    esta_verificado: boolean;
    categorias: { nombre: string } | null;
  } | null;
}

const TODOS = 'Todos';

const hashCorto = (id: string) => {
  const hex = id.replace(/-/g, '').toUpperCase();
  return `0x${hex.slice(0, 6)} ... ${hex.slice(-4)}`;
};

export default function Catalogo() {
  const [subastas, setSubastas] = useState<Subasta[] | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [filtro, setFiltro] = useState(TODOS);
  const [error, setError] = useState(false);

  useEffect(() => {
    api<Subasta[]>('/api/subastas').then(setSubastas).catch(() => setError(true));
    api<Categoria[]>('/api/categorias').then(setCategorias).catch(() => setError(true));
  }, []);

  const visibles = (subastas ?? []).filter(
    (s) => filtro === TODOS || s.activos?.categorias?.nombre === filtro,
  );

  return (
    <main className="bh-container catalog-page">
      {/* Encabezado */}
      <header className="catalog-header">
        <div>
          <h1>Catálogo de activos de alto valor</h1>
          <p>Participa en subastas respaldadas por contratos inteligentes con total seguridad jurídica.</p>
        </div>

      </header>

      {/* Barra de búsqueda */}
      <div className="search-container">
        <svg className="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input type="text" placeholder="Buscar activos..." className="search-input" />
        <span className="search-shortcut">Ctrl + K</span>
      </div>

      {/* Filtros */}
      <div className="filters-container">
        {[TODOS, ...categorias.map((c) => c.nombre)].map((nombre) => (
          <button
            key={nombre}
            className={`filter-pill ${nombre === filtro ? 'active' : ''}`}
            onClick={() => setFiltro(nombre)}
          >
            {nombre}
          </button>
        ))}
      </div>

      {error && <p>No se pudo conectar con el backend. Verifica que esté corriendo en el puerto 8080.</p>}
      {!error && subastas && visibles.length === 0 && <p>Aún no hay activos publicados en esta categoría.</p>}

      {/* Grid de Tarjetas */}
      <div className="catalog-grid">
        {visibles.map((item) => {
          const disponible = item.activos?.esta_verificado ?? false;
          const imagen = item.activos?.imagenes?.[0];
          return (
            <article key={item.id} className="catalog-card">
              <div className="catalog-card__image-wrapper">
                {imagen && <img src={imagen} alt={item.titulo} />}
              </div>
              <div className="catalog-card__content">
                <div className="catalog-card__meta">
                  <span className="category">{(item.activos?.categorias?.nombre ?? 'SIN CATEGORÍA').toUpperCase()}</span>
                  <span className={`status ${disponible ? 'status--available' : 'status--pending'}`}>
                    • {disponible ? 'Disponible' : 'En verificación'}
                  </span>
                </div>
                <h3 className="catalog-card__title">{item.titulo}</h3>
                <div className="catalog-card__hash">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                  </svg>
                  {hashCorto(item.id)}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}
