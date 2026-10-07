import { useEffect, useState } from 'react';
import { api, ApiError } from '../api';
import './CategoriaSelector.css';

type Categoria = { id: string; nombre: string };

type Props = {
  value: string[];
  onChange: (ids: string[]) => void;
  soloLectura?: boolean;
};

export default function CategoriaSelector({ value, onChange, soloLectura = false }: Props) {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api<Categoria[]>('/api/categorias')
      .then(setCategorias)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudieron cargar las categorías.'))
      .finally(() => setCargando(false));
  }, []);

  const cambiar = (id: string) => {
    onChange(value.includes(id) ? value.filter((actual) => actual !== id) : [...value, id]);
  };

  if (cargando) return <p className="categoria-selector__estado">Cargando categorías…</p>;
  if (error) return <p className="categoria-selector__error" role="alert">{error}</p>;
  if (categorias.length === 0) return <p className="categoria-selector__estado">Todavía no hay categorías disponibles.</p>;

  if (soloLectura) {
    const seleccionadas = categorias.filter((categoria) => value.includes(categoria.id));
    return (
      <div className="categoria-selector__lectura" aria-label="Preferencias seleccionadas">
        {seleccionadas.map((categoria) => <span className="categoria-selector__chip" key={categoria.id}>{categoria.nombre}</span>)}
      </div>
    );
  }

  return (
    <fieldset className="categoria-selector">
      <legend className="sr-solo">Categorías de interés</legend>
      <div className="categoria-selector__grid">
        {categorias.map((categoria) => (
          <label className={`categoria-selector__opcion ${value.includes(categoria.id) ? 'is-selected' : ''}`} key={categoria.id}>
            <input type="checkbox" checked={value.includes(categoria.id)} onChange={() => cambiar(categoria.id)} />
            <span>{categoria.nombre}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
