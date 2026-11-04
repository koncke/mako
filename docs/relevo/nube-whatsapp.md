# Relevo — WhatsApp sin ban (nube, 4/11/2026)

Lo escribió una sesión en la nube (cuenta `nube`), sin base ni claves de producción. El hallazgo completo, con la tabla de cada envío y
qué dice Meta vs. folclore: [docs/hallazgos-comunicacion.md](../hallazgos-comunicacion.md) → «Para que no nos vuelvan a banear».

## Lo pedido

Martín, textual: «Ya nos desbanearon la cuenta de whatsapp, implementa medidas para que no nos baneen, por ejemplo, en el onboarding,
en lugar de nosotros enviarle un codigo de seguridad, pedirles que ellos nos envien un mensaje primero y ahí enviarles su codigo... O algo
así, revisa todo.»

## Lo hecho (rama `punta/wa-escribe-primero`, encima de `origin/main` 5aaf3d69)

- El onboarding (chat de arranque, `/api/onboarding`, prueba de Automations): la persona le escribe a MaKo por `wa.me`; el webhook confirma
  su número. MaKo no le manda nada.
- 2FA: el código por WhatsApp no puede prenderse (`canalDisponible`).
- Reglas en `lib/mako-salida-reglas.ts`; freno en `lib/linea-freno.ts`, enchufado en `evFetch`, en el `ev` de `lib/mako-grupo.ts`, en la
  salida del bot y en el motor de los clientes.
- Tests: `tests/whatsapp-anti-ban.test.ts` (24, probado rompiéndolo). Ajustados a la regla nueva (la invitación por DM ya no sale a quien
  nunca escribió, aunque lo automático esté prendido): `tests/altas-en-grupos.test.ts`, `tests/agencia-grupos.test.ts`,
  `tests/agencia-grupos-auto.test.ts`. Los que copiaban una línea, pasados a lo que cuidan: `tests/mako-bot.test.ts`,
  `tests/seguridad-tokens-linea-ssrf.test.ts`, `tests/onboarding-whatsapp-primero.test.ts`. `tests/_respuesta-equipo-hijo.ts` espera 30 ms
  a que salga el 👍 (sale sin esperar, y el freno lo corre un poco).
- Medido acá: el tsc entero en verde, y los 846 tests afectados. ⚠️ Con Node 22 (el de la nube) ~40 archivos dan rojo también en `main`;
  con Node 24 (el de Actions), verdes.

## Sin migración

No hizo falta ninguna: el estado vive en `app_settings` (`mako.contacto.verificacion` por negocio, `linea.freno.<instancia>` y los topes en el
workspace de la plataforma).

## Lo que NO se pudo probar con WhatsApp de verdad (lo tiene que mirar alguien con la línea)

1. **Que el mensaje del `wa.me` llegue al webhook por la voz (`mako_ws9`) con el número de quien lo manda.** Si llega como `@lid` sin
   `remoteJidAlt` ni `senderPn`, no se confirma. Probar en el ws 3: onboarding → dar el número → «Abrir WhatsApp» → mandar → la app sigue
   sola en ~4 s. Si no sigue: el log del webhook dice `verificación por WhatsApp en <línea>: <resultado>`.
2. **Que Martín vea esos mensajes en su WhatsApp personal** (la voz es su número) y le parezca bien. Si no, la voz a una línea propia.
3. **Qué devuelve Evolution 2.3.7 para un 463 y para un «rate-overlimit» al MANDAR.** La señal se busca en el cuerpo entero. Si llega con
   otra forma, la línea no frena: mirar el log `[linea-freno]`.
4. **Que el mail del freno llegue** (`avisarPorEmail`, remitente de MaKo). Probado sólo con Resend de mentira.
5. **El link `wa.me` en iPhone y Android** con el texto con tilde («código»): se codifica con `encodeURIComponent`.

## Lo que espera una decisión de Martín

- Exigir que una persona le haya escrito a la línea antes de sumarla a un grupo desde Notificaciones (hoy sigue andando con tope).
- Aplicar «sin links en el primer mensaje» y «el mismo texto a muchos» a las líneas de los CLIENTES, con aviso en el editor: hoy no, porque
  les cambiaría la prospección y las difusiones.
- Los números (10 altas por día, 5 chats con el mismo texto, 30 min / 6 h / 24 h de freno) son nuestros: Meta no publica topes.

## Lo que no se tocó, a propósito

`mako.grupos.automatico`, la voz de línea y el corte de los grupos: son de Martín.
