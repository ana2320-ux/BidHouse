package com.bidhouse.demo.Servicios;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

// Pagos de contratos y saldo. La lógica que mueve dinero vive en funciones de
// Postgres (backend/sql/fase4_pagos.sql), atómicas e idempotentes; aquí se
// verifica con Mercado Pago y se decide qué función llamar.
//
// Referencias externas que viajan a Mercado Pago y vuelven en el pago:
//   "contrato:<idTransaccion>"            → pagar un contrato
//   "recarga:<idUsuario>:<uuid aleatorio>" → recargar saldo
@Service
public class ServicioPagos {

    static final BigDecimal RECARGA_MINIMA = new BigDecimal("1000");
    static final BigDecimal RECARGA_MAXIMA = new BigDecimal("100000000");

    private final SupabaseClient db;
    private final MercadoPagoClient mercadoPago;

    public ServicioPagos(SupabaseClient db, MercadoPagoClient mercadoPago) {
        this.db = db;
        this.mercadoPago = mercadoPago;
    }

    // ── Pagar un contrato ──

    public Map<String, Object> pagarConSaldo(String idTransaccion, String idUsuario) {
        Map<String, Object> parametros = new HashMap<>();
        parametros.put("p_transaccion_id", uuid(idTransaccion, "Contrato no encontrado"));
        parametros.put("p_comprador_id", idUsuario);
        Map<String, Object> contrato = FuncionesBd.llamar(db, "pagar_contrato_con_saldo", parametros);
        return Map.of("estado", contrato.get("estado"), "subastaId", contrato.get("subasta_id"));
    }

    public Map<String, Object> iniciarPagoMercadoPago(String idTransaccion, String idUsuario) {
        String id = uuid(idTransaccion, "Contrato no encontrado");
        // El id del usuario viene del token: solo se encuentra si es SU contrato.
        List<Map<String, Object>> filas = db.consultar("/transacciones?id=eq." + id + "&comprador_id=eq." + idUsuario
                + "&select=id,estado,monto,fecha_limite_pago,subastas(titulo)&limit=1");
        if (filas.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Contrato no encontrado");
        }
        Map<String, Object> contrato = filas.get(0);
        if (!"pendiente".equals(contrato.get("estado"))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Este contrato ya fue pagado.");
        }
        String titulo = contrato.get("subastas") instanceof Map<?, ?> s ? String.valueOf(s.get("titulo")) : "Activo BidHouse";
        String url = mercadoPago.crearPreferencia("BidHouse · " + titulo, decimal(contrato.get("monto")), "contrato:" + id);
        return Map.of("url", url);
    }

    // ── Recargar saldo ──

    public Map<String, Object> iniciarRecarga(String idUsuario, BigDecimal monto) {
        if (monto == null || monto.compareTo(RECARGA_MINIMA) < 0 || monto.compareTo(RECARGA_MAXIMA) > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "La recarga debe estar entre " + FuncionesBd.usd(RECARGA_MINIMA.toPlainString())
                            + " y " + FuncionesBd.usd(RECARGA_MAXIMA.toPlainString()) + ".");
        }
        // El uuid hace única cada recarga aunque sea del mismo monto.
        String referencia = "recarga:" + idUsuario + ":" + UUID.randomUUID();
        String url = mercadoPago.crearPreferencia("Recarga de saldo BidHouse", monto, referencia);
        return Map.of("url", url);
    }

    // ── Confirmar un pago al volver de Mercado Pago ──
    // La página de retorno manda el id del pago. Con ese id se le pregunta a
    // Mercado Pago cómo quedó (la URL no se cree) y, si está aprobado, se
    // registra según lo que diga external_reference. Repetirlo no duplica nada.
    public Map<String, Object> confirmar(String idUsuario, String idPago) {
        if (idPago == null || !idPago.matches("\\d{1,20}")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Id de pago inválido.");
        }
        Map<String, Object> pago = mercadoPago.obtenerPago(idPago);

        Map<String, Object> respuesta = new LinkedHashMap<>();
        respuesta.put("estadoPago", String.valueOf(pago.get("status")));
        if (!"approved".equals(pago.get("status"))) {
            // pending / in_process / rejected: nada que registrar todavía.
            return respuesta;
        }
        Map<String, Object> registrado = registrar(pago, idUsuario);
        if (registrado == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Este pago no corresponde a tu cuenta.");
        }
        respuesta.putAll(registrado);
        return respuesta;
    }

    // ── Sincronizar: detectar pagos sin que el comprador vuelva al sitio ──
    // Mercado Pago no devuelve a localhost después de pagar (ver AGENTS.md),
    // así que al abrir el perfil o el activo se le pregunta qué pagos aprobados
    // recibió BidHouse en los últimos 7 días y se registran los de este
    // usuario. Es lo que haría un webhook si tuviéramos URL pública.
    // Los ya registrados se saltan: las funciones de la BD son idempotentes.
    public Map<String, Object> sincronizar(String idUsuario) {
        int nuevos = 0;
        for (Map<String, Object> pago : mercadoPago.buscarPagosRecientes()) {
            if (!"approved".equals(pago.get("status")) || yaRegistrado(pago)) continue;
            try {
                if (registrar(pago, idUsuario) != null) nuevos++;
            } catch (ResponseStatusException e) {
                // ponytail: un pago aprobado que no se pudo registrar (ej. el
                // contrato ya se pagó con saldo) debería reembolsarse con la API
                // de Mercado Pago. Por ahora solo se salta.
            }
        }
        return Map.of("nuevos", nuevos);
    }

    // ¿Este pago ya se reflejó en BidHouse? Evita volver a llamar la BD por
    // cada pago viejo cada vez que alguien abre su perfil.
    private boolean yaRegistrado(Map<String, Object> pago) {
        String idPago = String.valueOf(pago.get("id"));
        String referencia = String.valueOf(pago.get("external_reference"));
        if (referencia.startsWith("recarga:")) {
            return !db.consultar("/movimientos?tipo=eq.recarga&referencia=eq." + idPago + "&select=id&limit=1").isEmpty();
        }
        if (referencia.startsWith("contrato:")) {
            return !db.consultar("/transacciones?referencia_pago=eq." + idPago + "&select=id&limit=1").isEmpty();
        }
        return true; // no es de BidHouse (ej. movimientos internos del sandbox)
    }

    // Registra un pago APROBADO si es de este usuario. Devuelve null si no le
    // corresponde (contrato de otra persona, recarga de otra cuenta o un pago
    // que no es de BidHouse).
    private Map<String, Object> registrar(Map<String, Object> pago, String idUsuario) {
        String idPago = String.valueOf(pago.get("id"));
        String referencia = String.valueOf(pago.get("external_reference"));
        BigDecimal cobrado = decimal(pago.get("transaction_amount"));
        Map<String, Object> respuesta = new LinkedHashMap<>();

        if (referencia.startsWith("contrato:")) {
            String idContrato;
            try {
                idContrato = UUID.fromString(referencia.substring("contrato:".length())).toString();
            } catch (IllegalArgumentException e) {
                return null;
            }
            // Solo si quien pregunta es el comprador de ese contrato.
            if (db.consultar("/transacciones?id=eq." + idContrato + "&comprador_id=eq." + idUsuario
                    + "&select=id&limit=1").isEmpty()) {
                return null;
            }
            Map<String, Object> parametros = new HashMap<>();
            parametros.put("p_transaccion_id", idContrato);
            parametros.put("p_referencia", idPago);
            parametros.put("p_monto_cobrado", cobrado);
            Map<String, Object> contrato = FuncionesBd.llamar(db, "registrar_pago_mercadopago", parametros);
            respuesta.put("tipo", "contrato");
            respuesta.put("subastaId", contrato.get("subasta_id"));
            respuesta.put("monto", contrato.get("monto"));
            return respuesta;
        }

        if (referencia.startsWith("recarga:")) {
            String[] partes = referencia.split(":");
            if (partes.length != 3 || !partes[1].equals(idUsuario)) {
                return null;
            }
            Map<String, Object> parametros = new HashMap<>();
            parametros.put("p_usuario_id", idUsuario);
            parametros.put("p_monto", cobrado); // 1 COP cobrado = 1 USD de saldo
            parametros.put("p_referencia", idPago);
            Map<String, Object> movimiento = FuncionesBd.llamar(db, "acreditar_recarga", parametros);
            respuesta.put("tipo", "recarga");
            respuesta.put("monto", movimiento.get("monto"));
            respuesta.put("saldo", movimiento.get("saldo_despues"));
            return respuesta;
        }
        return null;
    }

    // ── Saldo ──
    // "disponible": lo que puede usar ya. "porLiberar": ventas pagadas que
    // siguen en custodia (monto menos comisión); se vuelven saldo al liberarse.
    public Map<String, Object> saldo(String idUsuario) {
        List<Map<String, Object>> usuario = db.consultar("/usuarios?id=eq." + idUsuario + "&select=saldo_disponible&limit=1");
        if (usuario.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Tu cuenta no tiene un perfil asociado. Contacta a soporte.");
        }
        List<Map<String, Object>> enCustodia = db.consultar("/transacciones?vendedor_id=eq." + idUsuario
                + "&estado=in.(en_custodia,enviado,recibido)&select=monto,comision_plataforma");
        BigDecimal porLiberar = enCustodia.stream()
                .map(t -> decimal(t.get("monto")).subtract(decimalOCero(t.get("comision_plataforma"))))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        List<Map<String, Object>> movimientos = db.consultar("/movimientos?usuario_id=eq." + idUsuario
                + "&select=id,tipo,monto,saldo_despues,descripcion,creado_en&order=creado_en.desc&limit=20");

        Map<String, Object> respuesta = new LinkedHashMap<>();
        respuesta.put("disponible", decimalOCero(usuario.get(0).get("saldo_disponible")));
        respuesta.put("porLiberar", porLiberar);
        respuesta.put("movimientos", movimientos);
        return respuesta;
    }

    private static String uuid(String valor, String mensajeSiNo) {
        try {
            return UUID.fromString(valor).toString();
        } catch (IllegalArgumentException | NullPointerException e) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, mensajeSiNo);
        }
    }

    private static BigDecimal decimal(Object valor) {
        return new BigDecimal(String.valueOf(valor));
    }

    private static BigDecimal decimalOCero(Object valor) {
        return valor == null ? BigDecimal.ZERO : decimal(valor);
    }
}
