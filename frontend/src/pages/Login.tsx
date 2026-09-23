import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

// Reutilizamos los estilos del registro: las dos pantallas comparten
// el mismo layout (branding a la izquierda, formulario a la derecha)
// y las mismas clases .registro-*. Si algun dia divergen, se separa.
import './Registro.css';

export default function Login() {
  // ── Estado del formulario ──
  // Un solo objeto con los dos campos, igual que en Registro.
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // useNavigate() nos deja redirigir por codigo, sin que el usuario haga clic
  const navigate = useNavigate();

  // ── Un solo handler para los dos inputs ──
  // [e.target.name] usa el atributo name="" del input para saber
  // que campo del objeto actualizar.
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  // ── Envio del formulario ──
  const handleSubmit = async (e: React.FormEvent) => {
    // Sin esto el navegador recarga la pagina entera al enviar el form
    // y perdemos todo el estado.
    e.preventDefault();
    setError('');
    setLoading(true);

    // signInWithPassword() le manda las credenciales a Supabase.
    // Si son correctas, Supabase guarda la sesion en el navegador
    // automaticamente: no tenemos que manejar el token a mano.
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: formData.email,
      password: formData.password,
    });

    setLoading(false);

    if (signInError) {
      // Supabase responde en ingles. Traducimos el caso mas comun
      // para no mostrarle "Invalid login credentials" al usuario.
      if (signInError.message === 'Invalid login credentials') {
        setError('Correo o contrasena incorrectos');
      } else if (signInError.message === 'Email not confirmed') {
        setError('Todavia no confirmaste tu correo. Revisa tu bandeja de entrada.');
      } else {
        setError(signInError.message);
      }
      return;
    }

    // Todo bien: al perfil.
    // replace: true evita que el boton "atras" del navegador
    // devuelva al login ya estando logueado.
    navigate('/perfil', { replace: true });
  };

  return (
    <main className="registro-page">
      <div className="registro-container">
        {/* Lado izquierdo: branding */}
        <div className="registro-branding">
          <Link to="/" className="registro-logo">
            Bid<span>House</span>
          </Link>
          <h1>Bienvenido de vuelta</h1>
          <p>
            Accede a tus subastas activas, revisa tus ofertas y gestiona los
            activos que tienes en custodia.
          </p>
          <div className="registro-features">
            <div className="registro-feature">
              <span className="feature-icon">🛡️</span>
              <span>Sesion protegida</span>
            </div>
            <div className="registro-feature">
              <span className="feature-icon">📜</span>
              <span>Historial de pujas verificable</span>
            </div>
            <div className="registro-feature">
              <span className="feature-icon">🔒</span>
              <span>Fondos en custodia (Escrow)</span>
            </div>
          </div>
        </div>

        {/* Lado derecho: formulario */}
        <div className="registro-form-wrapper">
          <h2>Iniciar sesion</h2>
          <p className="registro-subtitle">
            ¿Todavia no tienes cuenta?{' '}
            <Link to="/registro" className="registro-link">Crear cuenta</Link>
          </p>

          {/* && significa: si hay error, muestra el div. Si error es
              string vacio, no dibuja nada. */}
          {error && <div className="registro-error">{error}</div>}

          <form onSubmit={handleSubmit} className="registro-form">
            <div className="form-group">
              <label htmlFor="email">Correo electronico</label>
              <input
                type="email"
                id="email"
                name="email"
                placeholder="Ej: alejandro@email.com"
                value={formData.email}
                onChange={handleChange}
                autoComplete="email"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Contrasena</label>
              <input
                type="password"
                id="password"
                name="password"
                placeholder="Tu contrasena"
                value={formData.password}
                onChange={handleChange}
                autoComplete="current-password"
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn--primary registro-submit"
              disabled={loading}
            >
              {loading ? 'Entrando...' : 'Iniciar sesion'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}