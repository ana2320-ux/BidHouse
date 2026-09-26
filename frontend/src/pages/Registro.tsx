import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import './Registro.css';

// Lo que /login manda en el "state" de la navegación cuando el correo es nuevo.
type EstadoDesdeLogin = { email?: string; esNuevo?: boolean } | null;

// ── Requisitos de la contraseña ──
// Cada requisito es un texto + una función que dice si la contraseña lo cumple.
// Se definen una sola vez y se usan en dos lugares: la checklist que se ve
// mientras escribes y la validación de handleSubmit. Así no se desincronizan.
const REQUISITOS_PASSWORD = [
  { texto: 'Más de 6 caracteres', cumple: (p: string) => p.length >= 6 },
  { texto: 'Al menos una mayúscula', cumple: (p: string) => /[A-ZÁÉÍÓÚÜÑ]/.test(p) },
  { texto: 'Al menos un símbolo ( . $ * # @ ! = + )', cumple: (p: string) => /[.$*#@!=+]/.test(p) },
];

export default function Registro() {
  const navigate = useNavigate();

  //Aqui es donde se revisan los datos que se evian desde el login, si es un usuario nuevo o no
  const desdeLogin = useLocation().state as EstadoDesdeLogin;

  // ── Estado del formulario ──
  // Los campos salen de la tabla "usuarios" de Supabase. En la BD solo nombre,
  // apellido y email son NOT NULL, pero aquí pedimos todos como obligatorios
  // (se validan en handleSubmit).
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
    
    // Validar campos de texto uno por uno
    if (formData.nombre.trim() === '') {
      setError('Por favor, necesitamos tu nombre para crear la cuenta.');
      return;
    }

    else if (formData.apellido.trim() === '') {
      setError('El apellido no puede estar vacío.');
      return;
    }

    else if (formData.documento_identidad.trim() === '') {
      setError('El documento de identidad es obligatorio para poder pujar.');
      return;
    }

    else if (formData.telefono.trim() === '') {
      setError('Necesitamos un teléfono de contacto válido.');
      return;
    }

    else if (formData.email.trim() === '') {
      setError('Olvidaste ingresar tu correo electrónico.');
      return;
    }

    // Reemplaza al type="email" del navegador (apagado con noValidate):
    // algo@algo.algo, sin espacios.
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      setError('El correo electrónico no tiene un formato válido.');
      return;
    }

    else if (formData.direccion.trim() === '') {
      setError('Debes proporcionar tu dirección para los envíos.');
      return;
    }

    else if (formData.ciudad.trim() === '') {
      setError('La ciudad es un campo obligatorio.');
      return;
    }

    else if (formData.pais.trim() === '') {
      setError('Por favor, indica tu país de residencia.');
      return;
    }

    // ── Validaciones de contraseñas ──

    // every() = "todos cumplen" (como allMatch de los Streams de Java)
    else if (!REQUISITOS_PASSWORD.every((r) => r.cumple(password))) {
      setError('La contraseña no cumple todos los requisitos de seguridad.');
      return;
    }

    else if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
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

        {/* noValidate apaga las validaciones del navegador (required, type="email"),
            que si no cancelan el envío antes de llegar a handleSubmit y muestran
            su propio globito en vez de nuestro mensaje. Todo se valida allá. */}
        <form onSubmit={handleSubmit} className="bh-acceso__form" noValidate>
          {/* ── Datos personales ── */}
          <section className="registro-seccion">
            <h2>Datos personales</h2>
            <div className="registro-fila">

              {/* ── Nombre ── */}
              <div className="bh-campo">
                <label htmlFor="nombre">Nombre</label>
                <input type="text" id="nombre" name="nombre" placeholder="Ej: Alejandro"
                  autoComplete="given-name" maxLength={100}
                  value={formData.nombre} onChange={handleChange} required />
              </div>

              {/* ── Apellido ── */}
              <div className="bh-campo">
                <label htmlFor="apellido">Apellido</label>
                <input type="text" id="apellido" name="apellido" placeholder="Ej: Montes"
                  autoComplete="family-name" maxLength={100}
                  value={formData.apellido} onChange={handleChange} required />
              </div>
            </div>

            {/* ── Documento de identidad ── */}
            <div className="registro-fila">
              <div className="bh-campo">
                <label htmlFor="documento_identidad">
                  Documento de identidad
                </label>
                <input type="text" id="documento_identidad" name="documento_identidad"
                  placeholder="Ej: 1020304050" maxLength={50}
                  value={formData.documento_identidad} onChange={handleChange} required/>
              </div>

              {/* ── Telefono ── */}
              <div className="bh-campo">
                <label htmlFor="telefono">
                  Teléfono
                </label>
                <input type="tel" id="telefono" name="telefono" placeholder="Ej: 300 123 4567"
                  autoComplete="tel" maxLength={20}
                  value={formData.telefono} onChange={handleChange} required/>
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

            {/* ── Dirección ── */}
            <div className="bh-campo">
              <label htmlFor="direccion">
                Dirección
              </label>
              <input type="text" id="direccion" name="direccion" placeholder="Ej: Calle 93 # 11-26, Apto 502"
                autoComplete="street-address"
                value={formData.direccion} onChange={handleChange} required/>
            </div>

            {/* ── Ciudad ── */}
            <div className="registro-fila">
              <div className="bh-campo">
                <label htmlFor="ciudad">
                  Ciudad
                </label>
                <input type="text" id="ciudad" name="ciudad" placeholder="Ej: Bogotá"
                  autoComplete="address-level2" maxLength={100}
                  value={formData.ciudad} onChange={handleChange} required />
              </div>

              {/* ── Pais ── */}
              <div className="bh-campo">
                <label htmlFor="pais">País</label>
                <input type="text" id="pais" name="pais"
                  autoComplete="country-name" maxLength={100}
                  value={formData.pais} onChange={handleChange}  required/>
              </div>
            </div>
          </section>

          {/* ── Seguridad y tipo de cuenta ── */}
          <section className="registro-seccion">
            <h2>Seguridad</h2>
            <div className="registro-fila">
              <div className="bh-campo">
                <label htmlFor="password">Contraseña</label>
                <input type="password" id="password" name="password" placeholder="Crea una contraseña segura"
                  autoComplete="new-password" aria-describedby="requisitos-password"
                  value={formData.password} onChange={handleChange} required />
              </div>
              <div className="bh-campo">
                <label htmlFor="confirmPassword">Confirmar contraseña</label>
                <input type="password" id="confirmPassword" name="confirmPassword" placeholder="Repite tu contraseña"
                  autoComplete="new-password"
                  value={formData.confirmPassword} onChange={handleChange} required />
              </div>
            </div>

            {/* ── Checklist de requisitos ──
                Se recalcula en cada tecla: handleChange cambia formData, React
                vuelve a dibujar y cada requisito se evalúa con el valor nuevo. */}
            <ul className="registro-requisitos" id="requisitos-password">
              {REQUISITOS_PASSWORD.map((r) => {
                const ok = r.cumple(formData.password);
                return (
                  <li key={r.texto} className={ok ? 'registro-requisito--ok' : ''}>
                    <span className="registro-requisito__icono" aria-hidden="true">{ok ? '✓' : '○'}</span>
                    {r.texto}
                  </li>
                );
              })}
            </ul>
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
