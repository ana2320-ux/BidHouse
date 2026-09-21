package com.bidhouse.demo;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import com.bidhouse.demo.Modelos.NuevaSubasta;

class NuevaSubastaTest {

    private static NuevaSubasta con(String nombre, BigDecimal precio, Integer dias, String imagen) {
        return new NuevaSubasta(nombre, UUID.randomUUID(), "desc", "nuevo", precio, BigDecimal.ZERO, dias, imagen);
    }

    @Test
    void rechazaCondicionFueraDelCheckDeLaBd() {
        var n = new NuevaSubasta("Rolex", UUID.randomUUID(), "desc", "Excelente", new BigDecimal("100"), BigDecimal.ZERO, 7, null);
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
}
