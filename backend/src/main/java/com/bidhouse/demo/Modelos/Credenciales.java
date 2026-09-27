package com.bidhouse.demo.Modelos;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

//Explicame esto 
// Parece que asi es la estructura de las clases de java cuando se trata de spring boot, al parecer el record es una clase que nace de un json, que es enviado por el fornt atravez de una API
// RTA: es una clase espacial que se usa para almacenar datos inmutables, es decir, una vez que se crea un objeto de tipo Credenciales, sus valores no pueden cambiar. Es útil para representar datos que no necesitan lógica adicional, como las credenciales de un usuario (email y password).
public record Credenciales (String email, String password) {
    public void validar() {
        obligatorio(email, 255, "El correo electrónico");
        if (password == null || password.isEmpty()) error("La contraseña es obligatoria");
    }

    //Explicame esto
    //Se verifican que las cosas que llegaron estan bien (me imagino que esto es una doble validacion ya que el fornt ya verifica eso no?)
    //RTA, se tiene que volver a revisar ya que todos pueden llamar a la API, no solo el front, por lo que es necesario validar los datos en el backend para asegurarse de que sean correctos y seguros.
    private static void obligatorio(String valor, int maximo, String campo) {
        if (valor == null || valor.isBlank()) error(campo + " es obligatorio");
        if (valor.strip().length() > maximo) error(campo + " no puede tener más de " + maximo + " caracteres");
    }

    //Explicame esto
    // Solo es el mensaje de error que se envia al front cuando algo no cuadra, cuando no se cumplen las cosas del metodo validar()
    // RTA: se para todo en caso de que halla un error
    private static void error(String mensaje) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, mensaje);
    }

    // Esto es para que cuando se haga un log o se muestre el objeto en un mensaje de error, la contraseña no aparezca en texto plano. En su lugar, se muestra "***" para proteger la información sensible.
    @Override 
    public String toString() {
        return "Credenciales[email=" + email + ", password=***]";
    }
}
