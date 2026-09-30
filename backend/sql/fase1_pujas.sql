-- ─────────────────────────────────────────────────────────────
-- BidHouse — Fase 1: pujas
--
-- Se corre UNA vez en Supabase: panel → SQL Editor → pegar → Run.
-- El backend no puede crear columnas ni funciones por la API, por eso va aquí.
-- Es seguro correrlo de nuevo: usa "if not exists" / "or replace".
-- ─────────────────────────────────────────────────────────────


-- 1) Modo de la publicación ───────────────────────────────────
-- permite_pujas = true  → subasta (o mixta, si además tiene precio_compra_inmediata)
-- permite_pujas = false → precio fijo (entonces precio_compra_inmediata es obligatorio)

-- Las subastas que ya existían son subastas "puras".
update public.subastas set permite_pujas = true where permite_pujas is null;

alter table public.subastas alter column permite_pujas set default true;
alter table public.subastas alter column permite_pujas set not null;

-- Una publicación sin pujas y sin precio no se podría comprar de ninguna forma.
alter table public.subastas drop constraint if exists subastas_modo_valido;
alter table public.subastas add constraint subastas_modo_valido
  check (permite_pujas or precio_compra_inmediata is not null);

alter table public.subastas drop constraint if exists subastas_compra_inmediata_positiva;
alter table public.subastas add constraint subastas_compra_inmediata_positiva
  check (precio_compra_inmediata is null or precio_compra_inmediata > 0);


-- 2) Función pujar() ──────────────────────────────────────────
-- Valida la puja y la guarda en UN SOLO paso atómico.
--
-- ¿Por qué aquí y no en Java? Si el backend hiciera "leer la oferta actual" y
-- después "guardar la puja" con dos llamadas HTTP, dos personas que pujan en el
-- mismo instante leerían la misma oferta ($10.000), las dos pasarían la
-- validación y las dos quedarían como "ganando".
-- Dentro de la función, "select ... for update" BLOQUEA la fila de la subasta
-- hasta que la función termina: la segunda puja espera en esa línea y, cuando
-- sigue, ya ve la oferta nueva y se valida contra ella.
--
-- Errores: se lanzan con un código en MAYÚSCULAS (ej. MONTO_INSUFICIENTE) que
-- el backend traduce a un mensaje en español (ServicioSubasta).
create or replace function public.pujar(
  p_subasta_id uuid,
  p_pujador_id uuid,
  p_monto numeric
)
returns public.pujas
language plpgsql
set search_path = public
as $$
declare
  s public.subastas%rowtype;
  minimo numeric;
  nueva public.pujas%rowtype;
begin
  if p_monto is null or p_monto <= 0 then
    raise exception 'MONTO_INVALIDO';
  end if;

  select * into s from public.subastas where id = p_subasta_id for update;

  if not found then
    raise exception 'SUBASTA_NO_EXISTE';
  end if;
  if not s.permite_pujas then
    raise exception 'NO_PERMITE_PUJAS';
  end if;
  if s.estado <> 'activa' or s.esta_activa is not true then
    raise exception 'SUBASTA_NO_ACTIVA';
  end if;
  if now() < s.fecha_inicio then
    raise exception 'SUBASTA_NO_INICIADA';
  end if;
  if now() >= s.fecha_fin then
    raise exception 'SUBASTA_CERRADA';
  end if;
  if s.vendedor_id = p_pujador_id then
    raise exception 'PUJA_PROPIA';
  end if;
  if s.pujador_lider_id = p_pujador_id then
    raise exception 'YA_VAS_GANANDO';
  end if;

  -- Primera puja: al menos el precio base.
  -- Siguientes: la oferta actual + el incremento mínimo (mínimo 1, para que
  -- con incremento 0 no se pueda "empatar" la oferta que va ganando).
  -- La misma regla está en ServicioSubasta.pujaMinima(): si cambias una, cambia la otra.
  if s.pujador_lider_id is null then
    minimo := s.precio_base;
  else
    minimo := s.oferta_actual_mas_alta + greatest(coalesce(s.incremento_minimo, 0), 1);
  end if;

  if p_monto < minimo then
    raise exception 'MONTO_INSUFICIENTE' using detail = minimo::text;
  end if;

  insert into public.pujas (subasta_id, pujador_id, monto)
  values (p_subasta_id, p_pujador_id, p_monto)
  returning * into nueva;

  -- OJO: en la BD ya existía un trigger (de antes de esta función) que, al
  -- insertar una puja MAYOR a la oferta actual, también actualiza la oferta,
  -- el líder y suma +1 a total_pujas. Por eso aquí no se "suma 1": se cuentan
  -- las pujas reales. Así el número es correcto exista o no ese trigger.
  update public.subastas
     set oferta_actual_mas_alta = p_monto,
         pujador_lider_id = p_pujador_id,
         total_pujas = (select count(*) from public.pujas where subasta_id = p_subasta_id),
         actualizado_en = now()
   where id = p_subasta_id;

  return nueva;
end;
$$;

-- IMPORTANTE (seguridad): Supabase deja que CUALQUIERA con la llave pública
-- llame las funciones del esquema public por /rest/v1/rpc. Como pujar() recibe
-- el id del pujador como parámetro, alguien podría pujar a nombre de otro.
-- Por eso solo la puede ejecutar la service_role, es decir, nuestro backend,
-- que saca el id del token verificado.
revoke execute on function public.pujar(uuid, uuid, numeric) from public, anon, authenticated;
grant execute on function public.pujar(uuid, uuid, numeric) to service_role;

-- 3) Corrige los contadores que quedaron inflados antes del arreglo de arriba
-- (pujas mayores a la oferta contaban doble). Recalcula todos desde las pujas
-- reales; correrlo de nuevo no cambia nada.
update public.subastas s
   set total_pujas = (select count(*) from public.pujas p where p.subasta_id = s.id)
 where total_pujas is distinct from (select count(*) from public.pujas p where p.subasta_id = s.id);

-- Que PostgREST vea la función nueva sin esperar.
notify pgrst, 'reload schema';
