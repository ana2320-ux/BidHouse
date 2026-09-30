package com.bidhouse.demo.Servicios;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

class SincronizadorBlockchainTest {

    private static Map<String, Object> contrato(String estado, boolean enviado, String... hechos) {
        Map<String, Object> t = new HashMap<>();
        t.put("estado", estado);
        t.put("enviado_en", enviado ? "2026-10-01T10:00:00+00:00" : null);
        t.put("hitos_blockchain", java.util.Arrays.stream(hechos).map(h -> Map.of("hito", h)).toList());
        return t;
    }

    @Test
    void registraLosHitosQueFaltanEnOrden() {
        // Pagado, enviado y confirmado entre dos vueltas: se ponen al día los tres.
        assertThat(SincronizadorBlockchain.pendientes(contrato("completada", true)))
                .containsExactly("pago", "envio", "liberacion");
        // Ya estaba el pago registrado: solo faltan envío y liberación.
        assertThat(SincronizadorBlockchain.pendientes(contrato("completada", true, "pago")))
                .containsExactly("envio", "liberacion");
        // Confirmado sin que el vendedor marcara el envío: no hay hito de envío.
        assertThat(SincronizadorBlockchain.pendientes(contrato("completada", false, "pago")))
                .containsExactly("liberacion");
        assertThat(SincronizadorBlockchain.pendientes(contrato("en_custodia", false, "pago"))).isEmpty();
        assertThat(SincronizadorBlockchain.pendientes(contrato("cancelada", false, "pago")))
                .containsExactly("cancelacion");
        assertThat(SincronizadorBlockchain.pendientes(contrato("en_disputa", true, "pago", "envio")))
                .containsExactly("disputa");
    }

    @Test
    void sabeSiLaLiberacionFueConfirmadaOPorTiempo() {
        Map<String, Object> t = new HashMap<>();
        t.put("fecha_limite_confirmacion", "2026-10-08T10:00:00+00:00");
        t.put("liberado_en", "2026-10-03T10:00:00+00:00");
        assertThat(SincronizadorBlockchain.confirmoElComprador(t)).isTrue();   // antes del plazo
        t.put("liberado_en", "2026-10-08T10:01:00+00:00");
        assertThat(SincronizadorBlockchain.confirmoElComprador(t)).isFalse();  // se liberó solo
    }

    @Test
    void elIdEnLaCadenaEsSiempreElMismoParaElMismoContrato() {
        assertThat(RegistroBlockchain.idAcuerdo("abc")).isEqualTo(RegistroBlockchain.idAcuerdo("abc")).hasSize(32);
        assertThat(RegistroBlockchain.idAcuerdo("abc")).isNotEqualTo(RegistroBlockchain.idAcuerdo("abd"));
        assertThat(List.of()).isEmpty();
    }
}
