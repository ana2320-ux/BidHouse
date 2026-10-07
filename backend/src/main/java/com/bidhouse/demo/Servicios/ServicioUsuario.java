package com.bidhouse.demo.Servicios;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import com.bidhouse.demo.Modelos.Credenciales;
import com.bidhouse.demo.Modelos.DatosPerfilRegistro;
import com.bidhouse.demo.Modelos.NuevoUsuario;
import com.bidhouse.demo.Modelos.PreferenciasUsuario;

@Service
public class ServicioUsuario {

    // Estados de "transacciones" que ya terminaron (ver el CHECK en
    // backend/sql/fase4_pagos.sql). Cualquier otro es un contrato en proceso.
    private static final Set<String> ESTADOS_TERMINADOS = Set.of("completada", "cancelada");

    private static final int MAX_DESCRIPCION = 300;

    private final SupabaseClient db;

    public ServicioUsuario(SupabaseClient db) {
        this.db = db;
    }

    // El id llega del token ya verificado (el "sub" del JWT, ver SeguridadConfig):
    // nadie puede hacerse pasar por otro cambiando un parámetro. Por eso
    // concatenarlo en la consulta es seguro.
    public Map<String, Object> usuarioActual(String id) {
        List<Map<String, Object>> filas = db.consultar("/usuarios?id=eq." + id + "&limit=1");
        if (filas.isEmpty()) {
            // Cuenta en Auth sin fila en "usuarios" (las viejas creadas desde el navegador).
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                    "Tu cuenta no tiene un perfil asociado. Contacta a soporte.");
        }
        return filas.get(0);
    }

    public Map<String, Object> perfil(String id) {
        Map<String, Object> u = usuarioActual(id);

        List<Map<String, Object>> activos = db.consultar("/activos?vendedor_id=eq." + id
                + "&select=id,nombre,precio_estimado,imagenes,esta_verificado,categorias(nombre),subastas(estado)&order=creado_en.desc");
        List<Map<String, Object>> pujas = db.consultar("/pujas?pujador_id=eq." + id + "&select=subasta_id");
        // Todas las transacciones donde es comprador O vendedor, las más nuevas primero.
        List<Map<String, Object>> transacciones = db.consultar("/transacciones?or=(vendedor_id.eq." + id
                + ",comprador_id.eq." + id + ")&select=id,estado,monto,creado_en,comprador_id,subastas(id,titulo)"
                + "&order=creado_en.desc");

        List<?> estados = activos.stream().flatMap(a -> ((List<?>) a.get("subastas")).stream())
                .map(s -> ((Map<?, ?>) s).get("estado")).toList();
        long enVivo = estados.stream().filter("activa"::equals).count();
        long enEspera = estados.stream().filter("pendiente"::equals).count();

        long completadas = transacciones.stream().filter(t -> "completada".equals(t.get("estado"))).count();
        long enProceso = transacciones.stream().filter(t -> !ESTADOS_TERMINADOS.contains(t.get("estado"))).count();

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("activosEnVivo", enVivo);
        stats.put("activosEnEspera", enEspera);
        stats.put("ofertasRealizadas", pujas.size());
        // Varias pujas pueden ser en la misma subasta: se cuentan subastas distintas.
        stats.put("subastasConOfertas", pujas.stream().map(p -> p.get("subasta_id")).distinct().count());
        stats.put("transaccionesCompletadas", completadas);
        stats.put("contratosEnProceso", enProceso);

        // Para "Transacciones recientes": las 5 últimas, diciendo si compró o vendió.
        List<Map<String, Object>> recientes = transacciones.stream().limit(5).map(t -> {
            Map<String, Object> r = new LinkedHashMap<>(t); // copia: no tocar la fila original
            // comprador_id solo sirve para saber el rol; no se manda al front.
            r.put("rol", id.equals(r.remove("comprador_id")) ? "comprador" : "vendedor");
            return r;
        }).toList();

        boolean vendedor = Boolean.TRUE.equals(u.get("es_vendedor"));
        boolean verificado = Boolean.TRUE.equals(u.get("esta_verificado"));
        String ciudad = u.get("ciudad") == null ? "" : " • " + u.get("ciudad");

        Map<String, Object> perfil = new LinkedHashMap<>();
        perfil.put("nombre", u.get("nombre"));
        perfil.put("apellido", u.get("apellido"));
        perfil.put("username", String.valueOf(u.get("email")).split("@")[0]);
        // "resumen" lo arma el sistema; "descripcion" la escribe el usuario.
        perfil.put("resumen", (vendedor ? "Vendedor" : "Comprador") + (verificado ? " verificado" : "") + ciudad);
        perfil.put("descripcion", u.get("descripcion"));
        perfil.put("imagenUrl", u.get("imagen_url"));
        perfil.put("verificado", verificado);
        perfil.put("stats", stats);
        perfil.put("activos", activos);
        perfil.put("transacciones", recientes);
        // Cuántos contratos hay en cada etapa (estado → cantidad), para el resumen visual.
        perfil.put("contratosPorEstado", transacciones.stream()
                .collect(Collectors.groupingBy(t -> String.valueOf(t.get("estado")), Collectors.counting())));
        return perfil;
    }

    // ── Descripción del perfil ──
    public Map<String, Object> actualizarDescripcion(String id, String texto) {
        String limpia = texto == null ? "" : texto.strip();
        if (limpia.length() > MAX_DESCRIPCION) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "La descripción no puede tener más de " + MAX_DESCRIPCION + " caracteres");
        }
        // Vacía = sin descripción (null), no un texto en blanco.
        String valor = limpia.isEmpty() ? null : limpia;

        Map<String, Object> cambios = new HashMap<>();
        cambios.put("descripcion", valor);
        try {
            db.actualizar("/usuarios?id=eq." + id, cambios);
        } catch (RestClientResponseException e) {
            // PGRST204 = PostgREST no encuentra la columna: falta crearla en Supabase.
            if (e.getResponseBodyAsString().contains("PGRST204")) {
                throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                        "Falta la columna usuarios.descripcion en la base de datos.", e);
            }
            throw e;
        }
        Map<String, Object> respuesta = new HashMap<>();
        respuesta.put("descripcion", valor);
        return respuesta;
    }

    // ── Foto de perfil ──
    // Se guarda en el bucket público "avatares" como <id>/avatar (siempre el
    // mismo nombre: al cambiarla se reemplaza y no quedan fotos viejas huérfanas).
    public Map<String, Object> cambiarFoto(String id, MultipartFile foto) {
        // 2 MB: el límite del bucket "avatares". Se revisa aquí para responder un
        // 400 claro en vez del error que daría Storage.
        Imagenes.Imagen imagen = Imagenes.leer(foto, 2 * 1024 * 1024);

        String url = db.subirArchivoPublico("avatares", id, "avatar", imagen.bytes(), imagen.tipo());
        // ?v=<hora> cambia la URL en cada subida. Sin esto el navegador seguiría
        // mostrando la foto vieja que tiene guardada en caché (la ruta es la misma).
        String urlVersionada = url + "?v=" + System.currentTimeMillis();

        Map<String, Object> cambios = new HashMap<>();
        cambios.put("imagen_url", urlVersionada);
        db.actualizar("/usuarios?id=eq." + id, cambios);
        return Map.of("imagenUrl", urlVersionada);
    }

    // ── Perfil después de confirmar correo ──
    // Supabase Auth puede crear la cuenta desde el navegador para poder usar el
    // código OTP. Este paso, ya autenticado, deja la fila de negocio ligada al
    // mismo sub del JWT y es idempotente si un trigger ya la creó.
    public Map<String, Object> asegurarPerfil(String id, DatosPerfilRegistro datos) {
        validarDatosPerfil(datos);
        List<Map<String, Object>> existentes = db.consultar("/usuarios?id=eq." + id + "&select=id&limit=1");
        if (existentes.isEmpty()) {
            Map<String, Object> fila = new LinkedHashMap<>();
            fila.put("id", id);
            fila.put("nombre", datos.nombre().strip());
            fila.put("apellido", datos.apellido().strip());
            fila.put("email", datos.email().strip().toLowerCase());
            fila.put("documento_identidad", datos.documentoIdentidad().strip());
            fila.put("telefono", NuevoUsuario.normalizarTelefono(datos.telefono()));
            fila.put("direccion", datos.direccion().strip());
            fila.put("ciudad", datos.ciudad().strip());
            fila.put("pais", datos.pais().strip());
            fila.put("es_vendedor", datos.esVendedor());
            fila.put("esta_verificado", true);
            try {
                db.insertar("usuarios", fila);
            } catch (RestClientResponseException e) {
                if (e.getStatusCode().value() == 409) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT,
                            mensajeDuplicado(e.getResponseBodyAsString()), e);
                }
                throw e;
            }
        }
        return Map.of("id", id);
    }

    // ── Preferencias ──
    public Map<String, Object> preferencias(String id) {
        try {
            List<Map<String, Object>> filas = db.consultar("/usuario_preferencias?usuario_id=eq." + id
                    + "&select=categoria_id&order=categoria_id");
            List<String> ids = filas.stream().map(f -> String.valueOf(f.get("categoria_id"))).toList();
            return Map.of("categoriaIds", ids);
        } catch (RestClientResponseException e) {
            throw errorSiFaltaTabla(e, "usuario_preferencias");
        }
    }

    public Map<String, Object> actualizarPreferencias(String id, PreferenciasUsuario solicitud) {
        List<String> ids = solicitud == null ? List.of() : solicitud.idsNormalizados();
        try {
            Map<String, Object> parametros = new LinkedHashMap<>();
            parametros.put("p_usuario_id", id);
            parametros.put("p_categoria_ids", ids);
            return FuncionesBd.llamar(db, "reemplazar_preferencias", parametros);
        } catch (ResponseStatusException e) {
            throw e;
        } catch (RestClientResponseException e) {
            throw errorSiFaltaTabla(e, "usuario_preferencias");
        }
    }

    // ── Registro ──
    // Son DOS escrituras contra DOS APIs distintas de Supabase, y entre ellas no
    // hay transacción (no se puede hacer "rollback" de una llamada HTTP):
    //   1) la cuenta en Auth: email + contraseña (la contraseña nunca toca "usuarios")
    //   2) la fila en "usuarios" con el MISMO id, para que cuando haya login el
    //      id que viene en el JWT sirva para encontrar los datos de la persona.
    // Si el paso 2 falla, se deshace el paso 1 a mano borrando la cuenta
    // ("compensación"), igual que ServicioSubasta.crear() borra el activo.
    public Map<String, Object> registrar(NuevoUsuario n) {
        n.validar();
        String email = n.email().strip().toLowerCase(); // "Ana@Gmail.com" y "ana@gmail.com" son la misma cuenta

        String id = db.crearCuenta(email, n.password());

        Map<String, Object> fila = new LinkedHashMap<>();
        fila.put("id", id);
        fila.put("nombre", n.nombre().strip());
        fila.put("apellido", n.apellido().strip());
        fila.put("email", email);
        fila.put("documento_identidad", n.documentoIdentidad().strip());
        fila.put("telefono", NuevoUsuario.normalizarTelefono(n.telefono()));
        fila.put("direccion", n.direccion().strip());
        fila.put("ciudad", n.ciudad().strip());
        fila.put("pais", n.pais().strip());
        fila.put("esta_verificado", true);
        // saldo_disponible, esta_verificado, esta_activo y las fechas no se mandan:
        // los pone la BD con sus valores por defecto. El usuario no los decide.

        try {
            db.insertar("usuarios", fila);
        } catch (RuntimeException e) {
            try {
                db.eliminarCuenta(id);
            } catch (RuntimeException alBorrar) {
                // Si también falla el borrado, no se pierde el error original:
                // el segundo queda "adjunto" al primero para poder diagnosticarlo.
                e.addSuppressed(alBorrar);
            }
            // 409 Conflict de PostgREST = choca con una restricción UNIQUE. En
            // "usuarios" son únicos el email y el documento de identidad.
            if (e instanceof RestClientResponseException r && r.getStatusCode().value() == 409) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, mensajeDuplicado(r.getResponseBodyAsString()), e);
            }
            throw e;
        }

        // Solo se devuelve lo necesario para confirmar; nunca la contraseña.
        return Map.of("id", id, "email", email);
    }

    // PostgREST dice qué columna chocó: {"details":"Key (documento_identidad)=(999) already exists."}.
    // Sin esto, alguien con un documento ya registrado leería que el problema es su correo.
    static String mensajeDuplicado(String cuerpoError) {
        if (cuerpoError != null && cuerpoError.contains("documento_identidad")) {
            return "Ya existe una cuenta con ese documento de identidad.";
        }
        return "Ya existe una cuenta con ese correo.";
    }

    // ── Login, paso 1: ¿el correo ya tiene cuenta? ──
    // Le permite al front decidir si pedir contraseña o mandar a crear cuenta
    // (flujo estilo Amazon). Costo aceptado: cualquiera puede averiguar si un
    // correo está registrado en BidHouse.
    public boolean existe(String email) {
        if (email == null || email.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El correo electrónico es obligatorio");
        }
        // Se normaliza igual que en registrar(): si no, "Ana@Gmail.com" no
        // encontraría a "ana@gmail.com", que es como quedó guardado.
        return db.existeUsuario(email.strip().toLowerCase());
    }

    // ── Login, paso 2: correo + contraseña → sesión ──
    // Supabase valida la contraseña y entrega los tokens; luego se busca la fila
    // de "usuarios" con el id de la cuenta (el mismo que se usó al registrar).
    public Map<String, Object> iniciarSesion(Credenciales c) {
        c.validar();
        String email = c.email().strip().toLowerCase();

        Map<String, Object> sesion = db.iniciarSesion(email, c.password());
        String id = (String) ((Map<?, ?>) sesion.get("user")).get("id");

        // El id viene de Supabase, no del usuario: concatenarlo aquí es seguro. (Como por temas de seguridad o algo asi)
        // BUENO, si el usuario existe, supa base, retorna un id, si no existe devuelve una excepcion,
        // si existe, ese id se usa para buscar en la tabla usuarios, si la otra informacion del usuario
        List<Map<String, Object>> filas = db.consultar("/usuarios?id=eq." + id
                + "&select=id,nombre,apellido,email,es_vendedor,esta_verificado&limit=1");
        if (filas.isEmpty()) {
            // Cuenta en Auth sin fila en "usuarios" (ej. las creadas desde el
            // navegador antes de que el registro pasara por el backend).
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                    "Tu cuenta no tiene un perfil asociado. Contacta a soporte.");
        }

        // Se arma la respuesta a mano en vez de reenviar la de Supabase: esa trae
        // datos internos (metadata, identidades, fechas) que el front no necesita.
        Map<String, Object> respuesta = new LinkedHashMap<>();
        respuesta.put("accessToken", sesion.get("access_token"));
        respuesta.put("refreshToken", sesion.get("refresh_token"));
        respuesta.put("expiraEn", sesion.get("expires_in")); // segundos (3600 = 1 hora)
        respuesta.put("usuario", filas.get(0));
        return respuesta;
    }

    private static void validarDatosPerfil(DatosPerfilRegistro d) {
        if (d == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Faltan los datos del perfil");
        }
        obligatorio(d.nombre(), 100, "El nombre");
        obligatorio(d.apellido(), 100, "El apellido");
        obligatorio(d.documentoIdentidad(), 50, "El documento de identidad");
        obligatorio(d.email(), 255, "El correo electrónico");
        obligatorio(d.direccion(), Integer.MAX_VALUE, "La dirección");
        obligatorio(d.ciudad(), 100, "La ciudad");
        obligatorio(d.pais(), 100, "El país");
        NuevoUsuario.normalizarTelefono(d.telefono());
    }

    private static void obligatorio(String valor, int maximo, String campo) {
        if (valor == null || valor.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, campo + " es obligatorio");
        }
        if (valor.strip().length() > maximo) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    campo + " no puede tener más de " + maximo + " caracteres");
        }
    }

    private static ResponseStatusException errorSiFaltaTabla(RestClientResponseException e, String tabla) {
        if (e.getResponseBodyAsString().contains("PGRST205")
                || e.getResponseBodyAsString().contains("42P01")) {
            return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Falta crear la tabla " + tabla + ". Corre backend/sql/fase5_preferencias.sql en Supabase.", e);
        }
        throw e;
    }
}
