// ── Cliente de Supabase ──
// Este archivo crea UNA SOLA conexión con Supabase y la exporta.
// Todos los archivos de la app importan "supabase" desde aquí.
//
// ¿Por qué un solo archivo?
// Porque crear múltiples conexiones desperdicia memoria.
// Con este patrón (Singleton), todos comparten la misma conexión.

import { createClient } from '@supabase/supabase-js';

// import.meta.env es cómo Vite accede a las variables de entorno.
// Solo funciona con variables que empiecen con VITE_
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Verificación: si faltan las variables, avisamos en consola
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Faltan las variables de entorno VITE_SUPABASE_URL y/o VITE_SUPABASE_ANON_KEY. ' +
    'Revisa tu archivo .env en la carpeta frontend/'
  );
}

// createClient() establece la conexión con tu proyecto de Supabase.
// Recibe la URL del proyecto y la clave pública (anon key).
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

