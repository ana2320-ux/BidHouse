package com.bidhouse.demo.Controladores;

import com.bidhouse.demo.Modelos.Subasta;
import com.bidhouse.demo.Servicios.ServicioSubasta;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/subastas")
public class ControladorSubasta {

    private final ServicioSubasta servicioSubasta;

    public ControladorSubasta(ServicioSubasta servicioSubasta) {
        this.servicioSubasta = servicioSubasta;
    }

    @GetMapping("/prueba")
    public Subasta obtenerSubastaDePrueba() {
        return servicioSubasta.obtenerSubastaDePrueba();
    }
}