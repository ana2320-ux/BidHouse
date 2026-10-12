import { parsePhoneNumberFromString } from 'libphonenumber-js';

/**
 * Devuelve el número en E.164. El campo nacional puede traer espacios,
 * guiones o un prefijo que la persona haya escrito por accidente.
 */
export function normalizarTelefono(prefijo: string, numero: string): string | null {
  const prefijoLimpio = `+${prefijo.replace(/\D/g, '')}`;
  const texto = numero.trim();
  if (!texto || !/^[+\d\s().-]+$/.test(texto) || (texto.includes('+') && !texto.startsWith('+'))) return null;
  const digitos = texto.replace(/\D/g, '');
  const digitosPrefijo = prefijoLimpio.replace('+', '');
  const nacional = texto.startsWith('+') && digitos.startsWith(digitosPrefijo)
    ? digitos.slice(digitosPrefijo.length)
    : digitos;

  if (!nacional) return null;
  const telefono = parsePhoneNumberFromString(`${prefijoLimpio}${nacional}`);
  return telefono?.isValid() ? telefono.number : null;
}
