package com.bidhouse.demo.Controladores;

import com.bidhouse.demo.Modelos.Usuario;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/usuarios")
@CrossOrigin(origins = "http://localhost:5173") // Permite que tu frontend de Vite se conecte
public class ControladorUsuario {

    @GetMapping("/perfil")
    public Usuario obtenerPerfilActual() {
        // Simulamos el usuario que tienes en tu diseño actual
        return new Usuario(
                "Alejandro",
                "Montes",
                "alejandro@bidhouse.com",
                "secreto123",
                "alemontes",
                "Vendedor de obras de arte certificadas• Premium Trader"
        );
    }
}