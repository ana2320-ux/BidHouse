import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api';
import { guardarSesion, type RespuestaLogin } from '../lib/sesion';
import './Login.css';

export default function Login() {
  // Flujo "identifier-first" (como Amazon): primero se pide SOLO el correo.
  // Con el correo se decide a dónde ir: si ya tiene cuenta, se pide la
  // contraseña; si no, es un cliente nuevo y se le manda a crear cuenta.
  // "paso" dice en cuál de las dos etapas va la pantalla.
  const [paso, setPaso] = useState<'email' | 'password'>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  // Si llegó desde otra página (ej. "Inicia sesión para pujar" en un activo),
  // esa página viene en el state como "desde" y se vuelve ahí al entrar.
  const destino = (useLocation().state as { desde?: string } | null)?.desde ?? '/';

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    /// **************************************
    /// EJECUCION DEL FLUJO DE LOGIN
    /// **************************************
    try {
      if (paso === 'email') {
        // ── Paso 1: ¿el correo ya tiene cuenta? ──
        const { existe } = await api<{ existe: boolean }>('/api/usuarios/existe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });

        if (existe) {
          setPaso('password');
        } else {
          // El correo viaja en el "state" de la navegación para que el registro
          // lo traiga ya escrito y el usuario no tenga que repetirlo.
          navigate('/registro', { state: { email, esNuevo: true } });
        }
      } else {
        // ── Paso 2: correo + contraseña → sesión ──
        const sesion = await api<RespuestaLogin>('/api/usuarios/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        // localStorage guarda texto en el navegador y sobrevive a recargar la
        // página o cerrar la pestaña. Por eso se convierte la sesión a JSON.
        // Ojo: cualquier script de la página puede leerlo; si algún día hay una
        // falla XSS, el token queda expuesto (la alternativa segura es una
        // cookie httpOnly puesta por el backend).
        guardarSesion(sesion);
        navigate(destino);
      }
    } catch (err) {
      setError(err instanceof ApiError
        ? err.message
        : 'No pudimos conectar con el servidor. Intenta de nuevo en un momento.');
    } finally {
      setLoading(false);
    }
  };

  // Volver al paso 1 para corregir el correo. Se borra la contraseña para no
  // mandarla por error junto con otro correo.
  const cambiarCorreo = () => {
    setPaso('email');
    setPassword('');
    setError('');
  };

  return (
    <main className="bh-acceso">
      <Link to="/" className="bh-acceso__logo" title="Volver al inicio">
        <div className="bh-logo">
          Bid<span>Luxury</span>
        </div>
      </Link>

      <div className="bh-acceso__card">
        <h1>Iniciar sesión</h1>
        <p className="bh-acceso__subtitulo">
          {paso === 'email'
            ? 'Ingresa tu correo electrónico para continuar.'
            : 'Ingresa tu contraseña para entrar.'}
        </p>

        {error && <div className="bh-acceso__error">{error}</div>}

        <form onSubmit={handleSubmit} className="bh-acceso__form">
          {paso === 'email' ? (
            <div className="bh-campo">
              <label htmlFor="email">Correo electrónico</label>
              <input
                type="email"
                id="email"
                name="email"
                placeholder="Ej: alejandro@gmail.com"
                autoComplete="email"
                maxLength={255}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                required
              />
            </div>
          ) : (
            <>
              {/* El correo ya no se edita aquí: se muestra y se puede cambiar */}
              <div className="login-correo">
                <span>{email}</span>
                <button type="button" className="login-cambiar" onClick={cambiarCorreo}>
                  Cambiar
                </button>
              </div>

              <div className="bh-campo">
                <label htmlFor="password">Contraseña</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                  required
                />
              </div>
            </>
          )}

          <button type="submit" className="btn btn--primary bh-acceso__boton" disabled={loading}>
            {loading ? 'Un momento...' : paso === 'email' ? 'Continuar' : 'Iniciar sesión'}
          </button>
        </form>

        <p className="bh-acceso__legal">
          Al continuar, aceptas los <a href="#">Términos de servicio</a> y la{' '}
          <a href="#">Política de privacidad</a> de BidLuxury.
        </p>
      </div>

      <div className="login-separador">¿Eres nuevo en BidLuxury?</div>
      <Link to="/registro" className="btn btn--outline bh-acceso__boton login-crear">
        Crear tu cuenta de BidLuxury
      </Link>

      <footer className="bh-acceso__pie">© 2026 BidLuxury. Subastas verificadas.</footer>
    </main>
  );
}
