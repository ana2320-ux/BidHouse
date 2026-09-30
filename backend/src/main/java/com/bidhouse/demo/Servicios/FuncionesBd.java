package com.bidhouse.demo.Servicios;

import java.math.BigDecimal;
import java.text.NumberFormat;
import java.util.Locale;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;

// Llamar funciones de Postgres (pujar, comprar_ahora, pagar_contrato_con_saldo...)
// y traducir sus errores a un status HTTP y un mensaje en español.
// Las funciones lanzan un código en MAYÚSCULAS y PostgREST lo devuelve así:
//   { "code": "P0001", "message": "MONTO_INSUFICIENTE", "details": "1250000" }
// El "message" es el código; "details" trae un dato extra si la función lo mandó.
final class FuncionesBd {

    private FuncionesBd() {
    }

    static Map<String, Object> llamar(SupabaseClient db, String funcion, Map<String, Object> parametros) {
        try {
            return db.llamarFuncion(funcion, parametros);
        } catch (RestClientResponseException e) {
            Map<?, ?> cuerpo;
            try {
                cuerpo = e.getResponseBodyAs(Map.class);
            } catch (RuntimeException noEsJson) {
                cuerpo = null;
            }
            throw traducirError(cuerpo, e);
        }
    }

    static ResponseStatusException traducirError(Map<?, ?> cuerpo, Throwable causa) {
        String codigo = cuerpo == null ? "" : String.valueOf(cuerpo.get("code"));
        String mensaje = cuerpo == null ? "" : String.valueOf(cuerpo.get("message"));
        String detalle = cuerpo == null ? "" : String.valueOf(cuerpo.get("details"));

        if ("23503".equals(codigo)) { // llave foránea: el usuario no tiene fila en "usuarios"
            return new ResponseStatusException(HttpStatus.NOT_FOUND,
                    "Tu cuenta no tiene un perfil asociado. Contacta a soporte.", causa);
        }
        if ("PGRST202".equals(codigo)) { // PostgREST no encuentra la función
            return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Falta crear una función en la base de datos: corre los scripts de backend/sql/.", causa);
        }

        return switch (mensaje) {
            case "MONTO_INSUFICIENTE" -> new ResponseStatusException(HttpStatus.CONFLICT,
                    "Alguien ya ofreció más o no alcanzas el mínimo. La puja mínima ahora es " + usd(detalle) + ".");
            case "MONTO_INVALIDO" -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "El monto debe ser mayor a 0");
            case "SUBASTA_NO_EXISTE" -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Subasta no encontrada");
            case "NO_PERMITE_PUJAS" -> new ResponseStatusException(HttpStatus.CONFLICT,
                    "Esta publicación es de precio fijo: no recibe pujas.");
            case "SUBASTA_NO_ACTIVA", "SUBASTA_NO_INICIADA" -> new ResponseStatusException(HttpStatus.CONFLICT,
                    "Esta subasta todavía no está abierta a pujas.");
            case "SUBASTA_CERRADA" -> new ResponseStatusException(HttpStatus.CONFLICT, "Esta subasta ya cerró.");
            case "PUJA_PROPIA" -> new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "No puedes pujar en tu propia publicación.");
            case "YA_VAS_GANANDO" -> new ResponseStatusException(HttpStatus.CONFLICT,
                    "Ya tienes la puja más alta en esta subasta.");
            // De comprar_ahora():
            case "SIN_COMPRA_INMEDIATA" -> new ResponseStatusException(HttpStatus.CONFLICT,
                    "Esta publicación es una subasta: solo se puede pujar.");
            case "YA_VENDIDA" -> new ResponseStatusException(HttpStatus.CONFLICT,
                    "Alguien ya compró este activo.");
            case "YA_HAY_PUJAS" -> new ResponseStatusException(HttpStatus.CONFLICT,
                    "Ya hay pujas en esta subasta: \"Cómpralo ya\" dejó de estar disponible.");
            case "COMPRA_PROPIA" -> new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "No puedes comprar tu propia publicación.");
            // De los pagos (backend/sql/fase4_pagos.sql):
            case "CONTRATO_NO_EXISTE" -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Contrato no encontrado");
            case "NO_ES_TU_CONTRATO" -> new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Este contrato no es tuyo.");
            case "CONTRATO_YA_PAGADO" -> new ResponseStatusException(HttpStatus.CONFLICT,
                    "Este contrato ya fue pagado.");
            case "PLAZO_VENCIDO" -> new ResponseStatusException(HttpStatus.CONFLICT,
                    "Se venció el plazo de 48 horas para pagar este contrato.");
            case "SALDO_INSUFICIENTE" -> new ResponseStatusException(HttpStatus.CONFLICT,
                    "No te alcanza el saldo: tienes " + usd(detalle) + ". Recarga saldo o paga con Mercado Pago.");
            case "MONTO_NO_COINCIDE" -> new ResponseStatusException(HttpStatus.CONFLICT,
                    "El monto pagado en Mercado Pago no coincide con el del contrato.");
            // De la entrega (backend/sql/fase4b_entrega.sql):
            case "NO_ES_TU_VENTA" -> new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Esta venta no es tuya.");
            case "CONTRATO_NO_PAGADO" -> new ResponseStatusException(HttpStatus.CONFLICT,
                    "El comprador todavía no ha pagado este contrato.");
            case "CONTRATO_CERRADO" -> new ResponseStatusException(HttpStatus.CONFLICT,
                    "Este contrato ya no admite ese cambio (ya se completó, se canceló o está en disputa).");
            case "USUARIO_NO_EXISTE" -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                    "Tu cuenta no tiene un perfil asociado. Contacta a soporte.");
            default -> new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "No se pudo completar la operación. Intenta de nuevo.", causa);
        };
    }

    static String usd(String valor) {
        try {
            return "$" + NumberFormat.getNumberInstance(Locale.US).format(new BigDecimal(valor)) + " USD";
        } catch (NumberFormatException e) {
            return valor;
        }
    }
}
