package com.bidhouse.demo.modelos;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

public class Subasta {

    private UUID id; //Identificador Único Universal 36 caracteres   letras, números y guiones
    private String title;
    private String description;
    private BigDecimal startingPrice;
    private BigDecimal currentHighestBid;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private boolean isActive;

    // Constructor vacío (necesario para frameworks como Spring/Hibernate)
    public Subasta() {
    }

    //Constructor
    public Subasta(String title, String description, BigDecimal startingPrice, LocalDateTime startTime, LocalDateTime endTime) {
        this.id = UUID.randomUUID();
        this.title = title;
        this.description = description;
        this.startingPrice = startingPrice;
        this.currentHighestBid = startingPrice; // Al inicio, la oferta más alta es el precio base
        this.startTime = startTime;
        this.endTime = endTime;
        this.isActive = true;
    }

    // Getters y Setters
    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public BigDecimal getStartingPrice() { return startingPrice; }
    public void setStartingPrice(BigDecimal startingPrice) { this.startingPrice = startingPrice; }

    public BigDecimal getCurrentHighestBid() { return currentHighestBid; }
    public void setCurrentHighestBid(BigDecimal currentHighestBid) { this.currentHighestBid = currentHighestBid; }

    public LocalDateTime getStartTime() { return startTime; }
    public void setStartTime(LocalDateTime startTime) { this.startTime = startTime; }

    public LocalDateTime getEndTime() { return endTime; }
    public void setEndTime(LocalDateTime endTime) { this.endTime = endTime; }

    public boolean isActive() { return isActive; }
    public void setActive(boolean active) { isActive = active; }
}