package com.bidhouse.demo.Modelos;

public class Usuario {
    private String nombre;
    private String apellido;
    private String email;
    private String password;
    private String username;
    private String descripcion;

    public Usuario() {}

    public Usuario(String nombre, String apellido, String email, String password, String username, String descripcion) {
        this.nombre = nombre;
        this.apellido = apellido;
        this.email = email;
        this.password = password;
        this.username = username;
        this.descripcion = descripcion;
    }

    // Getters y settes
    public String getNombre() { return nombre; }
    public String getApellido() { return apellido; }
    public String getEmail() { return email; }
    public String getPassword() { return password; }
    public String getUsername() { return username; }
    public String getDescripcion() { return descripcion; }

    public void setNombre(String nombre) { this.nombre = nombre; }
    public void setApellido(String apellido) { this.apellido = apellido; }
    public void setEmail(String email) { this.email = email; }
    public void setPassword(String password) { this.password = password; }
    public void setUsername(String username) { this.username = username; }
    public void setDescripcion(String descripcion) { this.descripcion = descripcion; }
}