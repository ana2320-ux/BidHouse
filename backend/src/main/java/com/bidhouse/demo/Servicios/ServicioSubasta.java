package com.bidhouse.demo.Servicios;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import com.bidhouse.demo.Modelos.NuevaPuja;
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
        // permite_pujas + precio_compra_inmediata: el catálogo muestra el modo de venta.
        return db.consultar("/subastas?select=id,titulo,precio_base,oferta_actual_mas_alta,fecha_fin,estado,"
                + "permite_pujas,precio_compra_inmediata,"
                + "activos(nombre,imagenes,esta_verificado,categorias(id,nombre))"
                + "&esta_activa=eq.true&estado=in.(pendiente,activa)&order=creado_en.desc");
    }

    public List<Map<String, Object>> listarCategorias() {
        return db.consultar("/categorias?activo=eq.true&select=id,nombre&order=nombre");
    }

    // idUsuario puede ser null (visitante sin sesión). Con sesión se calcula si
    // la publicación es suya y si va ganando, sin mandarle al navegador los ids
    // de vendedor y pujador líder (no hace falta que nadie los vea).
    public Map<String, Object> obtenerDetalle(String id, String idUsuario) {
        String idNormalizado = normalizarId(id);

        String consulta = "/subastas?select=id,titulo,descripcion,precio_base,oferta_actual_mas_alta,"
                + "incremento_minimo,fecha_inicio,fecha_fin,estado,esta_activa,"
                + "permite_pujas,precio_compra_inmediata,total_pujas,vendedor_id,pujador_lider_id,"
                + "activos(id,nombre,descripcion,condicion,precio_estimado,imagenes,esta_verificado,"
                + "categorias(id,nombre))&id=eq." + idNormalizado + "&limit=1";

        List<Map<String, Object>> filas = db.consultar(consulta);
        if (filas.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Subasta no encontrada: " + id);
        }

        Map<String, Object> detalle = new LinkedHashMap<>(filas.get(0));
        Object vendedor = detalle.remove("vendedor_id");
        Object lider = detalle.remove("pujador_lider_id");
        detalle.put("esMiPublicacion", idUsuario != null && idUsuario.equals(vendedor));
        detalle.put("voyGanando", idUsuario != null && idUsuario.equals(lider));
        detalle.put("pujaMinima", pujaMinima(
                decimal(detalle.get("precio_base")),
                decimal(detalle.get("oferta_actual_mas_alta")),
                decimal(detalle.get("incremento_minimo")),
                lider != null));

        // Si ya se vendió o cerró con ganador, a comprador y vendedor se les
        // muestra su contrato de garantía (para pagar o ver en qué va).
        Object estado = detalle.get("estado");
        if (idUsuario != null && ("finalizada".equals(estado) || "vendida".equals(estado))) {
            detalle.put("miContrato", contratoDe(idNormalizado, idUsuario));
        }
        return detalle;
    }

    private Map<String, Object> contratoDe(String idSubasta, String idUsuario) {
        String consulta = "/transacciones?subasta_id=eq." + idSubasta
                + "&or=(comprador_id.eq." + idUsuario + ",vendedor_id.eq." + idUsuario + ")"
                + "&select=id,estado,monto,comision_plataforma,fecha_limite_pago,fecha_limite_envio,"
                + "guia_envio,enviado_en,fecha_limite_confirmacion,liberado_en,notas,comprador_id";
        List<Map<String, Object>> filas;
        try {
            // Con los hitos ya registrados en la blockchain, para "Ver en blockchain".
            filas = db.consultar(consulta + ",hitos_blockchain(hito,tx_hash,creado_en)&order=creado_en.desc&limit=1");
        } catch (RestClientResponseException e) {
            // Si en esta BD todavía no se corrió fase4c_blockchain.sql, la tabla no
            // existe: se muestra el contrato sin hitos en vez de romper el detalle.
            filas = db.consultar(consulta + "&order=creado_en.desc&limit=1");
        }
        if (filas.isEmpty()) return null;
        Map<String, Object> contrato = new LinkedHashMap<>(filas.get(0));
        contrato.put("rol", idUsuario.equals(contrato.remove("comprador_id")) ? "comprador" : "vendedor");
        return contrato;
    }

    // Misma regla que la función pujar() en la BD (backend/sql/fase1_pujas.sql).
    // Se calcula aquí solo para mostrarla; la que manda es la de la BD.
    static BigDecimal pujaMinima(BigDecimal precioBase, BigDecimal ofertaActual, BigDecimal incremento, boolean hayPujas) {
        if (!hayPujas) return precioBase;
        BigDecimal paso = incremento == null ? BigDecimal.ONE : incremento.max(BigDecimal.ONE);
        return ofertaActual.add(paso);
    }

    // ── Imagen del activo ──
    // Se sube ANTES de publicar (apenas el vendedor la elige), para mostrarla en
    // la vista previa; publicar solo manda la URL. Nombre aleatorio dentro de la
    // carpeta del usuario: <idUsuario>/<uuid>.
    // ponytail: si el vendedor sube una imagen y no publica, queda huérfana en
    // el bucket. Si el espacio llega a importar, limpiar las que ningún activo use.
    public Map<String, Object> subirImagen(String idUsuario, MultipartFile archivo) {
        Imagenes.Imagen imagen = Imagenes.leer(archivo, 5 * 1024 * 1024); // límite del bucket "activos"
        String url = db.subirArchivoPublico("activos", idUsuario, UUID.randomUUID().toString(),
                imagen.bytes(), imagen.tipo());
        return Map.of("url", url);
    }

    // ── Pujas ──

    // Últimas 20 pujas, la más reciente primero. Del pujador solo se muestra la
    // inicial del nombre ("A***"): el historial es público y nadie necesita saber
    // quién puja. "esMia" marca las del usuario que está mirando.
    public List<Map<String, Object>> historialPujas(String id, String idUsuario) {
        String idNormalizado = normalizarId(id);
        List<Map<String, Object>> filas = db.consultar("/pujas?subasta_id=eq." + idNormalizado
                + "&select=id,monto,creado_en,pujador_id,usuarios(nombre)&order=creado_en.desc&limit=20");

        return filas.stream().map(f -> {
            Map<String, Object> puja = new LinkedHashMap<>();
            puja.put("id", f.get("id"));
            puja.put("monto", f.get("monto"));
            puja.put("creado_en", f.get("creado_en"));
            String nombre = f.get("usuarios") instanceof Map<?, ?> u ? String.valueOf(u.get("nombre")) : "";
            puja.put("alias", nombre.isEmpty() ? "Postor" : nombre.charAt(0) + "***");
            puja.put("esMia", idUsuario != null && idUsuario.equals(f.get("pujador_id")));
            return puja;
        }).toList();
    }

    // El pujador sale del token (idUsuario), nunca del cuerpo del pedido.
    // Toda la validación con la oferta actual y el guardado los hace pujar() en
    // la BD en un solo paso atómico (ver el SQL para el porqué).
    public Map<String, Object> pujar(String id, String idUsuario, NuevaPuja puja) {
        puja.validar();
        String idNormalizado = normalizarId(id);

        Map<String, Object> parametros = new HashMap<>();
        parametros.put("p_subasta_id", idNormalizado);
        parametros.put("p_pujador_id", idUsuario);
        parametros.put("p_monto", puja.monto());

        Map<String, Object> creada = llamar("pujar", parametros);

        Map<String, Object> respuesta = new LinkedHashMap<>();
        respuesta.put("id", creada.get("id"));
        respuesta.put("monto", creada.get("monto"));
        respuesta.put("creado_en", creada.get("creado_en"));
        return respuesta;
    }

    // ── Comprar ahora (precio fijo o "Cómpralo ya" del mixto) ──
    // Igual que pujar: el comprador sale del token y toda la validación y el
    // guardado los hace comprar_ahora() en la BD (backend/sql/fase3_compra.sql),
    // en un paso atómico para que nunca se venda dos veces.
    public Map<String, Object> comprar(String id, String idUsuario) {
        Map<String, Object> parametros = new HashMap<>();
        parametros.put("p_subasta_id", normalizarId(id));
        parametros.put("p_comprador_id", idUsuario);

        Map<String, Object> contrato = llamar("comprar_ahora", parametros);

        Map<String, Object> respuesta = new LinkedHashMap<>();
        respuesta.put("transaccionId", contrato.get("id"));
        respuesta.put("monto", contrato.get("monto"));
        respuesta.put("fechaLimitePago", contrato.get("fecha_limite_pago"));
        return respuesta;
    }

    // Llama una función de la BD y convierte su error en uno con sentido para el front.
    private Map<String, Object> llamar(String funcion, Map<String, Object> parametros) {
        return FuncionesBd.llamar(db, funcion, parametros);
    }

    // PostgREST manda los números como Integer o Double según el caso; así se
    // convierten todos a BigDecimal sin perder decimales.
    private static BigDecimal decimal(Object valor) {
        return valor == null ? null : new BigDecimal(String.valueOf(valor));
    }

    // Un id que no es UUID no puede existir: 404 directo, sin consultar la BD
    // (y sin meter texto arbitrario en la consulta).
    private static String normalizarId(String id) {
        try {
            return UUID.fromString(id).toString();
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Subasta no encontrada: " + id);
        }
    }

    // ponytail: dos inserts sin transacción (PostgREST); si falla el 2º se borra el activo a mano. Usar una función RPC en Postgres si hace falta atomicidad real.
    // idUsuario viene del token (ver ControladorSubasta): se vende a nombre de
    // quien inició sesión. usuarioActual() confirma que tenga fila en "usuarios".
    public Map<String, Object> crear(NuevaSubasta n, String idUsuario) {
        n.validar();
        String vendedorId = (String) usuarios.usuarioActual(idUsuario).get("id");
        // En precio fijo no hay pujas, así que el incremento no aplica.
        BigDecimal incremento = !n.permitePujas() || n.incrementoMinimo() == null ? BigDecimal.ZERO : n.incrementoMinimo();
        BigDecimal precioBase = n.precioBaseEfectivo();
        boolean hayImagen = n.imagenUrl() != null && !n.imagenUrl().isBlank();

        Map<String, Object> activo = new HashMap<>();
        activo.put("vendedor_id", vendedorId);
        activo.put("categoria_id", n.categoriaId());
        activo.put("nombre", n.nombre().strip());
        activo.put("descripcion", n.descripcion());
        activo.put("condicion", n.condicion());
        activo.put("precio_estimado", precioBase);
        activo.put("imagenes", hayImagen ? List.of(n.imagenUrl().strip()) : List.of());
        String activoId = (String) db.insertar("activos", activo).get("id");

        OffsetDateTime ahora = OffsetDateTime.now(ZoneOffset.UTC);
        Map<String, Object> subasta = new HashMap<>();
        subasta.put("activo_id", activoId);
        subasta.put("vendedor_id", vendedorId);
        subasta.put("titulo", n.nombre().strip());
        subasta.put("descripcion", n.descripcion());
        subasta.put("precio_base", precioBase);
        subasta.put("oferta_actual_mas_alta", precioBase);
        subasta.put("incremento_minimo", incremento);
        subasta.put("fecha_inicio", ahora.toString());
        subasta.put("fecha_fin", ahora.plusDays(n.duracionDias()).toString());
        // Se publica ya activa para que se pueda pujar de inmediato (fecha_inicio
        // es ahora). Si más adelante hay revisión o peritaje antes de publicar,
        // volver a "pendiente" y activar al aprobarla.
        subasta.put("estado", "activa");
        subasta.put("permite_pujas", n.permitePujas());
        subasta.put("precio_compra_inmediata", n.precioCompraInmediataEfectivo());

        try {
            return db.insertar("subastas", subasta);
        } catch (RuntimeException e) {
            db.eliminar("/activos?id=eq." + activoId);
            throw e;
        }
    }
}
