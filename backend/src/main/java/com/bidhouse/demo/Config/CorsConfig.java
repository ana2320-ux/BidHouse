package com.bidhouse.demo.Config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class CorsConfig implements WebMvcConfigurer {

    private final String frontendOrigin;

    public CorsConfig(@Value("${bidhouse.front-url}") String frontendUrl) {
        this.frontendOrigin = frontendUrl == null
                ? ""
                : frontendUrl.trim().replaceAll("/+$", "");
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                // Vite puede cambiar de puerto si el 5173 está ocupado. En
                // desarrollo se aceptan ambos nombres locales, sin bloquear
                // el login por cambiar de 5173 a 5174/5175.
                // También se acepta el origen público configurado para que
                // Mercado Pago pueda devolver al frontend y este confirme el
                // resultado mediante el backend.
                .allowedOriginPatterns("http://localhost:[*]", "http://127.0.0.1:[*]", "http://[::1]:[*]", frontendOrigin)
                .allowedMethods("GET", "POST", "PATCH", "PUT")
                // El navegador le oculta a JavaScript los headers de respuesta de
                // otro origen salvo los que se "exponen" aquí. api.ts lee este
                // para distinguir "token vencido" de otros 401.
                .exposedHeaders("WWW-Authenticate");
    }
}
