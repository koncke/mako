# Relevo — Tickets en la nube (el chat permanente de tickets)

Lo escribe el chat de la nube que recibe cada ticket del Cerebro. Esta sesión no ve la base de producción: lo que hay que medir
allá queda acá, con la consulta exacta.

Martín, 4/11/2026: «Manda a un chat a solucionar todos los tickets siempre.» y «los emails de los tickets».

## Hecho

- **Los correos de avance** (pedido de Joan del 2/11): rama `punta/tickets-correo-avance`.
  - Un correo por cada hito (recibido, en curso, te necesitamos, resuelto), nunca dos iguales.
  - Cada correo trae la baja, y no le llega a quien la tocó.
  - Lo corre el cron de tickets, cada 15 minutos.
  - El detalle, en docs/hallazgos-ticketera.md → «El correo de avance».
  - No lleva hito `tickets: [n]`: el pedido no llegó como ticket.

## Para medir en producción (lo hace una sesión local)

0. **La 0410 (`correo_bajas`) YA ESTÁ APLICADA y verificada: 6/11/2026, desde la PC** (`leads` = 3.134, o sea el proyecto
   correcto; `NOTIFY pgrst` hecho). Verificado en la base: las cinco columnas, el `unique (email, tipo)` —que es lo que hace
   idempotente el upsert—, el `check` de minúsculas y el de `tipo`, los tres **probados insertando y revertido** (la tabla
   quedó en 0 filas); RLS prendida y `anon`/`authenticated` sin ningún grant. Y por el camino que usa la app, no por SQL:
   `GET /rest/v1/correo_bajas?tipo=eq.ticket-avance` da **200 y `[]`**, así que PostgREST ya la ve y el cron no se frena.
   ⚠️ Esto **tenía que ir primero**: sin la tabla, la vuelta del cron no manda NINGÚN correo de avance y lo dice en su
   renglón («falta la migración 0410»). Es a propósito —escribirle a quien pidió la baja es peor que un correo de menos—,
   pero significa que desplegar el código sin la migración apaga los correos de todos.

1. **Que la 0364 esté aplicada.** El commit dbc64bdd7 dice que sí. Si faltara, el cron lo escribe una vez: «falta la migración 0364».
   ```sql
   select column_name from information_schema.columns where table_name = 'tickets' and column_name in ('avance_email', 'avance_email_at');
   ```
2. **La primera vuelta después del deploy.** El registro del cron dice `correos de avance N (fallidos M)`. Si M > 0, cada ticket lo
   tiene anotado:
   ```sql
   select ticket_id, texto, at from ticket_eventos where texto like 'El correo de avance%' order by at desc limit 20;
   ```
3. **Que nadie reciba de más.** Por persona, en el día:
   ```sql
   select usuario_email, count(*) from tickets where avance_email_at > now() - interval '1 day' group by 1 order by 2 desc;
   ```

## Lo que quedó afuera, a propósito

- **Tickets sin cuenta** (por WhatsApp sin perfil, el alumno de un curso): **RESUELTO el 6/11** con la mig 0410
  (`correo_bajas`, la baja por DIRECCIÓN). ⚠️ Y de paso se vio que la mitad de este renglón era falsa: a quien no tiene cuenta
  nunca le salió un correo de avance (`decidirAvance` pide `usuario_id` y un email de verdad). Y el otro camino —quien tiene cuenta en DOS
  negocios con la misma dirección— está MEDIDO y no le pasaba a nadie: el 6/11 había 0 direcciones duplicadas en `usuarios`.
  O sea que la 0410 cerró el agujero ANTES de que pase, que para una baja de correo es el momento correcto, pero no hubo
  ninguna persona recibiendo correos que había pedido no recibir. El detalle, en
  docs/hallazgos-ticketera.md → «La baja de los correos estaba atada a una CUENTA».
- **Los automáticos** (lo que MaKo abre solo): no mandan correo. MaKo ya se lo dijo en el chat.
- **Una casilla en Notificaciones** para prenderlos y apagarlos: hoy se hace desde el link del correo, que también los vuelve a
  prender. **SIGUE PENDIENTE, con el motor ya hecho** (6/11): `cambiarBajaPorEmail` y `apagadosPorEmail`
  (lib/tickets-baja-correo.ts) hacen las dos capas; falta la ruta en `app/api/perfil/` y la fila con el `Switch` en
  `app/perfil/NotificacionesPanel.tsx`. ⚠️ Esa ruta resuelve a la persona por el EMAIL DE LA SESIÓN, no con `filaPropia`
  (lib/perfil.ts), que usa `.maybeSingle()` sobre el email y tira con dos cuentas de la misma dirección.

## Tickets

~~Los #50, #51, #52 y #53 los ve otro agente: no se tocan hasta que el Cerebro los pase.~~ **LOS CUATRO ESTÁN RESUELTOS**
(medido en producción el 6/11/2026): los cuatro quedaron en `resuelto` el 4/11 entre las 08:45 y las 08:46 UTC, con el hito del
deploy, el aviso al cliente y su correo de avance. Lo que entregó cada uno, del historial:

| # | Qué quedó |
|---|---|
| 50 | En Chats, quien comentó tu publicación ya no dice «Mensaje no compatible», y los audios se pueden acelerar |
| 51 | Con una imagen adjunta se puede grabar un audio, y el campo de Chats en el teléfono queda pegado al teclado |
| 52 | La pantalla Plan ya no se vuelve a dibujar sola de noche |
| 53 | Una mensualidad sin fecha de cierre ya no dice «Al día» en la ficha |

⚠️ No hay que confirmar con nadie quién los tiene: ya no los tiene nadie. Este renglón quedó dos días diciendo que no se
tocaran y es lo que hace que un chat los vuelva a tomar.

### #56 — Natalia (ws 19), «los leads de la campaña X con nombre y teléfono» · punta `punta/ticket-56`

1. **ARREGLADO.**
   - `buscar_leads` busca la campaña cuando ningún lead se llama como el texto.
   - `listar_leads` tiene `campana` y sus filas traen teléfono.
   - En WhatsApp la lista la escribe el código: teléfonos exactos y la lista entera.
   - Sin campaña que coincida, MaKo ofrece las que hay y no pide la fecha.
   - Ya no sale «pídemelo otra vez» debajo de una pregunta.
   - Detalle: docs/hallazgos-comunicacion.md → «Los leads de la campaña X».
2. **Para medir en producción (lo corre el Cerebro desde la PC).** Cómo guardan la campaña esos 113 leads. Si los tres conteos de id
   (`meta_campaign_id`, `utm_campaign`, `meta_ad_id`/`utm_content`) dan cero, la lista sale vacía igual y hay que mirar de dónde entran.
   ```sql
   select count(*) as total,
     count(*) filter (where meta_campaign_id is not null) as con_campaign_id,
     count(*) filter (where utm_campaign is not null) as con_utm_campaign,
     count(*) filter (where meta_ad_id is not null or utm_content is not null) as con_anuncio,
     count(*) filter (where meta_campaign_name is not null) as con_nombre
   from leads where workspace_id = 19;
   select utm_campaign, meta_campaign_name, count(*) from leads where workspace_id = 19 group by 1, 2 order by 3 desc limit 20;
   select campaign_id, campaign_name, count(*) from marketing_metrics_daily
   where workspace_id = 19 and plataforma = 'meta' and campaign_name ilike '%cortes%' group by 1, 2;
   ```
3. **La prueba después del deploy:** en el grupo del ws 19, «pásame los leads de la campaña recon Finca Cortesin con su teléfono».

### #54 — Leandro (ws 10), «Replicar y adaptar» en el Web Generator · punta `punta/ticket-54`

1. **Volver atrás perdía lo leído y lo conversado: ARREGLADO.**
   - Lo leído queda como borrador del negocio en cuanto se lee. «Sin terminar», en la lista de landings del editor, lo retoma.
   - Abrir otra vez la misma dirección también lo retoma, sin leer ni pagar IA.
   - La copia creada borra el borrador.
   - Detalle: docs/hallazgos-editor-landing.md → «Lo leído para replicar se perdía al volver».
2. **El defecto visual «de cómo se interactúa con el chat»: NO SE PUDO VER** (la captura no llega a la nube). Lo que tendría que
   mirar el Cerebro, con la captura del ticket y su `contexto.ruta`:
   - **Si es el editor** (`/web-generator/<id>`): en «Nueva landing» la tarjeta de la izquierda es la LISTA de landings, no el
     chat. Para hablar con MaKo está la criatura de arriba a la derecha de la lista, y tocarla cierra la réplica y vuelve a la
     landing abierta (`setPanelIzq('agente')`, EditorLanding.tsx). Ese cambio de pantalla es el candidato más probable del «bug
     visual». Ahora lo leído no se pierde, pero el salto sigue. Además el chat que se abre es el de la landing ABIERTA: sus
     herramientas editan ESA landing, no la página que se estaba adaptando. Arreglarlo es una decisión de diseño (¿un chat
     propio de la réplica?), no un parche.
   - **Si es el Panel suelto** (`/web-generator?panel=1`): no tiene chat. La estrella de MaKo no se monta porque
     `/web-generator` está en `CON_CHAT_A_LA_VISTA` (lib/estrella-rutas.ts), así que no hay con quién hablar.
   - **La pantalla de Leandro mide 1536×674**: mirar si algo del chat queda cortado o tapado con ese alto.
3. **Para medir en producción:** que la vuelta guarde. Después de una lectura,
   `select key, updated_at from app_settings where workspace_id = 10 and key like 'landing.replica_borrador:%';`
   tiene que dar una fila por página leída.
4. **Rojo que ya estaba en `main`** (no es de este cambio): `tests/editor-landing-presentaciones.test.ts`, «plantillas: español
   neutro (tú)…», importa `voseoEn` de `tests/puente-panel-copy.test.ts`, que ya no lo exporta.
