package com.bidhouse.demo.Controladores;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.bidhouse.demo.Modelos.NuevaPuja;
import com.bidhouse.demo.Modelos.NuevaSubasta;
import com.bidhouse.demo.Servicios.ServicioSubasta;

@RestController
@RequestMapping("/api")
public class ControladorSubasta {

    private final ServicioSubasta servicioSubasta;

    public ControladorSubasta(ServicioSubasta servicioSubasta) {
        this.servicioSubasta = servicioSubasta;
    }

    @GetMapping("/subastas")
    public List<Map<String, Object>> catalogo() {
        return servicioSubasta.listarCatalogo();
    }

    // Pública, pero si llega con token se sabe quién mira: jwt es null para un
    // visitante sin sesión y el servicio lo trata como anónimo.
    @GetMapping("/subastas/{id}")
    public Map<String, Object> detalle(@PathVariable String id, @AuthenticationPrincipal Jwt jwt) {
        return servicioSubasta.obtenerDetalle(id, jwt == null ? null : jwt.getSubject());
    }

    @GetMapping("/subastas/{id}/pujas")
    public List<Map<String, Object>> pujas(@PathVariable String id, @AuthenticationPrincipal Jwt jwt) {
        return servicioSubasta.historialPujas(id, jwt == null ? null : jwt.getSubject());
    }

    // Exige sesión (ver SeguridadConfig): el pujador es quien trae el token.
    @PostMapping("/subastas/{id}/pujas")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> pujar(@PathVariable String id, @AuthenticationPrincipal Jwt jwt,
                                     @RequestBody NuevaPuja puja) {
        return servicioSubasta.pujar(id, jwt.getSubject(), puja);
    }

    @PostMapping("/subastas")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> vender(@AuthenticationPrincipal Jwt jwt, @RequestBody NuevaSubasta nueva) {
        return servicioSubasta.crear(nueva, jwt.getSubject());
    }

    // Sube la imagen de un activo (multipart, campo "imagen") y devuelve su URL
    // pública, que después se manda al publicar. Exige sesión.
    @PostMapping("/activos/imagenes")
    public Map<String, Object> subirImagen(@AuthenticationPrincipal Jwt jwt,
                                           @RequestParam("imagen") MultipartFile imagen) {
        return servicioSubasta.subirImagen(jwt.getSubject(), imagen);
    }

    // Compra inmediata: precio fijo, o "Cómpralo ya" de una mixta sin pujas.
    // Exige sesión: el comprador es quien trae el token. 201 = se creó el contrato.
    @PostMapping("/subastas/{id}/compra")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> comprar(@PathVariable String id, @AuthenticationPrincipal Jwt jwt) {
        return servicioSubasta.comprar(id, jwt.getSubject());
    }

    @GetMapping("/categorias")
    public List<Map<String, Object>> categorias() {
        return servicioSubasta.listarCategorias();
    }
}
