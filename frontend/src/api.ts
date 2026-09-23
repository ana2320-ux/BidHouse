const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function api<T>(ruta: string, init?: RequestInit): Promise<T> {
  const respuesta = await fetch(API_URL + ruta, init);
  if (!respuesta.ok) {
    const cuerpo = await respuesta.json().catch(() => null);
    throw new ApiError(respuesta.status, cuerpo?.detail ?? `Error ${respuesta.status}`);
  }
  return respuesta.json();
}

export const usd = (valor: number) => `$${valor.toLocaleString('en-US')} USD`;
