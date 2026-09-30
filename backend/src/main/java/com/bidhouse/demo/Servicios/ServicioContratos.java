package com.bidhouse.demo.Servicios;

import java.util.HashMap;
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
