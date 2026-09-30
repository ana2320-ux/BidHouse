// ── Sesión del usuario en el navegador ──
// Login la guarda y el resto de la app (navbar, home) la lee desde aquí.
// Así nadie más toca localStorage directamente ni repite la clave 'bh_sesion'.

const CLAVE = 'bh_sesion';

// Lo que devuelve POST /api/usuarios/login (ver ServicioUsuario.iniciarSesion()).
export type RespuestaLogin = {
  accessToken: string;
  refreshToken: string;
  expiraEn: number; // segundos, contados desde el momento del login
  usuario: {
    id: string;
    nombre: string;
    apellido: string;
    email: string;
    es_vendedor: boolean;
    esta_verificado: boolean;
  };
};

// Lo que se guarda: la respuesta + el momento exacto en que vence.
// "expiraEn" dice "3600 segundos desde ahora", pero ese "ahora" se pierde al
// recargar la página; por eso al guardar se convierte a una fecha fija.
export type Sesion = RespuestaLogin & { expiraEl: number };

export function guardarSesion(respuesta: RespuestaLogin) {
  const sesion: Sesion = { ...respuesta, expiraEl: Date.now() + respuesta.expiraEn * 1000 };
  localStorage.setItem(CLAVE, JSON.stringify(sesion));
}

// Devuelve null si no hay sesión, si el texto guardado está dañado o si ya venció.
// ponytail: al vencer (1 h) la sesión se pierde y hay que volver a entrar.
// Cuando moleste, renovarla con el refreshToken un poco antes de que venza.
export function leerSesion(): Sesion | null {
  try {
    const texto = localStorage.getItem(CLAVE);
    if (!texto) return null;
    const sesion = JSON.parse(texto) as Sesion;
    if (typeof sesion.expiraEl !== 'number' || Date.now() >= sesion.expiraEl) return null;
    return sesion;
  } catch {
    // JSON inválido o localStorage bloqueado (modo privado estricto): sin sesión.
    return null;
  }
}

export function cerrarSesion() {
  localStorage.removeItem(CLAVE);
}
