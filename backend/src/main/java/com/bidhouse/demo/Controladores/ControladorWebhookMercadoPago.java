package com.bidhouse.demo.Controladores;

import java.util.Map;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.bidhouse.demo.Servicios.ServicioMembresia;

@RestController
@RequestMapping("/api/webhooks/mercadopago")
public class ControladorWebhookMercadoPago {

    private final ServicioMembresia servicio;

    public ControladorWebhookMercadoPago(ServicioMembresia servicio) {
        this.servicio = servicio;
    }

    @PostMapping
    public Map<String, Object> recibir(@RequestBody Map<String, Object> evento,
                                       @RequestHeader(value = "x-signature", required = false) String firma,
                                       @RequestHeader(value = "x-request-id", required = false) String requestId) {
        return servicio.procesarWebhook(evento, firma, requestId);
    }
}
