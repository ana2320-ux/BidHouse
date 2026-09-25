import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Login.css';

export default function Login() {
  // Flujo "identifier-first" (como Amazon): primero se pide SOLO el correo.
  // Con el correo se decide a dónde ir: si ya tiene cuenta, se pide la
  // contraseña; si no, es un cliente nuevo y se le manda a crear cuenta.
  const [email, setEmail] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();

    // ponytail: sin backend todavía, todo correo se trata como cliente nuevo.
    // Cuando exista auth, aquí se consulta si el correo ya está registrado y,
    // si lo está, se muestra el paso de contraseña en vez de redirigir.
    //
    // El correo viaja en el "state" de la navegación para que el registro lo
    // traiga ya escrito y el usuario no tenga que repetirlo.
    navigate('/registro', { state: { email, esNuevo: true } });
  };

  return (
    <main className="bh-acceso">
      <Link to="/" className="bh-acceso__logo" title="Volver al inicio">
        <div className="bh-logo">
          Bid<span>House</span>
        </div>
      </Link>

      <div className="bh-acceso__card">
        <h1>Iniciar sesión</h1>
        <p className="bh-acceso__subtitulo">Ingresa tu correo electrónico para continuar.</p>

        <form onSubmit={handleSubmit} className="bh-acceso__form">
          <div className="bh-campo">
            <label htmlFor="email">Correo electrónico</label>
            <input
              type="email"
              id="email"
              name="email"
              placeholder="Ej: alejandro@email.com"
              autoComplete="email"
              maxLength={255}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              required
            />
          </div>

          <button type="submit" className="btn btn--primary bh-acceso__boton">
            Continuar
          </button>
        </form>

        <p className="bh-acceso__legal">
          Al continuar, aceptas los <a href="#">Términos de servicio</a> y la{' '}
          <a href="#">Política de privacidad</a> de BidHouse.
        </p>
      </div>

      <div className="login-separador">¿Eres nuevo en BidHouse?</div>
      <Link to="/registro" className="btn btn--outline bh-acceso__boton login-crear">
        Crear tu cuenta de BidHouse
      </Link>

      <footer className="bh-acceso__pie">© 2026 BidHouse. Subastas verificadas.</footer>
    </main>
  );
}
