import { useEffect, useMemo, useRef, useState } from 'react';
import './UbicacionInput.css';

interface UbicacionInputProps {
  pais: string;
  ciudad: string;
  onPaisChange: (pais: string) => void;
  onCiudadChange: (ciudad: string) => void;
  errorPais?: boolean;
  errorCiudad?: boolean;
}

// Forma de cada país en la respuesta de countriesnow.space.
type PaisApi = { country: string; iso2?: string; cities: string[] };

type Opcion = {
  valor: string;     // lo que se guarda (nombre en inglés, como lo da la API)
  etiqueta: string;  // lo que se muestra (en español cuando se puede)
  banderaUrl?: string;
};

// Una lista de miles de ciudades (EE. UU., India...) hace lento el menú;
// se muestran las primeras y el buscador filtra el resto.
const MAX_OPCIONES = 300;

const nombresEs = new Intl.DisplayNames(['es'], { type: 'region' });

function nombreEnEspanol(p: PaisApi): string {
  if (!p.iso2) return p.country;
  try {
    return nombresEs.of(p.iso2.toUpperCase()) ?? p.country;
  } catch {
    return p.country;
  }
}

function Bandera({ url }: { url?: string }) {
  const [fallo, setFallo] = useState(false);
  if (!url || fallo) return null;
  return <img src={url} alt="" onError={() => setFallo(true)} />;
}

// Desplegable con buscador. Copia el aspecto del selector de prefijo de PhoneInput
// para que todo el formulario de registro se vea igual.
function Desplegable({
  id,
  valor,
  opciones,
  onCambio,
  placeholder,
  placeholderBusqueda,
  deshabilitado,
  error,
}: {
  id: string;
  valor: string;
  opciones: Opcion[];
  onCambio: (valor: string) => void;
  placeholder: string;
  placeholderBusqueda: string;
  deshabilitado?: boolean;
  error?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cerrar = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setAbierto(false);
    };
    document.addEventListener('mousedown', cerrar);
    return () => document.removeEventListener('mousedown', cerrar);
  }, []);

  const seleccionada = opciones.find((o) => o.valor === valor);

  const filtradas = useMemo(() => {
    const termino = busqueda.trim().toLocaleLowerCase('es');
    const lista = termino
      ? opciones.filter((o) =>
          o.etiqueta.toLocaleLowerCase('es').includes(termino)
          || o.valor.toLocaleLowerCase('es').includes(termino))
      : opciones;
    return lista.slice(0, MAX_OPCIONES);
  }, [busqueda, opciones]);

  const elegir = (opcion: Opcion) => {
    onCambio(opcion.valor);
    setBusqueda('');
    setAbierto(false);
  };

  return (
    <div className="ubicacion-select" ref={ref}>
      <button
        type="button"
        id={id}
        className={`ubicacion-select__boton ${error ? 'ubicacion-select__boton--error' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-controls={`${id}-lista`}
        disabled={deshabilitado}
        onClick={() => setAbierto((v) => !v)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setAbierto(false);
        }}
      >
        <span className={`ubicacion-select__valor ${seleccionada ? '' : 'ubicacion-select__valor--vacio'}`}>
          {seleccionada && <Bandera url={seleccionada.banderaUrl} />}
          <span>{seleccionada ? seleccionada.etiqueta : placeholder}</span>
        </span>
        <span aria-hidden="true">⌄</span>
      </button>

      {abierto && (
        <div className="ubicacion-select__menu" id={`${id}-lista`} role="listbox">
          <input
            type="search"
            className="ubicacion-select__buscar"
            placeholder={placeholderBusqueda}
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setAbierto(false);
              // Enter elige la primera coincidencia en vez de enviar el formulario.
              if (event.key === 'Enter') {
                event.preventDefault();
                if (filtradas[0]) elegir(filtradas[0]);
              }
            }}
            aria-label={placeholderBusqueda}
            autoFocus
          />
          <div className="ubicacion-select__opciones">
            {filtradas.map((opcion) => (
              <button
                type="button"
                role="option"
                aria-selected={opcion.valor === valor}
                className="ubicacion-select__opcion"
                key={opcion.valor}
                onClick={() => elegir(opcion)}
              >
                <Bandera url={opcion.banderaUrl} />
                <span>{opcion.etiqueta}</span>
              </button>
            ))}
            {!filtradas.length && <span className="ubicacion-select__vacio">Sin resultados.</span>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function UbicacionInput({
  pais,
  ciudad,
  onPaisChange,
  onCiudadChange,
  errorPais,
  errorCiudad
}: UbicacionInputProps) {
  const [dataUbicacion, setDataUbicacion] = useState<PaisApi[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const fetchUbicaciones = async () => {
      try {
        const res = await fetch('https://countriesnow.space/api/v0.1/countries');
        const json = await res.json();
        if (!json.error) setDataUbicacion(json.data as PaisApi[]);
      } catch (err) {
        console.error('Error al cargar la API de ubicación:', err);
      } finally {
        setCargando(false);
      }
    };
    fetchUbicaciones();
  }, []);

  // La lista general (/countries) trae las ciudades recortadas: a Colombia le
  // faltan Bogotá y Medellín. /countries/cities devuelve la lista completa, así
  // que se pide por país al elegirlo. Si falla, se usa la recortada.
  const [ciudadesDelPais, setCiudadesDelPais] = useState<string[]>([]);
  const [cargandoCiudades, setCargandoCiudades] = useState(false);
  const cacheCiudades = useRef(new Map<string, string[]>());

  useEffect(() => {
    if (!pais || cargando) return;
    const enCache = cacheCiudades.current.get(pais);
    if (enCache) {
      setCiudadesDelPais(enCache);
      return;
    }
    // Si el usuario cambia de país antes de que llegue la respuesta, se descarta.
    let vigente = true;
    const respaldo = dataUbicacion.find((item) => item.country === pais)?.cities ?? [];
    setCargandoCiudades(true);
    fetch('https://countriesnow.space/api/v0.1/countries/cities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ country: pais }),
    })
      .then((res) => res.json())
      .then((json) => {
        const lista: string[] = !json.error && Array.isArray(json.data) && json.data.length ? json.data : respaldo;
        cacheCiudades.current.set(pais, lista);
        if (vigente) setCiudadesDelPais(lista);
      })
      .catch((err) => {
        console.error('Error al cargar las ciudades:', err);
        if (vigente) setCiudadesDelPais(respaldo);
      })
      .finally(() => {
        if (vigente) setCargandoCiudades(false);
      });
    return () => { vigente = false; };
  }, [pais, cargando, dataUbicacion]);

  // El valor guardado sigue siendo el nombre en inglés de la API (es lo que
  // espera /countries/cities y lo que ya hay en la BD); solo la etiqueta se traduce.
  const opcionesPais = useMemo<Opcion[]>(() =>
    dataUbicacion
      .map((p) => ({
        valor: p.country,
        etiqueta: nombreEnEspanol(p),
        banderaUrl: p.iso2 ? `https://flagcdn.com/w40/${p.iso2.toLowerCase()}.png` : undefined,
      }))
      .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es')),
  [dataUbicacion]);

  const opcionesCiudad = useMemo<Opcion[]>(() =>
    [...new Set(ciudadesDelPais)]
      .sort((a, b) => a.localeCompare(b, 'es'))
      .map((c) => ({ valor: c, etiqueta: c })),
  [ciudadesDelPais]);

  return (
    <div className="registro-fila">
      <div className="bh-campo">
        <label htmlFor="pais">País</label>
        <Desplegable
          id="pais"
          valor={pais}
          opciones={opcionesPais}
          onCambio={onPaisChange}
          placeholder={cargando ? 'Cargando países...' : 'Selecciona un país'}
          placeholderBusqueda="Buscar país"
          deshabilitado={cargando}
          error={errorPais}
        />
      </div>

      <div className="bh-campo">
        <label htmlFor="ciudad">Ciudad</label>
        <Desplegable
          id="ciudad"
          valor={ciudad}
          opciones={opcionesCiudad}
          onCambio={onCiudadChange}
          placeholder={
            !pais
              ? 'Primero elige un país'
              : cargando || cargandoCiudades
              ? 'Cargando ciudades...'
              : opcionesCiudad.length === 0
              ? 'Sin ciudades disponibles'
              : 'Selecciona una ciudad'
          }
          placeholderBusqueda="Buscar ciudad"
          deshabilitado={!pais || cargando || cargandoCiudades || opcionesCiudad.length === 0}
          error={errorCiudad}
        />
      </div>
    </div>
  );
}