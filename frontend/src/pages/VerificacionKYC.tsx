import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './VerificacionKYC.css';

export default function VerificacionKYC() {
  const [paso, setPaso] = useState(1);
  const [cargando, setCargando] = useState(false);
  const navigate = useNavigate();

  const manejarSimulacion = () => {
    if (paso === 1) {
      setPaso(2); // Pasa a la foto de la selfie
    } else if (paso === 2) {
      setCargando(true);
      // Simulamos que enviamos las fotos a Spring Boot / API externa
      setTimeout(() => {
        setCargando(false);
        setPaso(3); // Éxito
      }, 3000); // Tarda 3 segundos simulando el análisis de IA
    }
  };

  const finalizar = () => {
    // Aquí redirigimos al perfil una vez verificados
    navigate('/perfil');
  };

  return (
    <main className="bh-container kyc-page">
      <div className="kyc-card">
        {cargando ? (
          <div className="kyc-state">
            <div className="loader"></div>
            <h2>Analizando biometría...</h2>
            <p>Estamos verificando tu identidad con bases de datos gubernamentales.</p>
          </div>
        ) : paso === 1 ? (
          <div className="kyc-state">
            <span className="kyc-step">Paso 1 de 2</span>
            <h2>Sube tu Cédula</h2>
            <p>Toma una foto clara del frente de tu documento de identidad.</p>
            {/* El atributo capture="environment" abre la cámara trasera en celulares */}
            <input type="file" accept="image/*" capture="environment" className="kyc-input" />
            <button className="btn btn--primary-dark" onClick={manejarSimulacion}>
              Continuar
            </button>
          </div>
        ) : paso === 2 ? (
          <div className="kyc-state">
            <span className="kyc-step">Paso 2 de 2</span>
            <h2>Prueba de Vida</h2>
            <p>Toma una selfie para comprobar que eres tú.</p>
            {/* El atributo capture="user" abre la cámara frontal en celulares */}
            <input type="file" accept="image/*" capture="user" className="kyc-input" />
            <button className="btn btn--primary-dark" onClick={manejarSimulacion}>
              Verificar Identidad
            </button>
          </div>
        ) : (
          <div className="kyc-state success">
            <div className="success-icon">✓</div>
            <h2>¡Identidad Verificada!</h2>
            <p>Tu cuenta ahora tiene el nivel de máxima seguridad C2C.</p>
            <button className="btn btn--primary-dark" onClick={finalizar}>
              Ir a mi Perfil
            </button>
          </div>
        )}
      </div>
    </main>
  );
}