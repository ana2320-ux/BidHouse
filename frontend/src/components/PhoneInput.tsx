import { useEffect, useRef, useState } from 'react';
import './PhoneInput.css';

type PaisTelefono = { codigo: string; nombre: string; prefijo: string };

const PAISES_TELEFONO: PaisTelefono[] = [
  { codigo: 'CO', nombre: 'Colombia', prefijo: '+57' },
  { codigo: 'MX', nombre: 'México', prefijo: '+52' },
  { codigo: 'US', nombre: 'Estados Unidos', prefijo: '+1' },
  { codigo: 'CA', nombre: 'Canadá', prefijo: '+1' },
  { codigo: 'ES', nombre: 'España', prefijo: '+34' },
  { codigo: 'AR', nombre: 'Argentina', prefijo: '+54' },
  { codigo: 'CL', nombre: 'Chile', prefijo: '+56' },
  { codigo: 'PE', nombre: 'Perú', prefijo: '+51' },
  { codigo: 'BR', nombre: 'Brasil', prefijo: '+55' },
  { codigo: 'PA', nombre: 'Panamá', prefijo: '+507' },
];

type Props = {
  prefijo: string;
  numero: string;
  onPrefijoChange: (prefijo: string) => void;
  onNumeroChange: (numero: string) => void;
  error?: boolean;
};

export default function PhoneInput({ prefijo, numero, onPrefijoChange, onNumeroChange, error }: Props) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pais = PAISES_TELEFONO.find((p) => p.prefijo === prefijo) ?? PAISES_TELEFONO[0];

  useEffect(() => {
    const cerrar = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setAbierto(false);
    };
    document.addEventListener('mousedown', cerrar);
    return () => document.removeEventListener('mousedown', cerrar);
  }, []);

  return (
    <div className="phone-input" ref={ref}>
      <div className="phone-input__prefix-wrap">
        <button
          type="button"
          className={`phone-input__prefix ${error ? 'phone-input__prefix--error' : ''}`}
          aria-haspopup="listbox"
          aria-expanded={abierto}
          aria-label={`Prefijo telefónico seleccionado: ${pais.nombre} ${pais.prefijo}`}
          onClick={() => setAbierto((value) => !value)}
        >
          <span>{pais.prefijo}</span>
          <span aria-hidden="true">⌄</span>
        </button>
        {abierto && (
          <div className="phone-input__menu" role="listbox" aria-label="Países y prefijos">
            {PAISES_TELEFONO.map((opcion) => (
              <button
                type="button"
                role="option"
                aria-selected={opcion.codigo === pais.codigo}
                className="phone-input__option"
                key={opcion.codigo}
                onClick={() => {
                  onPrefijoChange(opcion.prefijo);
                  setAbierto(false);
                }}
              >
                <span>{opcion.nombre}</span>
                <strong>{opcion.prefijo}</strong>
              </button>
            ))}
          </div>
        )}
      </div>
      <input
        type="tel"
        value={numero}
        onChange={(event) => onNumeroChange(event.target.value.replace(/[^\d\s()-]/g, ''))}
        placeholder="300 123 4567"
        autoComplete="tel-national"
        inputMode="tel"
        aria-label="Número de teléfono"
        aria-invalid={error || undefined}
        required
      />
    </div>
  );
}
