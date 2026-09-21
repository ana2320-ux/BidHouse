package com.bidhouse.demo;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Properties;

import org.springframework.boot.EnvironmentPostProcessor;
import org.springframework.boot.SpringApplication;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.PropertiesPropertySource;

// ponytail: only supports simple KEY=VALUE lines, no quoting/escaping. Upgrade if .env needs those.
public class DotenvEnvironmentPostProcessor implements EnvironmentPostProcessor {

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        Path envFile = Path.of(".env");
        if (!Files.isRegularFile(envFile)) {
            return;
        }

        Properties props = new Properties();
        try {
            for (String line : Files.readAllLines(envFile)) {
                line = line.strip();
                if (line.isEmpty() || line.startsWith("#") || !line.contains("=")) {
                    continue;
                }
                String[] parts = line.split("=", 2);
                props.setProperty(parts[0].strip(), parts[1].strip());
            }
        } catch (IOException e) {
            throw new IllegalStateException("No se pudo leer el archivo .env", e);
        }

        environment.getPropertySources().addLast(new PropertiesPropertySource("dotenv", props));
    }
}
