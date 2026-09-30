-- ─────────────────────────────────────────────────────────────
-- BidHouse — Fase 4c: registro en blockchain (Sepolia)
--
-- Se corre UNA vez en Supabase: panel → SQL Editor → pegar → Run.
-- Requiere fase4b_entrega.sql. Es seguro correrlo de nuevo.
--
-- Cada hito de un contrato de garantía (pago, envío, liberación, cancelación,
-- disputa) se registra en el contrato RegistroBidHouse de la red Sepolia
-- (blockchain/contratos/RegistroBidHouse.sol). Aquí se guarda el hash de cada
-- transacción de la cadena, para mostrar "Ver en blockchain" en la web.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.hitos_blockchain (
  id uuid primary key default gen_random_uuid(),
  transaccion_id uuid not null references public.transacciones(id) on delete cascade,
  hito text not null check (hito in ('pago', 'envio', 'liberacion', 'cancelacion', 'disputa')),
  tx_hash text not null,                     -- hash de la transacción en Sepolia
  creado_en timestamptz not null default now(),
  -- Cada hito una sola vez por contrato: si el backend reintenta, no se duplica.
  unique (transaccion_id, hito)
);

-- Solo el backend (service_role) lee y escribe; la web lo recibe a través de la API.
alter table public.hitos_blockchain enable row level security;

notify pgrst, 'reload schema';
