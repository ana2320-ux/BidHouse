const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';

export async function api<T>(ruta: string, init?: RequestInit): Promise<T> {
  const respuesta = await fetch(API_URL + ruta, init);
  if (!respuesta.ok) {
    const cuerpo = await respuesta.json().catch(() => null);
    throw new Error(cuerpo?.detail ?? `Error ${respuesta.status}`);
  }
  return respuesta.json();
}

export const usd = (valor: number) => `$${valor.toLocaleString('en-US')} USD`;
