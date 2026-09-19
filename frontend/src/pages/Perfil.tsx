import './Perfil.css';

export default function Perfil() {
  return (
    <main className="bh-container profile-page">
      {/* Encabezado del Perfil */}
      <header className="profile-header">
        <div className="profile-user">
          <img 
            src="https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=150" 
            alt="Alejandro Montes" 
            className="profile-avatar"
          />
          <div className="profile-info">
            <div className="profile-name-row">
              <h1>Hola, Alejandro Montes</h1>
              <span className="badge-kyc">VERIFICADO</span>
            </div>
            <p>Cuenta de Custodia de Activos Reales en Operación • Premium Trader</p>
          </div>
        </div>
        <button className="btn profile-btn-add">+ Nueva Publicación </button>
      </header>

      {/* Tarjetas de Métricas */}
      <section className="profile-stats-grid">
        <article className="stat-card">
          <span className="stat-label">ACTIVOS EN SUBASTA</span>
          <h3 className="stat-value">3 Activos</h3>
          <p className="stat-desc">2 Activos en vivo, 1 en espera</p>
        </article>
        <article className="stat-card">
          <span className="stat-label">OFERTAS ACTIVAS</span>
          <h3 className="stat-value">5 Ofertas</h3>
          <p className="stat-desc">Suma total de $84,300 USD</p>
        </article>
        <article className="stat-card">
          <span className="stat-label">TRANSACCIONES COMPLETADAS</span>
          <h3 className="stat-value">14 Éxitos</h3>
          <p className="stat-desc">0 disputas registradas</p>
        </article>
        <article className="stat-card">
          <span className="stat-label">VOLUMEN TOTAL COMERCIALIZADO</span>
          <h3 className="stat-value">$412,500 USD</h3>
          <p className="stat-desc">Asegurado con smart contracts</p>
        </article>
      </section>

      {/* Contenido Principal: Dos Columnas */}
      <section className="profile-dashboard">
        {/* Columna Izquierda */}
        <div className="dashboard-col">
          <h2>Mis Activos en Custodia</h2>
          <div className="asset-list">
            <article className="asset-item">
              <div className="asset-item__image">
                <img src="https://images.unsplash.com/photo-1592198084033-aade902d1aae?auto=format&fit=crop&q=80&w=150" alt="Ferrari" />
              </div>
              <div className="asset-item__info">
                <h4>Ferrari 488 GTB 2020</h4>
                <p>Vehículos • <strong>$450,000 USD</strong></p>
              </div>
              <span className="badge-status available">• Disponible</span>
            </article>

            <article className="asset-item">
              <div className="asset-item__image">
                <img src="https://images.unsplash.com/photo-1523170335258-f5ed11844a49?auto=format&fit=crop&q=80&w=150" alt="Rolex" />
              </div>
              <div className="asset-item__info">
                <h4>Rolex Daytona Cosmograph</h4>
                <p>Relojes • <strong>$28,500 USD</strong></p>
              </div>
              <span className="badge-status waiting">• En subasta</span>
            </article>
          </div>
        </div>

        {/* Columna Derecha */}
        <div className="dashboard-col">
          <h2>Actividad Reciente y Seguridad Escrow</h2>
          <div className="activity-list">
            <article className="activity-item">
              <div className="activity-item__info">
                <h4>Nueva oferta recibida por Rolex Daytona Cosmograph</h4>
                <p>Hace 5 minutos • Oferente: 0x982A...dE89</p>
              </div>
              <span className="badge-action positive">+$100 USD</span>
            </article>

            <article className="activity-item">
              <div className="activity-item__info">
                <h4>Fondo en Custodia (Escrow Lock) activado para Ferrari</h4>
                <p>Hace 2 horas • Red Arbitrum • Smart Contract Seguro</p>
              </div>
              <span className="badge-action neutral">Bloqueado</span>
            </article>

            <article className="activity-item">
              <div className="activity-item__info">
                <h4>Inspección Física Agendada para MacBook Pro</h4>
                <p>Hace 5 horas • Hub de inspección Bogotá</p>
              </div>
              <span className="badge-action neutral">En proceso</span>
            </article>
          </div>
        </div>
      </section>
    </main>
  );
}