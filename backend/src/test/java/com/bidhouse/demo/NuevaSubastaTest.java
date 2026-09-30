package com.bidhouse.demo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import com.bidhouse.demo.Modelos.NuevaSubasta;

class NuevaSubastaTest {

    private static NuevaSubasta con(String nombre, BigDecimal precio, Integer dias, String imagen) {
        return new NuevaSubasta(nombre, UUID.randomUUID(), "desc", "nuevo", precio, BigDecimal.ZERO, dias, imagen, null, null);
    }

    @Test
    void rechazaCondicionFueraDelCheckDeLaBd() {
        var n = new NuevaSubasta("Rolex", UUID.randomUUID(), "desc", "Excelente", new BigDecimal("100"), BigDecimal.ZERO, 7, null, null, null);
        assertThatThrownBy(n::validar).isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void aceptaSubastaValida() {
        assertThatCode(() -> con("Rolex", new BigDecimal("100"), 7, "https://x.com/a.jpg").validar()).doesNotThrowAnyException();
        assertThatCode(() -> con("Rolex", new BigDecimal("100"), 7, null).validar()).doesNotThrowAnyException();
    }

    @Test
    void rechazaDatosInvalidos() {
        assertThatThrownBy(() -> con(" ", new BigDecimal("100"), 7, null).validar()).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> con("Rolex", BigDecimal.ZERO, 7, null).validar()).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> con("Rolex", new BigDecimal("100"), 31, null).validar()).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> con("Rolex", new BigDecimal("100"), 7, "javascript:alert(1)").validar()).isInstanceOf(ResponseStatusException.class);
    }

    private static NuevaSubasta modo(String modo, String base, String ya) {
        return new NuevaSubasta("Rolex", UUID.randomUUID(), "desc", "nuevo",
                base == null ? null : new BigDecimal(base), BigDecimal.ZERO, 7, null,
                modo, ya == null ? null : new BigDecimal(ya));
    }

    @Test
    void precioFijoExigeElPrecioDeVentaYNoRecibePujas() {
        var fijo = modo("precio_fijo", null, "9000");
        assertThatCode(fijo::validar).doesNotThrowAnyException();
        assertThat(fijo.permitePujas()).isFalse();
        assertThat(fijo.precioBaseEfectivo()).isEqualByComparingTo("9000"); // precio_base es NOT NULL en la BD
        assertThatThrownBy(() -> modo("precio_fijo", null, null).validar()).isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void mixtoExigeUnCompraloYaMayorAlPrecioBase() {
        assertThatCode(() -> modo("mixto", "10000", "15000").validar()).doesNotThrowAnyException();
        assertThatThrownBy(() -> modo("mixto", "10000", "10000").validar()).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> modo("mixto", "10000", null).validar()).isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void subastaIgnoraElCompraloYaYSinModoEsSubasta() {
        var subasta = modo("subasta", "10000", "15000");
        assertThat(subasta.precioCompraInmediataEfectivo()).isNull();
        assertThat(modo(null, "10000", null).modoEfectivo()).isEqualTo("subasta");
        assertThatThrownBy(() -> modo("trueque", "10000", null).validar()).isInstanceOf(ResponseStatusException.class);
    }
}
