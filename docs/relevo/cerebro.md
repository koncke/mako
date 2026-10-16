# Relevo — Cerebro (el chat orquestador; antes «Estrategia 3 cuentas»)

<sub>Escrito por el Cerebro de la cuenta 3 el 16/10/2026 ~01:15 hora AR, con la ventana de 5 h al 97%.
Material de primera mano. Lo de antes del 15/10 está en `docs/relevo/estrategia-3-cuentas.md`.</sub>

## Qué es este chat

Martín tira ideas de todo tipo acá; el Cerebro las reparte al chat JEFE de cada tab (se llama como la tab:
Automations, CRM, Dashboard, Web Generator, Video Editor, Pagos, Onboarding, Infra, Strategy, MaKo Mobile,
Centro de Operaciones), junta las puntas y es el ÚNICO que sube. Decide con criterio; a la Ticketera sólo lo
100% necesario (precio, clientes, seguridad que no se deshace, gasto). Nunca una decisión en el chat.

## Cómo se sube hoy (probado 25 veces el 15-16/10)

1. Worktree de integración: `C:/dev/wt-push-q` (con junction de node_modules). Se suman las puntas con
   `git merge --no-edit <sha>`, nunca rebase. Conflictos de `docs/hallazgos.md`: el script del scratchpad
   `unir_indice.py` (une filas por la base del merge); en `docs/hallazgos-*.md`, quedarse con las dos partes.
2. Antes de subir: `node scripts/tsc-bitacoras.mjs` (0), `node scripts/rutas-windows-en-tests.mjs` (0) y los tests
   del área. NO el tsc completo local (la máquina no tiene RAM).
3. `git push origin HEAD:refs/heads/integracion`. GitHub Actions corre tipos + guardas + los 10.800 tests
   (~10 min) y, con verde, avanza `main` por fast-forward; Vercel despliega solo (~2 min).
4. Seguir el run por la API de GitHub (token de `git credential fill`) y el deploy con `npx vercel ls`.
5. Regla de cola: NO cancelar un run en curso por una punta nueva salvo que arregle algo ROTO en producción
   (cada cancelación son 10 min sin que nada llegue; Martín: «No se estan pusheando las cosas...»).
6. Después de cada deploy: avisarle a cada chat que lo suyo está Ready y reportarle a Martín en bullets de producto.

Trampas medidas: un test con una ruta `C:\` como DATO falla en Linux (hay guarda); un hito `prompt` sin `puntos`
tira el typecheck (hay guarda); SendMessage NO cruza carpetas de config (ENOINBOX): la frontera es la carpeta.

## Estado al escribir esto

- `main` = run 24 (`25d18fc30`). Run 25 (`b51d22388`, crédito de Claude + regla PII + título 5 s + guarda de rutas)
  corriendo.
- **PENDIENTE APENAS EL RUN 25 ESTÉ READY:** correr el script de Onboarding que guarda las claves del crédito
  de Claude (cuentas 1 y 2, Max 20x) cifradas en el ws9: `scripts/credito-claude-a-plataforma.mts`, desde el
  worktree de Onboarding, con el `.env.local` del clon (tiene `ANTHROPIC_CREDITO_CUENTA1/2`). Martín lo
  autorizó: «Vinculalas a MaKo». Verificar con la primera llamada real (una fila en anthropic_usage con el motivo).
- **Run 26, ya listo para sumar:** web-anim `25340eb12` (secciones altas invisibles en la publicada: bug de
  producción), dashboard-bloques `b2189353c` (red del Dashboard con el crédito), y este relevo.
- Ticketera esperando a Martín: `cobrar-mako-en-mexico` (freno por +52 listo en `pagos-mexico-guarda` a075e1ae5,
  NO integrar hasta la A) y `garantia-grupal`.
- Martín tiene que abrir el chat «Centro de Operaciones › Review» (el visor de revisión) y avisar.

## Lo que está en curso en cada jefe

- **Centro de Operaciones**: 11 puntos del 16/10 en este orden: (1) pregunta estilo Claude en el chat + (2) botón
  Ticketera + (11) Uso visible; (5) sin accesorios + (10) en qué trabaja + (9) «Nuevo chat»; (4) organización
  (el Cerebro aparte, un pedido sólo en el chat que lo trabajó, sesiones con nombre de carpeta fuera) + (8);
  (3) historial y pendientes JUNTO con (12) el Plan (cada jefe = un proyecto del Plan); después (7) dictado y
  adjuntos y (13) Second Brain (diseño primero). El (6) Review va al sub-chat. Punto B (Runner por terminal)
  en revisión adversarial.
- **Automations**: el AI Step con red de plataforma (PII → sólo crédito) y que escuche las notas de voz;
  después la mudanza de los avisos por familias (61). Mudanza del reporte semanal ya pedida.
- **Onboarding**: el crédito de Claude y la regla PII hechos; sigue la red de la primera semana.
- **Dashboard**: afinar `pii` caja por caja en las Conclusiones.
- **Pagos**: quieto hasta México y la garantía.
- **Video Editor**: tanda 5 (verlo en Chrome) y medir las fuentes: esperan que Martín deje Chrome sin minimizar.
- **Web Generator**: tanda 8 cerrada.
- **CRM**: el armador de la ficha por bloques (b1).
- **Infra**: receta del acotado y guardas, hechas.

## Lo decidido el 15-16/10 que no hay que volver a preguntar

- Opción A (Ticketera `clientes-usan-su-claude`): MaKo dentro del Claude/ChatGPT del cliente + su crédito de Max
  por BYOK; lo que responde en vivo, con API. Mapa: `docs/mapa-ia-24h.md`.
- Datos de los clientes de un cliente (PII) NUNCA a un proveedor gratis que entrena; orden de la red: crédito
  de Claude → key de Gemini con facturación → gratis sólo sin PII. El Plan nunca paga IA.
- Las TRES cuentas de Claude son de Martín (no volver a plantear lo contrario).
- Cancelar el plan: botón «Darme de baja» propio; plazo de reembolso 5 días hábiles.
