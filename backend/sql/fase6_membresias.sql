-- BidLuxury — Fase 6: membresías y subastas premium
-- Ejecutar después de las fases anteriores en Supabase SQL Editor.
-- No borra datos existentes; las subastas actuales son normales por defecto.

alter table public.subastas
  add column if not exists es_premium boolean not null default false;

create index if not exists subastas_premium_activas
  on public.subastas (es_premium, estado, esta_activa);

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

-- El backend usa service_role y el webhook valida la firma de Mercado Pago.
-- Si alguna vez el navegador consulta Supabase directamente, solo podrá leer
-- su propia fila; no se habilitan INSERT/UPDATE/DELETE para usuarios.
drop policy if exists membresias_select_propia on public.membresias;
create policy membresias_select_propia
  on public.membresias
  for select
  to authenticated
  using (usuario_id = auth.uid());

-- La carga de subastas premium de prueba vive en fase6_seed_premium.sql para
-- poder repetirse después de cargar nuevos datos sin volver a tocar el DDL.

notify pgrst, 'reload schema';
