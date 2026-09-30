package com.bidhouse.demo.Servicios;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class ServicioUsuarioTest {

    @Test
    void elMensajeDeDuplicadoNombraElCampoQueChoco() {
        String documento = "{\"code\":\"23505\",\"details\":\"Key (documento_identidad)=(999) already exists.\","
                + "\"message\":\"duplicate key value violates unique constraint \\\"usuarios_documento_identidad_key\\\"\"}";
        String correo = "{\"code\":\"23505\",\"details\":\"Key (email)=(ana@gmail.com) already exists.\"}";

        assertThat(ServicioUsuario.mensajeDuplicado(documento)).contains("documento de identidad");
        assertThat(ServicioUsuario.mensajeDuplicado(correo)).contains("correo");
        assertThat(ServicioUsuario.mensajeDuplicado(null)).contains("correo");
    }
}
