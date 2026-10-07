package com.bidhouse.demo.Modelos;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** Datos que reemplazan las categorías favoritas del usuario autenticado. */
public record PreferenciasUsuario(List<String> categoriaIds) {

    public List<String> idsNormalizados() {
        if (categoriaIds == null) {
            return List.of();
        }
        if (categoriaIds.size() > 20) {
            throw error("Puedes seleccionar como máximo 20 categorías.");
        }

        var unicos = new LinkedHashSet<String>();
        for (String id : categoriaIds) {
            if (id == null || id.isBlank()) {
                throw error("Cada categoría seleccionada debe tener un id válido.");
            }
            String normalizado;
            try {
                normalizado = UUID.fromString(id.strip()).toString();
            } catch (IllegalArgumentException e) {
                throw error("Una de las categorías seleccionadas no es válida.");
            }
            unicos.add(normalizado);
        }
        return new ArrayList<>(unicos);
    }

    private static ResponseStatusException error(String mensaje) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, mensaje);
    }
}
