import Navbar from './components/Navbar';
import Home from './pages/Home';
import { Routes, Route } from 'react-router-dom';
import Perfil from './pages/Perfil.tsx';
import Catalogo from './pages/Catalogo';
import ComoFunciona from './pages/ComoFunciona.tsx';
import Registro from './pages/Registro';
import Vender from './pages/Vender.tsx';
import DetalleActivo from './pages/DetalleActivo';
import Login from './pages/Login.tsx';

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
        <Route path="/activo/:id" element={<DetalleActivo />} />
        {/* Aquí agregaremos más rutas en el futuro. Ejemplo: */}
        {/* <Route path="/subastas" element={<Auctions />} /> */}
        <Route path="/como-funciona" element={<ComoFunciona />} />
        <Route path="/registro" element={<Registro />} />
        <Route path="/vender" element={<Vender />} />
        <Route path="/login" element={<Login />} />
      </Routes>
    </div>
  );
}

export default App;
