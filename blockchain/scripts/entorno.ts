// Lee y escribe variables en backend/.env sin mostrarlas nunca en pantalla.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

export const RUTA_ENV = new URL('../../backend/.env', import.meta.url);

export function leerEnv(): Record<string, string> {
  if (!existsSync(RUTA_ENV)) throw new Error('No existe backend/.env (copia backend/.env.example).');
  const vars: Record<string, string> = {};
  for (const linea of readFileSync(RUTA_ENV, 'utf8').split('\n')) {
    const i = linea.indexOf('=');
    if (i > 0 && !linea.trimStart().startsWith('#')) vars[linea.slice(0, i).trim()] = linea.slice(i + 1).trim();
  }
  return vars;
}

// Agrega o reemplaza una variable conservando el resto del archivo.
export function escribirEnv(nombre: string, valor: string, comentario: string) {
  const texto = readFileSync(RUTA_ENV, 'utf8');
  const lineas = texto.split('\n');
  const i = lineas.findIndex((l) => l.startsWith(nombre + '='));
  if (i >= 0) lineas[i] = `${nombre}=${valor}`;
  else lineas.push('', `# ${comentario}`, `${nombre}=${valor}`);
  writeFileSync(RUTA_ENV, lineas.join('\n').replace(/\n{3,}/g, '\n\n'));
}
