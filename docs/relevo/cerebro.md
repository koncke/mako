# Relevo — Cerebro y «Cerebro › Integración»

<sub>Esta sección se PISA en cada relevo y no pasa de ~60 líneas. Lo viejo, tal cual se escribió, está en
`docs/relevo/cerebro-historia.md` (ahí quedaron los relevos del 21/10 noche de las cuentas claude4 y claude3).</sub>

## ⏩ LEER PRIMERO — 23/10/2026 tarde, cuenta claude2

**El Cerebro son dos chats:** **«Cerebro»** reparte y habla con Martín; **«Cerebro › Integración»** es el ÚNICO que integra
y arma el tren, y le pasa el sha verificado al Cerebro, que sube `main`. Las puntas van a Integración; los pedidos y
preguntas, al Cerebro. Cómo se integra paso a paso: el relevo del 21/10 noche, en `cerebro-historia.md` (sigue vigente).

**Al iniciar una cuenta, en este orden (Martín lo pidió el 21/10 y el 23/10 se hizo dos veces, en claude1 y en claude2):**
1. **La cuenta:** la dice Martín al abrir, y si no cuadra con `~/.claude/cuenta-activa.txt` gana él y se reescribe en el
   acto. La prueba barata es el reset SEMANAL de `get_usage` (al 23/10: claude1 28/10 10:00 UTC, claude2 27/10 21:00,
   claude3 28/10 08:59, claude4 27/10 19:59). Guardar las dos ventanas en `uso-semanal.txt` y `uso-cinco.txt`.
2. **El chat donde escribe Martín se llama «Cerebro»** y se fija arriba. Conviene que sea un chat NUEVO: el 23/10 el
   Cerebro de claude1 era una sesión de agosto desarchivada y no tenía `start_session`; el de claude2, abierto ese día, sí.
3. **El Runner, antes que nada:** `start_session` con el título «Runner», Haiku con esfuerzo bajo y modo bypass. El prompt
   es `INSTRUCCIONES_RUNNER` (lib/runner.ts) más «hacé una vuelta ya». A los ~3 minutos
   `~/.claude/operaciones/uso/<cuenta>.json` ya tiene la cuenta medida. Después, `detach_session` del Runner: si queda
   colgado del Cerebro, cada vuelta de 2 minutos lo despierta.
4. **Archivar los chats viejos de la cuenta.** Las listas de chats y los grupos de la barra son POR CUENTA. Grupo «Cerebro»
   en orden alfabético, y la lista sin secciones por carpeta.
5. **Integración y los jefes con trabajo se abren EN EL TURNO de Martín**, porque un turno automático no puede abrir chats.
   Se abren con lo que haya y lo verificado se manda después por mensaje. Van con los mismos nombres que en la otra cuenta,
   porque el Ops Center une los chats por nombre. ⚠️ `start_session` cambia «›» por «'» en el título: hay que renombrar en
   el acto con `set_session_title`. El techo es de 6 a 8 chats, según la RAM: el 23/10, con 11 chats, la PC bajó a
   0,86 GB y un push quedó 40 minutos colgado.
6. **El estado de cada chat de la otra cuenta se VERIFICA con git, no se copia de lo que dijo.** Va un lector Sonnet por
   chat sobre su cronología, con git (`merge-base --is-ancestor`): `C:/dev/cerebro-herramientas/workflow-relevo-chats-cuenta.js`.
   Las cronologías salen de `cola.cjs` y la lista de chats por cuenta de `listar.cjs`. El 23/10 tardó 4 min con 10 lectores
   y encontró una punta que el tren no tenía, otra que ya estaba en main y un relevo apuntando a un documento que no era.

**EL TREN (AGENTS.md, «Cómo se sube»):** cada chat pasa su punta «VERDE sin pushear». Integración mergea en
`C:/dev/wt-push-q` (merge, nunca rebase), corre los tests afectados, la batería del Ops Center sola y las guardas, y pasa el
sha. El Cerebro sube `main` con `--no-verify`, con el permiso permanente de Martín del 22/10 («que avance siempre»).
⚠️ **Sin minutos de Actions (vuelven el 1/11), subir `integracion` NO avanza `main`.** El 23/10 el arreglo de un cliente
quedó en `integracion` creyendo que Actions lo subía. Después de cada push, `git ls-remote origin refs/heads/main` y
`npx vercel ls -m githubCommitSha=<sha>` hasta que diga Ready. Los tipos son red: van después del push y con RAM.

**La ventana de 5 horas es de la CUENTA, no del chat.** Cuando se agota, se cortan TODOS los chats de la cuenta a la vez:
el 23/10, entre las 11:56 y las 12:02. Con la ventana arriba del 85 %, ni workflows ni tandas. Lo que está en el disco
se commitea o se deja escrito antes; a Planes lo cortó con trabajo sin commitear.

**Estado al escribir (23/10, ~13:00 ART, claude2):**
- `main` = `cd3827f44`, en producción (Vercel Ready a las 12:40): el ws13 vuelve a avisar de cada lead (era medio emoji).
- **Abiertos:** Cerebro, Runner, Cerebro › Integración, Automations (Opus), Planes, Cobros y Landings (Sonnet).
- **En el tren de Integración:** Cobros `ac21e6b4b`, Planes `75e10a6ee` (trae bf60e15ef y cfcf01abd), Ops Center
  `8e11ec65b`, Ventas `0c28ccf39`, Landings `web-diag-2310`, Offer `a5360e43c` y Chats de las tabs `256f46e07`.
  Automations `701bba4a2` entra cuando re-corra el arnés.
- **NO van todavía:** CRM `crm-b5-2310` @ `60bd69812` (después del 25/10: 2 rojos y 23 hallazgos; lleva adentro el port
  `5badeda1a`) e IA16 `ia16-2210` @ `9cd361a5e` (retenida hasta el lunes 26/10: apaga la IA de ws1, ws3, ws21, ws22 y ws4).
- ⚠️ **El `main` LOCAL del clon compartido** (`136ef8baa`) lleva `72abfb92c` y `d1dc59049`, viejos de Ventas, que chocan
  con `0c28ccf39`. Ese main no se empuja nunca.
- **Sin abrir**, porque su punta va en el tren o no tienen trabajo antes del lanzamiento (se reabren desde su relevo):
  Ventas, Offer, Ops Center, Chats de las tabs, CRM e IA del cliente.
- **Sin commitear, que no se toca:** `C:/dev/wt-planes-sp` (Calendly con `--ws`), `C:/dev/wt-aut-au2b` (AU2, punto 2) y
  el arnés del chat de MaKo (en `wt-aut-chat2`, `wt-aut-ui` y `wt-aut-arnes`; fuera de main).

**Espera a Martín, por lo que más duele:**
1. El QR del WhatsApp de MaKo en `/whatsapp?ws=9`. Está muerto desde el 19/10 y sin él no sale ningún aviso a los grupos.
2. Calendly en `/integraciones?ws=9`: el token de koncke y el nombre del evento de R1. Además, si su Calendly es pago,
   porque el webhook lo pide.
3. La pasarela en `/integraciones?ws=9` y, con la tanda de Cobros en producción, la prueba de humo de
   `docs/prueba-humo-cobro-mako.md`. Si cobra en pesos, el precio en «Planes en Mercado Pago».
4. La base de venta: su WhatsApp personal en el ws9, «Traer de un grupo de WhatsApp» y activar #568 y #569.
5. Partners: cumplir o dejar de prometer «se descuenta de tus próximos meses».

**Fechas:** el lanzamiento es el DOMINGO 25/10 (el 24 es sábado y la campaña de Mauricio arranca ese día; el 26 es lunes).
Varios chats escribieron «sábado 25».
