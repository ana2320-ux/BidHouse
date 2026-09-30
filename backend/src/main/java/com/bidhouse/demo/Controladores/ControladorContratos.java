package com.bidhouse.demo.Controladores;

import java.util.Map;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.bidhouse.demo.Servicios.ServicioContratos;

// Las acciones sobre un contrato de garantía ya pagado. Todas exigen sesión;
// la BD revisa que quien llama sea el vendedor o el comprador según el caso.
@RestController
@RequestMapping("/api/contratos")
public class ControladorContratos {

    private final ServicioContratos servicioContratos;

    public ControladorContratos(ServicioContratos servicioContratos) {
        this.servicioContratos = servicioContratos;
    }

    // Vendedor: { "guia": "Servientrega 1234567" }
    @PostMapping("/{id}/envio")
    public Map<String, Object> marcarEnviado(@PathVariable String id, @AuthenticationPrincipal Jwt jwt,
                                             @RequestBody Map<String, String> cuerpo) {
        return servicioContratos.marcarEnviado(id, jwt.getSubject(), cuerpo.get("guia"));
    }

    // Comprador: confirma que le llegó. Esto libera el pago al vendedor.
    @PostMapping("/{id}/recepcion")
    public Map<String, Object> confirmarRecepcion(@PathVariable String id, @AuthenticationPrincipal Jwt jwt) {
        return servicioContratos.confirmarRecepcion(id, jwt.getSubject());
    }

    // Comprador: { "motivo": "Llegó con la caja rota..." }. Retiene el pago.
    @PostMapping("/{id}/problema")
    public Map<String, Object> reportarProblema(@PathVariable String id, @AuthenticationPrincipal Jwt jwt,
                                                @RequestBody Map<String, String> cuerpo) {
        return servicioContratos.reportarProblema(id, jwt.getSubject(), cuerpo.get("motivo"));
    }
}
