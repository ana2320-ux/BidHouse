package com.bidhouse.demo.Config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

// Activa las tareas programadas (@Scheduled), como Servicios/CierreSubastas.
// Sin esto Spring ignora las anotaciones @Scheduled.
@Configuration
@EnableScheduling
public class ProgramacionConfig {
}
