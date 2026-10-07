package com.bidhouse.demo.Servicios;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;

import com.bidhouse.demo.Modelos.SolicitudMembresia;

@Service
public class ServicioMembresia {

    public static final String PLAN = "bidluxury_member";
    public static final BigDecimal PRECIO_MENSUAL = new BigDecimal("19.99");
    public static final BigDecimal PRECIO_ANUAL = new BigDecimal("199.99");

    private final SupabaseClient db;
    private final MercadoPagoClient mercadoPago;

    public ServicioMembresia(SupabaseClient db, MercadoPagoClient mercadoPago) {
        this.db = db;
        this.mercadoPago = mercadoPago;
    }

    public List<Map<String, Object>> planes() {
        return List.of(plan("mensual", PRECIO_MENSUAL, "mes"), plan("anual", PRECIO_ANUAL, "año"));
    }

    private static Map<String, Object> plan(String periodicidad, BigDecimal precio, String unidad) {
        Map<String, Object> respuesta = new LinkedHashMap<>();
        respuesta.put("plan", PLAN);
        respuesta.put("periodicidad", periodicidad);
        respuesta.put("precioUsd", precio);
        respuesta.put("moneda", "USD");
        respuesta.put("unidad", unidad);
        respuesta.put("renovacion", "anual".equals(periodicidad) ? "Renovación anual" : "Renovación mensual");
        return respuesta;
    }

    public Map<String, Object> estado(String idUsuario) {
        Map<String, Object> fila = filaActual(idUsuario);
        return fila == null ? estadoGratuito() : estadoDesde(fila);
    }

    public boolean usuarioTieneMembresiaActiva(String idUsuario) {
        if (idUsuario == null || idUsuario.isBlank()) return false;
        String ahora = OffsetDateTime.now(ZoneOffset.UTC).toString();
        try {
            return !db.consultar("/membresias?usuario_id=eq." + idUsuario
                    + "&estado=eq.activa&fecha_fin=gt." + ahora + "&select=id&limit=1").isEmpty();
        } catch (RestClientResponseException e) {
            throw errorSiFaltaTabla(e);
        }
    }

    public Map<String, Object> iniciarCheckout(String idUsuario, SolicitudMembresia solicitud) {
        if (solicitud == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Debes elegir una periodicidad.");
        }
        String periodicidad = solicitud.periodicidadNormalizada();
        Map<String, Object> actual = filaActual(idUsuario);
        if (actual != null && estaActiva(String.valueOf(actual.get("estado")), fecha(actual.get("fecha_fin")), OffsetDateTime.now(ZoneOffset.UTC))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya tienes una membresía activa.");
        }

        List<Map<String, Object>> usuarios = db.consultar("/usuarios?id=eq." + idUsuario + "&select=email&limit=1");
        if (usuarios.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Perfil de usuario no encontrado.");
        String email = String.valueOf(usuarios.get(0).get("email"));
        String idMembresia = actual == null ? UUID.randomUUID().toString() : String.valueOf(actual.get("id"));
        BigDecimal precio = "anual".equals(periodicidad) ? PRECIO_ANUAL : PRECIO_MENSUAL;

        Map<String, Object> cambios = new LinkedHashMap<>();
        cambios.put("usuario_id", idUsuario);
        cambios.put("plan", PLAN);
        cambios.put("periodicidad", periodicidad);
        cambios.put("estado", "pendiente");
        cambios.put("fecha_inicio", null);
        cambios.put("fecha_fin", null);
        cambios.put("renovacion_cancelada", false);
        cambios.put("mercadopago_payment_id", null);

        try {
            if (actual == null) {
                cambios.put("id", idMembresia);
                db.insertar("membresias", cambios);
            } else {
                db.actualizar("/membresias?id=eq." + idMembresia, cambios);
            }
            Map<String, Object> checkout = mercadoPago.crearPreaprobacion("BidLuxury Member · " + periodicidad,
                    email, precio, periodicidad, idMembresia);
            String idExterno = String.valueOf(checkout.get("id"));
            db.actualizar("/membresias?id=eq." + idMembresia,
                    Map.of("mercadopago_preapproval_id", idExterno));
            return Map.of("url", checkout.get("url"), "membresiaId", idMembresia, "periodicidad", periodicidad);
        } catch (RestClientResponseException e) {
            throw errorSiFaltaTabla(e);
        }
    }

    public Map<String, Object> confirmar(String idUsuario, String idPreaprobacion) {
        validarIdExterno(idPreaprobacion);
        Map<String, Object> fila = filaPorPreaprobacion(idPreaprobacion, idUsuario);
        if (fila == null) fila = filaPorId(idPreaprobacion, idUsuario);
        if (fila == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Membresía pendiente no encontrada.");
        return sincronizarDesdeMercadoPago(String.valueOf(fila.get("id")), idPreaprobacion);
    }

    public Map<String, Object> cancelar(String idUsuario) {
        Map<String, Object> fila = filaActual(idUsuario);
        if (fila == null || !estaActiva(String.valueOf(fila.get("estado")), fecha(fila.get("fecha_fin")), OffsetDateTime.now(ZoneOffset.UTC))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "No tienes una membresía activa para cancelar.");
        }
        String externo = String.valueOf(fila.get("mercadopago_preapproval_id"));
        if (!externo.isBlank() && !"null".equals(externo)) mercadoPago.cancelarPreaprobacion(externo);
        db.actualizar("/membresias?id=eq." + fila.get("id"), Map.of("renovacion_cancelada", true));
        return estado(idUsuario);
    }

    public Map<String, Object> procesarWebhook(Map<String, Object> evento, String firma, String requestId) {
        Object data = evento == null ? null : evento.get("data");
        String id = data instanceof Map<?, ?> mapa ? String.valueOf(mapa.get("id")) : "";
        String tipo = evento == null ? "" : String.valueOf(evento.getOrDefault("type", evento.get("topic")));
        if (!tipo.contains("preapproval") || id.isBlank() || "null".equals(id)) {
            return Map.of("recibido", true, "procesado", false);
        }
        if (!mercadoPago.firmaWebhookValida(firma, requestId, id)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Firma de webhook inválida.");
        }
        Map<String, Object> fila = filaPorPreaprobacion(id, null);
        if (fila == null) return Map.of("recibido", true, "procesado", false);
        return sincronizarDesdeMercadoPago(String.valueOf(fila.get("id")), id);
    }

    private Map<String, Object> sincronizarDesdeMercadoPago(String idFila, String idPreaprobacion) {
        Map<String, Object> externo = mercadoPago.obtenerPreaprobacion(idPreaprobacion);
        String estadoExterno = String.valueOf(externo.get("status"));
        Map<String, Object> cambios = new LinkedHashMap<>();
        cambios.put("mercadopago_preapproval_id", idPreaprobacion);
        Object ultimoPago = externo.get("last_payment_id");
        if (ultimoPago != null) cambios.put("mercadopago_payment_id", String.valueOf(ultimoPago));

        OffsetDateTime ahora = OffsetDateTime.now(ZoneOffset.UTC);
        Map<String, Object> existente = filaPorId(idFila, null);
        if ("authorized".equals(estadoExterno)) {
            OffsetDateTime fin = fecha(externo.get("next_payment_date"));
            if (fin == null) fin = ahora.plusMonths("anual".equals(String.valueOf(existente.get("periodicidad"))) ? 12 : 1);
            cambios.put("estado", "activa");
            cambios.put("fecha_inicio", existente.get("fecha_inicio") == null ? ahora.toString() : existente.get("fecha_inicio"));
            cambios.put("fecha_fin", fin.toString());
            cambios.put("renovacion_cancelada", false);
        } else if ("cancelled".equals(estadoExterno) || "paused".equals(estadoExterno)) {
            OffsetDateTime fin = fecha(existente.get("fecha_fin"));
            cambios.put("renovacion_cancelada", true);
            if (!estaActiva(String.valueOf(existente.get("estado")), fin, ahora)) cambios.put("estado", "vencida");
        }
        db.actualizar("/membresias?id=eq." + idFila, cambios);
        return estado(String.valueOf(existente.get("usuario_id")));
    }

    private Map<String, Object> filaActual(String idUsuario) {
        try {
            List<Map<String, Object>> filas = db.consultar("/membresias?usuario_id=eq." + idUsuario
                    + "&select=id,usuario_id,plan,periodicidad,estado,fecha_inicio,fecha_fin,renovacion_cancelada,mercadopago_preapproval_id,mercadopago_payment_id,creado_en,actualizado_en"
                    + "&order=creado_en.desc&limit=1");
            return filas.isEmpty() ? null : filas.get(0);
        } catch (RestClientResponseException e) {
            throw errorSiFaltaTabla(e);
        }
    }

    private Map<String, Object> filaPorPreaprobacion(String id, String usuario) {
        String filtroUsuario = usuario == null ? "" : "&usuario_id=eq." + usuario;
        List<Map<String, Object>> filas = db.consultar("/membresias?mercadopago_preapproval_id=eq." + id + filtroUsuario
                + "&select=id,usuario_id,plan,periodicidad,estado,fecha_inicio,fecha_fin,renovacion_cancelada,mercadopago_preapproval_id,mercadopago_payment_id,creado_en,actualizado_en&limit=1");
        return filas.isEmpty() ? null : filas.get(0);
    }

    private Map<String, Object> filaPorId(String id, String usuario) {
        String filtroUsuario = usuario == null ? "" : "&usuario_id=eq." + usuario;
        List<Map<String, Object>> filas = db.consultar("/membresias?id=eq." + id + filtroUsuario
                + "&select=id,usuario_id,plan,periodicidad,estado,fecha_inicio,fecha_fin,renovacion_cancelada,mercadopago_preapproval_id,mercadopago_payment_id,creado_en,actualizado_en&limit=1");
        return filas.isEmpty() ? null : filas.get(0);
    }

    private Map<String, Object> estadoDesde(Map<String, Object> fila) {
        OffsetDateTime fin = fecha(fila.get("fecha_fin"));
        boolean activa = estaActiva(String.valueOf(fila.get("estado")), fin, OffsetDateTime.now(ZoneOffset.UTC));
        Map<String, Object> respuesta = new LinkedHashMap<>();
        respuesta.put("activa", activa);
        respuesta.put("plan", activa ? fila.get("plan") : "gratuito");
        respuesta.put("periodicidad", activa ? fila.get("periodicidad") : null);
        respuesta.put("estado", activa ? "activa" : ("vencida".equals(fila.get("estado")) ? "vencida" : "gratuito"));
        respuesta.put("fechaInicio", fila.get("fecha_inicio"));
        respuesta.put("fechaFin", fila.get("fecha_fin"));
        respuesta.put("renovacionCancelada", Boolean.TRUE.equals(fila.get("renovacion_cancelada")));
        return respuesta;
    }

    private static Map<String, Object> estadoGratuito() {
        return Map.of("activa", false, "plan", "gratuito", "estado", "gratuito", "renovacionCancelada", false);
    }

    static boolean estaActiva(String estado, OffsetDateTime fechaFin, OffsetDateTime ahora) {
        return "activa".equals(estado) && fechaFin != null && fechaFin.isAfter(ahora);
    }

    private static OffsetDateTime fecha(Object valor) {
        if (valor == null || String.valueOf(valor).isBlank() || "null".equals(String.valueOf(valor))) return null;
        try { return OffsetDateTime.parse(String.valueOf(valor)); }
        catch (RuntimeException e) { return null; }
    }

    private static void validarIdExterno(String id) {
        if (id == null || !id.matches("[A-Za-z0-9_-]{1,120}")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Identificador de membresía inválido.");
        }
    }

    private static ResponseStatusException errorSiFaltaTabla(RestClientResponseException e) {
        String cuerpo = e.getResponseBodyAsString();
        if (cuerpo.contains("PGRST205") || cuerpo.contains("PGRST204")) {
            return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Falta crear la tabla membresias en Supabase: ejecuta backend/sql/fase6_membresias.sql; "
                            + "si la columna es_premium ya existe, ejecuta backend/sql/fase6b_membresias_tabla.sql.", e);
        }
        return new ResponseStatusException(HttpStatus.BAD_GATEWAY, "No se pudo consultar la membresía.", e);
    }
}
