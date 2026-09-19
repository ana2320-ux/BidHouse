import Navbar from './components/Navbar';
import Home from './pages/Home';
import { Routes, Route } from 'react-router-dom';
import Perfil from './pages/Perfil.tsx'; 
import Catalogo from './pages/Catalogo';

function App() {
  return (
    <div>
      {/* El Navbar va primero para que quede arriba de todo */}
      <Navbar />
     {/* Routes actúa como un contenedor donde se intercambiarán las páginas */}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/perfil" element={<Perfil />} />
        <Route path="/catalogo" element={<Catalogo />} />
        {/* Aquí agregaremos más rutas en el futuro. Ejemplo: */}
        {/* <Route path="/subastas" element={<Auctions />} /> */}
      </Routes>
    </div>
  );
}

export default App;