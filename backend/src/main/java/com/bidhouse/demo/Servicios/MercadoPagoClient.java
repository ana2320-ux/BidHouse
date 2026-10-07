package com.bidhouse.demo.Servicios;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.List;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Map;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;

// Habla con la API de Mercado Pago (Checkout Pro). Dos cosas:
//   1) crear una "preferencia": la orden de pago. Devuelve la URL de la página
//      de Mercado Pago a la que se manda al comprador; ahí elige pagar con
//      tarjeta o con el dinero de su cuenta.
//   2) consultar un pago por su id, para confirmar que de verdad se aprobó.
//
// El token es secreto (con él se cobra y se reembolsa): solo vive en
// backend/.env como MERCADOPAGO_ACCESS_TOKEN. Si falta, la app arranca igual y
// solo fallan los pagos con un mensaje claro.
@Component
public class MercadoPagoClient {

    private static final ParameterizedTypeReference<Map<String, Object>> OBJETO = new ParameterizedTypeReference<>() {};

    private final RestClient http;
    private final boolean configurado;
    private final String urlRetorno;
    private final String secretoWebhook;

    public MercadoPagoClient(@Value("${mercadopago.access-token}") String token,
                             @Value("${bidhouse.front-url}") String frontUrl,
                             @Value("${mercadopago.webhook-secret:}") String secretoWebhook) {
        this.configurado = token != null && !token.isBlank();
        this.urlRetorno = frontUrl + "/pagos/retorno";
        this.secretoWebhook = secretoWebhook == null ? "" : secretoWebhook.trim();
        this.http = RestClient.builder()
                .baseUrl("https://api.mercadopago.com")
                .defaultHeader("Authorization", "Bearer " + token)
                .build();
    }

    // Moneda: el sitio muestra USD, pero la cuenta es de Colombia y cobra en
    // COP. Para el demo se cobra el mismo número (1 USD = 1 COP) redondeado a
    // pesos enteros. registrar_pago_mercadopago() en la BD usa la misma regla.
    static BigDecimal aPesos(BigDecimal usd) {
        return usd.setScale(0, RoundingMode.HALF_UP);
    }

    // Devuelve la URL de pago. "referenciaExterna" viaja a Mercado Pago y vuelve
    // en el pago: así sabemos qué se pagó (ej. "contrato:<id>").
    public String crearPreferencia(String titulo, BigDecimal montoUsd, String referenciaExterna) {
        exigirConfiguracion();
        Map<String, Object> cuerpo = Map.of(
                "items", List.of(Map.of(
                        "title", titulo,
                        "quantity", 1,
                        "unit_price", aPesos(montoUsd),
                        "currency_id", "COP")),
                "external_reference", referenciaExterna,
                // Sin "auto_return": Mercado Pago lo rechaza con localhost (exige
                // https público). El comprador vuelve con "Volver al sitio".
                "back_urls", Map.of("success", urlRetorno, "failure", urlRetorno, "pending", urlRetorno),
                "statement_descriptor", "BIDLUXURY");
        try {
            Map<String, Object> preferencia = http.post()
                    .uri("/checkout/preferences")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(cuerpo)
                    .retrieve()
                    .body(OBJETO);
            // Con las credenciales de una cuenta de PRUEBA se usa init_point
            // (la cuenta de prueba ya hace que todo sea sandbox).
            return String.valueOf(preferencia.get("init_point"));
        } catch (RestClientResponseException e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Mercado Pago no pudo crear el pago (respondió " + e.getStatusCode().value() + ").", e);
        }
    }

    // Mercado Pago Preapproval crea una suscripción recurrente. El monto se
    // recibe en USD porque es la moneda que muestra el sitio, pero se envía en
    // COP con la misma conversión que ya usa Checkout Pro en este proyecto.
    public Map<String, Object> crearPreaprobacion(String titulo, String email, BigDecimal montoUsd,
                                                   String periodicidad, String referenciaExterna) {
        exigirConfiguracion();
        Map<String, Object> recurrente = new LinkedHashMap<>();
        recurrente.put("frequency", 1);
        recurrente.put("frequency_type", "anual".equals(periodicidad) ? "years" : "months");
        recurrente.put("transaction_amount", aPesos(montoUsd));
        recurrente.put("currency_id", "COP");

        Map<String, Object> cuerpo = new LinkedHashMap<>();
        cuerpo.put("reason", titulo);
        cuerpo.put("payer_email", email);
        cuerpo.put("external_reference", referenciaExterna);
        cuerpo.put("back_url", urlRetorno.replace("/pagos/retorno", "/membresia/resultado"));
        cuerpo.put("auto_recurring", recurrente);
        try {
            Map<String, Object> respuesta = http.post()
                    .uri("/preapproval")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(cuerpo)
                    .retrieve()
                    .body(OBJETO);
            Object url = respuesta.get("init_point");
            if (url == null || String.valueOf(url).isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                        "Mercado Pago no devolvió una URL para iniciar la membresía.");
            }
            Object id = respuesta.get("id");
            if (id == null || String.valueOf(id).isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                        "Mercado Pago no devolvió el identificador de la membresía.");
            }
            return Map.of("url", String.valueOf(url), "id", String.valueOf(id));
        } catch (RestClientResponseException e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Mercado Pago no pudo crear la membresía (respondió " + e.getStatusCode().value() + ").", e);
        }
    }

    public Map<String, Object> obtenerPreaprobacion(String id) {
        exigirConfiguracion();
        try {
            return http.get().uri("/preapproval/{id}", id).retrieve().body(OBJETO);
        } catch (RestClientResponseException e) {
            if (e.getStatusCode().value() == 404) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Mercado Pago no tiene esa membresía.");
            }
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "No se pudo consultar la membresía en Mercado Pago.", e);
        }
    }

    public void cancelarPreaprobacion(String id) {
        exigirConfiguracion();
        try {
            http.put().uri("/preapproval/{id}", id)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("status", "cancelled"))
                    .retrieve().toBodilessEntity();
        } catch (RestClientResponseException e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Mercado Pago no pudo cancelar la renovación.", e);
        }
    }

    // Mercado Pago firma el manifest con el formato exacto id/request-id/ts.
    // Si no hay secreto configurado se rechaza el webhook: nunca se activa una
    // membresía solo porque alguien llamó públicamente a este endpoint.
    public boolean firmaWebhookValida(String firma, String requestId, String dataId) {
        if (secretoWebhook.isBlank() || firma == null || requestId == null || dataId == null) return false;
        String ts = null;
        String v1 = null;
        for (String parte : firma.split(",")) {
            String[] claveValor = parte.trim().split("=", 2);
            if (claveValor.length != 2) continue;
            if ("ts".equals(claveValor[0])) ts = claveValor[1];
            if ("v1".equals(claveValor[0])) v1 = claveValor[1];
        }
        if (ts == null || v1 == null || !ts.matches("\\d+")) return false;
        String manifest = "id:" + dataId + ";request-id:" + requestId + ";ts:" + ts + ";";
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secretoWebhook.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] esperado = mac.doFinal(manifest.getBytes(StandardCharsets.UTF_8));
            byte[] recibido = HexFormat.of().parseHex(v1);
            return MessageDigest.isEqual(esperado, recibido);
        } catch (NoSuchAlgorithmException | InvalidKeyException | IllegalArgumentException e) {
            return false;
        }
    }

    // GET /v1/payments/{id}: la fuente de verdad sobre un pago. Nunca se confía
    // en el "status=approved" que viene en la URL de retorno: eso lo puede
    // escribir cualquiera a mano.
    public Map<String, Object> obtenerPago(String idPago) {
        exigirConfiguracion();
        try {
            return http.get().uri("/v1/payments/{id}", idPago).retrieve().body(OBJETO);
        } catch (RestClientResponseException e) {
            if (e.getStatusCode().value() == 404) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Mercado Pago no tiene un pago con ese id.");
            }
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "No se pudo consultar el pago en Mercado Pago (respondió " + e.getStatusCode().value() + ").", e);
        }
    }

    // Pagos recibidos por la cuenta de BidHouse en los últimos 7 días, los más
    // nuevos primero. Reemplaza a los webhooks (que exigen una URL pública):
    // en vez de que Mercado Pago nos avise, le preguntamos.
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> buscarPagosRecientes() {
        exigirConfiguracion();
        try {
            Map<String, Object> respuesta = http.get()
                    .uri("/v1/payments/search?sort=date_created&criteria=desc&limit=100"
                            + "&range=date_created&begin_date=NOW-7DAYS&end_date=NOW")
                    .retrieve()
                    .body(OBJETO);
            Object resultados = respuesta.get("results");
            return resultados instanceof List<?> lista ? (List<Map<String, Object>>) lista : List.of();
        } catch (RestClientResponseException e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "No se pudieron consultar los pagos en Mercado Pago (respondió " + e.getStatusCode().value() + ").", e);
        }
    }

    private void exigirConfiguracion() {
        if (!configurado) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Mercado Pago no está configurado: falta MERCADOPAGO_ACCESS_TOKEN en backend/.env.");
        }
    }
}
