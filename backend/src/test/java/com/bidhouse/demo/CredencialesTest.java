package com.bidhouse.demo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import com.bidhouse.demo.Modelos.Credenciales;

class CredencialesTest {

    @Test
    void aceptaCredencialesCompletas() {
        assertThatCode(() -> new Credenciales("ana@gmail.com", "x").validar()).doesNotThrowAnyException();
    }

    @Test
    void noExigeLasReglasDeCreacionDeContrasena() {
        // En el login una contraseña "débil" no es un error de formato: simplemente
        // será incorrecta y lo dirá Supabase. Las reglas solo aplican al registrarse.
        assertThatCode(() -> new Credenciales("ana@gmail.com", "abc").validar()).doesNotThrowAnyException();
    }

    @Test
    void rechazaCamposVacios() {
        assertThatThrownBy(() -> new Credenciales(" ", "Clave#1").validar()).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> new Credenciales(null, "Clave#1").validar()).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> new Credenciales("ana@gmail.com", "").validar()).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> new Credenciales("ana@gmail.com", null).validar()).isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void toStringNoMuestraLaContrasena() {
        assertThat(new Credenciales("ana@gmail.com", "Clave#1").toString()).doesNotContain("Clave#1");
    }
}
