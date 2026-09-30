-- ─────────────────────────────────────────────────────────────
-- BidHouse — Fase 3: comprar ahora ("Precio fijo" y "Cómpralo ya")
--
-- Se corre UNA vez en Supabase: panel → SQL Editor → pegar → Run.
-- Requiere fase1_pujas.sql y fase2_cierre.sql. Es seguro correrlo de nuevo.
--
-- Al comprar, la publicación pasa a 'vendida' (valor que ya acepta el CHECK
-- de subastas.estado) y se crea el mismo contrato de garantía que al ganar una
-- subasta: transaccion 'pendiente' con 48 h para pagar. Desde ahí los tres
-- modos de venta siguen igual (fase 4: pagos).
-- ─────────────────────────────────────────────────────────────

-- Compra inmediata en UN SOLO paso atómico, igual que pujar().
-- "for update" bloquea la publicación: si dos personas le dan "Comprar" al
-- mismo tiempo, la segunda espera, luego ve que ya está 'vendida' y recibe
-- YA_VENDIDA. Así nunca se vende dos veces.
create or replace function public.comprar_ahora(
  p_subasta_id uuid,
  p_comprador_id uuid
)
returns public.transacciones
language plpgsql
set search_path = public
as $$
declare
  s public.subastas%rowtype;
  contrato public.transacciones%rowtype;
begin
  select * into s from public.subastas where id = p_subasta_id for update;

  if not found then
    raise exception 'SUBASTA_NO_EXISTE';
  end if;
  if s.precio_compra_inmediata is null then
    raise exception 'SIN_COMPRA_INMEDIATA';      -- subasta pura: solo se puja
  end if;
  if s.estado = 'vendida' then
    raise exception 'YA_VENDIDA';
  end if;
  if s.estado <> 'activa' or s.esta_activa is not true or now() < s.fecha_inicio then
    raise exception 'SUBASTA_NO_ACTIVA';
  end if;
  if now() >= s.fecha_fin then
    raise exception 'SUBASTA_CERRADA';
  end if;
  if s.vendedor_id = p_comprador_id then
    raise exception 'COMPRA_PROPIA';
  end if;
  -- Modo mixto: "Cómpralo ya" desaparece con la primera puja, para que nadie
  -- se salte a quien ya está pujando. (En precio fijo no hay pujas.)
  if exists (select 1 from public.pujas where subasta_id = p_subasta_id) then
    raise exception 'YA_HAY_PUJAS';
  end if;

  -- pujador_lider_id = el comprador: es quien se queda con el activo, así el
  -- detalle le muestra "lo compraste" igual que al ganador de una subasta.
  update public.subastas
     set estado = 'vendida',
         pujador_lider_id = p_comprador_id,
         oferta_actual_mas_alta = s.precio_compra_inmediata,
         actualizado_en = now()
   where id = p_subasta_id;

  -- Mismo contrato que al ganar una subasta (fase2_cierre.sql), sin puja ganadora.
  -- Comisión: la misma función que el cierre (fase2_cierre.sql).
  insert into public.transacciones
    (subasta_id, comprador_id, vendedor_id, monto, comision_plataforma, estado, fecha_limite_pago)
  values
    (s.id, p_comprador_id, s.vendedor_id, s.precio_compra_inmediata,
     public.comision_plataforma(s.precio_compra_inmediata), 'pendiente', now() + interval '48 hours')
  returning * into contrato;

  insert into public.notificaciones (usuario_id, tipo, titulo, mensaje, datos)
  values
    (p_comprador_id, 'compra_realizada', '¡Compra realizada!',
     format('Compraste "%s" por %s USD. Tienes 48 horas para pagar.', s.titulo, s.precio_compra_inmediata),
     json_build_object('subasta_id', s.id, 'transaccion_id', contrato.id)),
    (s.vendedor_id, 'subasta_vendida', '¡Vendiste tu activo!',
     format('"%s" se vendió por %s USD. Esperando el pago del comprador.', s.titulo, s.precio_compra_inmediata),
     json_build_object('subasta_id', s.id, 'transaccion_id', contrato.id));

  return contrato;
end;
$$;

-- Igual que pujar(): recibe el id del comprador, así que solo la puede
-- ejecutar el backend (service_role), que lo saca del token verificado.
revoke execute on function public.comprar_ahora(uuid, uuid) from public, anon, authenticated;
grant execute on function public.comprar_ahora(uuid, uuid) to service_role;

notify pgrst, 'reload schema';
