package com.bidhouse.demo.Servicios;

import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
public class SupabaseClient {

    private static final ParameterizedTypeReference<List<Map<String, Object>>> FILAS = new ParameterizedTypeReference<>() {};

    private final RestClient http;

    public SupabaseClient(@Value("${supabase.url}") String url, @Value("${supabase.secret-key}") String secretKey) {
        this.http = RestClient.builder()
                .baseUrl(url + "/rest/v1")
                .defaultHeader("apikey", secretKey)
                .defaultHeader("Authorization", "Bearer " + secretKey)
                .build();
    }

    public List<Map<String, Object>> consultar(String rutaYFiltros) {
        return http.get().uri(rutaYFiltros).retrieve().body(FILAS);
    }

    public Map<String, Object> insertar(String tabla, Map<String, Object> fila) {
        List<Map<String, Object>> creadas = http.post()
                .uri("/" + tabla)
                .header("Prefer", "return=representation")
                .contentType(MediaType.APPLICATION_JSON)
                .body(fila)
                .retrieve()
                .body(FILAS);
        return creadas.get(0);
    }

    public void eliminar(String rutaYFiltros) {
        http.delete().uri(rutaYFiltros).retrieve().toBodilessEntity();
    }
}
