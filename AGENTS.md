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
datos reales y otra parte sigue maquetada con datos quemados. Ya hay registro,
login y perfil propio: el backend identifica al usuario por su token.

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

Los cambios que hicimos nosotros al esquema (columnas, funciones de Postgres)
quedan como scripts en `backend/sql/`, para correrlos en el SQL Editor en orden
(`fase1_pujas.sql`, `fase2_cierre.sql`, `fase3_compra.sql`, ...). El backend no puede hacer DDL por
la API.

**`CHECK` que existen en la BD** (descubiertos probando; no se ven desde la API):
- `subastas.estado` acepta `pendiente`, `activa`, `vendida`, `cancelada`,
  `finalizada` (rechaza, por ejemplo, `adjudicada` o `desierta`).
- `transacciones.estado` acepta `pendiente` y `completada`; rechaza `en_custodia`,
  `enviado`, `recibido`, `cancelada` y `en_disputa`. La fase 4 (pagos) tiene que
  reemplazar este CHECK para las etapas del contrato.
- `notificaciones.tipo` no tiene restricción.
- `usuarios.documento_identidad` y `usuarios.email` son **únicos** (el teléfono no).
  `ServicioUsuario.mensajeDuplicado()` dice cuál chocó al registrarse.
- **Trigger en `pujas`:** al insertar una puja MAYOR a la oferta actual, la BD
  actualiza sola `oferta_actual_mas_alta`, `pujador_lider_id` y suma +1 a
  `total_pujas` (con una puja igual no hace nada). Por eso `pujar()` recalcula
  `total_pujas` contando las pujas en vez de sumar 1; si no, contaba doble.

- **Backend como proxy de Supabase.** `Servicios/SupabaseClient` tiene tres
  `RestClient`: `/rest/v1` (tablas, con `SUPABASE_SECRET_KEY`, se salta RLS),
  `/auth/v1` (registro y login, con la llave pública, igual que haría el navegador) y
  `/auth/v1/admin` (borrar cuentas, con la *service_role*), más `/storage/v1`
  (archivos, con la *service_role*). Los servicios arman la
  consulta como string de PostgREST, incluidas relaciones embebidas
  (`activos(nombre,categorias(nombre))`), y devuelven `Map<String, Object>` tal
  cual: no hay DTOs de salida, así que el JSON que ve el front usa los nombres
  de columna en `snake_case`.
- **Autenticación.** `Config/SeguridadConfig` (Spring Security, resource
  server) valida el `Authorization: Bearer <jwt>` contra `SUPABASE_JWKS_URL`.
  Supabase firma con **ES256** (hay que declararlo: el default de Spring es
  RS256) y se validan también `iss` y `aud=authenticated`. Rutas públicas: GET
  de catálogo/categorías/status y POST de registro/existe/login; todo lo demás
  exige token. Los controladores reciben `@AuthenticationPrincipal Jwt` y pasan
  `jwt.getSubject()` (el id del usuario) al servicio.
- **Archivos.** Fotos de perfil en el bucket público `avatares` de Storage
  (máx. 2 MB, jpg/png/webp), ruta `<id>/avatar` con upsert; la URL (con
  `?v=<hora>` para romper caché) va en `usuarios.imagen_url`. Imágenes de
  activos en el bucket público `activos` (máx. 5 MB), ruta `<idUsuario>/<uuid>`:
  se suben al elegirlas en Vender (`POST /api/activos/imagenes`) y publicar solo
  manda la URL; si no se publica, la imagen queda huérfana. El tipo y el tamaño
  se validan en `Servicios/Imagenes.leer()`, por los bytes y no por el nombre
  ni el Content-Type.
- **Errores.** Validación con `ResponseStatusException` (ver
  `NuevaSubasta.validar()`) y `spring.mvc.problemdetails.enabled=true`, así que
  la respuesta es un Problem Detail. El helper `frontend/src/api.ts` lee su
  campo `detail` y lo lanza como `ApiError`.
- **Cuenta y perfil comparten id.** `ServicioUsuario.registrar()` crea la
  cuenta en Supabase Auth y después la fila en `usuarios` con el **mismo id**
  (el `sub` del JWT). No hay trigger en la BD que haga esto: si creas cuentas
  por otro lado, la fila de `usuarios` no aparece. Si el insert falla, se borra
  la cuenta (compensación, no hay transacción entre las dos APIs).
- **Pujas.** `POST /api/subastas/{id}/pujas` llama la función de Postgres
  `pujar()` (`backend/sql/fase1_pujas.sql`) por `/rest/v1/rpc`: valida y guarda
  en una sola transacción con `select ... for update`, para que dos pujas
  simultáneas no ganen las dos. Solo la puede ejecutar la *service_role* (se
  revoca a `anon`/`authenticated`: recibe el id del pujador como parámetro).
  La regla del mínimo está duplicada en `ServicioSubasta.pujaMinima()` solo
  para mostrarla. El detalle y el historial son públicos, pero con token dicen
  `esMiPublicacion`, `voyGanando` y `esMia` sin exponer ids de otros usuarios.
- **Compra inmediata.** `POST /api/subastas/{id}/compra` llama `comprar_ahora()`
  (`backend/sql/fase3_compra.sql`), atómica como `pujar()`: rechaza subastas
  puras, publicaciones propias, vencidas, ya vendidas y mixtas que ya tienen
  pujas. Deja la subasta en `vendida` con el comprador como `pujador_lider_id`
  (así el detalle usa `voyGanando` = "lo compré") y crea el mismo contrato
  `pendiente` que el cierre. Los errores de ambas funciones los traduce
  `ServicioSubasta.errorDeBd()`.
- **Cierre de subastas.** `Servicios/CierreSubastas` (`@Scheduled`, cada minuto)
  llama la función `cerrar_subastas_vencidas()` (`backend/sql/fase2_cierre.sql`).
  Cada subasta activa vencida pasa a `finalizada`; si tiene líder, se marca la
  puja ganadora, se crea la `transaccion` `pendiente` (comisión 3 %, plazo de
  pago 48 h en `fecha_limite_pago`) y se crean `notificaciones` para ganador,
  vendedor y perdedores. Usa `for update skip locked`: es seguro que corran
  varios backends a la vez. Se apaga con `bidhouse.cierre-automatico=false`
  (los `@SpringBootTest` lo apagan para no tocar subastas reales).
- **Front.** Todas las llamadas al backend pasan por `api()` en `src/api.ts`,
  que agrega el token si hay sesión y, ante un 401 con `WWW-Authenticate`
  (token inválido o vencido), borra la sesión. Ninguna página usa ya
  `src/lib/supabaseClient.ts`.

## Estado real del código

Distingue lo que ya funciona de lo que es fachada:

| Zona | Estado |
| --- | --- |
| `Login.tsx` | **Real**, en dos pasos: `POST /api/usuarios/existe` (si el correo no tiene fila en `usuarios`, manda a `/registro`) y `POST /api/usuarios/login`. La sesión se guarda y se lee solo a través de `src/lib/sesion.ts` (vence a la hora; no se renueva). |
| `Navbar.tsx` | Con sesión muestra el nombre y un menú (Mi perfil, Vender, Cerrar sesión). |
| `HomeUsuario.tsx` | Home con sesión (estilo Mercado Libre): saludo, categorías con fotos (tomadas de sus activos, porque `categorias.imagen_url` está vacía), accesos "Mis pujas"/"Mis ventas" que por ahora solo enlazan, y vitrina de servicios (destacar, peritaje, BidHouse Plus 3% → 1%) sin implementar. |
| `Registro.tsx` | **Real** (`POST /api/usuarios/registro`). El proyecto tiene la confirmación de correo desactivada: la cuenta queda activa al crearse. Hay 2 cuentas viejas creadas desde el navegador que no tienen fila en `usuarios`. |
| `Perfil.tsx` | **Real y propio** (sin sesión redirige a `/login`). Foto (`POST /api/usuarios/perfil/foto`) y descripción (`PATCH /api/usuarios/perfil`). Los botones "Ver subastas activas / mis ofertas / contratos" están deshabilitados: sus pantallas no existen. "Transacciones recientes" muestra etapas del escrow cuyos estados intermedios son supuestos. |
| `Catalogo.tsx` | **Real** (`GET /api/subastas`, `/api/categorias`). Cada tarjeta muestra el modo de venta (`src/lib/modos.ts`, compartido con Vender). Los filtros por categoría funcionan; el buscador no está conectado. |
| `DetalleActivo.tsx` | **Real**: detalle, panel para pujar y para comprar ("Comprar ahora" en precio fijo, "Cómpralo ya" en mixto sin pujas), ambos con confirmación, e historial (`components/Pujas.tsx`); se refresca cada 15 s. Muestra el resultado al cerrar o vender según quién mira. |
| `Vender.tsx` | **Real** (`POST /api/subastas`), exige sesión. Elige el modo (subasta, precio fijo, mixto); el backend lo guarda como `permite_pujas` + `precio_compra_inmediata` (`NuevaSubasta.modoEfectivo()`). Publica directo como `activa` y lleva al detalle. Inserta en `activos` y luego en `subastas`, sin transacción. |
| `Home.tsx` | Sin sesión, home público estático; con sesión delega en `HomeUsuario`. |
| `ComoFunciona.tsx` | Contenido estático, está bien así. |
| Pagos | No existen: todo contrato queda `pendiente`. Las notificaciones se guardan pero no hay pantalla que las muestre. |

## Decisión de arquitectura: modelo B

El equipo eligió que **todo pase por Spring Boot**: el front nunca habla directo
con Supabase y el backend es el único que tiene las llaves. El registro ya
sigue este modelo.

Registro, login, perfil y vender ya lo siguen: el front manda el token y el
backend lo valida.

## Decisiones de producto: compras y pujas

Acordadas con el equipo; todavía no están implementadas.

- **Tres modos de publicación:** subasta, precio fijo y mixto (subasta con
  "Cómpralo ya", que desaparece con la primera puja). En BD: `subastas.permite_pujas`
  + `subastas.precio_compra_inmediata`.
- **Pueden pujar o comprar** todos los usuarios (todos quedan verificados al
  registrarse), salvo en su propia publicación.
- **Contrato de garantía** (`transacciones.estado`): `pendiente` (pago, 48 h) →
  `en_custodia` (envío, 5 días) → `enviado` (confirmar recepción, 7 días; si no
  responde se da por recibido) → `recibido` → `completada` (pago liberado al
  vendedor menos comisión 3 %, 1 % con BidHouse Plus). Ramas: `cancelada` (no
  pagó: se ofrece al segundo postor) y `en_disputa`.
- **Pagos con Mercado Pago Checkout Pro (sandbox).** El backend crea la
  preferencia con `MERCADOPAGO_ACCESS_TOKEN` (solo en `backend/.env`, nunca en
  el front) y verifica cada pago con `GET /v1/payments/{id}` antes de marcarlo
  en custodia: nunca se confía en el `status` de la URL de retorno. Webhooks,
  cuando haya URL pública.
- **La cuenta de Mercado Pago es de Colombia (MCO): cobra en COP**, y el sitio
  hoy muestra USD. Falta probar los topes de monto en sandbox.
- **En Colombia no existe la API de payouts** (confirmado por soporte de Mercado
  Pago): no se puede transferir automáticamente de BidHouse al vendedor.
- **Decisión: la liberación es un saldo a favor del vendedor dentro de
  BidHouse.** Flujo: (1) el comprador paga por Checkout Pro a la cuenta de
  BidHouse (real en sandbox); (2) el contrato en blockchain registra el acuerdo
  y sus hitos; (3) al cumplirse las condiciones, el vendedor recibe el monto
  menos la comisión como saldo. El vendedor ve "saldo por liberar" (ventas en
  custodia) y "saldo disponible" (ya liberado). Cada cambio de saldo se registra
  en una tabla `movimientos` (tipo extracto) y el saldo es la suma de sus
  movimientos. Retirar el saldo queda para después.
- **Contrato en blockchain (testnet):** un solo contrato "registro" para todos
  los acuerdos. No guarda dinero (el dinero está en Mercado Pago): registra el
  acuerdo y sus hitos y decide cuándo se puede liberar; el backend hace de
  puente. Nunca guardar datos personales en la cadena: es pública y permanente.
- **Para después:** anti-sniping y precio de reserva.

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
- El Navbar y el Home leen la sesión en cada dibujo; se actualizan solos porque
  `App` se vuelve a dibujar en cada cambio de URL. Si cambias la sesión sin
  navegar, no se enteran.
- `registrar()` guarda `esta_verificado = true` a propósito: la verificación
  de identidad se hace al crear la cuenta, así que todo usuario está verificado.
- El CORS permite `GET`/`POST`/`PATCH` y expone `WWW-Authenticate`; sin eso el
  front no puede distinguir "token vencido" de otros 401.
- `frontend/package-lock.json` y un `package-lock.json` vacío en la raíz
  están versionados por accidente; el lockfile real es `bun.lock`.

## Pendientes conocidos

Si vas a trabajar en algo, probablemente esté acá:

1. Renovar el token con el `refreshToken` antes de que venza (dura 1 h).
   Llenar "Mis pujas"/"Mis ventas" del home y las pantallas de "Ver subastas
   activas", "Ver mis ofertas" y "Ver contratos" del perfil.
2. Borrar las 2 cuentas viejas de Auth sin fila en `usuarios`: `/existe` dice
   que no existen y el registro les responde 409.
3. Conectar el buscador del catálogo y el home a datos reales.
4. Crear subasta de forma atómica (función RPC en Postgres) en vez de dos
   inserts con borrado manual.
5. Agregar `VITE_API_URL` a `frontend/.env.example`.
