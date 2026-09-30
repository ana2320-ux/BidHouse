package com.bidhouse.demo.Controladores;

import java.math.BigDecimal;
import java.util.Map;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.bidhouse.demo.Servicios.ServicioPagos;

// Todo aquí exige sesión (ver SeguridadConfig): quien paga o recarga es
// siempre el dueño del token.
@RestController
@RequestMapping("/api/pagos")
public class ControladorPagos {

    private final ServicioPagos servicioPagos;

    public ControladorPagos(ServicioPagos servicioPagos) {
        this.servicioPagos = servicioPagos;
    }

    // Paga un contrato con el saldo de BidHouse. Queda en custodia al instante.
    @PostMapping("/contratos/{id}/saldo")
    public Map<String, Object> pagarConSaldo(@PathVariable String id, @AuthenticationPrincipal Jwt jwt) {
        return servicioPagos.pagarConSaldo(id, jwt.getSubject());
    }

    // Crea el pago en Mercado Pago y devuelve { url } para mandar al comprador.
    @PostMapping("/contratos/{id}/mercadopago")
    public Map<String, Object> pagarConMercadoPago(@PathVariable String id, @AuthenticationPrincipal Jwt jwt) {
        return servicioPagos.iniciarPagoMercadoPago(id, jwt.getSubject());
    }

    // Recargar saldo: { "monto": 50000 } → { url } de Mercado Pago.
    @PostMapping("/recargas")
    public Map<String, Object> recargar(@RequestBody Map<String, BigDecimal> cuerpo, @AuthenticationPrincipal Jwt jwt) {
        return servicioPagos.iniciarRecarga(jwt.getSubject(), cuerpo.get("monto"));
    }

    // Al volver de Mercado Pago: { "idPago": "123..." } → verifica y registra.
    @PostMapping("/confirmar")
    public Map<String, Object> confirmar(@RequestBody Map<String, String> cuerpo, @AuthenticationPrincipal Jwt jwt) {
        return servicioPagos.confirmar(jwt.getSubject(), cuerpo.get("idPago"));
    }

    // Busca en Mercado Pago los pagos aprobados de este usuario que todavía no
    // se registraron (por si no volvió con "Volver al sitio") → { "nuevos": n }.
    @PostMapping("/sincronizar")
    public Map<String, Object> sincronizar(@AuthenticationPrincipal Jwt jwt) {
        return servicioPagos.sincronizar(jwt.getSubject());
    }

    @GetMapping("/saldo")
    public Map<String, Object> saldo(@AuthenticationPrincipal Jwt jwt) {
        return servicioPagos.saldo(jwt.getSubject());
    }
}
