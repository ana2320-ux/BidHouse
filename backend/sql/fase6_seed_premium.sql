-- BidLuxury — datos de prueba para subastas premium
-- Ejecutar después de fase6_membresias.sql.
-- No crea copias: marca hasta tres subastas activas ya existentes. Prefiere
-- una de Arte, una de Vehículos y una de Joyería si esas categorías existen.

alter table public.subastas
  add column if not exists es_premium boolean not null default false;

with candidatas as (
  select distinct on (a.categoria_id)
         s.id,
         s.creado_en,
         case c.nombre
           when 'Arte y Antigüedades' then 1
           when 'Vehículos' then 2
           when 'Joyería y Relojes' then 3
           else 9
         end as prioridad
  from public.subastas s
  join public.activos a on a.id = s.activo_id
  join public.categorias c on c.id = a.categoria_id
  where s.esta_activa is true
    and s.estado = 'activa'
  order by a.categoria_id, s.creado_en desc nulls last
), seleccionadas as (
  select id
  from candidatas
  order by prioridad, creado_en desc nulls last
  limit 3
)
update public.subastas s
   set es_premium = true
 where s.id in (select id from seleccionadas);

notify pgrst, 'reload schema';
