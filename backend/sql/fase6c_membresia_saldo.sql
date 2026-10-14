-- BidLuxury — Fase 6c: comprar y activar membresías
-- Ejecutar después de fase4_pagos.sql y fase6_membresias.sql (o fase6b).
-- La compra con saldo no usa el saldo por liberar. Mercado Pago solo activa
-- una compra única después de que el backend verifica el pago aprobado.

-- El extracto debe distinguir la salida por compra de una membresía.
alter table public.movimientos drop constraint if exists movimientos_tipo_check;
alter table public.movimientos add constraint movimientos_tipo_check
  check (tipo in ('recarga', 'pago_contrato', 'pago_membresia', 'venta_liberada', 'reembolso'));

-- Estas columnas completan el comprobante de la compra sin crear otra tabla:
-- el precio se guarda en USD como los planes del sitio y Mercado Pago conserva
-- su identificador en mercadopago_payment_id.
alter table public.membresias add column if not exists precio numeric(14, 2);
alter table public.membresias add column if not exists moneda text not null default 'USD';
alter table public.membresias add column if not exists metodo_pago text;
alter table public.membresias add column if not exists estado_pago text;
alter table public.membresias add column if not exists fecha_pago timestamptz;

alter table public.membresias drop constraint if exists membresias_metodo_pago_check;
alter table public.membresias add constraint membresias_metodo_pago_check
  check (metodo_pago is null or metodo_pago in ('saldo_billetera', 'mercadopago'));
alter table public.membresias drop constraint if exists membresias_estado_pago_check;
alter table public.membresias add constraint membresias_estado_pago_check
  check (estado_pago is null or estado_pago in ('pendiente', 'aprobado', 'rechazado', 'cancelado'));

-- La función calcula el precio en la base de datos, bloquea al usuario y
-- activa la membresía en la misma transacción que el descuento. El bloqueo
-- del usuario serializa dos intentos simultáneos de compra para esa cuenta.
create or replace function public.comprar_membresia_con_saldo(
  p_usuario_id uuid,
  p_periodicidad text
)
returns public.membresias
language plpgsql
set search_path = public
as $$
declare
  u public.usuarios%rowtype;
  m public.membresias%rowtype;
  precio numeric(14, 2);
  fin timestamptz;
  tiene_membresia boolean;
begin
  if p_periodicidad not in ('mensual', 'anual') then
    raise exception 'PERIODICIDAD_INVALIDA';
  end if;

  precio := case when p_periodicidad = 'anual' then 199.99 else 19.99 end;
  fin := case
    when p_periodicidad = 'anual' then now() + interval '1 year'
    else now() + interval '1 month'
  end;

  -- Este es el único saldo permitido para comprar: nunca se toma saldo por
  -- liberar ni se confía en un saldo calculado por el frontend.
  select * into u
    from public.usuarios
   where id = p_usuario_id
   for update;
  if not found then
    raise exception 'USUARIO_NO_EXISTE';
  end if;

  -- La fila única por usuario se bloquea después del usuario. Así dos
  -- peticiones no pueden activar dos membresías ni descontar dos veces.
  select * into m
    from public.membresias
   where usuario_id = p_usuario_id
   for update;
  tiene_membresia := found;

  if tiene_membresia and m.estado = 'activa' and m.fecha_fin is not null and m.fecha_fin > now() then
    raise exception 'MEMBRESIA_YA_ACTIVA';
  end if;

  if coalesce(u.saldo_disponible, 0) < precio then
    raise exception 'SALDO_MEMBRESIA_INSUFICIENTE'
      using detail = coalesce(u.saldo_disponible, 0)::text;
  end if;

  update public.usuarios
     set saldo_disponible = coalesce(saldo_disponible, 0) - precio
   where id = p_usuario_id;

  if tiene_membresia then
    update public.membresias
       set plan = 'bidluxury_member',
           periodicidad = p_periodicidad,
           estado = 'activa',
           fecha_inicio = now(),
           fecha_fin = fin,
           renovacion_cancelada = true,
           mercadopago_preapproval_id = null,
           mercadopago_payment_id = null,
           precio = case when p_periodicidad = 'anual' then 199.99 else 19.99 end,
           moneda = 'USD',
           metodo_pago = 'saldo_billetera',
           estado_pago = 'aprobado',
           fecha_pago = now(),
           actualizado_en = now()
     where id = m.id
     returning * into m;
  else
    insert into public.membresias (
      usuario_id, plan, periodicidad, estado, fecha_inicio, fecha_fin,
      renovacion_cancelada, mercadopago_preapproval_id, mercadopago_payment_id,
      precio, moneda, metodo_pago, estado_pago, fecha_pago
    ) values (
      p_usuario_id, 'bidluxury_member', p_periodicidad, 'activa', now(), fin,
      true, null, null, precio, 'USD', 'saldo_billetera', 'aprobado', now()
    )
    returning * into m;
  end if;

  insert into public.movimientos (
    usuario_id, tipo, monto, saldo_despues, referencia, descripcion
  ) values (
    p_usuario_id,
    'pago_membresia',
    -precio,
    coalesce(u.saldo_disponible, 0) - precio,
    'membresia:' || m.id,
    format('Compra de membresía BidLuxury Member (%s)', p_periodicidad)
  );

  return m;
end;
$$;

-- Reserva la única fila de membresía antes de crear la preferencia de Checkout
-- Pro. El bloqueo evita que dos clics simultáneos creen dos compras externas
-- para el mismo usuario; la activación sigue dependiendo del pago aprobado.
create or replace function public.preparar_membresia_mercadopago(
  p_usuario_id uuid,
  p_periodicidad text
)
returns public.membresias
language plpgsql
set search_path = public
as $$
declare
  m public.membresias%rowtype;
  precio_plan numeric(14, 2);
begin
  if p_periodicidad not in ('mensual', 'anual') then
    raise exception 'PERIODICIDAD_INVALIDA';
  end if;

  precio_plan := case when p_periodicidad = 'anual' then 199.99 else 19.99 end;

  perform 1 from public.usuarios where id = p_usuario_id for update;
  if not found then
    raise exception 'USUARIO_NO_EXISTE';
  end if;

  select * into m
    from public.membresias
   where usuario_id = p_usuario_id
   for update;

  if found and m.estado = 'activa' and m.fecha_fin is not null and m.fecha_fin > now() then
    raise exception 'MEMBRESIA_YA_ACTIVA';
  end if;

  if found and m.estado = 'pendiente'
     and coalesce(m.estado_pago, '') not in ('rechazado', 'cancelado') then
    raise exception 'MEMBRESIA_COMPRA_PENDIENTE';
  end if;

  if found then
    update public.membresias
       set plan = 'bidluxury_member',
           periodicidad = p_periodicidad,
           estado = 'pendiente',
           fecha_inicio = null,
           fecha_fin = null,
           renovacion_cancelada = true,
           mercadopago_preapproval_id = null,
           mercadopago_payment_id = null,
           precio = precio_plan,
           moneda = 'USD',
           metodo_pago = 'mercadopago',
           estado_pago = 'pendiente',
           fecha_pago = null,
           actualizado_en = now()
     where id = m.id
     returning * into m;
  else
    insert into public.membresias (
      usuario_id, plan, periodicidad, estado, fecha_inicio, fecha_fin,
      renovacion_cancelada, precio, moneda, metodo_pago, estado_pago, fecha_pago
    ) values (
      p_usuario_id, 'bidluxury_member', p_periodicidad, 'pendiente', null, null,
      true, precio_plan, 'USD', 'mercadopago', 'pendiente', null
    )
    returning * into m;
  end if;

  return m;
end;
$$;

-- Checkout Pro no aumenta el saldo: después de verificar el pago en la API de
-- Mercado Pago, el backend llama esta función para activar la fila pendiente.
-- El bloqueo y la comprobación del payment_id hacen que confirmar dos veces el
-- mismo pago sea inocuo y que nunca se active una membresía de otra cuenta.
create or replace function public.activar_membresia_mercadopago(
  p_usuario_id uuid,
  p_membresia_id uuid,
  p_payment_id text
)
returns public.membresias
language plpgsql
set search_path = public
as $$
declare
  m public.membresias%rowtype;
  fin timestamptz;
begin
  if p_payment_id is null or btrim(p_payment_id) = '' then
    raise exception 'PAGO_MEMBRESIA_INVALIDO';
  end if;

  -- Bloquear primero al usuario mantiene el mismo orden que la compra con
  -- saldo y evita carreras entre dos intentos de activación.
  perform 1 from public.usuarios where id = p_usuario_id for update;
  if not found then
    raise exception 'USUARIO_NO_EXISTE';
  end if;

  select * into m
    from public.membresias
   where id = p_membresia_id and usuario_id = p_usuario_id
   for update;
  if not found then
    raise exception 'MEMBRESIA_NO_EXISTE';
  end if;

  if m.estado = 'activa' and m.mercadopago_payment_id = p_payment_id then
    return m;
  end if;
  if m.estado = 'activa' then
    raise exception 'MEMBRESIA_YA_ACTIVA';
  end if;
  if m.estado <> 'pendiente' then
    raise exception 'MEMBRESIA_PAGO_NO_PENDIENTE';
  end if;
  if exists (
    select 1 from public.membresias
     where mercadopago_payment_id = p_payment_id and id <> p_membresia_id
  ) then
    raise exception 'PAGO_MEMBRESIA_DUPLICADO';
  end if;

  fin := case
    when m.periodicidad = 'anual' then now() + interval '1 year'
    else now() + interval '1 month'
  end;

  update public.membresias
     set estado = 'activa',
         fecha_inicio = now(),
         fecha_fin = fin,
         renovacion_cancelada = true,
         mercadopago_preapproval_id = null,
         mercadopago_payment_id = p_payment_id,
         precio = case when m.periodicidad = 'anual' then 199.99 else 19.99 end,
         moneda = 'USD',
         metodo_pago = 'mercadopago',
         estado_pago = 'aprobado',
         fecha_pago = now(),
         actualizado_en = now()
   where id = p_membresia_id
   returning * into m;

  return m;
end;
$$;

revoke execute on function public.activar_membresia_mercadopago(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.activar_membresia_mercadopago(uuid, uuid, text) to service_role;

revoke execute on function public.comprar_membresia_con_saldo(uuid, text) from public, anon, authenticated;
grant execute on function public.comprar_membresia_con_saldo(uuid, text) to service_role;

revoke execute on function public.preparar_membresia_mercadopago(uuid, text) from public, anon, authenticated;
grant execute on function public.preparar_membresia_mercadopago(uuid, text) to service_role;

notify pgrst, 'reload schema';
