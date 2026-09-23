package com.bidhouse.demo.Servicios;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.bidhouse.demo.Modelos.NuevaSubasta;

@Service
public class ServicioSubasta {

    private final SupabaseClient db;
    private final ServicioUsuario usuarios;

    public ServicioSubasta(SupabaseClient db, ServicioUsuario usuarios) {
        this.db = db;
        this.usuarios = usuarios;
    }

    public List<Map<String, Object>> listarCatalogo() {
        return db.consultar("/subastas?select=id,titulo,precio_base,oferta_actual_mas_alta,fecha_fin,estado,"
                + "activos(nombre,imagenes,esta_verificado,categorias(nombre))"
                + "&esta_activa=eq.true&estado=in.(pendiente,activa)&order=creado_en.desc");
    }

    public List<Map<String, Object>> listarCategorias() {
        return db.consultar("/categorias?activo=eq.true&select=id,nombre&order=nombre");
    }

    public Map<String, Object> obtenerDetalle(String id) {
        final String idNormalizado;
        try {
            idNormalizado = UUID.fromString(id).toString();
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Subasta no encontrada: " + id);
        }

        String consulta = "/subastas?select=id,titulo,descripcion,precio_base,oferta_actual_mas_alta,"
                + "incremento_minimo,fecha_inicio,fecha_fin,estado,esta_activa,"
                + "activos(id,nombre,descripcion,condicion,precio_estimado,imagenes,esta_verificado,"
                + "categorias(id,nombre))&id=eq." + idNormalizado + "&limit=1";

        List<Map<String, Object>> filas = db.consultar(consulta);
        if (filas.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Subasta no encontrada: " + id);
        }
        return filas.get(0);
    }

    // ponytail: dos inserts sin transacción (PostgREST); si falla el 2º se borra el activo a mano. Usar una función RPC en Postgres si hace falta atomicidad real.
    public Map<String, Object> crear(NuevaSubasta n) {
        n.validar();
        String vendedorId = (String) usuarios.usuarioActual().get("id");
        BigDecimal incremento = n.incrementoMinimo() == null ? BigDecimal.ZERO : n.incrementoMinimo();
        boolean hayImagen = n.imagenUrl() != null && !n.imagenUrl().isBlank();

        Map<String, Object> activo = new HashMap<>();
        activo.put("vendedor_id", vendedorId);
        activo.put("categoria_id", n.categoriaId());
        activo.put("nombre", n.nombre().strip());
        activo.put("descripcion", n.descripcion());
        activo.put("condicion", n.condicion());
        activo.put("precio_estimado", n.precioBase());
        activo.put("imagenes", hayImagen ? List.of(n.imagenUrl().strip()) : List.of());
        String activoId = (String) db.insertar("activos", activo).get("id");

        OffsetDateTime ahora = OffsetDateTime.now(ZoneOffset.UTC);
        Map<String, Object> subasta = new HashMap<>();
        subasta.put("activo_id", activoId);
        subasta.put("vendedor_id", vendedorId);
        subasta.put("titulo", n.nombre().strip());
        subasta.put("descripcion", n.descripcion());
        subasta.put("precio_base", n.precioBase());
        subasta.put("oferta_actual_mas_alta", n.precioBase());
        subasta.put("incremento_minimo", incremento);
        subasta.put("fecha_inicio", ahora.toString());
        subasta.put("fecha_fin", ahora.plusDays(n.duracionDias()).toString());
        subasta.put("estado", "pendiente");

        try {
            return db.insertar("subastas", subasta);
        } catch (RuntimeException e) {
            db.eliminar("/activos?id=eq." + activoId);
            throw e;
        }
    }
}
