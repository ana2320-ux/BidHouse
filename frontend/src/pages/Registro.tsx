import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import './Registro.css';

// Lo que /login manda en el "state" de la navegación cuando el correo es nuevo.
type EstadoDesdeLogin = { email?: string; esNuevo?: boolean } | null;

export default function Registro() {
  const navigate = useNavigate();
  const desdeLogin = useLocation().state as EstadoDesdeLogin;

  // ── Estado del formulario ──
  // Los campos salen de la tabla "usuarios" de Supabase. Los que son NOT NULL
  // allá (nombre, apellido, email) son obligatorios aquí; el resto es opcional.
  // La contraseña NO está en "usuarios": la guarda Supabase Auth (auth.users).
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    documento_identidad: '',
    telefono: '',
    email: desdeLogin?.email ?? '',
    direccion: '',
    ciudad: '',
    pais: 'Colombia', // mismo valor por defecto que la columna en la BD
    es_vendedor: false,
    password: '',
    confirmPassword: '',
  });

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false); // Para deshabilitar el botón mientras carga
  const [success, setSuccess] = useState(false); // Para mostrar mensaje de éxito

  // ── Manejar cambios en los inputs ──
  // El checkbox guarda "checked" (true/false); los demás guardan "value".
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, type, value, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  // ── Manejar envío del formulario ──
  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    // async porque supabase.auth.signUp() es una operación asíncrona
    // (va a internet, tarda un poco en responder)
    e.preventDefault();
    setError('');

    // Se separan las contraseñas del resto: "perfil" es lo que va a la BD.
    const { password, confirmPassword, ...perfil } = formData;

    // ── Validaciones locales (antes de llamar a Supabase) ──
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    // ── Llamada a Supabase ──
    setLoading(true);

    // "options.data" guarda información extra del usuario en auth.users →
    // campo raw_user_meta_data. Ojo: eso NO llena la tabla "usuarios"; para
    // eso hace falta un trigger en la BD o el backend (decisión pendiente,
    // ver AGENTS.md). Se mandan todos los datos para no perderlos mientras.
    const { error: signUpError } = await supabase.auth.signUp({
      email: perfil.email,
      password,
      options: { data: perfil },
    });

    setLoading(false);

    // ── Manejar resultado ──
    if (signUpError) {
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
      <main className="bh-acceso">
        <div className="bh-acceso__logo bh-logo">
          Bid<span>House</span>
        </div>
        <div className="bh-acceso__card registro-exito">
          <span className="registro-exito__icono">✅</span>
          <h1>¡Cuenta creada!</h1>
          <p>
            Revisa tu correo electrónico para confirmar tu cuenta.
            Serás redirigido al inicio de sesión en unos segundos...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="bh-acceso">
      <Link to="/" className="bh-acceso__logo" title="Volver al inicio">
        <div className="bh-logo">
          Bid<span>House</span>
        </div>
      </Link>

      {/* Solo aparece si llegó desde /login con un correo sin cuenta */}
      {desdeLogin?.esNuevo && (
        <div className="registro-aviso" role="status">
          <span className="registro-aviso__icono">👋</span>
          <div>
            <strong>Parece que eres nuevo en BidHouse</strong>
            No encontramos una cuenta con <b>{desdeLogin.email}</b>. Completa tus
            datos para crearla.
          </div>
        </div>
      )}

      <div className="bh-acceso__card bh-acceso__card--ancha">
        <h1>Crear cuenta</h1>
        <p className="bh-acceso__subtitulo">
          Necesitamos estos datos para verificar tu identidad antes de que puedas pujar o vender.
        </p>

        {error && <div className="bh-acceso__error">{error}</div>}

        <form onSubmit={handleSubmit} className="bh-acceso__form">
          {/* ── Datos personales ── */}
          <section className="registro-seccion">
            <h2>Datos personales</h2>
            <div className="registro-fila">
              <div className="bh-campo">
                <label htmlFor="nombre">Nombre</label>
                <input type="text" id="nombre" name="nombre" placeholder="Ej: Alejandro"
                  autoComplete="given-name" maxLength={100}
                  value={formData.nombre} onChange={handleChange} required />
              </div>
              <div className="bh-campo">
                <label htmlFor="apellido">Apellido</label>
                <input type="text" id="apellido" name="apellido" placeholder="Ej: Montes"
                  autoComplete="family-name" maxLength={100}
                  value={formData.apellido} onChange={handleChange} required />
              </div>
            </div>
            <div className="registro-fila">
              <div className="bh-campo">
                <label htmlFor="documento_identidad">
                  Documento de identidad <span className="bh-campo__opcional">(opcional)</span>
                </label>
                <input type="text" id="documento_identidad" name="documento_identidad"
                  placeholder="Ej: 1020304050" maxLength={50}
                  value={formData.documento_identidad} onChange={handleChange} />
              </div>
              <div className="bh-campo">
                <label htmlFor="telefono">
                  Teléfono <span className="bh-campo__opcional">(opcional)</span>
                </label>
                <input type="tel" id="telefono" name="telefono" placeholder="Ej: 300 123 4567"
                  autoComplete="tel" maxLength={20}
                  value={formData.telefono} onChange={handleChange} />
              </div>
            </div>
          </section>

          {/* ── Contacto y ubicación ── */}
          <section className="registro-seccion">
            <h2>Contacto y ubicación</h2>
            <div className="bh-campo">
              <label htmlFor="email">Correo electrónico</label>
              <input type="email" id="email" name="email" placeholder="Ej: alejandro@email.com"
                autoComplete="email" maxLength={255}
                value={formData.email} onChange={handleChange} required />
            </div>
            <div className="bh-campo">
              <label htmlFor="direccion">
                Dirección <span className="bh-campo__opcional">(opcional)</span>
              </label>
              <input type="text" id="direccion" name="direccion" placeholder="Ej: Calle 93 # 11-26, Apto 502"
                autoComplete="street-address"
                value={formData.direccion} onChange={handleChange} />
            </div>
            <div className="registro-fila">
              <div className="bh-campo">
                <label htmlFor="ciudad">
                  Ciudad <span className="bh-campo__opcional">(opcional)</span>
                </label>
                <input type="text" id="ciudad" name="ciudad" placeholder="Ej: Bogotá"
                  autoComplete="address-level2" maxLength={100}
                  value={formData.ciudad} onChange={handleChange} />
              </div>
              <div className="bh-campo">
                <label htmlFor="pais">País</label>
                <input type="text" id="pais" name="pais"
                  autoComplete="country-name" maxLength={100}
                  value={formData.pais} onChange={handleChange} />
              </div>
            </div>
          </section>

          {/* ── Seguridad y tipo de cuenta ── */}
          <section className="registro-seccion">
            <h2>Seguridad</h2>
            <div className="registro-fila">
              <div className="bh-campo">
                <label htmlFor="password">Contraseña</label>
                <input type="password" id="password" name="password" placeholder="Mínimo 6 caracteres"
                  autoComplete="new-password"
                  value={formData.password} onChange={handleChange} required />
              </div>
              <div className="bh-campo">
                <label htmlFor="confirmPassword">Confirmar contraseña</label>
                <input type="password" id="confirmPassword" name="confirmPassword" placeholder="Repite tu contraseña"
                  autoComplete="new-password"
                  value={formData.confirmPassword} onChange={handleChange} required />
              </div>
            </div>
            <label className="registro-check">
              <input type="checkbox" name="es_vendedor"
                checked={formData.es_vendedor} onChange={handleChange} />
              <span>
                También quiero vender activos
                <small>Podrás publicar subastas una vez verifiquemos tu identidad.</small>
              </span>
            </label>
          </section>

          {/* disabled={loading} deshabilita el botón mientras se envía */}
          <button type="submit" className="btn btn--primary bh-acceso__boton" disabled={loading}>
            {loading ? 'Creando cuenta...' : 'Crear mi cuenta'}
          </button>
        </form>

        <p className="bh-acceso__legal">
          Al crear una cuenta, aceptas los <a href="#">Términos de servicio</a> y la{' '}
          <a href="#">Política de privacidad</a> de BidHouse.
        </p>
      </div>

      <p className="registro-cuenta">
        ¿Ya tienes una cuenta?{' '}
        <Link to="/login" className="bh-acceso__link">Iniciar sesión</Link>
      </p>

      <footer className="bh-acceso__pie">© 2026 BidHouse. Subastas verificadas.</footer>
    </main>
  );
}
