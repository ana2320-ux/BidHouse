package com.bidhouse.demo.Servicios;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;

import org.junit.jupiter.api.Test;

class MercadoPagoClientTest {

    @Test
    void convierteUsdACopYRedondeaPesos() {
        // Checkout Pro mantiene la regla histórica del demo para no cambiar
        // recargas ni pagos de contratos.
        assertThat(MercadoPagoClient.aPesos(new BigDecimal("1200"))).isEqualByComparingTo("1200");
        assertThat(MercadoPagoClient.aPesos(new BigDecimal("99.50"))).isEqualByComparingTo("100");
        assertThat(MercadoPagoClient.aPesos(new BigDecimal("99.49"))).isEqualByComparingTo("99");

        MercadoPagoClient cliente = new MercadoPagoClient(
                "token-de-prueba", "http://localhost:5173", "", new BigDecimal("4000"), "");

        assertThat(cliente.aPesosMembresia(new BigDecimal("19.99"))).isEqualByComparingTo("79960");
        assertThat(cliente.aPesosMembresia(new BigDecimal("199.99"))).isEqualByComparingTo("799960");
    }
}
