package com.bidhouse.demo.Modelos;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

//Explicame esto 
// Parece que asi es la estructura de las clases de java cuando se trata de spring boot, al parecer el record es una clase que nace de un json, que es enviado por el fornt atravez de una API
public record Credenciales (String email, String password) {
    public void validar() {
        obligatorio(email, 255, "El correo electrónico");
        if (password == null || password.length() < 6 ) error("La contraseña debe tener al menos 6 caracteres");
    }

    //Explicame esto
    //Se verifican que las cosas que llegaron estan bien (me imagino que esto es una doble validacion ya que el fornt ya verifica eso no?)
    private static void obligatorio(String valor, int maximo, String campo) {
        if (valor == null || valor.isBlank()) error(campo + " es obligatorio");
        if (valor.strip().length() > maximo) error(campo + " no puede tener más de " + maximo + " caracteres");
    }

    //Explicame esto
    // Solo es el mensaje de error que se envia al front cuando algo no cuadra, cuando no se cumplen las cosas del metodo validar()
    private static void error(String mensaje) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, mensaje);
    }
}
