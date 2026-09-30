package com.bidhouse.demo;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;

import static org.assertj.core.api.Assertions.assertThat;

// Sin el cierre automático: los tests no deben cerrar subastas reales en Supabase.
@SpringBootTest(properties = "bidhouse.cierre-automatico=false")
class BidHouseApplicationTests {

	@Value("${supabase.url}")
	private String supabaseUrl;

	@Test
	void contextLoads() {
	}

	@Test
	void supabaseEnvVarsAreLoadedFromDotenv() {
		assertThat(supabaseUrl).isNotBlank();
	}

}
