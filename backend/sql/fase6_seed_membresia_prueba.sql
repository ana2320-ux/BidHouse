-- BidLuxury — membresía activa de prueba (solo desarrollo)
-- Reemplaza el correo entre comillas por el correo de un usuario REAL de
-- public.usuarios antes de ejecutar. No incluye ningún bypass en la app.
-- La membresía se considera activa solo durante los próximos 30 días.

insert into public.membresias (
  usuario_id, plan, periodicidad, estado, fecha_inicio, fecha_fin,
  renovacion_cancelada, actualizado_en
)
select
  u.id,
  'bidluxury_member',
  'mensual',
  'activa',
  now(),
  now() + interval '30 days',
  false,
  now()
from public.usuarios u
where lower(u.email) = lower('REEMPLAZA_CON_EL_CORREO_DE_PRUEBA')
on conflict (usuario_id) do update set
  plan = excluded.plan,
  periodicidad = excluded.periodicidad,
  estado = excluded.estado,
  fecha_inicio = excluded.fecha_inicio,
  fecha_fin = excluded.fecha_fin,
  renovacion_cancelada = false,
  actualizado_en = now();

notify pgrst, 'reload schema';
