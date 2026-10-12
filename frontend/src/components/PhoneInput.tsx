import { useEffect, useMemo, useRef, useState } from 'react';
import { getCountries, getCountryCallingCode, type CountryCode } from 'libphonenumber-js';
import './PhoneInput.css';

export type PaisTelefono = {
  codigo: string;
  nombre: string;
  prefijo: string;
  bandera: string;
  banderaUrl?: string;
};

const urlBandera = (codigo: string) => `https://flagcdn.com/w40/${codigo.toLowerCase()}.png`;

function banderaDesdeCodigo(codigo: string): string {
  return codigo.length === 2
    ? String.fromCodePoint(...codigo.toUpperCase().split('').map((letra) => 127397 + letra.charCodeAt(0)))
    : '🏳️';
}

function crearPaises(): PaisTelefono[] {
  const nombres = new Intl.DisplayNames(['es'], { type: 'region' });
  return getCountries()
    .map((codigo) => {
      const codigoPais = codigo as CountryCode;
      const codigoNormalizado = codigoPais.toUpperCase();
      const nombre = nombres.of(codigoNormalizado) ?? codigoNormalizado;
      const prefijo = `+${getCountryCallingCode(codigoPais)}`;
      return {
        codigo: codigoNormalizado,
        nombre,
        prefijo,
        bandera: banderaDesdeCodigo(codigoNormalizado),
        banderaUrl: urlBandera(codigoNormalizado),
      };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

const PAISES = crearPaises();
const PAIS_FALLBACK = PAISES.find((pais) => pais.codigo === 'CO') ?? PAISES[0];

function Bandera({ pais }: { pais: PaisTelefono }) {
  const [mostrarEmoji, setMostrarEmoji] = useState(false);
  if (mostrarEmoji) return <span aria-hidden="true">{pais.bandera}</span>;
  return <img src={pais.banderaUrl} alt="" onError={() => setMostrarEmoji(true)} />;
}

type Props = {
  paisCodigo: string;
  prefijo: string;
  numero: string;
  onPaisCodigoChange: (codigo: string) => void;
  onPrefijoChange: (prefijo: string) => void;
  onNumeroChange: (numero: string) => void;
  error?: boolean;
};

export default function PhoneInput({
  paisCodigo,
  prefijo,
  numero,
  onPaisCodigoChange,
  onPrefijoChange,
  onNumeroChange,
  error,
}: Props) {
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

  const paisSeleccionado = PAISES.find((pais) => pais.codigo === paisCodigo && pais.prefijo === prefijo)
    ?? PAISES.find((pais) => pais.codigo === paisCodigo)
    ?? PAISES.find((pais) => pais.prefijo === prefijo)
    ?? PAIS_FALLBACK;

  const paisesFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLocaleLowerCase('es');
    if (!termino) return PAISES;
    return PAISES.filter((pais) => pais.nombre.toLocaleLowerCase('es').includes(termino) || pais.prefijo.includes(termino));
  }, [busqueda]);

  const cambiarNumero = (valor: string) => {
    const texto = valor.trimStart();
    const digitos = texto.replace(/\D/g, '');
    const digitosPrefijo = prefijo.replace(/\D/g, '');
    const sinPrefijoDuplicado = texto.startsWith('+') && digitos.startsWith(digitosPrefijo)
      ? digitos.slice(digitosPrefijo.length)
      : valor;
    onNumeroChange(sinPrefijoDuplicado);
  };

  return (
    <div className="phone-input" ref={ref}>
      <div className="phone-input__prefix-wrap">
        <button
          type="button"
          className={`phone-input__prefix ${error ? 'phone-input__prefix--error' : ''}`}
          aria-haspopup="listbox"
          aria-expanded={abierto}
          aria-controls="phone-input-country-list"
          aria-label={`Prefijo telefónico seleccionado: ${paisSeleccionado.nombre} ${paisSeleccionado.prefijo}`}
          onClick={() => setAbierto((value) => !value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setAbierto(false);
          }}
        >
          <span className="phone-input__selected">
            <Bandera pais={paisSeleccionado} />
            <span>{paisSeleccionado.prefijo}</span>
          </span>
          <span aria-hidden="true">⌄</span>
        </button>

        {abierto && (
          <div className="phone-input__menu" id="phone-input-country-list" role="listbox" aria-label="Países y prefijos">
            <input
              type="search"
              className="phone-input__search"
              placeholder="Buscar país o prefijo"
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              aria-label="Buscar país o prefijo"
              autoFocus
            />
            <div className="phone-input__options">
              {paisesFiltrados.map((opcion) => (
                <button
                  type="button"
                  role="option"
                  aria-selected={opcion.codigo === paisSeleccionado.codigo && opcion.prefijo === paisSeleccionado.prefijo}
                  className="phone-input__option"
                  key={`${opcion.codigo}-${opcion.prefijo}`}
                  onClick={() => {
                    onPaisCodigoChange(opcion.codigo);
                    onPrefijoChange(opcion.prefijo);
                    setBusqueda('');
                    setAbierto(false);
                  }}
                >
                  <span className="phone-input__option-name">
                    <Bandera pais={opcion} />
                    <span>{opcion.nombre}</span>
                  </span>
                  <strong>{opcion.prefijo}</strong>
                </button>
              ))}
              {!paisesFiltrados.length && <span className="phone-input__empty">No encontramos ese país.</span>}
            </div>
          </div>
        )}
      </div>
      <input
        type="tel"
        value={numero}
        onChange={(event) => cambiarNumero(event.target.value)}
        placeholder="300 123 4567"
        autoComplete="tel-national"
        inputMode="tel"
        aria-label="Número de teléfono nacional"
        aria-invalid={error || undefined}
        required
      />
    </div>
  );
}
