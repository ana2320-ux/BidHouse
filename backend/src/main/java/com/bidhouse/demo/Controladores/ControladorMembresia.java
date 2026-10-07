package com.bidhouse.demo.Controladores;

import java.util.List;
import java.util.Map;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.bidhouse.demo.Modelos.SolicitudMembresia;
import com.bidhouse.demo.Servicios.ServicioMembresia;

@RestController
@RequestMapping("/api/membresias")
public class ControladorMembresia {

    private final ServicioMembresia servicio;

    public ControladorMembresia(ServicioMembresia servicio) {
        this.servicio = servicio;
    }

    @GetMapping("/planes")
    public List<Map<String, Object>> planes() {
        return servicio.planes();
    }

    @GetMapping("/estado")
    public Map<String, Object> estado(@AuthenticationPrincipal Jwt jwt) {
        return servicio.estado(jwt.getSubject());
    }

    @PostMapping("/checkout")
    public Map<String, Object> checkout(@AuthenticationPrincipal Jwt jwt,
                                        @RequestBody SolicitudMembresia solicitud) {
        return servicio.iniciarCheckout(jwt.getSubject(), solicitud);
    }

    @PostMapping("/confirmar")
    public Map<String, Object> confirmar(@AuthenticationPrincipal Jwt jwt,
                                         @RequestBody Map<String, String> cuerpo) {
        return servicio.confirmar(jwt.getSubject(), cuerpo.get("preapprovalId"));
    }

    @PostMapping("/cancelar")
    public Map<String, Object> cancelar(@AuthenticationPrincipal Jwt jwt) {
        return servicio.cancelar(jwt.getSubject());
    }
}
