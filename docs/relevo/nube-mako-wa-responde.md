# Relevo — MaKo SIEMPRE responde en WhatsApp (nube, 10/11/2026)

Chat: «Ops Center» en la nube (`cli_b4bb6cd6-f68b-5162-ae59-96d6e5078bd4`). Rama `claude/wizardly-faraday-dpqw18`, subida a
`punta/mako-wa-responde`. El aprendizaje, en `docs/hallazgos-comunicacion.md` → «MaKo se callaba con la línea frenada».

## Lo pedido

Martín, 10/11/2026 21:08 ART, al Cerebro desde el teléfono, textual: *«Mako en WhatsApp no responde... SIEMPRE debe responder, haz
un relevo de eso para que no ocurra más»*. No salió: la PC estaba dormida desde las 08:56. Me lo pasó con «Solucionalo».

## Lo que NO pude

Medir producción: la nube no tiene la base ni Evolution. **No sé cuál de las causas fue esta vez.** Lo arreglado sale de leer el
código; lo que hay que medir lo dice el diagnóstico de abajo.

## Lo hecho

- **La respuesta sale aunque WhatsApp haya frenado la línea.** El freno del 4/11 frenaba toda escritura: un 403 de UN chat dejaba a
  MaKo mudo 6 horas en todos los grupos (un 463, 24). Ahora la respuesta al grupo donde alguien acaba de escribir (texto, archivo,
  audio, 👍, «escribiendo…») pasa; avisos, flujos, altas, invitaciones y otros grupos siguen frenados.
- **El tope del mismo texto no frena una respuesta** (el mismo cartel a seis grupos en una hora dejaba al sexto sin contestar).
- **Lo que WhatsApp no toma abre un ticket** con el motivo («la línea estaba frenada», «el servidor de WhatsApp no contestó»), en vez
  de guardarse como dicho. Lo que no salió por ningún lado tampoco se guarda: el vigía lo cuenta como silencio.
- **`scripts/diagnostico-mako-whatsapp.mts`**: mira las seis causas en una corrida, sólo lee.
- **Una señal más grave durante el freno lo sube** (un 463 durante un freno de 30 min pasa a 24 h y manda el mail).
- Tests: `tests/mako-responde-siempre.test.ts` (12, catorce roturas, cada una cae; un renombre lo deja verde).
- **La revisión independiente** (antes de subir) encontró 3 cosas medias y 5 chicas; las arreglé todas menos las anotadas abajo. La más
  importante: con una sola marca, un aviso de un flujo que el turno disparaba hacia el mismo grupo también pasaba el freno.

## Lo que tiene que correr el Cerebro (en la PC)

1. **El diagnóstico, ahora** (dice cuál fue la causa de hoy):

   ```bash
   NODE_OPTIONS=--conditions=react-server npx tsx scripts/diagnostico-mako-whatsapp.mts --horas 24
   ```

   Si dice que la línea está **caída o sorda**, la arregla Martín escaneando el QR en /whatsapp (es su teléfono: va en su chat, en
   palabras de producto). Después de reconectar, lo que trae la sincronización NO lo contesta MaKo: hay que leer los grupos y contestar
   lo que quedó a mano (hallazgo del 9/11).
2. **El despliegue:** es un cliente roto (MaKo no contesta). Con la punta en verde y en main, `desplegar-ya` en vez de esperar al cron
   de las 08:05.
3. **El vigía de los grupos:** `npx vercel env ls | grep VIGIA_GRUPOS`. Si no está en `on`, un silencio no levanta ticket. Prenderlo
   en `seco` primero y después en `on` (así lo pide su ruta).

## Lo que falta (en orden)

1. **La alarma de la línea SORDA** (la causa que más se repitió: 9/11, y el «pareció» del 10/11). Diseño en el hallazgo: si el eco de
   lo que MaKo manda a un grupo llega al webhook con la línea sana, «MaKo mandó 2 o más a grupos en 30 min y no entró NINGÚN evento por
   esa línea» es sordera sin falsos positivos de noche. Hay que medir el eco antes, con la línea de verdad: lo hace el chat de WhatsApp
   en la PC.
2. Frenar sólo el chat que dio 403, no la línea entera (hace falta saber qué devuelve Evolution en cada caso; no medido).
3. Lo que la revisión dejó y no se tocó: los carteles de audio y archivo y «Se me cortó…» no pasan por `siNoLlego`; una respuesta que
   salió a medias se guarda entera; la pendiente que propuso una respuesta perdida sigue viva; el «listo» de un pedido delegado, que
   sale fuera del turno, sigue frenado.

## Autocrítica

- **Cambié:** la excepción del freno es sólo para el MISMO grupo y sólo para mandar (no sumar gente, no invitar), y sólo para grupos:
  un chat 1 a 1 no la tiene (el bot está apagado y lo mira la ventana de 24 h).
- **Cambié, por la revisión:** de una marca a dos. Con la del turno sola, todo lo que el turno disparaba hacia ese grupo pasaba (un
  aviso de un flujo, un `after()`); ahora sólo lo que sale por las puertas de la respuesta. Y el turno de la app también abre el turno:
  comparte la cola con WhatsApp y a veces contesta allá.
- **Cambié:** el motivo del ticket se reescribe para que el filtro de ruido no lo tire: «Evolution 503» o un «timeout» se descartaban
  como ruido de la IA, y son justo los casos en que MaKo quedó mudo. Lo cazó el test, no una lectura.
- **Cambié:** lo que no salió por ningún lado ya no se guarda como dicho: el turno siguiente creía que lo había dicho.
- **Descarté:** construir la alarma de la línea sorda a ciegas. Sin medir el eco, una regla de «horas sin mensajes» avisa de noche
  y se aprende a ignorar.
- **Descarté:** sacar el freno. Lo que provoca un ban (escribirle a desconocidos, el mismo texto a muchos) sigue frenado.
