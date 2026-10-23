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

**Estado al escribir (23/10, ~15:10 ART, claude2):**
- `main` = `3e8462653`, en producción. Dos trenes del día:
  - **309c54ef4:** Cobros (el primer cobro real), Planes (/planes sin pasarela, partner en la agenda, Calendly), Ops Center (fotos), Landings (Diagnóstico y carruseles), Offer (Ángulos), Chats de las tabs (grafo), el seguimiento detrás de «No contestó» y este relevo.
  - **3e8462653:** el anti-ban por automatización, con `misma-persona-propia.mts --aplicar` corrido (510 filas, el antes igual al después), la tarjeta de MaKo sin desplegables, el chat del costado, las 8 tarjetas de la revisión, la limpieza de automatizaciones (374 archivadas) y Ads Manager con la cuenta que lee. Martín verificó la #289.
- **Próximo tren** (Integración, sin apuro): Ads Manager `4ce368228` («Cuenta Cuenta 2») y Automations `e3253d518` (el null de FlujoLienzo:392).
- **Abiertos:** Cerebro, Runner, Integración, Automations, Automations › Limpieza, Planes, Cobros, Landings y Ads Manager. Martín pidió NO archivar ninguno todavía.
- **NO van todavía:** CRM `crm-b5-2310` @ `60bd69812` (después del 25/10) e IA16 `ia16-2210` @ `9cd361a5e` (lunes 26/10).
- **Ventas** `0c28ccf39` da rojo en `tests/crm-tarjeta-personalizable.test.ts`: queda una tarjeta para reabrir su chat (task_69fc20ed). ⚠️ El `main` LOCAL del clon compartido lleva `72abfb92c`/`d1dc59049` viejos de Ventas: no se empuja nunca.
- **Sábado 24:** Automations mide la primera hora de la campaña de Mauricio (#289, goteo de 5 min y que «Contestó» corte) y, cuando entre un lead nuevo del ws13 y avise, manda los dos mensajes a su grupo: el aviso de arreglo y los 10 leads sin aviso, nombres escritos por el código.
- **Mauricio, Ads Manager:** sus campañas de Sergio (ws20), Patricia (ws22) y Florencia (ws21) no existen en las cuentas conectadas: quedaron como borrador o se crearon en otra cuenta. Florencia no conectó Meta. Espera que él diga en qué cuenta las creó.
- **Decisiones del día que no se re-preguntan:** el «ya me llegó tu pago» de la #289 es a propósito (levantamuertos); una tarjeta no gana controles y cada canal es su tarjeta (AGENTS.md); la vista previa del link vive en Configuraciones porque la pidió Mauricio.

**Espera a Martín, por lo que más duele:**
1. El QR del WhatsApp de MaKo en `/whatsapp?ws=9`. Está muerto desde el 19/10: es la línea de venta del ws9. Los avisos a los grupos de los clientes salen por la «voz de MaKo», que está viva.
2. Calendly en `/integraciones?ws=9`: el token de koncke y el nombre del evento de R1. Además, si su Calendly es pago,
   porque el webhook lo pide.
3. La pasarela en `/integraciones?ws=9` y, con la tanda de Cobros en producción, la prueba de humo de
   `docs/prueba-humo-cobro-mako.md`. Si cobra en pesos, el precio en «Planes en Mercado Pago».
4. La base de venta: su WhatsApp personal en el ws9, «Traer de un grupo de WhatsApp» y activar #568 y #569.
5. Partners: cumplir o dejar de prometer «se descuenta de tus próximos meses».

**Fechas:** el lanzamiento es el DOMINGO 25/10 (el 24 es sábado y la campaña de Mauricio arranca ese día; el 26 es lunes).
Varios chats escribieron «sábado 25».
