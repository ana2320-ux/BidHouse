import { useEffect, useState } from 'react';
import { ApiError, api } from '../api';
import type { EstadoMembresia } from './membresia';

type ResultadoMembresia = {
  estado: EstadoMembresia | null;
  cargando: boolean;
  error: string;
  setEstado: (estado: EstadoMembresia) => void;
};

/**
 * Mantiene una única interpretación del estado que devuelve el backend para
 * que el perfil y la pantalla de planes no puedan mostrar planes distintos.
 * Un error queda separado de "gratuito": consultar la membresía no es lo
 * mismo que confirmar que la cuenta no tiene una membresía.
 */
export function useMembresia(habilitada: boolean): ResultadoMembresia {
  const [estado, setEstado] = useState<EstadoMembresia | null>(null);
  const [cargando, setCargando] = useState(habilitada);
  const [error, setError] = useState('');

  useEffect(() => {
    let vigente = true;

    if (!habilitada) return () => { vigente = false; };

    api<EstadoMembresia>('/api/membresias/estado')
      .then((respuesta) => {
        if (vigente) setEstado(respuesta);
      })
      .catch((err) => {
        if (!vigente) return;
        setError(err instanceof ApiError ? err.message : 'No se pudo consultar tu membresía.');
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });

    return () => { vigente = false; };
  }, [habilitada]);

  return { estado, cargando, error, setEstado };
}
