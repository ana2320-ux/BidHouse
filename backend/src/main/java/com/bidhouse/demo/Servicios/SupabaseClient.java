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
//   /storage/v1     → Storage: ARCHIVOS (fotos de perfil en el bucket "avatares").
@Component
public class SupabaseClient {

    private static final ParameterizedTypeReference<List<Map<String, Object>>> FILAS = new ParameterizedTypeReference<>() {};
    private static final ParameterizedTypeReference<Map<String, Object>> OBJETO = new ParameterizedTypeReference<>() {};

    private final RestClient rest;      // tablas, con service_role (se salta RLS)
    private final RestClient auth;      // registro, con la llave PÚBLICA
    private final RestClient authAdmin; // administración de cuentas, con service_role
    private final RestClient storage;   // archivos, con service_role
    private final String url;

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
        this.storage = conLlave(url + "/storage/v1", secretKey);
        this.url = url;
    }

    private static RestClient conLlave(String baseUrl, String llave) {
        return RestClient.builder()
                .baseUrl(baseUrl)
                .defaultHeader("apikey", llave)
                .defaultHeader("Authorization", "Bearer " + llave)
                // Engañamos al anti-bots de Cloudflare para que deje pasar las peticiones de Java
                .defaultHeader("User-Agent", "BidHouse-Backend/1.0")
                // Forzamos a que siempre envíe y reciba JSON por defecto
                .defaultHeader("Content-Type", MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader("Accept", MediaType.APPLICATION_JSON_VALUE)
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
                .body(fila)
                .retrieve()
                .body(FILAS);
        return creadas.get(0);
    }

    public void eliminar(String rutaYFiltros) {
        rest.delete().uri(rutaYFiltros).retrieve().toBodilessEntity();
    }

    // PATCH = cambiar SOLO las columnas que vienen en "cambios" de las filas que
    // cumplan el filtro (UPDATE ... SET ... WHERE ...). Un Map (y no Map.of) para
    // poder mandar null y así vaciar una columna.
    public void actualizar(String rutaYFiltros, Map<String, Object> cambios) {
        rest.patch()
                .uri(rutaYFiltros)
                .body(cambios)
                .retrieve()
                .toBodilessEntity();
    }

    // Llama una función de Postgres (POST /rest/v1/rpc/<nombre>). Los parámetros
    // van en un JSON con los mismos nombres que en la función (p_subasta_id, ...).
    // Todo lo que hace la función corre en una sola transacción de la BD.
    public Map<String, Object> llamarFuncion(String nombre, Map<String, Object> parametros) {
        return rest.post()
                .uri("/rpc/{nombre}", nombre)
                .body(parametros)
                .retrieve()
                .body(OBJETO);
    }

    // ── Archivos (Storage) ──

    // Sube (o reemplaza, por x-upsert) bucket/carpeta/archivo y devuelve su URL
    // pública. Solo para buckets públicos: cualquiera con la URL puede verlo.
    // Carpeta y archivo van como variables separadas porque Spring codifica
    // cada variable entera: un "/" dentro de una sola variable llegaría como %2F.
    public String subirArchivoPublico(String bucket, String carpeta, String archivo, byte[] contenido, String tipo) {
        storage.post()
                .uri("/object/{bucket}/{carpeta}/{archivo}", bucket, carpeta, archivo)
                .header("x-upsert", "true")
                .contentType(MediaType.parseMediaType(tipo))
                .body(contenido)
                .retrieve()
                .toBodilessEntity();
        return url + "/storage/v1/object/public/" + bucket + "/" + carpeta + "/" + archivo;
    }

    // ── Cuentas (Auth) ──

    // POST /auth/v1/signup. Devuelve el id (uuid) de la cuenta creada, que es
    // el mismo "sub" que traerán los JWT de esa persona cuando haga login.
    public String crearCuenta(String email, String password) {
        Map<String, Object> respuesta;
        try {
            respuesta = auth.post()
                    .uri("/signup")
                    .body(Map.of("email", email, "password", password))
                    .retrieve()
                    .body(OBJETO);
        } catch (RestClientResponseException e) {
            throw traducirErrorDeAuth(e);
        }

        // La forma de la respuesta depende de la config del proyecto:
        //  - sin confirmación de correo (la de hoy): { access_token, ..., user: { id, ... } }
        //  - con confirmación de correo:             { id, ..., identities: [...] }
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
    public boolean existeUsuario(String email) {
        // Se le pide a la base de datos que busque un usuario con ese email exacto,
        // pero que solo traiga el 'id' (para no gastar datos) y se detenga al encontrar el primero (limit=1).
        List<Map<String, Object>> usuarios = rest.get()
        .uri("/usuarios?email=eq.{email}&select=id&limit=1", email)
        .retrieve()
        .body(FILAS); // Convierte el JSON crudo en una Lista de Mapas de Java

        return !usuarios.isEmpty(); // Si la lista no está vacía, el usuario existe
    } 

    /// METODO NUEVO
    // POST /auth/v1/token?grant_type=password. En Supabase, "iniciar sesión" es
    // cambiar correo + contraseña por un token (JWT) que demuestra quién eres.
    public Map<String, Object> iniciarSesion(String email, String password) {
        try {
            return auth.post() // Utiliza el RestClient que tiene la llave pública
                    .uri("/token?grant_type=password") // Ruta para intercambiar credenciales por el JWT
                    .body(Map.of("email", email, "password", password)) // Envía el JSON con las credenciales
                    .retrieve()
                    .body(OBJETO); // Lo convierte a un Map<String, Object>
        } catch (RestClientResponseException e) { 
            // En caso de que no se encuentre el usuario o la contraseña sea incorrecta, se lanza error
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
            // Con "Confirm email" activado en Supabase, no se puede entrar
            // hasta hacer clic en el enlace que llega al correo.
            case "email_not_confirmed" ->
                    new ResponseStatusException(HttpStatus.FORBIDDEN,
                            "Confirma tu correo antes de iniciar sesión: te enviamos un enlace al registrarte.");
            case "invalid_credentials" ->
                    new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Correo o contraseña incorrectos.");
            // Cualquier otra cosa es un fallo de Supabase, no del usuario: 502 Bad Gateway
            // significa "el servidor del que dependo me respondió mal".
            default -> new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Error al comunicarse con Supabase (respondió " + e.getStatusCode().value() + ").", e);
        };
    }
}