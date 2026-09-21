# AGENTS.md

Contexto del proyecto para agentes y asistentes de código. Léelo antes de
proponer cambios. Está en la raíz del repo y es público: **no escribas aquí
llaves, tokens, URLs de proyectos privados ni rutas locales de nadie.**

---

## Qué es BidHouse

Plataforma de subastas en línea de activos de alto valor (relojes, arte, autos
clásicos, inmuebles) con verificación de identidad, custodia en escrow y
liquidación vía contratos inteligentes.

Proyecto académico (Innovación, semestre 2026-03). Está en fase temprana: buena
parte de la interfaz está maquetada con datos quemados y todavía no hay base de
datos propia.

## Estructura

```
backend/    Spring Boot 4.1.1 · Java 21 · Maven
frontend/   React 19 · Vite 8 · TypeScript · React Router 7 · Supabase JS
docs/       Documentación de la materia (PDF)
```

## Cómo se levanta

```bash
# Backend — desde backend/ (el .env se lee relativo al directorio de trabajo)
cd backend && ./mvnw spring-boot:run     # → http://localhost:8080

# Frontend — el proyecto usa bun (hay bun.lock, no package-lock)
cd frontend && bun install && bun dev    # → http://localhost:5173
```

## Variables de entorno

Hacen falta **dos** archivos `.env`, uno por aplicacion, y ninguno se versiona.
Cada carpeta tiene su plantilla commiteada con los nombres y sin valores:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Los valores reales salen del panel de Supabase (Project Settings -> API) o se
los pides a alguien del equipo. **Nunca los pegues en un commit, un issue ni un
chat.**

Estan separados a proposito, no los unifiques en un `.env` de la raiz:
`backend/.env` contiene `SUPABASE_SECRET_KEY` (la *service_role*, que se salta
todas las politicas RLS) y esa llave no debe convivir con las variables que
terminan en el navegador. Ademas Vite lee el `.env` de `frontend/` y el
post-processor de Spring el de `backend/`, asi que hoy funciona sin configurar
nada; en produccion tampoco compartirian archivo.

Cualquier variable `VITE_*` **queda compilada dentro del bundle** y es visible
para cualquiera que abra la pagina. Ahi solo van valores publicos. La `anon key`
de Supabase si lo es por diseno: lo que protege los datos son las politicas RLS.

Nota: `SUPABASE_PUBLISHABLE_KEY` (backend) y `VITE_SUPABASE_ANON_KEY` (frontend)
son el mismo valor con nombres de epocas distintas — Supabase renombro la *anon
key* a *publishable key*. No son dos llaves.

---

## Estado real del código

Distingue lo que ya funciona de lo que es fachada:

| Zona | Estado |
| --- | --- |
| `Registro.tsx` | **Real.** Llama a `supabase.auth.signUp()` directo desde el navegador. |
| `Perfil.tsx` | Trae datos de Spring Boot, pero el backend devuelve un usuario hardcodeado. Las métricas y listas del dashboard son estáticas en el JSX. |
| `Catalogo.tsx`, `Home.tsx` | Solo maqueta. Arreglos `MOCK_ITEMS` / `liveLots` en el archivo. Los filtros y el buscador no filtran nada. |
| `ComoFunciona.tsx` | Contenido estático, está bien así. |
| `ServicioSubasta` | Devuelve una laptop de prueba fija. |
| Capa de datos del backend | **No existe.** Sin JPA, sin repositorios, sin migraciones. |

## Decisión de arquitectura pendiente

Hoy conviven dos caminos de datos que se contradicen y hay que unificarlos:

- El registro habla **directo con Supabase** desde el navegador.
- El perfil habla con **Spring Boot**, que a su vez tiene configurada
  `SUPABASE_SECRET_KEY` y `SUPABASE_JWKS_URL` pero no las usa en ningún lado.

Antes de agregar una funcionalidad que toque datos de usuario, pregunta cuál de
los dos modelos se adoptó:

- **A — Supabase como fuente de verdad.** El front lo consulta directo, con RLS
  bien configurado. Spring Boot solo resuelve lo que Supabase no puede (reglas
  de puja, cierre de subasta). Mucho menos código.
- **B — Todo pasa por Spring Boot**, que valida el JWT contra `SUPABASE_JWKS_URL`.
  El front nunca toca Supabase directo.

No elijas por tu cuenta: es una decisión del equipo.

---

## Convenciones

- **Backend en español.** Paquetes `Controladores`, `Modelos`, `Servicios`;
  clases `ControladorUsuario`, `ServicioSubasta`. Mantén ese idioma y esa
  estructura aunque los campos de algunos modelos estén en inglés
  (`Subasta.title`, `startingPrice`) — no los renombres sin acordarlo.
- **Frontend:** una página por archivo en `src/pages/`, con su `.css` hermano
  del mismo nombre. Los estilos compartidos viven en `globals.css`; las clases
  comunes usan prefijo `bh-` (`bh-container`, `bh-header`).
- **Inyección por constructor** en los servicios de Spring, no `@Autowired`
  sobre el campo.
- **Comentarios en español** explicando el *porqué*, no el *qué*. Varios
  archivos los usan como material de estudio del equipo; respétalos.
- Commits en español, con prefijo de zona cuando aplique
  (`Backend: ...`, `Frontend: ...`).

## Reglas de higiene del repo

- **Nunca** commitees `.env`, `.idea/`, `.vscode/`, `target/`, `node_modules/`
  ni archivos de configuración personal de editor.
- No agregues valores reales de llaves a los ejemplos, la documentación ni los
  mensajes de commit.
- No crees carpetas de configuración de asistentes de IA dentro del repo. Si
  necesitas dejar contexto duradero, va en este archivo.
- El backend corre en `:8080` y el frontend en `:5173`; cualquier endpoint nuevo
  necesita CORS para ese origen.

## Trampas conocidas

- `DotenvEnvironmentPostProcessor` lee `.env` **relativo al directorio de
  trabajo**. Si arrancas el backend desde la raíz del repo en vez de `backend/`,
  no encuentra nada y la app falla al resolver las propiedades.
- El test `supabaseEnvVarsAreLoadedFromDotenv` falla en cualquier entorno sin
  `.env` (CI incluido). Tenlo en cuenta antes de reportar que "los tests están
  rotos".
- El CORS está puesto como `@CrossOrigin` suelto en un solo controlador. Los
  demás endpoints no lo tienen y el navegador los bloquea.
- La URL del backend está escrita a mano en el front; todavía no hay
  `VITE_API_URL`.
- No existe la ruta `/login`, pero varios enlaces y redirecciones apuntan ahí.

## Pendientes conocidos

Si vas a trabajar en algo, probablemente esté acá:

1. Ruta y pantalla de `/login` (hoy lleva a pantalla en blanco).
2. Sacar el campo `password` de lo que devuelve la API de usuario.
3. CORS global en un `WebMvcConfigurer` en vez de anotación por controlador.
4. `VITE_API_URL` en lugar de la URL escrita a mano.
5. Capa de persistencia del backend, una vez se resuelva la decisión de
   arquitectura de arriba.
6. Conectar catálogo y home a datos reales.
