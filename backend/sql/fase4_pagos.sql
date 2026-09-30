-- ─────────────────────────────────────────────────────────────
-- BidHouse — Fase 4a: pagos y saldo
--
-- Se corre UNA vez en Supabase: panel → SQL Editor → pegar → Run.
-- Requiere las fases 1 a 3. Es seguro correrlo de nuevo.
--
-- Moneda: el sitio muestra USD y Mercado Pago (cuenta de Colombia) cobra en
-- COP. Para el demo se cobra el MISMO número (1 USD = 1 COP, redondeado a
-- pesos enteros). Todo lo de aquí se guarda en la moneda del sitio.
-- ─────────────────────────────────────────────────────────────


-- 1) Etapas del contrato de garantía ──────────────────────────
-- El CHECK original solo aceptaba 'pendiente' y 'completada'.
alter table public.transacciones drop constraint if exists transacciones_estado_check;
alter table public.transacciones add constraint transacciones_estado_check
  check (estado in ('pendiente',     -- esperando el pago del comprador (48 h)
                    'en_custodia',   -- pagado: BidHouse guarda el dinero; el vendedor debe enviar (5 días)
                    'enviado',       -- el vendedor envió; el comprador confirma que llegó (7 días)
                    'recibido',      -- el comprador confirmó; falta liberar el pago
                    'completada',    -- pago liberado al vendedor como saldo
                    'cancelada',     -- no se pagó a tiempo
                    'en_disputa'));  -- el comprador reportó un problema

-- Fechas de cada hito (las de envío y confirmación se usan en la fase 4b).
alter table public.transacciones
  add column if not exists pagado_en timestamptz,
  add column if not exists fecha_limite_envio timestamptz,
  add column if not exists enviado_en timestamptz,
  add column if not exists guia_envio text,
  add column if not exists fecha_limite_confirmacion timestamptz,
  add column if not exists liberado_en timestamptz;


-- 2) Saldo y extracto ─────────────────────────────────────────
-- usuarios.saldo_disponible ya existía. Nunca puede quedar negativo.
alter table public.usuarios drop constraint if exists usuarios_saldo_no_negativo;
alter table public.usuarios add constraint usuarios_saldo_no_negativo check (saldo_disponible >= 0);

-- Cada cambio de saldo deja una fila aquí, como un extracto bancario. Así
-- siempre se puede explicar de dónde salió cada peso del saldo.
create table if not exists public.movimientos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  tipo text not null check (tipo in ('recarga', 'pago_contrato', 'venta_liberada', 'reembolso')),
  monto numeric(14, 2) not null,           -- positivo: entra al saldo; negativo: sale
  saldo_despues numeric(14, 2) not null,
  transaccion_id uuid references public.transacciones(id) on delete set null,
  referencia text,                          -- id del pago en Mercado Pago (recargas)
  descripcion text not null,
  creado_en timestamptz not null default now()
);

-- El mismo pago de Mercado Pago nunca se acredita dos veces (ni aunque el
-- comprador recargue la página de retorno o el backend lo verifique dos veces).
create unique index if not exists movimientos_referencia_unica
  on public.movimientos (tipo, referencia) where referencia is not null;
create index if not exists movimientos_por_usuario
  on public.movimientos (usuario_id, creado_en desc);

-- RLS sin políticas = nadie con la llave pública puede leer ni escribir el
-- extracto. Solo el backend (service_role, que se salta RLS).
alter table public.movimientos enable row level security;


-- 3) acreditar_recarga() ──────────────────────────────────────
-- La llama el backend DESPUÉS de verificar con la API de Mercado Pago que el
-- pago está aprobado. Idempotente: si esa referencia ya se acreditó, devuelve
-- el mismo movimiento sin sumar otra vez.
create or replace function public.acreditar_recarga(
  p_usuario_id uuid,
  p_monto numeric,
  p_referencia text
)
returns public.movimientos
language plpgsql
set search_path = public
as $$
declare
  u public.usuarios%rowtype;
  m public.movimientos%rowtype;
begin
  if p_monto is null or p_monto <= 0 then
    raise exception 'MONTO_INVALIDO';
  end if;

  -- Primero el candado sobre el usuario: si llegan dos confirmaciones del
  -- mismo pago a la vez, la segunda espera aquí y luego encuentra el
  -- movimiento ya creado (abajo), en vez de acreditar dos veces.
  select * into u from public.usuarios where id = p_usuario_id for update;
  if not found then
    raise exception 'USUARIO_NO_EXISTE';
  end if;

  select * into m from public.movimientos where tipo = 'recarga' and referencia = p_referencia;
  if found then
    return m;
  end if;

  update public.usuarios
     set saldo_disponible = coalesce(saldo_disponible, 0) + p_monto
   where id = p_usuario_id;

  insert into public.movimientos (usuario_id, tipo, monto, saldo_despues, referencia, descripcion)
  values (p_usuario_id, 'recarga', p_monto, coalesce(u.saldo_disponible, 0) + p_monto,
          p_referencia, 'Recarga con Mercado Pago')
  returning * into m;

  return m;
end;
$$;


-- 4) pagar_contrato_con_saldo() ───────────────────────────────
-- El comprador paga con su saldo de BidHouse: sale de su saldo y queda en
-- custodia (el dinero ya está en la cuenta de BidHouse desde la recarga).
create or replace function public.pagar_contrato_con_saldo(
  p_transaccion_id uuid,
  p_comprador_id uuid
)
returns public.transacciones
language plpgsql
set search_path = public
as $$
declare
  t public.transacciones%rowtype;
  u public.usuarios%rowtype;
  titulo text;
begin
  select * into t from public.transacciones where id = p_transaccion_id for update;
  if not found then
    raise exception 'CONTRATO_NO_EXISTE';
  end if;
  if t.comprador_id <> p_comprador_id then
    raise exception 'NO_ES_TU_CONTRATO';
  end if;
  if t.estado <> 'pendiente' then
    raise exception 'CONTRATO_YA_PAGADO';
  end if;
  if t.fecha_limite_pago is not null and now() > t.fecha_limite_pago then
    raise exception 'PLAZO_VENCIDO';
  end if;

  select * into u from public.usuarios where id = p_comprador_id for update;
  if coalesce(u.saldo_disponible, 0) < t.monto then
    raise exception 'SALDO_INSUFICIENTE' using detail = coalesce(u.saldo_disponible, 0)::text;
  end if;

  select s.titulo into titulo from public.subastas s where s.id = t.subasta_id;

  update public.usuarios
     set saldo_disponible = saldo_disponible - t.monto
   where id = p_comprador_id;

  insert into public.movimientos (usuario_id, tipo, monto, saldo_despues, transaccion_id, descripcion)
  values (p_comprador_id, 'pago_contrato', -t.monto, u.saldo_disponible - t.monto, t.id,
          format('Pago de "%s" (queda en custodia)', titulo));

  update public.transacciones
     set estado = 'en_custodia', metodo_pago = 'saldo', pagado_en = now(),
         fecha_limite_envio = now() + interval '5 days', actualizado_en = now()
   where id = t.id
  returning * into t;

  insert into public.notificaciones (usuario_id, tipo, titulo, mensaje, datos)
  values (t.vendedor_id, 'pago_recibido', 'El comprador pagó',
          format('El pago de "%s" está en custodia. Envía el activo en los próximos 5 días.', titulo),
          json_build_object('subasta_id', t.subasta_id, 'transaccion_id', t.id));

  return t;
end;
$$;


-- 5) registrar_pago_mercadopago() ─────────────────────────────
-- Marca un contrato como pagado por Mercado Pago. La llama el backend después
-- de verificar el pago con la API de Mercado Pago (nunca con lo que dice la
-- URL de retorno). p_monto_cobrado es lo que Mercado Pago dice que cobró.
-- Idempotente: si el mismo pago ya se registró, devuelve el contrato.
create or replace function public.registrar_pago_mercadopago(
  p_transaccion_id uuid,
  p_referencia text,
  p_monto_cobrado numeric
)
returns public.transacciones
language plpgsql
set search_path = public
as $$
declare
  t public.transacciones%rowtype;
  titulo text;
begin
  select * into t from public.transacciones where id = p_transaccion_id for update;
  if not found then
    raise exception 'CONTRATO_NO_EXISTE';
  end if;
  if t.estado <> 'pendiente' then
    if t.referencia_pago = p_referencia then
      return t;                            -- ya registrado: no repetir
    end if;
    raise exception 'CONTRATO_YA_PAGADO';
  end if;
  -- 1 USD = 1 COP redondeado a pesos: lo cobrado debe cubrir el monto.
  if p_monto_cobrado is null or p_monto_cobrado < round(t.monto) then
    raise exception 'MONTO_NO_COINCIDE';
  end if;

  select s.titulo into titulo from public.subastas s where s.id = t.subasta_id;

  update public.transacciones
     set estado = 'en_custodia', metodo_pago = 'mercadopago', referencia_pago = p_referencia,
         pagado_en = now(), fecha_limite_envio = now() + interval '5 days', actualizado_en = now()
   where id = t.id
  returning * into t;

  insert into public.notificaciones (usuario_id, tipo, titulo, mensaje, datos)
  values (t.vendedor_id, 'pago_recibido', 'El comprador pagó',
          format('El pago de "%s" está en custodia. Envía el activo en los próximos 5 días.', titulo),
          json_build_object('subasta_id', t.subasta_id, 'transaccion_id', t.id));

  return t;
end;
$$;


-- Igual que las otras: reciben ids de usuario como parámetro, así que solo
-- las puede ejecutar el backend (service_role).
revoke execute on function public.acreditar_recarga(uuid, numeric, text) from public, anon, authenticated;
revoke execute on function public.pagar_contrato_con_saldo(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.registrar_pago_mercadopago(uuid, text, numeric) from public, anon, authenticated;
grant execute on function public.acreditar_recarga(uuid, numeric, text) to service_role;
grant execute on function public.pagar_contrato_con_saldo(uuid, uuid) to service_role;
grant execute on function public.registrar_pago_mercadopago(uuid, text, numeric) to service_role;

notify pgrst, 'reload schema';
