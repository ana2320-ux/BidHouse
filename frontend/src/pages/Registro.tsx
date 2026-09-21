import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import './Registro.css';

export default function Registro() {
  // ── Estado del formulario ──
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false); // Para deshabilitar el botón mientras carga
  const [success, setSuccess] = useState(false); // Para mostrar mensaje de éxito

  // useNavigate() nos permite redirigir al usuario a otra página por código
  const navigate = useNavigate();

  // ── Manejar cambios en los inputs (igual que antes) ──
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  // ── Manejar envío del formulario ──
  const handleSubmit = async (e: React.FormEvent) => {
    // async porque supabase.auth.signUp() es una operación asíncrona
    // (va a internet, tarda un poco en responder)
    e.preventDefault();
    setError('');

    // ── Validaciones locales (antes de llamar a Supabase) ──
    if (formData.password !== formData.confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    if (formData.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    // ── Llamada a Supabase ──
    setLoading(true); // Activamos el estado de carga

    // supabase.auth.signUp() envía el email y password a Supabase.
    // Supabase crea el usuario, encripta la contraseña, y devuelve
    // un objeto con { data, error }.
    //
    // "options.data" guarda información extra del usuario (nombre, etc.)
    // en la tabla auth.users → campo raw_user_meta_data
    const { error: signUpError } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        data: {
          nombre: formData.nombre,
          apellido: formData.apellido,
          username: formData.username,
        },
      },
    });

    setLoading(false); // Desactivamos el estado de carga

    // ── Manejar resultado ──
    if (signUpError) {
      // Si Supabase devolvió un error, lo mostramos al usuario
      setError(signUpError.message);
      return;
    }

    // ¡Éxito! Mostramos mensaje y redirigimos al login después de 2 segundos
    setSuccess(true);
    setTimeout(() => {
      navigate('/login');
    }, 2000);
  };

  // ── Si el registro fue exitoso, mostramos un mensaje bonito ──
  if (success) {
    return (
      <main className="registro-page">
        <div className="registro-success-card">
          <span className="success-icon">✅</span>
          <h2>¡Cuenta creada exitosamente!</h2>
          <p>
            Revisa tu correo electrónico para confirmar tu cuenta.
            Serás redirigido al login en unos segundos...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="registro-page">
      <div className="registro-container">
        {/* Lado izquierdo: Branding */}
        <div className="registro-branding">
          <Link to="/" className="registro-logo">
            Bid<span>House</span>
          </Link>
          <h1>Únete a la plataforma de subastas más segura</h1>
          <p>
            Compra y vende activos de alto valor con verificación de identidad,
            contratos inteligentes y depósito en garantía.
          </p>
          <div className="registro-features">
            <div className="registro-feature">
              <span className="feature-icon">🛡️</span>
              <span>Verificación de identidad</span>
            </div>
            <div className="registro-feature">
              <span className="feature-icon">📜</span>
              <span>Contratos inteligentes</span>
            </div>
            <div className="registro-feature">
              <span className="feature-icon">🔒</span>
              <span>Depósito en custodia (Escrow)</span>
            </div>
          </div>
        </div>

        {/* Lado derecho: Formulario */}
        <div className="registro-form-wrapper">
          <h2>Crear cuenta</h2>
          <p className="registro-subtitle">
            ¿Ya tienes una cuenta?{' '}
            <Link to="/login" className="registro-link">Iniciar sesión</Link>
          </p>

          {/* Mensaje de error */}
          {error && <div className="registro-error">{error}</div>}

          <form onSubmit={handleSubmit} className="registro-form">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="nombre">Nombre</label>
                <input
                  type="text"
                  id="nombre"
                  name="nombre"
                  placeholder="Ej: Alejandro"
                  value={formData.nombre}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="apellido">Apellido</label>
                <input
                  type="text"
                  id="apellido"
                  name="apellido"
                  placeholder="Ej: Montes"
                  value={formData.apellido}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="username">Nombre de usuario</label>
              <input
                type="text"
                id="username"
                name="username"
                placeholder="Ej: alemontes"
                value={formData.username}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">Correo electrónico</label>
              <input
                type="email"
                id="email"
                name="email"
                placeholder="Ej: alejandro@email.com"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Contraseña</label>
              <input
                type="password"
                id="password"
                name="password"
                placeholder="Mínimo 6 caracteres"
                value={formData.password}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirmar contraseña</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                placeholder="Repite tu contraseña"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
              />
            </div>

            {/* disabled={loading} deshabilita el botón mientras se envía */}
            <button
              type="submit"
              className="btn btn--primary registro-submit"
              disabled={loading}
            >
              {loading ? 'Creando cuenta...' : 'Crear mi cuenta'}
            </button>
          </form>

          <p className="registro-terms">
            Al crear una cuenta, aceptas nuestros{' '}
            <a href="#">Términos de servicio</a> y{' '}
            <a href="#">Política de privacidad</a>.
          </p>
        </div>
      </div>
    </main>
  );
}
