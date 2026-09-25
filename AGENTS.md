# AGENTS.md

Contexto del proyecto para agentes y asistentes de código. Léelo antes de
proponer cambios. Está en la raíz del repo y es público: **no escribas aquí
llaves, tokens, URLs de proyectos privados ni rutas locales de nadie.**

---

## Qué es BidHouse

Plataforma de subastas en línea de activos de alto valor (relojes, arte, autos
clásicos, inmuebles) con verificación de identidad, custodia en escrow y
liquidación vía contratos inteligentes.

Proyecto académico (Innovación, semestre 2026-03). Está en fase temprana: la
base de datos vive en Supabase (Postgres), parte de la interfaz ya consume
datos reales y otra parte sigue maquetada con datos quemados. Todavía no hay
login.

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

# Frontend — el proyecto usa bun (bun.lock es el lockfile que manda)
cd frontend && bun install && bun dev    # → http://localhost:5173
```

Verificación:

```bash
cd frontend && bun run lint        # ESLint
cd frontend && bun run build       # tsc -b + vite build: es el chequeo de tipos
cd backend  && ./mvnw test                          # todos los tests
cd backend  && ./mvnw test -Dtest=NuevaSubastaTest  # una sola clase
cd backend  && ./mvnw test -Dtest=NuevaSubastaTest#aceptaSubastaValida  # un solo método
```

El frontend no tiene tests.

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

## Arquitectura de datos

La base de datos es un proyecto de Supabase. **El esquema no está en el repo**
(no hay migraciones ni JPA): las tablas (`usuarios`, `activos`, `subastas`,
`categorias`, `pujas`, `transacciones`, `notificaciones`) y sus `CHECK` se
administran desde el panel. Si cambias una columna, las consultas del backend
son strings y no van a fallar al compilar.

- **Backend como proxy de PostgREST.** `Servicios/SupabaseClient` es un
  `RestClient` contra `SUPABASE_URL/rest/v1` autenticado con
  `SUPABASE_SECRET_KEY` (*service_role*, se salta RLS). Los servicios arman la
  consulta como string de PostgREST, incluidas relaciones embebidas
  (`activos(nombre,categorias(nombre))`), y devuelven `Map<String, Object>` tal
  cual: no hay DTOs de salida, así que el JSON que ve el front usa los nombres
  de columna en `snake_case`.
- **Usuario actual fijo.** Sin login, `ServicioUsuario.usuarioActual()` busca el
  email de `bidhouse.usuario-actual-email` en `application.properties`. Todo lo
  que "es del usuario" (perfil, vender) cuelga de ahí.
- **Errores.** Validación con `ResponseStatusException` (ver
  `NuevaSubasta.validar()`) y `spring.mvc.problemdetails.enabled=true`, así que
  la respuesta es un Problem Detail. El helper `frontend/src/api.ts` lee su
  campo `detail` y lo lanza como `ApiError`.
- **Front.** Todas las llamadas al backend pasan por `api()` en `src/api.ts`.
  Solo `Registro.tsx` usa el cliente de Supabase (`src/lib/supabaseClient.ts`).

## Estado real del código

Distingue lo que ya funciona de lo que es fachada:

| Zona | Estado |
| --- | --- |
| `Login.tsx` | Solo maqueta. Pide el correo (estilo Amazon) y siempre manda a `/registro` como cliente nuevo; no hay paso de contraseña. |
| `Registro.tsx` | **Real.** Llama a `supabase.auth.signUp()` directo desde el navegador. Los datos de perfil van a `raw_user_meta_data`, no a la tabla `usuarios`. |
| `Perfil.tsx` | **Real**, pero siempre del usuario fijo por config. Métricas calculadas en `ServicioUsuario.perfil()`. |
| `Catalogo.tsx` | **Real** (`GET /api/subastas`, `/api/categorias`). Los filtros por categoría funcionan; el buscador no está conectado. |
| `DetalleActivo.tsx` | **Real** (`GET /api/subastas/{id}`). |
| `Vender.tsx` | **Real** (`POST /api/subastas`): inserta en `activos` y luego en `subastas`, sin transacción. |
| `Home.tsx` | Solo maqueta: arreglo `liveLots` en el archivo. |
| `ComoFunciona.tsx` | Contenido estático, está bien así. |
| Pujas, cierre de subasta, auth en el backend | No existen. |

## Decisión de arquitectura pendiente

Hoy conviven dos caminos de datos que se contradicen y hay que unificarlos:

- El registro habla **directo con Supabase** desde el navegador.
- Catálogo, detalle, perfil y vender hablan con **Spring Boot**, que consulta
  Supabase con la *service_role*. `SUPABASE_JWKS_URL` está configurada pero no
  se usa: el backend no valida ningún JWT.

Que el código se haya inclinado hacia Spring Boot no significa que la decisión
esté tomada. Antes de agregar una funcionalidad que toque datos de usuario,
pregunta cuál de los dos modelos se adoptó:

- **A — Supabase como fuente de verdad.** El front lo consulta directo, con RLS
  bien configurado. Spring Boot solo resuelve lo que Supabase no puede (reglas
  de puja, cierre de subasta). Mucho menos código.
- **B — Todo pasa por Spring Boot**, que valida el JWT contra `SUPABASE_JWKS_URL`.
  El front nunca toca Supabase directo.

No elijas por tu cuenta: es una decisión del equipo.

---

## Convenciones

- **Backend en español.** Paquetes `Controladores`, `Modelos`, `Servicios`;
  clases `ControladorUsuario`, `ServicioSubasta`; configuración en `Config/`.
  Los modelos de entrada son `record` con su propio `validar()`
  (`NuevaSubasta`). Todos los endpoints van bajo `/api`.
- **Frontend:** una página por archivo en `src/pages/`, con su `.css` hermano
  del mismo nombre. Los estilos compartidos viven en `globals.css`; las clases
  comunes usan prefijo `bh-` (`bh-container`, `bh-header`).
- **Inyección por constructor** en los servicios de Spring, no `@Autowired`
  sobre el campo.
- **Comentarios en español** explicando el *porqué*, no el *qué*. Varios
  archivos los usan como material de estudio del equipo; respétalos.
- Los comentarios `// ponytail:` marcan atajos conocidos y dicen qué hacer
  cuando dejen de alcanzar. Si resuelves uno, borra el comentario.
- Commits en español, con prefijo de zona cuando aplique
  (`Backend: ...`, `Frontend: ...`).

## Reglas de higiene del repo

- **Nunca** commitees `.env`, `.idea/`, `.vscode/`, `target/`, `node_modules/`
  ni archivos de configuración personal de editor.
- No agregues valores reales de llaves a los ejemplos, la documentación ni los
  mensajes de commit.
- No crees carpetas de configuración de asistentes de IA dentro del repo. Si
  necesitas dejar contexto duradero, va en este archivo.
- El backend corre en `:8080` y el frontend en `:5173`.

## Trampas conocidas

- `DotenvEnvironmentPostProcessor` lee `.env` **relativo al directorio de
  trabajo**. Si arrancas el backend desde la raíz del repo en vez de `backend/`,
  no encuentra nada y la app falla al resolver las propiedades.
- El test `supabaseEnvVarsAreLoadedFromDotenv` falla en cualquier entorno sin
  `.env` (CI incluido). Tenlo en cuenta antes de reportar que "los tests están
  rotos".
- El CORS es global (`Config/CorsConfig`) pero solo cubre `/api/**` y solo
  `GET`/`POST`. Un endpoint fuera de `/api` o con `PUT`/`PATCH`/`DELETE` lo
  bloquea el navegador hasta que lo agregues ahí.
- `api.ts` lee `VITE_API_URL` con fallback a `http://localhost:8080`, pero la
  variable no está en `frontend/.env.example`.
- `/login` y `/registro` no muestran navbar (`RUTAS_SIN_NAVBAR` en `App.tsx`).
- El backend no tiene autenticación y usa la *service_role*: cualquiera que
  llegue a `:8080` puede crear subastas a nombre del usuario fijo.
- `frontend/package-lock.json` y un `package-lock.json` vacío en la raíz
  están versionados por accidente; el lockfile real es `bun.lock`.

## Pendientes conocidos

Si vas a trabajar en algo, probablemente esté acá:

1. Login real: consultar si el correo existe y pedir la contraseña.
2. Reemplazar el usuario fijo por el JWT de Supabase, según la decisión de
   arquitectura de arriba.
3. Conectar el buscador del catálogo y el home a datos reales.
4. Crear subasta de forma atómica (función RPC en Postgres) en vez de dos
   inserts con borrado manual.
5. Agregar `VITE_API_URL` a `frontend/.env.example`.
