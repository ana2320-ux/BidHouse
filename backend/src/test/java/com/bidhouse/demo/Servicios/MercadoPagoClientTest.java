package com.bidhouse.demo.Servicios;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;

import org.junit.jupiter.api.Test;

class MercadoPagoClientTest {

    @Test
    void cobraElMismoNumeroEnPesosRedondeado() {
        // Demo: 1 USD = 1 COP, a pesos enteros (el COP no usa centavos).
        assertThat(MercadoPagoClient.aPesos(new BigDecimal("1200"))).isEqualByComparingTo("1200");
        assertThat(MercadoPagoClient.aPesos(new BigDecimal("99.50"))).isEqualByComparingTo("100");
        assertThat(MercadoPagoClient.aPesos(new BigDecimal("99.49"))).isEqualByComparingTo("99");
    }
}
