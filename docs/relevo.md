# El relevo entre cuentas

<sub>**Este documento se PISA en cada relevo.** Siempre describe el último traspaso; las
versiones anteriores viven en el historial (`git log -p -- docs/relevo.md`).</sub>

**Relevo del 2026-10-14, 15:20 hora AR: la cuenta 2 (claude2) cierra al 98% semanal.**
Lo escribió el chat orquestador («Estrategia 3 cuentas»), que integró y pusheó todo lo del 13 y el
14/10. Martín pidió: «Pausa todo y guarda contexto para la próxima cuenta… Solo pushea esto último y
luego pausa todo de todos los chats».

> ⚠️ Material de primera mano sobre los pushes; de **segunda mano** sobre el código de cada chat (sale
> de lo que cada chat reportó). Verificá antes de actuar.

---

## Los tres comandos del primer minuto

1. `cat docs/relevo/estrategia-3-cuentas.md`: **cómo se pushea hoy** (un solo push por vez desde un
   worktree, merge y nunca rebase, el vigía de RAM, heap de 5120, «no esperes RAM»), y lo pendiente.
2. `git status` y `git log --oneline origin/main..main`: en el main LOCAL del clon hay commits de
   docs **sin pushear** (el merge de los docs del CRM, `5fd7efd91`, y este relevo). Salen con el
   próximo push; no cambian producción.
3. `docs/relevo/<área>.md` del chat que vayas a continuar (tabla de abajo).

**Estado al cerrar:** `origin/main` = `ab2641963`, deploy de producción **Ready**. Los chats que
corrían (CRM y Landing Generator) quedaron **pausados** por el orquestador; ninguno estaba pusheando.

---

## Dónde quedó cada chat

| Chat | En producción | A medias (NO pushear sin su dueño) | Briefing |
|---|---|---|---|
| **CRM** | tanda A (reproductor de la grabación, etiquetas con «+N», «A revisar» por lead, clic derecho, MaKo al costado) | tanda B, la ficha por bloques: ramas `crm-bloques-b1..b5` (`C:/Users/marti/wtc-b1..b5`, 9-13 commits cada una). Tiene 2 commits WIP y Pagos 2 fallas altas de la revisión | `docs/relevo/crm.md`, `docs/relevo/crm-tanda-b1.md`, `docs/diseno-ficha-bloques.md` (las 7 decisiones de Martín) |
| **Landing Generator** | tandas 3-5 (hola-mako.site, botón de pago por la pasarela, VSL en los diseños, API) | tanda 6 en `landing-t6` (`C:/dev/wt-landing-t6`, +5 commits), pausada a mitad de un turno. Rojo en main: `tests/integracion-sin-salir.test.ts` por `DialogoPublicar.tsx` y `CobroBoton.tsx` | `docs/relevo/landing-generator.md` |
| **General** | sexta vuelta (bloques mirados en captura, tema «General» en las plantillas) y el arreglo del Dashboard sin hojas | nada | `docs/relevo/general-y-calendario.md` |
| **Image Editor** | tandas 1 y 2 (editor tipo Canva en Content Machine › Image, sólo super admin) | `opcion-image-en-clientes`: espera la decisión de Martín | `docs/relevo/image-editor.md` |
| **Automations** | «nada por detrás» completo: las 3 migraciones corridas (la 3ª, 8 automatizaciones, verificada) | nada | `docs/relevo/chatbot.md` |

**Pedido de Martín sin chat que lo tome (14/10 14:34, textual):** «Dale este mismo feedback al
dashboard... Que rediseñe bloque por bloque y que tenga en cuenta mobile. Que vaya viendo con datos
ficticios o con algun dato de algun workspace que todo se vea bien en diseño. Tanto bloques como las
plantillas.» El método está en `docs/hallazgos-objectives.md` → «General, sexta vuelta».

**Ramas que NUNCA se pushean sin su dueño:** `wip/api-acciones-0910`, `wip/api-acciones-1410`
(«A MEDIAS»), `api-acciones-1310`, `opcion-image-en-clientes`, `crm-bloques-b1..b5`.
Sin trabajo nuevo sobre origin: `chats-1410`, `graphics-1310`, `graphics-bloques-1310`,
`pagos-pasarela`, `video-editor`, `chatbot-v6`, `mobile-mismas-rutas`. `pagos-automations` tiene 1
commit del 11/10 sin integrar.

---

## Lo que decide Martín

- Si la tab Image se ve también mirando la cuenta de un cliente (`opcion-image-en-clientes`).
- Si la barra de selección en lote del Ads Manager va oscura o clara.
- Que el vigía de RAM se levante solo si se cae (hoy sólo arranca al iniciar sesión).
- Confirmar el borrador de 50 tareas del Perro: https://hola-mako.com/plan/revisar/propmv7rwo1dkj2i6

## Lo que se aprendió hoy (ya escrito en el repo)

- `docs/hallazgos-infra.md`: mergear en el worktree de un push mientras corre su pre-push da errores
  falsos; un paquete suelto en `node_modules` y no declarado pasa el typecheck y tira el deploy
  (`qrcode`).
- `scripts/typecheck-lock.mjs` y `AGENTS.md`: el heap del typecheck pasó a 5120 MB (con el Image Editor
  no entraba en 4096).
- Un hito `tipo: 'prompt'` de `app/admin/dev/*/bitacora.ts` lleva `puntos` igual: frenó tres pushes.
