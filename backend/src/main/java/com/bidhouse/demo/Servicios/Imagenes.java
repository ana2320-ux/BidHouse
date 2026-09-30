package com.bidhouse.demo.Servicios;

import java.io.IOException;

import org.springframework.http.HttpStatus;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

// Reconoce el tipo real de una imagen por sus primeros bytes ("firma" o
// "magic number"), sin confiar en el nombre del archivo ni en el Content-Type
// que manda el navegador: esos los controla quien sube el archivo.
// Importa porque el bucket es público: si alguien lograra subir un HTML o un
// SVG con scripts disfrazado de foto, quedaría servido desde nuestro dominio.
public final class Imagenes {

    private Imagenes() {
    }

    // Una imagen ya revisada: sus bytes y su tipo real.
    public record Imagen(byte[] bytes, String tipo) {
    }

    // Lee un archivo subido y lo rechaza (400) si no llegó, si pesa más de
    // maxBytes o si no es JPG/PNG/WEBP de verdad. Lo usan la foto de perfil y
    // la imagen de los activos, cada una con su propio límite de tamaño.
    public static Imagen leer(MultipartFile archivo, long maxBytes) {
        if (archivo == null || archivo.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No llegó ninguna imagen");
        }
        if (archivo.getSize() > maxBytes) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "La imagen no puede pesar más de " + (maxBytes / (1024 * 1024)) + " MB");
        }
        byte[] bytes;
        try {
            bytes = archivo.getBytes();
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No se pudo leer la imagen", e);
        }
        String tipo = tipo(bytes);
        if (tipo == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La imagen debe ser JPG, PNG o WEBP");
        }
        return new Imagen(bytes, tipo);
    }

    // Devuelve "image/jpeg", "image/png" o "image/webp"; null si no es ninguna.
    public static String tipo(byte[] b) {
        if (b == null) return null;
        // JPEG: FF D8 FF
        if (b.length >= 3 && (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF) {
            return "image/jpeg";
        }
        // PNG: 89 'P' 'N' 'G' 0D 0A 1A 0A
        if (b.length >= 8 && (b[0] & 0xFF) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G'
                && b[4] == 0x0D && b[5] == 0x0A && b[6] == 0x1A && b[7] == 0x0A) {
            return "image/png";
        }
        // WEBP: "RIFF" + 4 bytes de tamaño + "WEBP"
        if (b.length >= 12 && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F'
                && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P') {
            return "image/webp";
        }
        return null;
    }
}
