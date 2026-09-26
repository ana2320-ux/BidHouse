package com.bidhouse.demo.Controladores;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.bidhouse.demo.Modelos.Credenciales;
import com.bidhouse.demo.Modelos.NuevoUsuario;
import com.bidhouse.demo.Servicios.ServicioUsuario;

@RestController
@RequestMapping("/api/usuarios")
public class ControladorUsuario {

    private final ServicioUsuario servicioUsuario;

    public ControladorUsuario(ServicioUsuario servicioUsuario) {
        this.servicioUsuario = servicioUsuario;
    }

    @GetMapping("/perfil")
    public Map<String, Object> perfil() {
        return servicioUsuario.perfil();
    }

    // POST /api/usuarios/registro → 201 Created. @RequestBody le pide a Spring
    // que convierta el JSON del cuerpo en un NuevoUsuario.
    @PostMapping("/registro")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> registrar(@RequestBody NuevoUsuario nuevo) {
        return servicioUsuario.registrar(nuevo);
    }

    // POST /api/usuarios/existe → { "existe": true | false }.
    // Es POST y no GET ?email=... porque las URLs quedan en logs e historiales,
    // y un correo es un dato personal; el cuerpo de un POST no se registra.
    /// BUENO, cuando se ejecuta la API /existe, spring ejecuta el metodo, 
    // servicioUsuario.existe, que hace una consulta a la base de datos, 
    // si encuentra el email, devuelve true, si no lo encuentra devuelve false.
    ///BUENO, el requestBody es un mapa que envia toda la info que tiene el front y la envia al back
    @PostMapping("/existe")
    public Map<String, Boolean> existe(@RequestBody Map<String, String> cuerpo) {
        return Map.of("existe", servicioUsuario.existe(cuerpo.get("email")));
    }

    // POST /api/usuarios/login → 200 OK (no 201: no se crea nada, solo se entrega
    // una sesión). Devuelve los tokens y los datos básicos del usuario.
    @PostMapping("/login")
    public Map<String, Object> iniciarSesion(@RequestBody Credenciales credenciales) {
        return servicioUsuario.iniciarSesion(credenciales);
    }
}
