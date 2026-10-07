-- ─────────────────────────────────────────────────────────────
-- BidHouse — Fase 5: preferencias de categorías por usuario
--
-- Ejecutar una vez en Supabase → SQL Editor → Run.
-- Es seguro volver a ejecutarlo.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.usuario_preferencias (
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  categoria_id uuid not null references public.categorias(id) on delete cascade,
  creado_en timestamptz not null default now(),
  primary key (usuario_id, categoria_id)
);

create index if not exists usuario_preferencias_categoria_idx
  on public.usuario_preferencias(categoria_id);

-- El backend usa service_role, pero dejar RLS activado evita que una futura
-- exposición accidental de la tabla permita leer preferencias de otros usuarios.
alter table public.usuario_preferencias enable row level security;

create or replace function public.reemplazar_preferencias(
  p_usuario_id uuid,
  p_categoria_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ids uuid[] := coalesce(p_categoria_ids, '{}'::uuid[]);
  resultado jsonb;
begin
  if not exists (select 1 from public.usuarios where id = p_usuario_id) then
    raise exception using errcode = 'P0001', message = 'USUARIO_NO_EXISTE';
  end if;

  if exists (
    select 1
    from unnest(ids) seleccionada(id)
    left join public.categorias c on c.id = seleccionada.id
    where c.id is null or c.activo is distinct from true
  ) then
    raise exception using errcode = 'P0001', message = 'CATEGORIA_INVALIDA';
  end if;

  delete from public.usuario_preferencias where usuario_id = p_usuario_id;

  insert into public.usuario_preferencias(usuario_id, categoria_id)
  select p_usuario_id, id
  from unnest(ids) seleccionada(id)
  on conflict (usuario_id, categoria_id) do nothing;

  select jsonb_build_object(
    'categoriaIds', coalesce(jsonb_agg(categoria_id order by categoria_id), '[]'::jsonb)
  )
  into resultado
  from public.usuario_preferencias
  where usuario_id = p_usuario_id;

  return resultado;
end;
$$;

revoke all on function public.reemplazar_preferencias(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.reemplazar_preferencias(uuid, uuid[]) to service_role;

notify pgrst, 'reload schema';
