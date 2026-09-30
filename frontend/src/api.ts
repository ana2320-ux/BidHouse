import { cerrarSesion, leerSesion } from './lib/sesion';

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
  // Si hay sesión, cada pedido lleva el token. Así el backend sabe quién es
  // (Spring lo verifica en SeguridadConfig) sin que las páginas hagan nada.
  // new Headers(...) conserva los headers que ya traía el pedido.
  const sesion = leerSesion();
  const headers = new Headers(init?.headers);
  if (sesion) headers.set('Authorization', `Bearer ${sesion.accessToken}`);

  const respuesta = await fetch(API_URL + ruta, { ...init, headers });

  // Spring responde 401 con el header WWW-Authenticate solo cuando el problema
  // es el TOKEN (vencido, inválido o ausente). Un 401 sin ese header es otra
  // cosa, por ejemplo "correo o contraseña incorrectos" en el login.
  if (respuesta.status === 401 && respuesta.headers.has('WWW-Authenticate')) {
    if (sesion) cerrarSesion(); // la sesión guardada ya no sirve
    throw new ApiError(401, 'Tu sesión expiró. Inicia sesión de nuevo.');
  }

  if (!respuesta.ok) {
    const cuerpo = await respuesta.json().catch(() => null);
    throw new ApiError(respuesta.status, cuerpo?.detail ?? `Error ${respuesta.status}`);
  }
  return respuesta.json();
}

export const usd = (valor: number) => `$${valor.toLocaleString('en-US')} USD`;
