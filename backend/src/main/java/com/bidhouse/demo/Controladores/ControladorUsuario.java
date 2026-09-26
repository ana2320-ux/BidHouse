package com.bidhouse.demo.Controladores;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

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
}
