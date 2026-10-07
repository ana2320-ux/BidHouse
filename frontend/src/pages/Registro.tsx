import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';
import './Registro.css';
import { supabase } from '../lib/supabaseClient';
import PhoneInput from '../components/PhoneInput';
import { guardarSesion } from '../lib/sesion';
import type { RespuestaLogin } from '../lib/sesion';

// Lo que /login manda en el "state" de la navegación cuando el correo es nuevo.
type EstadoDesdeLogin = { email?: string; esNuevo?: boolean } | null;

// ── Requisitos de la contraseña ──
const REQUISITOS_PASSWORD = [
  { texto: 'Más de 6 caracteres', cumple: (p: string) => p.length >= 6 },
  { texto: 'Al menos una mayúscula', cumple: (p: string) => /[A-ZÁÉÍÓÚÜÑ]/.test(p) },
  { texto: 'Al menos un símbolo ( . $ * # @ ! = + )', cumple: (p: string) => /[.$*#@!=+]/.test(p) },
];

// ── Componente auxiliar para Iconos de Estado (Sin emojis) ──
const StatusIcon = ({ completado }: { completado: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={completado ? "#185e94" : "#cbd5e1"} strokeWidth="2" className="status-icon">
    {completado ? (
      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
    ) : (
      <circle cx="12" cy="12" r="10" />
    )}
  </svg>
);

export default function Registro() {
  const navigate = useNavigate();
  const desdeLogin = useLocation().state as EstadoDesdeLogin;
  
  // Estado para el código de verificación de Supabase
  const [codigoVerificacion, setCodigoVerificacion] = useState('');

  // ── Control de pasos (Paso 1: Datos | Paso 2: KYC | Paso 3: Código OTP) ──
  const [paso, setPaso] = useState<1 | 2 | 3>(1);

  // ── Estado del formulario de datos personales ──
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    documento_identidad: '',
    telefonoNumero: '',
    telefonoPrefijo: '+57',
    email: desdeLogin?.email ?? '',
    direccion: '',
    ciudad: '',
    pais: 'Colombia',
    es_vendedor: false,
    password: '',
    confirmPassword: '',
  });

  // ── Documentos y biometría para KYC (Estándar Rappi / Truora) ──
  const [docFrente, setDocFrente] = useState<File | null>(null);
  const [, setDocFrentePreview] = useState<string | null>(null);
  const [docReverso, setDocReverso] = useState<File | null>(null);
  const [, setDocReversoPreview] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [analisisEtapa, setAnalisisEtapa] = useState<number>(0);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // ── Manejar cambios en los inputs ──
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, type, value, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  // ── Manejar carga de fotos para KYC ──
  const handleFileChange = (
    tipo: 'frente' | 'reverso' | 'selfie',
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (tipo === 'frente') {
      setDocFrente(file);
      setDocFrentePreview(url);
    } else if (tipo === 'reverso') {
      setDocReverso(file);
      setDocReversoPreview(url);
    } else {
      setSelfie(file);
      setSelfiePreview(url);
    }
  };

  // ── Validar Paso 1 antes de pasar a la biometría ──
  const validarPaso1 = (): boolean => {
    setError('');

    if (formData.nombre.trim() === '') {
      setError('Por favor, necesitamos tu nombre para crear la cuenta.');
      return false;
    }
    if (formData.apellido.trim() === '') {
      setError('El apellido no puede estar vacío.');
      return false;
    }
    if (formData.documento_identidad.trim() === '') {
      setError('El documento de identidad es obligatorio para verificar tu cuenta.');
      return false;
    }
    if (formData.telefonoNumero.trim() === '' || formData.telefonoNumero.replace(/\D/g, '').length < 7) {
      setError('Necesitamos un teléfono de contacto válido.');
      return false;
    }
    if (formData.email.trim() === '') {
      setError('Olvidaste ingresar tu correo electrónico.');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      setError('El correo electrónico no tiene un formato válido.');
      return false;
    }
    if (formData.direccion.trim() === '') {
      setError('Debes proporcionar tu dirección para los envíos.');
      return false;
    }
    if (formData.ciudad.trim() === '') {
      setError('La ciudad es un campo obligatorio.');
      return false;
    }
    if (formData.pais.trim() === '') {
      setError('Por favor, indica tu país de residencia.');
      return false;
    }
    if (!REQUISITOS_PASSWORD.every((r) => r.cumple(formData.password))) {
      setError('La contraseña no cumple todos los requisitos de seguridad.');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return false;
    }

    return true;
  };

  const handleAvanzarPaso2 = (e: React.MouseEvent) => {
    e.preventDefault();
    if (validarPaso1()) {
      setError('');
      setPaso(2);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // ── Enviar formulario completo (Paso 2) ──
  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    // En el paso 3 el Enter del campo del código también envía este <form>:
    // sin esto se volvía a llamar signUp() y Supabase mandaba otro código,
    // dejando inválido el que la persona acababa de escribir.
    if (paso === 3) {
      if (codigoVerificacion.length === 8 && !loading) await handleVerificarCodigo(e);
      return;
    }

    if (paso === 1) {
      if (validarPaso1()) {
        setPaso(2);
      }
      return;
    }

    if (!docFrente) {
      setError('Por favor, sube la foto del frente de tu documento de identidad.');
      return;
    }
    if (!docReverso) {
      setError('Por favor, sube la foto posterior de tu documento de identidad.');
      return;
    }
    if (!selfie) {
      setError('Por favor, toma una selfie para completar la prueba de vida biométrica.');
      return;
    }

    const { password, telefonoNumero, telefonoPrefijo, ...perfil } = formData;
    const telefono = `${telefonoPrefijo}${telefonoNumero.replace(/\D/g, '')}`;

    setLoading(true);
    setAnalisisEtapa(1);

    try {
      // 1. Simulación visual de etapas de análisis
      await new Promise((r) => setTimeout(r, 700));
      setAnalisisEtapa(2);
      await new Promise((r) => setTimeout(r, 700));
      setAnalisisEtapa(3);
      await new Promise((r) => setTimeout(r, 600));

      // 2. Registro real en Supabase
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: perfil.email,
        password: password,
        options: {
          data: {
            nombre: perfil.nombre,
            apellido: perfil.apellido,
            documento_identidad: perfil.documento_identidad,
            telefono,
            direccion: perfil.direccion,
            ciudad: perfil.ciudad,
            pais: perfil.pais,
            es_vendedor: perfil.es_vendedor
          }
        }
      });

      if (signUpError) throw signUpError;

      // Si el proyecto no exige confirmación, Supabase entrega la sesión aquí.
      // En ese caso se completa el perfil y se conserva la sesión del backend.
      if (data.session) {
        await finalizarRegistro(data.session.access_token, telefono, perfil);
      } else {
        // Con confirmación activa, Supabase envía el código y esperamos al OTP.
        setPaso(3);
      }

    } catch (err: unknown) {
      setError(err instanceof Error
        ? err.message
        : 'No pudimos conectar con el servidor. Intenta de nuevo en un momento.');
    } finally {
      setLoading(false);
      setAnalisisEtapa(0);
    }
  };

  const finalizarRegistro = async (accessToken: string, telefono: string, datosPerfil: Omit<typeof formData, 'password' | 'confirmPassword' | 'telefonoNumero' | 'telefonoPrefijo'>) => {
    const { documento_identidad, ...datosConNombreBackend } = datosPerfil;
    await api('/api/usuarios/perfil/registro', {
      method: 'POST',
      token: accessToken,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...datosConNombreBackend, documentoIdentidad: documento_identidad, telefono }),
    });
    const sesion = await api<RespuestaLogin>('/api/usuarios/login', {
      method: 'POST',
      body: JSON.stringify({ email: formData.email.trim(), password: formData.password }),
      headers: { 'Content-Type': 'application/json' },
    });
    guardarSesion(sesion);
    setSuccess(true);
    window.setTimeout(() => navigate('/preferencias'), 1200);
  };

  // ── Validar Código OTP (Paso 3) ──
  const handleVerificarCodigo = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { data, error } = await supabase.auth.verifyOtp({
      email: formData.email,
      token: codigoVerificacion,
      type: 'signup', // Le decimos a Supabase que es un código de registro
    });

    if (error) {
      setError('Código incorrecto o expirado. Pide uno nuevo con "Reenviar código".');
      setLoading(false);
      return;
    }

    // De aquí en adelante el código ya fue aceptado: si algo falla, la cuenta
    // existe y está confirmada, así que el mensaje no debe culpar al código.
    try {
      if (data.session) {
        const telefono = `${formData.telefonoPrefijo}${formData.telefonoNumero.replace(/\D/g, '')}`;
        const datosPerfil = {
          nombre: formData.nombre,
          apellido: formData.apellido,
          documento_identidad: formData.documento_identidad,
          email: formData.email,
          direccion: formData.direccion,
          ciudad: formData.ciudad,
          pais: formData.pais,
          es_vendedor: formData.es_vendedor,
        };
        await finalizarRegistro(data.session.access_token, telefono, datosPerfil);
      } else {
        setSuccess(true);
        window.setTimeout(() => navigate('/login', { state: { email: formData.email } }), 1800);
      }

    } catch (err: unknown) {
      setError('Tu correo quedó confirmado, pero no pudimos terminar de abrir tu sesión'
        + (err instanceof Error && err.message ? ` (${err.message})` : '')
        + '. Inicia sesión con tu correo y contraseña.');
    } finally {
      setLoading(false);
    }
  };

  // ── Reenviar el código (Paso 3) ──
  // El código vence (lo define "Email OTP Expiration" en Supabase) y al pedir
  // uno nuevo el anterior deja de servir. Supabase no deja reenviar a la misma
  // dirección antes de 60 s, así que el botón espera ese tiempo.
  const [esperaReenvio, setEsperaReenvio] = useState(0);
  const [avisoReenvio, setAvisoReenvio] = useState('');

  useEffect(() => {
    if (esperaReenvio <= 0) return;
    const t = window.setTimeout(() => setEsperaReenvio((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [esperaReenvio]);

  const handleReenviarCodigo = async () => {
    setError('');
    setAvisoReenvio('');
    const { error } = await supabase.auth.resend({ type: 'signup', email: formData.email });
    if (error) {
      setError(error.status === 429
        ? 'Espera un momento antes de pedir otro código.'
        : 'No pudimos reenviar el código. Intenta de nuevo en un momento.');
      return;
    }
    setCodigoVerificacion('');
    setAvisoReenvio(`Te enviamos un código nuevo a ${formData.email}.`);
    setEsperaReenvio(60);
  };

  // ── Pantalla de Éxito Final ──
  if (success) {
    return (
      <main className="bh-acceso">
        <div className="bh-acceso__logo bh-logo">
          Bid<span>Luxury</span>
        </div>
        <div className="bh-acceso__card registro-exito">
          <div className="registro-exito__icono">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
          <h1>¡Cuenta creada y validada!</h1>
          <p>
            Tu identidad y documentos han sido procesados mediante el protocolo biométrico.
            Serás redirigido en unos segundos...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="bh-acceso">
      <Link to="/" className="bh-acceso__logo" title="Volver al inicio">
        <div className="bh-logo">
          Bid<span>Luxury</span>
        </div>
      </Link>

      {desdeLogin?.esNuevo && (
        <div className="registro-aviso" role="status">
          <div className="registro-aviso__icono">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
          </div>
          <div>
            <strong>Parece que eres nuevo en BidLuxury</strong>
            No encontramos una cuenta con <b>{desdeLogin.email}</b>. Completa tus datos para crearla.
          </div>
        </div>
      )}

      <div className="bh-acceso__card bh-acceso__card--ancha">
        <h1>{paso === 1 ? 'Crear cuenta' : 'Verificación de Identidad'}</h1>
        <p className="bh-acceso__subtitulo">
          {paso === 1
            ? 'Ingresa tus datos personales para configurar tu cuenta en BidLuxury.'
            : paso === 2 
            ? 'Para proteger a todos nuestros clientes vamos a validar tu documento de identidad y realizar una prueba biométrica.'
            : 'Por favor verifica tu bandeja de entrada.'}
        </p>

        {error && <div className="bh-acceso__error">{error}</div>}

        <form onSubmit={handleSubmit} className="bh-acceso__form" noValidate>
          {/* PASO 1: DATOS PERSONALES */}
          {paso === 1 && (
            <>
              <section className="registro-seccion">
                <h2>Datos personales</h2>
                <div className="registro-fila">
                  <div className="bh-campo">
                    <label htmlFor="nombre">Nombre</label>
                    <input
                      type="text"
                      id="nombre"
                      name="nombre"
                      placeholder="Ej: Alejandro"
                      autoComplete="given-name"
                      maxLength={100}
                      value={formData.nombre}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="bh-campo">
                    <label htmlFor="apellido">Apellido</label>
                    <input
                      type="text"
                      id="apellido"
                      name="apellido"
                      placeholder="Ej: Montes"
                      autoComplete="family-name"
                      maxLength={100}
                      value={formData.apellido}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>

                <div className="registro-fila">
                  <div className="bh-campo">
                    <label htmlFor="documento_identidad">Documento de identidad</label>
                    <input
                      type="text"
                      id="documento_identidad"
                      name="documento_identidad"
                      placeholder="Ej: 1020304050"
                      maxLength={50}
                      value={formData.documento_identidad}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="bh-campo">
                    <label htmlFor="telefono">Teléfono</label>
                    <PhoneInput
                      prefijo={formData.telefonoPrefijo}
                      numero={formData.telefonoNumero}
                      onPrefijoChange={(telefonoPrefijo) => setFormData({ ...formData, telefonoPrefijo })}
                      onNumeroChange={(telefonoNumero) => setFormData({ ...formData, telefonoNumero })}
                      error={Boolean(error && formData.telefonoNumero.trim() === '')}
                    />
                  </div>
                </div>
              </section>

              <section className="registro-seccion">
                <h2>Contacto y ubicación</h2>
                <div className="bh-campo">
                  <label htmlFor="email">Correo electrónico</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    placeholder="Ej: alejandro@email.com"
                    autoComplete="email"
                    maxLength={255}
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="bh-campo">
                  <label htmlFor="direccion">Dirección</label>
                  <input
                    type="text"
                    id="direccion"
                    name="direccion"
                    placeholder="Ej: Calle 93 # 11-26, Apto 502"
                    autoComplete="street-address"
                    value={formData.direccion}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="registro-fila">
                  <div className="bh-campo">
                    <label htmlFor="ciudad">Ciudad</label>
                    <input
                      type="text"
                      id="ciudad"
                      name="ciudad"
                      placeholder="Ej: Bogotá"
                      autoComplete="address-level2"
                      maxLength={100}
                      value={formData.ciudad}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="bh-campo">
                    <label htmlFor="pais">País</label>
                    <input
                      type="text"
                      id="pais"
                      name="pais"
                      autoComplete="country-name"
                      maxLength={100}
                      value={formData.pais}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
              </section>

              <section className="registro-seccion">
                <h2>Seguridad</h2>
                <div className="registro-fila">
                  <div className="bh-campo">
                    <label htmlFor="password">Contraseña</label>
                    <input
                      type="password"
                      id="password"
                      name="password"
                      placeholder="Crea una contraseña segura"
                      autoComplete="new-password"
                      aria-describedby="requisitos-password"
                      value={formData.password}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="bh-campo">
                    <label htmlFor="confirmPassword">Confirmar contraseña</label>
                    <input
                      type="password"
                      id="confirmPassword"
                      name="confirmPassword"
                      placeholder="Repite tu contraseña"
                      autoComplete="new-password"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>

                <ul className="registro-requisitos" id="requisitos-password">
                  {REQUISITOS_PASSWORD.map((r) => {
                    const ok = r.cumple(formData.password);
                    return (
                      <li key={r.texto} className={ok ? 'registro-requisito--ok' : ''}>
                        <span className="registro-requisito__icono" aria-hidden="true">
                          {ok ? (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                              <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          ) : '○'}
                        </span>
                        {r.texto}
                      </li>
                    );
                  })}
                </ul>
              </section>

              {/* Botón para pasar al Paso 2 */}
              <button
                type="button"
                className="btn btn--primary bh-acceso__boton"
                onClick={handleAvanzarPaso2}
              >
                Continuar a Verificación de Identidad
              </button>
            </>
          )}

          {/* PASO 2: VERIFICACIÓN KYC */}
          {paso === 2 && (
            <div className="kyc-container">
              {loading ? (
                <div className="kyc-analisis">
                  <svg className="kyc-spinner" viewBox="0 0 50 50">
                    <circle className="path" cx="25" cy="25" r="20" fill="none" strokeWidth="5"></circle>
                  </svg>
                  <h3>Validando identidad en tiempo real...</h3>
                  <p>Procesando protocolo biométrico y validación documental.</p>
                  <ul className="kyc-analisis__checklist">
                    <li className={analisisEtapa >= 1 ? 'paso-ok' : 'paso-espera'}>
                      <StatusIcon completado={analisisEtapa >= 1} />
                      <span>Extracción de datos del documento </span>
                    </li>
                    <li className={analisisEtapa >= 2 ? 'paso-ok' : 'paso-espera'}>
                      <StatusIcon completado={analisisEtapa >= 2} />
                      <span>Verificación biométrica facial </span>
                    </li>
                    <li className={analisisEtapa >= 3 ? 'paso-ok' : 'paso-espera'}>
                      <StatusIcon completado={analisisEtapa >= 3} />
                      <span>Consulta de listas y registro de cuenta</span>
                    </li>
                  </ul>
                </div>
              ) : (
                <div className="kyc-formulario">
                  
                  {/* Carga de Documentos */}
                  <div className="kyc-grid-documentos">
                    <label className={`kyc-upload-box ${docFrente ? 'kyc-upload-box--cargado' : ''}`}>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="kyc-upload-input"
                        onChange={(e) => handleFileChange('frente', e)}
                      />
                      <div className="kyc-box-content">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <rect x="3" y="4" width="18" height="16" rx="2" ry="2"></rect>
                          <line x1="7" y1="8" x2="11" y2="8"></line>
                          <circle cx="9" cy="13" r="2"></circle>
                        </svg>
                        <h3>Cédula frontal</h3>
                        <p>{docFrente ? docFrente.name : 'Toca para capturar documento'}</p>
                        <span className="kyc-status-badge">{docFrente ? 'Documento cargado' : 'Requerido'}</span>
                      </div>
                    </label>

                    <label className={`kyc-upload-box ${docReverso ? 'kyc-upload-box--cargado' : ''}`}>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="kyc-upload-input"
                        onChange={(e) => handleFileChange('reverso', e)}
                      />
                      <div className="kyc-box-content">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <rect x="3" y="4" width="18" height="16" rx="2" ry="2"></rect>
                          <line x1="3" y1="10" x2="21" y2="10"></line>
                          <line x1="7" y1="15" x2="17" y2="15"></line>
                        </svg>
                        <h3>Cédula posterior</h3>
                        <p>{docReverso ? docReverso.name : 'Toca para capturar el documento'}</p>
                        <span className="kyc-status-badge">{docReverso ? 'Documento cargado' : 'Requerido'}</span>
                      </div>
                    </label>
                  </div>

                  {/* Selfie Biométrica */}
                  <label className={`kyc-selfie-box ${selfie ? 'kyc-selfie-box--cargado' : ''}`}>
                    <input
                      type="file"
                      accept="image/*"
                      capture="user"
                      className="kyc-upload-input"
                      onChange={(e) => handleFileChange('selfie', e)}
                    />
                    <div className="kyc-box-content">
                      <div className="kyc-selfie-marco">
                        {selfiePreview ? (
                          <img src={selfiePreview} alt="Selfie biométrica" />
                        ) : (
                          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                            <path d="M12 11c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v3h16v-3c0-2.66-5.33-4-8-4z"></path>
                          </svg>
                        )}
                      </div>
                      <h3>Prueba Biometria</h3>
                      <p>Centra tu rostro con buena iluminación</p>
                      <span className="kyc-status-badge">{selfie ? 'Biometría capturada' : 'Tomar selfie'}</span>
                    </div>
                  </label>

                  <div className="registro-botones-paso2">
                    <button
                      type="button"
                      className="btn btn--outline"
                      onClick={() => { setError(''); setPaso(1); }}
                    >
                      ← Volver
                    </button>
                    <button
                      type="submit"
                      className="btn btn--primary bh-acceso__boton"
                      disabled={loading}
                    >
                      Finalizar proceso
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PASO 3: VERIFICACIÓN DE CORREO  */}
          {paso === 3 && (
            <div className="kyc-container" style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ marginBottom: '24px' }}>
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="1.5">
                  <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h2 style={{ fontSize: '1.5rem', marginBottom: '12px' }}>Verifica tu correo electrónico</h2>
              <p style={{ color: 'var(--gray-mid)', marginBottom: '32px', fontSize: '0.95rem' }}>
                Hemos enviado un código de seguridad de 8 dígitos a <strong>{formData.email}</strong>. 
                Ingrésalo a continuación para activar tu cuenta C2C.
              </p>

              <div className="bh-campo" style={{ maxWidth: '250px', margin: '0 auto 24px auto' }}>
                <input
                  type="text"
                  maxLength={8}
                  placeholder="00000000"
                  value={codigoVerificacion}
                  onChange={(e) => setCodigoVerificacion(e.target.value.replace(/\D/g, ''))}
                  style={{ fontSize: '2rem', textAlign: 'center', letterSpacing: '0.2em', padding: '16px' }}
                  required
                />
              </div>

              <button
                type="button"
                className="btn btn--primary bh-acceso__boton"
                onClick={handleVerificarCodigo}
                disabled={loading || codigoVerificacion.length < 8}
                style={{ maxWidth: '300px', margin: '0 auto' }}
              >
                {loading ? 'Validando...' : 'Confirmar código'}
              </button>

              <p style={{ color: 'var(--gray-mid)', marginTop: '20px', fontSize: '0.9rem' }}>
                ¿No te llegó o ya expiró?{' '}
                <button
                  type="button"
                  className="bh-acceso__link"
                  onClick={handleReenviarCodigo}
                  disabled={esperaReenvio > 0}
                  style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', cursor: esperaReenvio > 0 ? 'default' : 'pointer' }}
                >
                  {esperaReenvio > 0 ? `Reenviar en ${esperaReenvio} s` : 'Reenviar código'}
                </button>
              </p>
              {avisoReenvio && (
                <p role="status" style={{ color: 'var(--blue)', fontSize: '0.88rem', marginTop: '8px' }}>{avisoReenvio}</p>
              )}
            </div>
          )}
        </form>

        <p className="bh-acceso__legal">
          Al crear una cuenta, aceptas los <a href="#">Términos de servicio</a> y la{' '}
          <a href="#">Política de privacidad</a> de BidLuxury.
        </p>
      </div>

      <p className="registro-cuenta">
        ¿Ya tienes una cuenta?{' '}
        <Link to="/login" className="bh-acceso__link">Iniciar sesión</Link>
      </p>

      <footer className="bh-acceso__pie">© 2026 BidLuxury. Subastas verificadas.</footer>
    </main>
  );
}
