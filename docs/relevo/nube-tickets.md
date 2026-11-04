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

- **Tickets sin cuenta** (por WhatsApp sin perfil, el alumno de un curso): no tienen dónde guardar «no me escribas». Si hace falta,
  se necesita una tabla de bajas por email (una migración).
- **Los automáticos** (lo que MaKo abre solo): no mandan correo. MaKo ya se lo dijo en el chat.
- **Una casilla en Notificaciones** para prenderlos y apagarlos: hoy se hace desde el link del correo, que también los vuelve a prender.

## Tickets

Ninguno todavía. Los #50, #51, #52 y #53 los ve otro agente: no se tocan hasta que el Cerebro los pase.
