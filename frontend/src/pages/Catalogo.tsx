import './Catalogo.css';

const MOCK_ITEMS = [
  {
    id: 1,
    category: "VEHÍCULOS",
    title: "Ferrari 488 GTB 2020",
    status: "Disponible",
    hash: "0xC3B857 ... 7EBA",
    image: "https://images.unsplash.com/photo-1592198084033-aade902d1aae?auto=format&fit=crop&q=80&w=600"
  },
  {
    id: 2,
    category: "RELOJES",
    title: "Rolex Daytona",
    status: "En verificación",
    hash: "0x59BC77 ... 376F",
    image: "https://images.unsplash.com/photo-1523170335258-f5ed11844a49?auto=format&fit=crop&q=80&w=600"
  },
  {
    id: 3,
    category: "COLECCIONABLES",
    title: "Charizard PSA 10",
    status: "Disponible",
    hash: "0x958703 ... 5622",
    image: "https://images.unsplash.com/photo-1613771404784-3a5686aa2be3?auto=format&fit=crop&q=80&w=600"
  }
];

const FILTERS = ["Todos", "Vehículos", "Relojes", "Inmuebles", "Arte", "Electrónicos", "Coleccionables", "Otros"];

export default function Catalogo() {
  return (
    <main className="bh-container catalog-page">
      {/* Encabezado */}
      <header className="catalog-header">
        <div>
          <h1>Catálogo de activos de alto valor</h1>
          <p>Participa en subastas respaldadas por contratos inteligentes con total seguridad jurídica.</p>
        </div>
        
      </header>

      {/* Barra de búsqueda */}
      <div className="search-container">
        <svg className="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input type="text" placeholder="Buscar activos..." className="search-input" />
        <span className="search-shortcut">Ctrl + K</span>
      </div>

      {/* Filtros */}
      <div className="filters-container">
        {FILTERS.map((filter, index) => (
          <button 
            key={filter} 
            className={`filter-pill ${index === 0 ? 'active' : ''}`}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Grid de Tarjetas */}
      <div className="catalog-grid">
        {MOCK_ITEMS.map((item) => (
          <article key={item.id} className="catalog-card">
            <div className="catalog-card__image-wrapper">
              <img src={item.image} alt={item.title} />
            </div>
            <div className="catalog-card__content">
              <div className="catalog-card__meta">
                <span className="category">{item.category}</span>
                <span className={`status ${item.status === 'Disponible' ? 'status--available' : 'status--pending'}`}>
                  • {item.status}
                </span>
              </div>
              <h3 className="catalog-card__title">{item.title}</h3>
              <div className="catalog-card__hash">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                </svg>
                {item.hash}
              </div>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}