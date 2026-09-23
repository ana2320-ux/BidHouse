package com.bidhouse.demo.Controladores;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

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

    @GetMapping("/subastas/{id}")
    public Map<String, Object> detalle(@PathVariable String id) {
        return servicioSubasta.obtenerDetalle(id);
    }

    @PostMapping("/subastas")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> vender(@RequestBody NuevaSubasta nueva) {
        return servicioSubasta.crear(nueva);
    }

    @GetMapping("/categorias")
    public List<Map<String, Object>> categorias() {
        return servicioSubasta.listarCategorias();
    }
}
