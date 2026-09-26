package com.bidhouse.demo.Servicios;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;

import com.bidhouse.demo.Modelos.NuevoUsuario;

@Service
public class ServicioUsuario {

    private final SupabaseClient db;
    private final String emailActual;

    public ServicioUsuario(SupabaseClient db, @Value("${bidhouse.usuario-actual-email}") String emailActual) {
        this.db = db;
        this.emailActual = emailActual;
    }

    // ponytail: sin login aún, el usuario actual es fijo por config. Reemplazar por el JWT de Supabase (SUPABASE_JWKS_URL) al hacer auth.
    public Map<String, Object> usuarioActual() {
        List<Map<String, Object>> filas = db.consultar("/usuarios?email=eq." + emailActual + "&limit=1");
        if (filas.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado: " + emailActual);
        }
        return filas.get(0);
    }

    public Map<String, Object> perfil() {
        Map<String, Object> u = usuarioActual();
        String id = (String) u.get("id");

        List<Map<String, Object>> activos = db.consultar("/activos?vendedor_id=eq." + id
                + "&select=id,nombre,precio_estimado,imagenes,esta_verificado,categorias(nombre),subastas(estado)&order=creado_en.desc");
        List<Map<String, Object>> pujas = db.consultar("/pujas?pujador_id=eq." + id + "&select=monto,subastas(estado)");
        List<Map<String, Object>> cerradas = db.consultar("/transacciones?estado=eq.completada&or=(vendedor_id.eq." + id
                + ",comprador_id.eq." + id + ")&select=monto");
        List<Map<String, Object>> actividad = db.consultar("/notificaciones?usuario_id=eq." + id
                + "&order=creado_en.desc&limit=5&select=id,tipo,titulo,mensaje,creado_en");

        List<?> estados = activos.stream().flatMap(a -> ((List<?>) a.get("subastas")).stream())
                .map(s -> ((Map<?, ?>) s).get("estado")).toList();
        long enVivo = estados.stream().filter("activa"::equals).count();
        long enEspera = estados.stream().filter("pendiente"::equals).count();

        List<Map<String, Object>> pujasVivas = pujas.stream()
                .filter(p -> p.get("subastas") instanceof Map<?, ?> s && "activa".equals(s.get("estado"))).toList();

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("activosEnVivo", enVivo);
        stats.put("activosEnEspera", enEspera);
        stats.put("ofertasActivas", pujasVivas.size());
        stats.put("sumaOfertas", suma(pujasVivas));
        stats.put("transaccionesCompletadas", cerradas.size());
        stats.put("volumenTotal", suma(cerradas));

        boolean vendedor = Boolean.TRUE.equals(u.get("es_vendedor"));
        boolean verificado = Boolean.TRUE.equals(u.get("esta_verificado"));
        String ciudad = u.get("ciudad") == null ? "" : " • " + u.get("ciudad");

        Map<String, Object> perfil = new LinkedHashMap<>();
        perfil.put("nombre", u.get("nombre"));
        perfil.put("apellido", u.get("apellido"));
        perfil.put("username", emailActual.split("@")[0]);
        perfil.put("descripcion", (vendedor ? "Vendedor" : "Comprador") + (verificado ? " verificado" : "") + ciudad);
        perfil.put("verificado", verificado);
        perfil.put("stats", stats);
        perfil.put("activos", activos);
        perfil.put("actividad", actividad);
        return perfil;
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
        fila.put("telefono", n.telefono().strip());
        fila.put("direccion", n.direccion().strip());
        fila.put("ciudad", n.ciudad().strip());
        fila.put("pais", n.pais().strip());
        fila.put("es_vendedor", n.esVendedor());
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
            // 409 Conflict de PostgREST = choca con una restricción UNIQUE (ej. el email).
            if (e instanceof RestClientResponseException r && r.getStatusCode().value() == 409) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe un usuario con ese correo.", e);
            }
            throw e;
        }

        // Solo se devuelve lo necesario para confirmar; nunca la contraseña.
        return Map.of("id", id, "email", email);
    }

    private static BigDecimal suma(List<Map<String, Object>> filas) {
        return filas.stream().map(f -> new BigDecimal(String.valueOf(f.get("monto")))).reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
