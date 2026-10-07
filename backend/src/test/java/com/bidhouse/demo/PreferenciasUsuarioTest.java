package com.bidhouse.demo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import com.bidhouse.demo.Modelos.PreferenciasUsuario;

class PreferenciasUsuarioTest {

    @Test
    void normalizaYEliminaIdsDuplicados() {
        String id = UUID.randomUUID().toString();
        assertThat(new PreferenciasUsuario(List.of(id, id.toUpperCase())).idsNormalizados())
                .containsExactly(id);
    }

    @Test
    void permiteListaVacia() {
        assertThat(new PreferenciasUsuario(null).idsNormalizados()).isEmpty();
    }

    @Test
    void rechazaIdInvalido() {
        assertThatThrownBy(() -> new PreferenciasUsuario(List.of("no-es-un-uuid")).idsNormalizados())
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void limitaCantidadDePreferencias() {
        List<String> demasiadas = java.util.stream.IntStream.range(0, 21)
                .mapToObj(i -> UUID.randomUUID().toString()).toList();
        assertThatThrownBy(() -> new PreferenciasUsuario(demasiadas).idsNormalizados())
                .isInstanceOf(ResponseStatusException.class);
    }
}
