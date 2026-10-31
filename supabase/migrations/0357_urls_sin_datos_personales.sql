-- =============================================================================
-- 0357 — sacar de las URLs ya guardadas los datos personales en claro (P6)
-- =============================================================================
-- ORDEN DE DESPLIEGUE: va DESPUÉS del deploy, o junto con él. No agrega ni saca ninguna columna y nada del
-- código la lee, así que no hay versión desplegada que se rompa; lo que sí importa es que el corte de la
-- ENTRADA (la lista blanca de lib/url-datos-personales.ts) ya esté arriba, o la próxima visita vuelve a
-- escribir lo que esto limpia.
--
-- EL SÍNTOMA. `vsl_events.landing_url` guarda la URL con la que entró el visitante, y esa URL llega con los
-- datos de la persona en claro en el query string: la página de gracias de una agenda redirige a
-- `…/gracias?name=Ana+Pérez&email=ana@…`, y Cal.com a `…/?attendeeName=…&email=…&uid=…`. O sea nombres y
-- correos de los leads de un cliente guardados en claro en una columna de ANALÍTICA, que no es donde viven
-- los datos de una persona, que se lee desde pantallas de analítica y que se exporta.
--
-- MEDIDO EL 30/10/2026 (sólo lectura, contra producción), y es exactamente lo que esta migración toca:
--   · vsl_events.landing_url ....... 487 filas · 2 workspaces · 2026-08-21 12:34 → 2026-10-24 15:21 UTC
--   · landing_visits.landing_url ... 112 filas · 2 workspaces · 2026-08-21 12:31 → 2026-10-24 15:21 UTC
--   · landing_visits.referrer .......  66 filas · 2 workspaces · 2026-08-21 12:36 → 2026-10-24 11:43 UTC
--   · replay_sesiones.landing_url ...   0 filas (la columna existe y guarda lo mismo: se limpia igual, por
--     si entró algo entre la medición y la aplicación)
-- Los dos workspaces son el 13 (Código Inmobiliario, 449 + 106 + 65 filas, 79 visitantes distintos) y el 14
-- (P2P Consulting, 38 + 6 + 1, 3 visitantes). Parámetros en claro: `email` y `name` en los dos, más el paquete
-- de Cal.com en el 14 (`attendeeName`, `user`, `uid`, `title`, `description`, `location`, `eventTypeSlug`,
-- `metadata[lead_id]`, `rescheduledBy`, …). El último evento afectado es del 24/10, que es el día en que se
-- desplegó el primer corte de la entrada: desde entonces no entró ni una fila con `name=` o `email=`.
--
-- QUÉ HACE, Y QUÉ NO. SÓLO reescribe esas tres columnas (`update … set <columna> = …`). No borra una sola
-- fila, no toca ninguna otra columna y no cambia el esquema: el evento se conserva entero —qué pasó, cuándo,
-- de qué página y de qué visitante— y lo único que se va es el dato de la persona.
--
-- LAS DOS LISTAS, Y POR QUÉ SON DOS (es la parte que se lee mal):
--   · QUÉ FILAS SE TOCAN lo decide una lista NEGRA de nombres (`$$…nombre|name|mail|attendee…$$` de abajo) más
--     «la URL contiene un email». Para esto una lista negra está bien: si se queda corta, se limpian MENOS
--     filas, y el peor caso es tener que correr otra migración.
--   · QUÉ SOBREVIVE ADENTRO de esas filas lo decide la lista BLANCA `parametros_que_se_guardan`, que es la
--     MISMA de `PARAMS_QUE_SE_GUARDAN` en lib/url-datos-personales.ts (lo fija
--     tests/url-de-entrada-lista-blanca.test.ts: si las dos listas se separan, el test falla). Acá una lista
--     negra sería fatal: dejaría pasar el parámetro que nadie nombró, que es justo el caso que se midió
--     (`attendeeName` seguía entrando con el corte del 24/10 ya desplegado).
--
-- ⚠️ NO SE LIMPIA LA TABLA ENTERA, A PROPÓSITO. Aplicar la lista blanca a las 109.706 filas con valor de
--    `vsl_events` les sacaría también `ai`, `ct`, `__lovable_sha` y cualquier parámetro propio del cliente, y
--    eso cambia la llave con la que `lib/editor-landing` y los gráficos cruzan eventos con páginas. Se toca lo
--    que tiene datos de una persona y nada más: una fila sin datos personales vuelve BYTE POR BYTE igual.
--    Medido: de las 665 filas afectadas, NINGUNA trae un parámetro de la lista blanca, así que todas quedan
--    como su dirección sin query — no se pierde ni un utm ni un fbclid.
--
-- ⚠️ Y SI QUEDA ALGO, LA MIGRACIÓN FALLA EN VEZ DE DECIR QUE TERMINÓ. El bloque final vuelve a preguntar por
--    los datos personales y tira una excepción si encuentra una sola fila. Un archivo `.sql` se aplica en una
--    sola transacción implícita, así que eso revierte todo: nadie queda con la migración «aplicada» y los
--    datos adentro. El caso que podría dispararlo es un dato personal en el `#…` sin forma de query (medido:
--    0 filas lo tienen).
--
-- Lo que costó y lo que quedó abierto: docs/hallazgos-landing.md → «Los datos personales en claro».
-- =============================================================================

do $$
declare
  -- La lista BLANCA: lo único que sobrevive de la query. Igual a PARAMS_QUE_SE_GUARDAN (lib/url-datos-personales.ts).
  parametros_que_se_guardan text[] := array[
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id',
    'fbclid', 'gclid', 'gbraid', 'wbraid', 'dclid', 'gad_source', 'gad_campaignid',
    'msclkid', 'ttclid', 'twclid', 'li_fat_id', 'igshid', 'yclid', 'rdt_cid', 'epik', 'scid', 'mc_cid',
    'v', 'variante', 'variant', 'ab', 'ab_test', 'exp', 'experimento', 'prueba_ab',
    'vsl', 'vsl_id', 'video', 'video_id', 'vid',
    'mko_test'
  ];
  -- El SELECTOR (lista negra): ¿esta fila trae el dato de una persona? Por el nombre de algún parámetro…
  re_nombres text := '(^|[?&#])[^=&#]*(nombre|name|apellido|mail|correo|telefon|phone|celular|movil|whats|wpp|documento|dni|cuit|cuil|cedula|cpf|cnpj|curp|rfc|ssn|direccion|address|invitee|attendee)[^=&#]*=';
  -- … o porque en algún lado hay un email (también codificado una o dos veces: `%40`, `%2540`).
  re_email text := '[a-z0-9._%+-]+(@|%40|%2540)[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}';
  objetivo record;
  tocadas integer;
  quedan integer;
  sql_limpiar text;
begin
  for objetivo in
    select * from (values
      ('vsl_events', 'landing_url'),
      ('landing_visits', 'landing_url'),
      ('landing_visits', 'referrer'),
      ('replay_sesiones', 'landing_url')
    ) as t(tabla, columna)
  loop
    -- La columna puede no existir todavía en una base que viene de más atrás: se saltea diciéndolo.
    if not exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = objetivo.tabla and column_name = objetivo.columna
    ) then
      raise notice '0357: %.% no existe, se saltea', objetivo.tabla, objetivo.columna;
      continue;
    end if;

    -- La limpieza, en SQL y sin crear ninguna función:
    --   base = todo lo de antes del primer `?` (o del `#` si viene antes)
    --   q    = la query, partida por `&`, con sólo los pares cuyo NOMBRE está en la lista blanca
    --   cola = el `#…` tal cual, salvo que traiga datos de una persona: ahí se va entero
    sql_limpiar := format($f$
      with partido as (
        select ctid as fila,
               %1$I as antes,
               split_part(%1$I, '#', 1) as sin_hash,
               substring(%1$I from '#.*$') as cola
          from public.%2$I
         where %1$I is not null
           and (%1$I ~* $1 or %1$I ~* $2)
      ),
      armado as (
        select p.fila,
               p.antes,
               split_part(p.sin_hash, '?', 1)
                 || coalesce('?' || (
                      select string_agg(par, '&' order by ord)
                        from unnest(string_to_array(substring(p.sin_hash from '\?(.*)$'), '&'))
                             with ordinality as t(par, ord)
                       where lower(regexp_replace(split_part(par, '=', 1), '[-[:space:]]', '_', 'g'))
                             = any($3)
                    ), '')
                 || case when p.cola is null then ''
                         when p.cola ~* $1 or p.cola ~* $2 then ''
                         else p.cola end
                 as despues
          from partido p
      )
      update public.%2$I x
         set %1$I = a.despues
        from armado a
       where x.ctid = a.fila
         and x.%1$I is distinct from a.despues
    $f$, objetivo.columna, objetivo.tabla);

    execute sql_limpiar using re_nombres, re_email, parametros_que_se_guardan;
    get diagnostics tocadas = row_count;

    execute format('select count(*)::int from public.%1$I where %2$I ~* $1 or %2$I ~* $2', objetivo.tabla, objetivo.columna)
       into quedan using re_nombres, re_email;

    raise notice '0357: %.% → % filas limpiadas, % con datos personales todavía', objetivo.tabla, objetivo.columna, tocadas, quedan;

    if quedan > 0 then
      raise exception '0357: %.% quedó con % filas con datos personales; no se da por hecha una limpieza a medias',
        objetivo.tabla, objetivo.columna, quedan;
    end if;
  end loop;
end $$;
