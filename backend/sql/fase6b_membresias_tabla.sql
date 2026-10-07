-- BidLuxury — Fase 6b: completar la tabla de membresías
-- Ejecutar si fase6_membresias.sql alcanzó a crear es_premium pero la tabla
-- membresias todavía no existe. Es idempotente y no borra datos.

create table if not exists public.membresias (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null unique references public.usuarios(id) on delete cascade,
  plan text not null check (plan = 'bidluxury_member'),
  periodicidad text not null check (periodicidad in ('mensual', 'anual')),
  estado text not null check (estado in ('pendiente', 'activa', 'cancelada', 'vencida')),
  fecha_inicio timestamptz,
  fecha_fin timestamptz,
  renovacion_cancelada boolean not null default false,
  mercadopago_preapproval_id text unique,
  mercadopago_payment_id text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index if not exists membresias_activas_por_usuario
  on public.membresias (usuario_id, estado, fecha_fin);

alter table public.membresias enable row level security;

drop policy if exists membresias_select_propia on public.membresias;
create policy membresias_select_propia
  on public.membresias
  for select
  to authenticated
  using (usuario_id = auth.uid());

notify pgrst, 'reload schema';
