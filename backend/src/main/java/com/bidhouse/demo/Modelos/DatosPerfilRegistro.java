package com.bidhouse.demo.Modelos;

/** Perfil que se completa después de confirmar el correo en Auth. */
public record DatosPerfilRegistro(
        String nombre,
        String apellido,
        String documentoIdentidad,
        String telefono,
        String email,
        String direccion,
        String ciudad,
        String pais,
        boolean esVendedor) {
}
