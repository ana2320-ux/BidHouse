package com.bidhouse.demo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import com.bidhouse.demo.Modelos.NuevoUsuario;

class NuevoUsuarioTest {

    private static NuevoUsuario con(String email, String password) {
        return new NuevoUsuario("Ana", "Pérez", "1020304050", "3001234567", email,
                "Calle 1 # 2-3", "Bogotá", "Colombia", false, password);
    }

    @Test
    void aceptaUsuarioValido() {
        assertThatCode(() -> con("ana@gmail.com", "Clave#1").validar()).doesNotThrowAnyException();
    }

    @Test
    void rechazaCamposVaciosOLargos() {
        var sinNombre = new NuevoUsuario(" ", "Pérez", "1", "3", "ana@gmail.com", "x", "x", "x", false, "Clave#1");
        var telefonoLargo = new NuevoUsuario("Ana", "Pérez", "1", "1".repeat(21), "ana@gmail.com", "x", "x", "x", false, "Clave#1");
        assertThatThrownBy(sinNombre::validar).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(telefonoLargo::validar).isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void rechazaEmailMalFormado() {
        assertThatThrownBy(() -> con("ana@gmail", "Clave#1").validar()).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> con("ana @gmail.com", "Clave#1").validar()).isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void exigeLosRequisitosDeLaContrasena() {
        assertThatThrownBy(() -> con("ana@gmail.com", "Cl#1").validar()).isInstanceOf(ResponseStatusException.class);    // corta
        assertThatThrownBy(() -> con("ana@gmail.com", "clave#1").validar()).isInstanceOf(ResponseStatusException.class); // sin mayúscula
        assertThatThrownBy(() -> con("ana@gmail.com", "Clave11").validar()).isInstanceOf(ResponseStatusException.class); // sin símbolo
    }

    @Test
    void toStringNoMuestraLaContrasena() {
        assertThat(con("ana@gmail.com", "Clave#1").toString()).doesNotContain("Clave#1");
    }
}
