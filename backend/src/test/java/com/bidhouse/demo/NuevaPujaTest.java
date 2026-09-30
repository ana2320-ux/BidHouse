package com.bidhouse.demo;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;

import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import com.bidhouse.demo.Modelos.NuevaPuja;

class NuevaPujaTest {

    @Test
    void aceptaMontosPositivosConHastaDosDecimales() {
        assertThatCode(() -> new NuevaPuja(new BigDecimal("1250000")).validar()).doesNotThrowAnyException();
        assertThatCode(() -> new NuevaPuja(new BigDecimal("99.90")).validar()).doesNotThrowAnyException();
    }

    @Test
    void rechazaMontosVaciosNegativosOConMuchosDecimales() {
        assertThatThrownBy(() -> new NuevaPuja(null).validar()).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> new NuevaPuja(BigDecimal.ZERO).validar()).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> new NuevaPuja(new BigDecimal("-5")).validar()).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> new NuevaPuja(new BigDecimal("10.555")).validar()).isInstanceOf(ResponseStatusException.class);
    }
}
