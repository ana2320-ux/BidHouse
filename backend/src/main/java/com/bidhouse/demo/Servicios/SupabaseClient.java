package com.bidhouse.demo.Servicios;

import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;

// Supabase expone dos APIs HTTP distintas y aquí hay un RestClient por cada uso:
//   /rest/v1        → PostgREST: las TABLAS (usuarios, subastas...).
//   /auth/v1        → GoTrue: las CUENTAS (registro, login, contraseñas).
//   /auth/v1/admin  → GoTrue en modo administrador (borrar cuentas, etc.).
@Component
public class SupabaseClient {

    private static final ParameterizedTypeReference<List<Map<String, Object>>> FILAS = new ParameterizedTypeReference<>() {};
    private static final ParameterizedTypeReference<Map<String, Object>> OBJETO = new ParameterizedTypeReference<>() {};

    private final RestClient rest;      // tablas, con service_role (se salta RLS)
    private final RestClient auth;      // registro, con la llave PÚBLICA
    private final RestClient authAdmin; // administración de cuentas, con service_role

    public SupabaseClient(@Value("${supabase.url}") String url,
                          @Value("${supabase.secret-key}") String secretKey,
                          @Value("${supabase.publishable-key}") String publishableKey) {
        this.rest = conLlave(url + "/rest/v1", secretKey);
        // El registro usa la llave pública a propósito: es exactamente lo que
        // hacía el navegador con supabase.auth.signUp(), así Supabase aplica las
        // mismas reglas (registro habilitado, confirmación de correo, límites).
        // Con la service_role habría que usar /admin/users, que se salta todo eso.
        this.auth = conLlave(url + "/auth/v1", publishableKey);
        this.authAdmin = conLlave(url + "/auth/v1/admin", secretKey);
    }

    private static RestClient conLlave(String baseUrl, String llave) {
        return RestClient.builder()
                .baseUrl(baseUrl)
                .defaultHeader("apikey", llave)
                .defaultHeader("Authorization", "Bearer " + llave)
                .build();
    }

    // ── Tablas (PostgREST) ──

    public List<Map<String, Object>> consultar(String rutaYFiltros) {
        return rest.get().uri(rutaYFiltros).retrieve().body(FILAS);
    }

    public Map<String, Object> insertar(String tabla, Map<String, Object> fila) {
        List<Map<String, Object>> creadas = rest.post()
                .uri("/" + tabla)
                .header("Prefer", "return=representation")
                .contentType(MediaType.APPLICATION_JSON)
                .body(fila)
                .retrieve()
                .body(FILAS);
        return creadas.get(0);
    }

    public void eliminar(String rutaYFiltros) {
        rest.delete().uri(rutaYFiltros).retrieve().toBodilessEntity();
    }

    // ── Cuentas (Auth) ──

    // POST /auth/v1/signup. Devuelve el id (uuid) de la cuenta creada, que es
    // el mismo "sub" que traerán los JWT de esa persona cuando haga login.
    public String crearCuenta(String email, String password) {
        Map<String, Object> respuesta;
        try {
            respuesta = auth.post()
                    .uri("/signup")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("email", email, "password", password))
                    .retrieve()
                    .body(OBJETO);
        } catch (RestClientResponseException e) {
            throw traducirErrorDeAuth(e);
        }

        // La forma de la respuesta depende de la config del proyecto:
        //  - sin confirmación de correo (la de hoy): { access_token, ..., user: { id, ... } }
        //  - con confirmación de correo:              { id, ..., identities: [...] }
        @SuppressWarnings("unchecked")
        Map<String, Object> usuario = (Map<String, Object>) respuesta.getOrDefault("user", respuesta);

        // Con confirmación activada, si el correo ya existe Supabase NO da error:
        // devuelve un usuario falso con identities vacío, para que un atacante no
        // pueda averiguar qué correos están registrados.
        if (usuario.get("identities") instanceof List<?> identidades && identidades.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe una cuenta con ese correo.");
        }
        return (String) usuario.get("id");
    }

    // DELETE /auth/v1/admin/users/{id}. Solo el servidor puede hacer esto.
    public void eliminarCuenta(String id) {
        authAdmin.delete().uri("/users/{id}", id).retrieve().toBodilessEntity();
    }

    /// METODO NUEVO
    //Explicame esto
    public boolean existeUsuario(String email){
        //como que se le pide la API o la base de datos que traiga todos los usuarios, nose si solo trae el email, o todos los datos del los usuarios
        List<Map<String, Object>> usuarios = rest.get() //ahi le pide un mapa de usuarios a la API, osea la base de datos
        .uri("/usuarios?email=eq.{email}&select=id&limit=1", email) //aqui se le piden solo los usuarios que tengan el email, que le envio no?
        .retrieve() //se piden los usuarios a la API, osea a la base de datos que cumplan la condicion
        .body(FILAS); //Ni idea a que se refiere con esto, como asi que filas, tal vez algo de la db

        return !usuarios.isEmpty(); //si la lista de usuarios que trajo esta vacia, osea que no encontro ningun usuario con ese email, devuelve false, si encontro al menos uno devuelve true
    } 

    ///METODO NUEVO
    //Explicame esto
    // POST /auth/v1/token?grant_type=password. En Supabase, "iniciar sesión" es
    // cambiar correo + contraseña por un token (JWT) que demuestra quién eres.
    public Map<String, Object> iniciarSesion(String email, String password) {
        try {
            return auth.post() //utiliza una llave publica para que no todos puedan iniciar sesion, solo los que tengan la llave publica
                    .uri("/token?grant_type=password") //se genera un token (JWT) para que con ese token sepamos quien es el usuario
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("email", email, "password", password)) //se mete en el mapa el email y la contraseña que le paso el usuario para que la API de supabase me devuelva un token (JWT)
                    .retrieve()
                    .body(OBJETO); //llega un objeto y no un JSON, por eso se usa OBJETO, que es un mapa de String a Object, osea un objeto JSON
        } catch (RestClientResponseException e) { // en caso de que no se encuentre el usuario o la contraseña sea incorrecta, se lanza una excepcion y se traduce a un error de HTTP 401 Unauthorized
            throw traducirErrorDeAuth(e);
        }
    }

    // Supabase responde errores como { "code": 422, "error_code": "user_already_exists", "msg": "..." }.
    // Se traducen a un status HTTP con sentido para NUESTRO cliente y un mensaje
    // en español, que Spring devuelve como Problem Detail (campo "detail").
    private static ResponseStatusException traducirErrorDeAuth(RestClientResponseException e) {
        Map<?, ?> cuerpo;
        try {
            cuerpo = e.getResponseBodyAs(Map.class);
        } catch (RuntimeException noEsJson) {
            cuerpo = null;
        }
        String codigo = cuerpo == null ? "" : String.valueOf(cuerpo.get("error_code"));

        return switch (codigo) {
            case "user_already_exists", "email_exists" ->
                    new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe una cuenta con ese correo.");
            case "weak_password" ->
                    new ResponseStatusException(HttpStatus.BAD_REQUEST, "Supabase rechazó la contraseña por ser demasiado débil.");
            case "email_address_invalid", "validation_failed" ->
                    new ResponseStatusException(HttpStatus.BAD_REQUEST, "Supabase rechazó el correo electrónico.");
            case "signup_disabled", "email_provider_disabled" ->
                    new ResponseStatusException(HttpStatus.FORBIDDEN, "El registro de cuentas está deshabilitado.");
            case "over_request_rate_limit", "over_email_send_rate_limit" ->
                    new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Demasiados intentos. Espera unos minutos.");
            // Ojo: se compara "error_code" (invalid_credentials), no "msg" (Invalid login credentials).
            // El msg es texto para humanos y Supabase lo puede cambiar; el código es estable.
            case "invalid_credentials" ->
                    new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Correo o contraseña incorrectos.");
            // Cualquier otra cosa es un fallo de Supabase, no del usuario: 502 Bad Gateway
            // significa "el servidor del que dependo me respondió mal".
            default -> new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Error al comunicarse con Supabase (respondió " + e.getStatusCode().value() + ").", e);
        };
    }
}
