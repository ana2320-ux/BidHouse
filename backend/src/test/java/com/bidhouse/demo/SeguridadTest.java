package com.bidhouse.demo;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;

// Prueba las reglas de SeguridadConfig sin llamar a Supabase: todos los casos
// se resuelven antes (en el filtro de seguridad o en la validación).
// jwt() simula un token ya verificado, sin firmar nada de verdad.
@SpringBootTest
@AutoConfigureMockMvc
class SeguridadTest {

    @Autowired
    MockMvc mvc;

    @Test
    void lasRutasPublicasNoPidenToken() throws Exception {
        mvc.perform(get("/api/status")).andExpect(status().isOk());
    }

    @Test
    void elPerfilSinTokenDa401() throws Exception {
        mvc.perform(get("/api/usuarios/perfil")).andExpect(status().isUnauthorized());
    }

    @Test
    void unTokenFalsoDa401() throws Exception {
        mvc.perform(get("/api/usuarios/perfil").header("Authorization", "Bearer esto.no.es-un-jwt"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void conTokenSeRechazaUnArchivoQueNoEsImagen() throws Exception {
        var html = new MockMultipartFile("foto", "foto.png", "image/png", "<html></html>".getBytes());
        mvc.perform(multipart("/api/usuarios/perfil/foto").file(html).with(jwt().jwt(j -> j.subject("u-1"))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void conTokenSeRechazaUnaDescripcionDemasiadoLarga() throws Exception {
        String larga = "{\"descripcion\":\"" + "a".repeat(301) + "\"}";
        mvc.perform(patch("/api/usuarios/perfil").with(jwt().jwt(j -> j.subject("u-1")))
                        .contentType(MediaType.APPLICATION_JSON).content(larga))
                .andExpect(status().isBadRequest());
    }
}
