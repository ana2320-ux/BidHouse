-- ─────────────────────────────────────────────────────────────
-- BidHouse — Fase 4b: envío, recepción y liberación del pago
--
-- Se corre UNA vez en Supabase: panel → SQL Editor → pegar → Run.
-- Requiere fase4_pagos.sql. Es seguro correrlo de nuevo.
--
-- El contrato de garantía después del pago:
--   en_custodia ──(vendedor: "enviado" + guía)──► enviado
--   enviado ──(comprador: "lo recibí", o pasan 7 días)──► completada
--             y el vendedor recibe monto − comisión como SALDO
--   enviado / en_custodia ──(comprador: "tengo un problema")──► en_disputa
-- Plazos que vencen solos (procesar_vencimientos_contratos, cada minuto):
--   pendiente   + 48 h sin pagar  → cancelada
--   en_custodia + 5 días sin enviar → cancelada y el pago vuelve al comprador
--   enviado     + 7 días sin responder → se da por recibido y se libera
-- ─────────────────────────────────────────────────────────────


-- 1) liberar_contrato() — interna ─────────────────────────────
-- Pasa el contrato a 'completada' y le acredita al vendedor el monto menos la
-- comisión. La usan confirmar_recepcion() y los vencimientos; el backend no
-- la llama directo (no se le da permiso a nadie).
create or replace function public.liberar_contrato(p_transaccion_id uuid)
returns public.transacciones
language plpgsql
set search_path = public
as $$
declare
  t public.transacciones%rowtype;
  v public.usuarios%rowtype;
  neto numeric;
  titulo text;
begin
  select * into t from public.transacciones where id = p_transaccion_id for update;
  if t.estado = 'completada' then
    return t;                                   -- ya liberado: no pagar dos veces
  end if;

  neto := t.monto - coalesce(t.comision_plataforma, 0);
  select s.titulo into titulo from public.subastas s where s.id = t.subasta_id;
  select * into v from public.usuarios where id = t.vendedor_id for update;

  update public.usuarios
     set saldo_disponible = coalesce(saldo_disponible, 0) + neto
   where id = t.vendedor_id;

  insert into public.movimientos (usuario_id, tipo, monto, saldo_despues, transaccion_id, descripcion)
  values (t.vendedor_id, 'venta_liberada', neto, coalesce(v.saldo_disponible, 0) + neto, t.id,
          format('Venta de "%s" (menos %s USD de comisión)', titulo, coalesce(t.comision_plataforma, 0)));

  update public.transacciones
     set estado = 'completada', liberado_en = now(), actualizado_en = now()
   where id = t.id
  returning * into t;

  insert into public.notificaciones (usuario_id, tipo, titulo, mensaje, datos)
  values (t.vendedor_id, 'pago_liberado', '¡Pago liberado!',
          format('Se sumaron %s USD a tu saldo por la venta de "%s".', neto, titulo),
          json_build_object('subasta_id', t.subasta_id, 'transaccion_id', t.id));

  return t;
end;
$$;


-- 2) marcar_enviado() — el vendedor ──────────────────────────
create or replace function public.marcar_enviado(
  p_transaccion_id uuid,
  p_vendedor_id uuid,
  p_guia text
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
  if t.vendedor_id <> p_vendedor_id then
    raise exception 'NO_ES_TU_VENTA';
  end if;
  if t.estado = 'pendiente' then
    raise exception 'CONTRATO_NO_PAGADO';        -- no se envía nada sin el dinero en custodia
  end if;
  if t.estado <> 'en_custodia' then
    raise exception 'CONTRATO_CERRADO';
  end if;

  select s.titulo into titulo from public.subastas s where s.id = t.subasta_id;

  update public.transacciones
     set estado = 'enviado', enviado_en = now(), guia_envio = p_guia,
         fecha_limite_confirmacion = now() + interval '7 days', actualizado_en = now()
   where id = t.id
  returning * into t;

  insert into public.notificaciones (usuario_id, tipo, titulo, mensaje, datos)
  values (t.comprador_id, 'activo_enviado', 'Tu compra va en camino',
          format('El vendedor envió "%s" (%s). Confirma cuando te llegue.', titulo, p_guia),
          json_build_object('subasta_id', t.subasta_id, 'transaccion_id', t.id));

  return t;
end;
$$;


-- 3) confirmar_recepcion() — el comprador ────────────────────
-- Es lo que libera el dinero: por eso solo el comprador puede hacerlo.
create or replace function public.confirmar_recepcion(
  p_transaccion_id uuid,
  p_comprador_id uuid
)
returns public.transacciones
language plpgsql
set search_path = public
as $$
declare
  t public.transacciones%rowtype;
begin
  select * into t from public.transacciones where id = p_transaccion_id for update;
  if not found then
    raise exception 'CONTRATO_NO_EXISTE';
  end if;
  if t.comprador_id <> p_comprador_id then
    raise exception 'NO_ES_TU_CONTRATO';
  end if;
  if t.estado = 'pendiente' then
    raise exception 'CONTRATO_NO_PAGADO';
  end if;
  -- También desde en_custodia: si el activo llegó sin que el vendedor marcara
  -- el envío, el comprador igual puede darlo por recibido.
  if t.estado not in ('en_custodia', 'enviado') then
    raise exception 'CONTRATO_CERRADO';
  end if;

  update public.transacciones set estado = 'recibido', actualizado_en = now() where id = t.id;
  return public.liberar_contrato(t.id);
end;
$$;


-- 4) reportar_problema() — el comprador ──────────────────────
-- Congela el contrato: el dinero sigue en custodia y ya no se libera solo.
-- ponytail: no hay todavía quién resuelva la disputa (un admin que reembolse
-- o libere). Por ahora queda registrada en "notas" y avisada al vendedor.
create or replace function public.reportar_problema(
  p_transaccion_id uuid,
  p_comprador_id uuid,
  p_motivo text
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
  if t.comprador_id <> p_comprador_id then
    raise exception 'NO_ES_TU_CONTRATO';
  end if;
  if t.estado = 'pendiente' then
    raise exception 'CONTRATO_NO_PAGADO';
  end if;
  if t.estado not in ('en_custodia', 'enviado') then
    raise exception 'CONTRATO_CERRADO';
  end if;

  select s.titulo into titulo from public.subastas s where s.id = t.subasta_id;

  update public.transacciones
     set estado = 'en_disputa', notas = p_motivo, actualizado_en = now()
   where id = t.id
  returning * into t;

  insert into public.notificaciones (usuario_id, tipo, titulo, mensaje, datos)
  values (t.vendedor_id, 'disputa_abierta', 'El comprador reportó un problema',
          format('Sobre "%s": %s. El pago queda retenido mientras se revisa.', titulo, p_motivo),
          json_build_object('subasta_id', t.subasta_id, 'transaccion_id', t.id));

  return t;
end;
$$;


-- 5) procesar_vencimientos_contratos() — cada minuto ─────────
-- La llama el backend junto con el cierre de subastas (CierreSubastas.java).
-- "skip locked": igual que el cierre, aguanta varios backends a la vez.
create or replace function public.procesar_vencimientos_contratos()
returns json
language plpgsql
set search_path = public
as $$
declare
  t public.transacciones%rowtype;
  c public.usuarios%rowtype;
  titulo text;
  cancelados int := 0;
  reembolsados int := 0;
  liberados int := 0;
begin
  -- a) No pagó en 48 h → se cancela.
  -- ponytail: la decisión era ofrecerle el activo al segundo postor; por
  -- ahora solo se cancela y se avisa a los dos.
  for t in
    select * from public.transacciones
     where estado = 'pendiente' and fecha_limite_pago < now()
     for update skip locked
  loop
    select s.titulo into titulo from public.subastas s where s.id = t.subasta_id;
    update public.transacciones
       set estado = 'cancelada', notas = 'El comprador no pagó dentro de las 48 horas.', actualizado_en = now()
     where id = t.id;
    insert into public.notificaciones (usuario_id, tipo, titulo, mensaje, datos)
    values
      (t.comprador_id, 'contrato_cancelado', 'Se venció el plazo de pago',
       format('No pagaste "%s" dentro de las 48 horas y el contrato se canceló.', titulo),
       json_build_object('subasta_id', t.subasta_id, 'transaccion_id', t.id)),
      (t.vendedor_id, 'contrato_cancelado', 'El comprador no pagó',
       format('El contrato de "%s" se canceló porque el comprador no pagó a tiempo.', titulo),
       json_build_object('subasta_id', t.subasta_id, 'transaccion_id', t.id));
    cancelados := cancelados + 1;
  end loop;

  -- b) Pagó pero el vendedor no envió en 5 días → se le devuelve el dinero al
  -- comprador como saldo de BidHouse (sea cual sea el medio con el que pagó).
  -- ponytail: si pagó con Mercado Pago, lo ideal es reembolsar a su tarjeta
  -- con la API de reembolsos (POST /v1/payments/{id}/refunds).
  for t in
    select * from public.transacciones
     where estado = 'en_custodia' and fecha_limite_envio < now()
     for update skip locked
  loop
    select s.titulo into titulo from public.subastas s where s.id = t.subasta_id;
    select * into c from public.usuarios where id = t.comprador_id for update;
    update public.usuarios set saldo_disponible = coalesce(saldo_disponible, 0) + t.monto where id = t.comprador_id;
    insert into public.movimientos (usuario_id, tipo, monto, saldo_despues, transaccion_id, descripcion)
    values (t.comprador_id, 'reembolso', t.monto, coalesce(c.saldo_disponible, 0) + t.monto, t.id,
            format('Reembolso de "%s": el vendedor no lo envió a tiempo', titulo));
    update public.transacciones
       set estado = 'cancelada', notas = 'El vendedor no envió dentro de los 5 días; se reembolsó al comprador.',
           actualizado_en = now()
     where id = t.id;
    insert into public.notificaciones (usuario_id, tipo, titulo, mensaje, datos)
    values
      (t.comprador_id, 'reembolso', 'Te devolvimos tu dinero',
       format('El vendedor no envió "%s" a tiempo. Se sumaron %s USD a tu saldo.', titulo, t.monto),
       json_build_object('subasta_id', t.subasta_id, 'transaccion_id', t.id)),
      (t.vendedor_id, 'contrato_cancelado', 'Se canceló tu venta',
       format('No enviaste "%s" dentro de los 5 días y el pago se devolvió al comprador.', titulo),
       json_build_object('subasta_id', t.subasta_id, 'transaccion_id', t.id));
    reembolsados := reembolsados + 1;
  end loop;

  -- c) Enviado y el comprador no respondió en 7 días → se da por recibido.
  for t in
    select * from public.transacciones
     where estado = 'enviado' and fecha_limite_confirmacion < now()
     for update skip locked
  loop
    update public.transacciones set estado = 'recibido', actualizado_en = now() where id = t.id;
    perform public.liberar_contrato(t.id);
    liberados := liberados + 1;
  end loop;

  return json_build_object('cancelados', cancelados, 'reembolsados', reembolsados, 'liberados', liberados);
end;
$$;


-- Permisos: solo el backend (service_role). liberar_contrato() también se le
-- da, aunque el backend nunca la llama directo: Postgres revisa el permiso de
-- CADA función con el rol que hizo la llamada, así que sin esto
-- confirmar_recepcion() fallaría al llamarla por dentro.
revoke execute on function public.liberar_contrato(uuid) from public, anon, authenticated;
grant execute on function public.liberar_contrato(uuid) to service_role;
revoke execute on function public.marcar_enviado(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.confirmar_recepcion(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.reportar_problema(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.procesar_vencimientos_contratos() from public, anon, authenticated;
grant execute on function public.marcar_enviado(uuid, uuid, text) to service_role;
grant execute on function public.confirmar_recepcion(uuid, uuid) to service_role;
grant execute on function public.reportar_problema(uuid, uuid, text) to service_role;
grant execute on function public.procesar_vencimientos_contratos() to service_role;

notify pgrst, 'reload schema';
