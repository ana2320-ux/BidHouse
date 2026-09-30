package com.bidhouse.demo.Config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;

import jakarta.servlet.DispatcherType;

// Quién puede llamar a qué. Cada pedido pasa por esta cadena de filtros ANTES
// de llegar a un controlador:
//   - Si trae "Authorization: Bearer <token>", Spring verifica la firma del
//     token con las llaves públicas de Supabase (SUPABASE_JWKS_URL), que no
//     esté vencido y que sea de nuestro proyecto (ver application.properties).
//   - Si la ruta no es pública y el token falta o no es válido → 401, y el
//     controlador ni se ejecuta.
// Con token válido, el controlador recibe el Jwt con @AuthenticationPrincipal;
// su "sub" es el id del usuario (el mismo id de su fila en "usuarios").
@Configuration
public class SeguridadConfig {

    @Bean
    SecurityFilterChain filtros(HttpSecurity http) throws Exception {
        http
                // CSRF protege sesiones basadas en cookies. Aquí no hay cookies:
                // el token viaja en un header que el navegador no manda solo.
                .csrf(csrf -> csrf.disable())
                // Usa la configuración de CorsConfig (orígenes y métodos permitidos).
                .cors(Customizer.withDefaults())
                // Sin sesión en el servidor: cada pedido se identifica con su token.
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        // Cuando algo falla, Spring reenvía internamente a /error. Si
                        // /error también exigiera token, un 500 llegaría como 401.
                        .dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()
                        // Públicas: ver el catálogo y entrar o crear cuenta.
                        .requestMatchers(HttpMethod.GET, "/api/status", "/api/categorias",
                                "/api/subastas", "/api/subastas/*").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/usuarios/registro",
                                "/api/usuarios/existe", "/api/usuarios/login").permitAll()
                        // Todo lo demás (perfil, vender, ...) exige token válido.
                        .anyRequest().authenticated())
                .oauth2ResourceServer(o -> o.jwt(Customizer.withDefaults()));
        return http.build();
    }
}
