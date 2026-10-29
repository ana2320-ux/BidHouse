-- ─────────────────────────────────────────────────────────────
-- BidHouse — Fase 8: comisión reducida para BidLuxury Member
--
-- Se corre UNA vez en Supabase: panel → SQL Editor → pegar → Run.
-- Requiere fase2_cierre.sql y fase6b_membresias_tabla.sql. Es seguro
-- correrlo de nuevo.
--
-- Un vendedor con membresía activa paga 0,5 % por venta en vez de 1 %. La
-- tasa se fija al crear el contrato: si la membresía vence después, ese
-- contrato conserva la comisión con la que nació.
-- ─────────────────────────────────────────────────────────────


-- 1) Comisión según el vendedor ───────────────────────────────
-- "Activa" con la misma regla que comprar_membresia_con_saldo()
-- (fase6c): estado 'activa' y fecha_fin en el futuro. Una renovación
-- cancelada sigue activa hasta su fecha_fin.
create or replace function public.comision_plataforma(p_monto numeric, p_vendedor uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select round(p_monto * case
           when exists (select 1
                          from public.membresias m
                         where m.usuario_id = p_vendedor
                           and m.estado = 'activa'
                           and m.fecha_fin is not null
                           and m.fecha_fin > now())
           then 0.005
           else 0.01
         end, 2);
$$;

-- Dice si alguien tiene membresía: no se expone por /rest/v1/rpc.
revoke execute on function public.comision_plataforma(numeric, uuid) from public, anon, authenticated;


-- 2) Aplicarla en cada contrato nuevo ─────────────────────────
-- cerrar_subastas_vencidas() y comprar_ahora() siguen llamando la versión de
-- un argumento (1 %). En vez de reescribir las dos, este trigger corrige la
-- comisión al insertar, así cualquier camino que cree un contrato la respeta.
create or replace function public.aplicar_comision_vendedor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.comision_plataforma := public.comision_plataforma(new.monto, new.vendedor_id);
  return new;
end;
$$;

drop trigger if exists transacciones_comision_vendedor on public.transacciones;
create trigger transacciones_comision_vendedor
  before insert on public.transacciones
  for each row execute function public.aplicar_comision_vendedor();
