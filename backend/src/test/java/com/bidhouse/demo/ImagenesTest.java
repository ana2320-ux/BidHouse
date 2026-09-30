package com.bidhouse.demo;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;

import org.junit.jupiter.api.Test;

import com.bidhouse.demo.Servicios.Imagenes;

class ImagenesTest {

    @Test
    void reconoceLasFirmasDeJpgPngYWebp() {
        assertThat(Imagenes.tipo(new byte[] {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 0x00})).isEqualTo("image/jpeg");
        assertThat(Imagenes.tipo(new byte[] {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A})).isEqualTo("image/png");
        assertThat(Imagenes.tipo("RIFF\0\0\0\0WEBPVP8 ".getBytes(StandardCharsets.ISO_8859_1))).isEqualTo("image/webp");
    }

    @Test
    void rechazaLoQueNoEsImagenAunqueDigaSerlo() {
        // Un HTML o un SVG con nombre "foto.png" sigue sin ser una imagen.
        assertThat(Imagenes.tipo("<html><script>alert(1)</script>".getBytes(StandardCharsets.UTF_8))).isNull();
        assertThat(Imagenes.tipo("<svg onload=alert(1)>".getBytes(StandardCharsets.UTF_8))).isNull();
        assertThat(Imagenes.tipo(new byte[0])).isNull();
        assertThat(Imagenes.tipo(null)).isNull();
    }
}
