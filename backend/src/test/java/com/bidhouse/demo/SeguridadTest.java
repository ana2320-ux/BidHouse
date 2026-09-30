package com.bidhouse.demo;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
// Sin el cierre automático: los tests no deben cerrar subastas reales en Supabase.
@SpringBootTest(properties = "bidhouse.cierre-automatico=false")
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
    void pujarSinTokenDa401() throws Exception {
        mvc.perform(post("/api/subastas/00000000-0000-0000-0000-000000000000/pujas")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"monto\":100}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void lasAccionesDelContratoExigenToken() throws Exception {
        String id = "/api/contratos/00000000-0000-0000-0000-000000000000";
        mvc.perform(post(id + "/recepcion")).andExpect(status().isUnauthorized());
        mvc.perform(post(id + "/envio").contentType(MediaType.APPLICATION_JSON).content("{\"guia\":\"Servientrega 123\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void conTokenSeRechazanGuiaYMotivoDemasiadoCortos() throws Exception {
        String id = "/api/contratos/00000000-0000-0000-0000-000000000000";
        mvc.perform(post(id + "/envio").with(jwt().jwt(j -> j.subject("u-1")))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"guia\":\"x\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post(id + "/problema").with(jwt().jwt(j -> j.subject("u-1")))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"motivo\":\"mal\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void losPagosExigenToken() throws Exception {
        mvc.perform(get("/api/pagos/saldo")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/pagos/recargas").contentType(MediaType.APPLICATION_JSON).content("{\"monto\":5000}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/pagos/confirmar").contentType(MediaType.APPLICATION_JSON).content("{\"idPago\":\"1\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void conTokenSeRechazaUnaRecargaFueraDeRango() throws Exception {
        mvc.perform(post("/api/pagos/recargas").with(jwt().jwt(j -> j.subject("u-1")))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"monto\":10}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void conTokenSeRechazaUnIdDePagoQueNoEsNumero() throws Exception {
        mvc.perform(post("/api/pagos/confirmar").with(jwt().jwt(j -> j.subject("u-1")))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"idPago\":\"abc/../x\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void comprarSinTokenDa401() throws Exception {
        mvc.perform(post("/api/subastas/00000000-0000-0000-0000-000000000000/compra"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void conTokenSeRechazaUnaPujaDeMontoCero() throws Exception {
        mvc.perform(post("/api/subastas/00000000-0000-0000-0000-000000000000/pujas")
                        .with(jwt().jwt(j -> j.subject("u-1")))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"monto\":0}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void conTokenSeRechazaUnArchivoQueNoEsImagen() throws Exception {
        var html = new MockMultipartFile("foto", "foto.png", "image/png", "<html></html>".getBytes());
        mvc.perform(multipart("/api/usuarios/perfil/foto").file(html).with(jwt().jwt(j -> j.subject("u-1"))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void subirImagenDeActivoSinTokenDa401() throws Exception {
        var png = new MockMultipartFile("imagen", "a.png", "image/png", new byte[] {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A});
        mvc.perform(multipart("/api/activos/imagenes").file(png)).andExpect(status().isUnauthorized());
    }

    @Test
    void conTokenSeRechazaUnaImagenDeActivoQueNoEsImagen() throws Exception {
        var html = new MockMultipartFile("imagen", "a.jpg", "image/jpeg", "<html></html>".getBytes());
        mvc.perform(multipart("/api/activos/imagenes").file(html).with(jwt().jwt(j -> j.subject("u-1"))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void conTokenSeRechazaUnaFotoDePerfilDeMasDe2Mb() throws Exception {
        // Spring ya acepta hasta 5 MB (por las imágenes de activos); el límite de
        // 2 MB de la foto de perfil lo pone el servicio.
        byte[] grande = new byte[3 * 1024 * 1024];
        byte[] firmaPng = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A};
        System.arraycopy(firmaPng, 0, grande, 0, firmaPng.length);
        var foto = new MockMultipartFile("foto", "grande.png", "image/png", grande);
        mvc.perform(multipart("/api/usuarios/perfil/foto").file(foto).with(jwt().jwt(j -> j.subject("u-1"))))
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
