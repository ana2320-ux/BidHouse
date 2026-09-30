package com.bidhouse.demo.Servicios;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

// Reglas de las pujas que no necesitan base de datos: el mínimo que se muestra
// y la traducción de los errores que lanza la función pujar().
class ServicioSubastaPujasTest {

    private static BigDecimal d(String v) {
        return new BigDecimal(v);
    }

    @Test
    void laPrimeraPujaArrancaEnElPrecioBase() {
        assertThat(ServicioSubasta.pujaMinima(d("1000"), d("1000"), d("50"), false)).isEqualByComparingTo("1000");
    }

    @Test
    void lasSiguientesSumanElIncrementoYNuncaMenosDeUno() {
        assertThat(ServicioSubasta.pujaMinima(d("1000"), d("1200"), d("50"), true)).isEqualByComparingTo("1250");
        // Con incremento 0 no se puede empatar a quien va ganando.
        assertThat(ServicioSubasta.pujaMinima(d("1000"), d("1200"), d("0"), true)).isEqualByComparingTo("1201");
        assertThat(ServicioSubasta.pujaMinima(d("1000"), d("1200"), null, true)).isEqualByComparingTo("1201");
    }

    @Test
    void traduceLosCodigosDeLaFuncionPujar() {
        var insuficiente = ServicioSubasta.errorDeBd(
                Map.of("code", "P0001", "message", "MONTO_INSUFICIENTE", "details", "1250000"), null);
        assertThat(insuficiente.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(insuficiente.getReason()).contains("$1,250,000 USD");

        assertThat(ServicioSubasta.errorDeBd(Map.of("message", "PUJA_PROPIA"), null).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(ServicioSubasta.errorDeBd(Map.of("message", "SUBASTA_CERRADA"), null).getStatusCode())
                .isEqualTo(HttpStatus.CONFLICT);
        assertThat(ServicioSubasta.errorDeBd(Map.of("code", "PGRST202"), null).getStatusCode())
                .isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertThat(ServicioSubasta.errorDeBd(null, null).getStatusCode()).isEqualTo(HttpStatus.BAD_GATEWAY);
    }

    @Test
    void traduceLosCodigosDeComprarAhora() {
        assertThat(ServicioSubasta.errorDeBd(Map.of("message", "YA_VENDIDA"), null).getReason())
                .contains("ya compró");
        assertThat(ServicioSubasta.errorDeBd(Map.of("message", "YA_HAY_PUJAS"), null).getStatusCode())
                .isEqualTo(HttpStatus.CONFLICT);
        assertThat(ServicioSubasta.errorDeBd(Map.of("message", "COMPRA_PROPIA"), null).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(ServicioSubasta.errorDeBd(Map.of("message", "SIN_COMPRA_INMEDIATA"), null).getReason())
                .contains("solo se puede pujar");
    }
}
