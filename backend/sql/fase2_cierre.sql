-- ─────────────────────────────────────────────────────────────
-- BidHouse — Fase 2: cierre de subastas
--
-- Se corre UNA vez en Supabase: panel → SQL Editor → pegar → Run.
-- Requiere haber corrido antes fase1_pujas.sql. Es seguro correrlo de nuevo.
--
-- Estados que usa (respetan los CHECK que ya existen en la BD):
--   subastas.estado:      'activa' → 'finalizada' (con o sin ganador; se sabe
--                         cuál por pujador_lider_id). 'vendida' queda para
--                         "Cómpralo ya" (fase 3).
--   transacciones.estado: 'pendiente' (esperando el pago del ganador).
-- ─────────────────────────────────────────────────────────────


-- 0) Comisión de BidHouse ─────────────────────────────────────
-- Un solo lugar para la tasa: la usan el cierre de subastas (aquí) y la
-- compra inmediata (fase3_compra.sql). 1 % por venta.
-- ponytail: BidHouse Plus (suscripción) la baja a 0,5 %; cuando exista,
-- recibir el vendedor y devolver 0.005 si está suscrito.
create or replace function public.comision_plataforma(p_monto numeric)
returns numeric
language sql
immutable
as $$
  select round(p_monto * 0.01, 2);
$$;

-- Los contratos que aún no se liberaron pasan a la comisión nueva. Los ya
-- completados se dejan como están: ese dinero ya se le pagó al vendedor.
update public.transacciones
   set comision_plataforma = public.comision_plataforma(monto)
 where estado in ('pendiente', 'en_custodia', 'enviado', 'recibido', 'en_disputa')
   and comision_plataforma is distinct from public.comision_plataforma(monto);


-- 1) Plazo para pagar ─────────────────────────────────────────
-- El ganador tiene 48 h (decisión del equipo). Qué pasa si no paga se
-- implementa con los pagos (fase 4).
alter table public.transacciones add column if not exists fecha_limite_pago timestamptz;


-- 2) Función cerrar_subastas_vencidas() ──────────────────────
-- La llama el backend cada minuto (Servicios/CierreSubastas.java). Por cada
-- subasta activa cuya fecha_fin ya pasó, en UNA sola transacción:
--   · sin pujas → la marca finalizada y le avisa al vendedor;
--   · con pujas → la marca finalizada, marca la puja ganadora, crea el
--     contrato de garantía (transaccion 'pendiente') con la comisión (1 %)
--     y el plazo de pago, y avisa al ganador, al vendedor y a los que perdieron.
--
-- "for update skip locked": toma cada subasta con candado; si otra instancia
-- del backend (o una puja en curso) la tiene tomada, la salta y la cierra en
-- la siguiente vuelta. Así, aunque corran varios backends a la vez (cada
-- integrante del equipo tiene el suyo), ninguna subasta se cierra dos veces.
create or replace function public.cerrar_subastas_vencidas()
returns json
language plpgsql
set search_path = public
as $$
declare
  s public.subastas%rowtype;
  ganadora public.pujas%rowtype;
  cerradas int := 0;
  con_ganador int := 0;
begin
  for s in
    select * from public.subastas
     where estado = 'activa' and fecha_fin <= now()
     order by fecha_fin
     for update skip locked
  loop
    update public.subastas
       set estado = 'finalizada', actualizado_en = now()
     where id = s.id;
    cerradas := cerradas + 1;

    -- Sin pujas (o precio fijo que nadie compró): nada que adjudicar.
    if s.pujador_lider_id is null then
      insert into public.notificaciones (usuario_id, tipo, titulo, mensaje, datos)
      values (s.vendedor_id, 'subasta_desierta', 'Tu publicación terminó sin compradores',
              format('"%s" cerró sin ofertas. Puedes volver a publicarla.', s.titulo),
              json_build_object('subasta_id', s.id));
      continue;
    end if;

    -- La puja ganadora es la más alta del líder (la última que hizo).
    select * into ganadora
      from public.pujas
     where subasta_id = s.id and pujador_id = s.pujador_lider_id
     order by monto desc, creado_en desc
     limit 1;

    update public.pujas set es_ganadora = true where id = ganadora.id;

    -- Contrato de garantía, con la comisión de comision_plataforma() (arriba).
    insert into public.transacciones
      (subasta_id, comprador_id, vendedor_id, puja_ganadora_id, monto,
       comision_plataforma, estado, fecha_limite_pago)
    values
      (s.id, s.pujador_lider_id, s.vendedor_id, ganadora.id, s.oferta_actual_mas_alta,
       public.comision_plataforma(s.oferta_actual_mas_alta), 'pendiente', now() + interval '48 hours');
    con_ganador := con_ganador + 1;

    insert into public.notificaciones (usuario_id, tipo, titulo, mensaje, datos)
    values
      (s.pujador_lider_id, 'subasta_ganada', '¡Ganaste la subasta!',
       format('Ganaste "%s" con %s USD. Tienes 48 horas para pagar.', s.titulo, s.oferta_actual_mas_alta),
       json_build_object('subasta_id', s.id)),
      (s.vendedor_id, 'subasta_vendida', 'Tu subasta tiene ganador',
       format('"%s" cerró en %s USD. Esperando el pago del comprador.', s.titulo, s.oferta_actual_mas_alta),
       json_build_object('subasta_id', s.id));

    -- A cada persona que pujó y no ganó, un solo aviso aunque haya pujado varias veces.
    -- (El distinct va en la subconsulta y solo sobre el id: Postgres no sabe
    -- comparar valores json, así que un distinct sobre la fila completa falla.)
    insert into public.notificaciones (usuario_id, tipo, titulo, mensaje, datos)
    select p.pujador_id, 'subasta_perdida', 'La subasta terminó',
           format('"%s" cerró en %s USD. Esta vez no ganaste.', s.titulo, s.oferta_actual_mas_alta),
           json_build_object('subasta_id', s.id)
      from (select distinct pujador_id
              from public.pujas
             where subasta_id = s.id and pujador_id <> s.pujador_lider_id) p;
  end loop;

  return json_build_object('cerradas', cerradas, 'con_ganador', con_ganador);
end;
$$;

-- Igual que pujar(): solo la puede ejecutar el backend (service_role).
revoke execute on function public.cerrar_subastas_vencidas() from public, anon, authenticated;
grant execute on function public.cerrar_subastas_vencidas() to service_role;

notify pgrst, 'reload schema';
