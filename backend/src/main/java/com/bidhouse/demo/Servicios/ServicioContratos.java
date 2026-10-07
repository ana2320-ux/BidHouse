package com.bidhouse.demo.Servicios;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

// El contrato de garantía después del pago (backend/sql/fase4b_entrega.sql):
// el vendedor marca el envío, el comprador confirma que lo recibió (y eso
// libera el pago como saldo del vendedor) o reporta un problema.
// Quién puede hacer qué lo revisa la BD con el id que viene del token.
@Service
public class ServicioContratos {

    static final int MAX_GUIA = 200;
    static final int MAX_MOTIVO = 500;
    static final int MAX_MENSAJE = 1000; // igual que el CHECK de mensajes.texto

    private final SupabaseClient db;

    public ServicioContratos(SupabaseClient db) {
        this.db = db;
    }

    public Map<String, Object> marcarEnviado(String idTransaccion, String idVendedor, String guia) {
        String texto = guia == null ? "" : guia.strip();
        if (texto.length() < 3 || texto.length() > MAX_GUIA) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Escribe la transportadora y el número de guía (o cómo se entregó), entre 3 y " + MAX_GUIA + " caracteres.");
        }
        Map<String, Object> parametros = new HashMap<>();
        parametros.put("p_transaccion_id", uuid(idTransaccion));
        parametros.put("p_vendedor_id", idVendedor);
        parametros.put("p_guia", texto);
        return resumen(FuncionesBd.llamar(db, "marcar_enviado", parametros));
    }

    public Map<String, Object> confirmarRecepcion(String idTransaccion, String idComprador) {
        Map<String, Object> parametros = new HashMap<>();
        parametros.put("p_transaccion_id", uuid(idTransaccion));
        parametros.put("p_comprador_id", idComprador);
        return resumen(FuncionesBd.llamar(db, "confirmar_recepcion", parametros));
    }

    public Map<String, Object> reportarProblema(String idTransaccion, String idComprador, String motivo) {
        String texto = motivo == null ? "" : motivo.strip();
        if (texto.length() < 10 || texto.length() > MAX_MOTIVO) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Cuéntanos qué pasó (entre 10 y " + MAX_MOTIVO + " caracteres).");
        }
        Map<String, Object> parametros = new HashMap<>();
        parametros.put("p_transaccion_id", uuid(idTransaccion));
        parametros.put("p_comprador_id", idComprador);
        parametros.put("p_motivo", texto);
        return resumen(FuncionesBd.llamar(db, "reportar_problema", parametros));
    }

    // ── Chat del contrato (backend/sql/fase7_chat.sql) ──
    // Solo el comprador y el vendedor de ESE contrato. No se devuelve el id del
    // autor: "esMio" basta para pintar cada burbuja de un lado o del otro.
    // ponytail: el front pregunta cada 10 s (polling); si el chat crece, usar Supabase Realtime.
    public List<Map<String, Object>> mensajes(String idTransaccion, String idUsuario) {
        String id = uuid(idTransaccion);
        exigirParticipante(id, idUsuario);
        return db.consultar("/mensajes?transaccion_id=eq." + id
                + "&select=id,texto,creado_en,autor_id&order=creado_en.asc&limit=500")
                .stream().map(m -> {
                    Map<String, Object> mensaje = new LinkedHashMap<>();
                    mensaje.put("id", m.get("id"));
                    mensaje.put("texto", m.get("texto"));
                    mensaje.put("creado_en", m.get("creado_en"));
                    mensaje.put("esMio", idUsuario.equals(m.get("autor_id")));
                    return mensaje;
                }).toList();
    }

    public Map<String, Object> enviarMensaje(String idTransaccion, String idUsuario, String texto) {
        String limpio = texto == null ? "" : texto.strip();
        if (limpio.isEmpty() || limpio.length() > MAX_MENSAJE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "El mensaje debe tener entre 1 y " + MAX_MENSAJE + " caracteres.");
        }
        String id = uuid(idTransaccion);
        exigirParticipante(id, idUsuario);

        Map<String, Object> fila = new HashMap<>();
        fila.put("transaccion_id", id);
        fila.put("autor_id", idUsuario);
        fila.put("texto", limpio);
        Map<String, Object> creado = db.insertar("mensajes", fila);

        Map<String, Object> mensaje = new LinkedHashMap<>();
        mensaje.put("id", creado.get("id"));
        mensaje.put("texto", creado.get("texto"));
        mensaje.put("creado_en", creado.get("creado_en"));
        mensaje.put("esMio", true);
        return mensaje;
    }

    private void exigirParticipante(String idTransaccion, String idUsuario) {
        List<Map<String, Object>> filas = db.consultar("/transacciones?id=eq." + idTransaccion
                + "&select=comprador_id,vendedor_id&limit=1");
        if (filas.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Contrato no encontrado");
        }
        Map<String, Object> t = filas.get(0);
        if (!idUsuario.equals(t.get("comprador_id")) && !idUsuario.equals(t.get("vendedor_id"))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Este chat es solo del comprador y el vendedor.");
        }
    }

    private static Map<String, Object> resumen(Map<String, Object> contrato) {
        return Map.of("estado", contrato.get("estado"), "subastaId", contrato.get("subasta_id"));
    }

    private static String uuid(String valor) {
        try {
            return UUID.fromString(valor).toString();
        } catch (IllegalArgumentException | NullPointerException e) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Contrato no encontrado");
        }
    }
}
