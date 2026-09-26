package com.bidhouse.demo.Modelos;

import java.util.regex.Pattern;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

// Lo que llega en el JSON de POST /api/usuarios/registro. Spring (Jackson)
// arma el record emparejando cada clave del JSON con el componente del mismo
// nombre, por eso el front manda "documentoIdentidad" y no "documento_identidad".
public record NuevoUsuario(
        String nombre,
        String apellido,
        String documentoIdentidad,
        String telefono,
        String email,
        String direccion,
        String ciudad,
        String pais,
        boolean esVendedor, // boolean primitivo: si no viene en el JSON queda en false
        String password) {

    // Mismas reglas que Registro.tsx. Se repiten aquí porque el front se puede
    // saltar (cualquiera puede hacer un POST con curl): la validación que manda
    // es la del servidor; la del front solo es para avisar rápido.
    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    private static final Pattern MAYUSCULA = Pattern.compile("[A-ZÁÉÍÓÚÜÑ]");
    private static final Pattern SIMBOLO = Pattern.compile("[.$*#@!=+]");

    public void validar() {
        // Los máximos son los de las columnas varchar(n) de la tabla "usuarios":
        // si se pasan, Postgres rechaza el insert con un error poco claro.
        obligatorio(nombre, 100, "El nombre");
        obligatorio(apellido, 100, "El apellido");
        obligatorio(documentoIdentidad, 50, "El documento de identidad");
        obligatorio(telefono, 20, "El teléfono");
        obligatorio(email, 255, "El correo electrónico");
        if (!EMAIL.matcher(email.strip()).matches()) error("El correo electrónico no tiene un formato válido");
        obligatorio(direccion, Integer.MAX_VALUE, "La dirección"); // columna text: sin máximo
        obligatorio(ciudad, 100, "La ciudad");
        obligatorio(pais, 100, "El país");

        if (password == null || password.length() < 6) error("La contraseña debe tener al menos 6 caracteres");
        if (!MAYUSCULA.matcher(password).find()) error("La contraseña debe tener al menos una mayúscula");
        if (!SIMBOLO.matcher(password).find()) error("La contraseña debe tener al menos un símbolo ( . $ * # @ ! = + )");
    }

    // Un record genera toString() con TODOS sus campos. Si algún día este objeto
    // termina en un log o en el mensaje de una excepción, la contraseña quedaría
    // escrita en texto plano. Se sobreescribe para taparla.
    @Override
    public String toString() {
        return "NuevoUsuario[email=" + email + ", nombre=" + nombre + " " + apellido + ", password=***]";
    }

    private static void obligatorio(String valor, int maximo, String campo) {
        if (valor == null || valor.isBlank()) error(campo + " es obligatorio");
        if (valor.strip().length() > maximo) error(campo + " no puede tener más de " + maximo + " caracteres");
    }

    private static void error(String mensaje) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, mensaje);
    }
}
