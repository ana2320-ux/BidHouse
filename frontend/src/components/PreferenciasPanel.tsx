import { useEffect, useState } from 'react';
import { api, ApiError } from '../api';
import CategoriaSelector from './CategoriaSelector';
import './PreferenciasPanel.css';

type Props = {
  onSaved?: () => void;
  compacto?: boolean;
  modoInicial?: 'lectura' | 'edicion';
  titulo?: string;
  descripcion?: string;
};

export default function PreferenciasPanel({
  onSaved,
  compacto = false,
  modoInicial = 'lectura',
  titulo = '¿Qué activos te interesan?',
  descripcion = 'Selecciona categorías para que podamos mostrarte oportunidades más relevantes.',
}: Props) {
  const [guardadas, setGuardadas] = useState<string[]>([]);
  const [borrador, setBorrador] = useState<string[]>([]);
  const [editando, setEditando] = useState(modoInicial === 'edicion');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  useEffect(() => {
    api<{ categoriaIds: string[] }>('/api/usuarios/preferencias')
      .then((respuesta) => {
        const ids = respuesta.categoriaIds ?? [];
        setGuardadas(ids);
        setBorrador(ids);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudieron cargar tus preferencias.'))
      .finally(() => setCargando(false));
  }, []);

  const guardar = async () => {
    setGuardando(true);
    setError('');
    setExito('');
    try {
      const respuesta = await api<{ categoriaIds: string[] }>('/api/usuarios/preferencias', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoriaIds: borrador }),
      });
      const ids = respuesta.categoriaIds ?? borrador;
      setGuardadas(ids);
      setBorrador(ids);
      setEditando(false);
      setExito('Preferencias actualizadas.');
      onSaved?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron guardar tus preferencias.');
    } finally {
      setGuardando(false);
    }
  };

  const editar = () => {
    setBorrador(guardadas);
    setExito('');
    setError('');
    setEditando(true);
  };

  const cancelar = () => {
    setBorrador(guardadas);
    setError('');
    setExito('');
    setEditando(false);
  };

  const seleccionadas = editando ? borrador : guardadas;

  return (
    <section className={`preferencias-panel ${compacto ? 'preferencias-panel--compacto' : ''}`} aria-labelledby="preferencias-titulo">
      <div className="preferencias-panel__cabecera">
        <div>
          <span className="preferencias-panel__eyebrow">PERSONALIZA TU EXPERIENCIA</span>
          <h2 id="preferencias-titulo">{compacto ? 'Mis preferencias' : titulo}</h2>
          <p>{compacto && !editando && guardadas.length === 0 ? 'Aún no has seleccionado preferencias.' : descripcion}</p>
        </div>
        <span className="preferencias-panel__contador" aria-live="polite">{seleccionadas.length} seleccionadas</span>
      </div>
      {error && <div className="preferencias-panel__mensaje preferencias-panel__mensaje--error" role="alert">{error}</div>}
      {exito && <div className="preferencias-panel__mensaje preferencias-panel__mensaje--exito" role="status">{exito}</div>}
      {cargando ? <p className="preferencias-panel__cargando">Cargando preferencias...</p> : (
        <CategoriaSelector value={seleccionadas} onChange={setBorrador} soloLectura={!editando} />
      )}
      {!cargando && !editando && (
        <button type="button" className="preferencias-panel__editar" onClick={editar}>
          {guardadas.length === 0 ? 'Agregar preferencias' : 'Editar preferencias'}
        </button>
      )}
      {!cargando && editando && (
        <div className="preferencias-panel__acciones">
          <button type="button" className="preferencias-panel__guardar" onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando...' : compacto ? 'Guardar cambios' : 'Guardar preferencias'}
          </button>
          {compacto && <button type="button" className="preferencias-panel__cancelar" onClick={cancelar} disabled={guardando}>Cancelar</button>}
        </div>
      )}
    </section>
  );
}
