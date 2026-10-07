import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import SubastaCard, { type SubastaCardData } from '../components/SubastaCard';
import './Catalogo.css';

interface Categoria {
  id: string;
  nombre: string;
}

const TODOS = 'Todos';

export default function Catalogo() {
  const [subastas, setSubastas] = useState<SubastaCardData[] | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  // ?categoria=Vehículos en la URL (lo usa el home al hacer clic en una
  // categoría) deja el filtro elegido desde el principio.
  const [params] = useSearchParams();
  const [filtro, setFiltro] = useState(params.get('categoria') ?? TODOS);
  const [error, setError] = useState(false);

  useEffect(() => {
    api<SubastaCardData[]>('/api/subastas').then(setSubastas).catch(() => setError(true));
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
        {visibles.map((item) => <SubastaCard key={item.id} subasta={item} />)}
      </div>
    </main>
  );
}
