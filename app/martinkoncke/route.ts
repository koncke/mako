// =============================================================================
// GET /martinkoncke — Plan de ejecución de MaKo (tablero privado de Martín)
// =============================================================================
// Ruta oculta (no figura en el sidebar). HTML autónomo servido desde el route
// handler: NO hereda el layout raíz. Persistencia en localStorage del navegador
// (keys mako_plan_v2 / mako_plan_ui_v2). El SEED de abajo es la FUENTE DE VERDAD:
// tareas con proyecto + estado + prioridad + detalle, reconciliadas contra el
// código real. Para editar el plan, editar el array SEED (o la UI).
// Reemplaza al kanban v1 (mako_tasks_v1); ese board se exportó una vez y se
// migró a este SEED. Vista: Foco arriba · Proyectos al medio · Kanban toggle.
// =============================================================================

export const dynamic = 'force-static';

const HTML = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Plan de MaKo · Tablero</title>
<style>
  :root{
    --bg:#1a1a1c; --panel:#242427; --panel-2:#2a2a2e; --panel-3:#303036;
    --line:rgba(255,255,255,.08); --line-strong:rgba(255,255,255,.15);
    --gold:#f0c60a; --gold-dim:rgba(240,198,10,.15);
    --txt:#f5f5f4; --muted:#9b9ba2; --muted-2:#6f6f76;
    --alta:#e5484d; --media:#f0a818; --baja:#46a758; --futuro:#6f6f76;
    --hecho:#46a758; --parcial:#f0a818; --abierto:#6f6f76;
    --radius:14px; --fast:.16s cubic-bezier(.2,.7,.3,1);
    --chev:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'><path d='M2 3.5L5 6.5L8 3.5' stroke='%239b9ba2' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/></svg>");
  }
  *{box-sizing:border-box}
  html,body{margin:0;background:var(--bg);color:var(--txt);color-scheme:dark}
  body{font-family:Arial,-apple-system,"Segoe UI",Roboto,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;line-height:1.45;padding:26px 18px 80px}
  .wrap{max-width:1180px;margin:0 auto}
  h1{font-size:25px;letter-spacing:-.01em;margin:6px 0 2px;font-weight:800}
  .eyebrow{display:flex;align-items:center;gap:9px;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--muted);font-weight:700}
  .eyebrow .sq{width:9px;height:9px;background:var(--gold);display:inline-block}
  .sub{color:var(--muted);font-size:13px;max-width:680px;margin-top:3px}

  /* Barra de progreso global por estado */
  .head{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;flex-wrap:wrap;margin-bottom:18px}
  .statline{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
  .stat{display:flex;align-items:center;gap:7px;background:var(--panel);border:1px solid var(--line);border-radius:99px;padding:5px 12px;font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums}
  .stat b{color:var(--txt);font-weight:700}
  .stat .d{width:8px;height:8px;border-radius:99px}

  /* Toolbar */
  .tools{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin:0 0 18px;padding-top:14px;border-top:1px solid var(--line)}
  .btn{appearance:none;border:1px solid var(--line-strong);background:var(--panel);color:var(--txt);font:inherit;font-size:12.5px;padding:8px 13px;border-radius:99px;cursor:pointer;transition:background var(--fast),border-color var(--fast),color var(--fast);white-space:nowrap}
  .btn:hover{background:var(--panel-2);border-color:var(--muted-2)}
  .btn:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
  .btn.active{border-color:var(--gold);color:var(--gold);background:var(--gold-dim)}
  #searchInput{background:var(--panel);border:1px solid var(--line);color:var(--txt);font:inherit;font-size:13px;padding:8px 13px;border-radius:10px;min-width:180px;flex:1;transition:border-color var(--fast)}
  #searchInput:focus{outline:none;border-color:var(--gold)}
  .seg{display:inline-flex;background:var(--panel);border:1px solid var(--line-strong);border-radius:99px;padding:3px}
  .seg button{appearance:none;border:none;background:transparent;color:var(--muted);font:inherit;font-size:12.5px;font-weight:600;padding:6px 14px;border-radius:99px;cursor:pointer;transition:all var(--fast)}
  .seg button.on{background:var(--gold-dim);color:var(--gold)}
  .add{display:flex;gap:7px;flex:1;min-width:220px}
  .add input{flex:1;background:var(--panel);border:1px solid var(--line);color:var(--txt);font:inherit;font-size:13.5px;padding:9px 13px;border-radius:10px}
  .add input:focus{outline:none;border-color:var(--gold)}
  .add .btn{border-color:var(--gold);color:var(--gold);background:var(--gold-dim);font-weight:700}

  /* Foco */
  .foco{margin:0 0 26px}
  .sec-lbl{display:flex;align-items:center;gap:9px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);font-weight:800;margin:0 0 12px}
  .sec-lbl .cnt{font-weight:700;color:var(--muted-2)}
  .foco-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}
  .foco-card{background:linear-gradient(180deg,var(--panel-2),var(--panel));border:1px solid var(--line-strong);border-left:3px solid var(--gold);border-radius:12px;padding:13px 14px}
  .foco-card .ft{font-size:14px;font-weight:600;line-height:1.4;margin-bottom:8px}
  .foco-empty{font-size:13px;color:var(--muted-2);border:1px dashed var(--line);border-radius:10px;padding:16px}

  /* Proyecto */
  .project{margin:0 0 14px;border:1px solid var(--line);border-radius:var(--radius);overflow:hidden;background:rgba(255,255,255,.015)}
  .proj-head{display:flex;align-items:center;gap:11px;padding:13px 15px;cursor:pointer;user-select:none;border-left:3px solid var(--pc,#888)}
  .proj-head:hover{background:rgba(255,255,255,.02)}
  .proj-emoji{font-size:16px}
  .proj-name{font-size:14.5px;font-weight:800;letter-spacing:.01em;flex:1}
  .proj-bar{height:5px;width:120px;background:var(--panel-2);border-radius:99px;overflow:hidden;flex:0 0 auto}
  .proj-bar span{display:block;height:100%;background:linear-gradient(90deg,#caa406,var(--gold))}
  .proj-count{font-size:11.5px;color:var(--muted);font-variant-numeric:tabular-nums;white-space:nowrap}
  .proj-chev{color:var(--muted-2);font-size:12px;transition:transform var(--fast)}
  .project.closed .proj-chev{transform:rotate(-90deg)}
  .project.closed .proj-body{display:none}
  .proj-body{padding:4px 12px 12px;display:flex;flex-direction:column;gap:8px}

  /* Kanban */
  .board{display:grid;grid-template-columns:repeat(4,1fr);gap:13px;align-items:start}
  @media(max-width:1000px){.board{grid-template-columns:repeat(2,1fr)}}
  @media(max-width:640px){.board{grid-template-columns:1fr}}
  .col{background:rgba(255,255,255,.02);border:1px solid var(--line);border-top:3px solid var(--futuro);border-radius:var(--radius);padding:11px}
  .col.col-alta{border-top-color:var(--alta)} .col.col-media{border-top-color:var(--media)}
  .col.col-baja{border-top-color:var(--baja)} .col.col-futuro{border-top-color:var(--futuro)}
  .col-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
  .col-title{font-size:11.5px;font-weight:800;letter-spacing:.13em;display:flex;align-items:center;gap:8px}
  .col-count{font-size:11.5px;color:var(--muted);background:var(--panel);border:1px solid var(--line);border-radius:99px;padding:2px 9px}
  .dot{width:8px;height:8px;border-radius:99px;display:inline-block}
  .dot.alta{background:var(--alta)} .dot.media{background:var(--media)} .dot.baja{background:var(--baja)} .dot.futuro{background:var(--futuro)}
  .col-body{display:flex;flex-direction:column;gap:8px;min-height:20px}
  .col-empty{font-size:12px;color:var(--muted-2);text-align:center;padding:14px 6px;border:1px dashed var(--line);border-radius:9px}

  /* Tarjeta */
  .card{background:var(--panel);border:1px solid var(--line);border-left:3px solid var(--futuro);border-radius:11px;padding:10px 12px;transition:border-color var(--fast),opacity var(--fast)}
  .card.p-alta{border-left-color:var(--alta)} .card.p-media{border-left-color:var(--media)}
  .card.p-baja{border-left-color:var(--baja)} .card.p-futuro{border-left-color:var(--futuro)}
  .card.st-hecho{opacity:.62}
  .card:hover{border-color:var(--line-strong)}
  .card-top{display:flex;align-items:center;gap:8px;margin-bottom:7px;flex-wrap:wrap}
  .num{font-size:10px;font-weight:700;color:var(--muted-2);font-variant-numeric:tabular-nums}
  .badge{font-size:10px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;padding:2px 8px;border-radius:99px;border:1px solid}
  .badge.hecho{color:var(--hecho);border-color:rgba(70,167,88,.4);background:rgba(70,167,88,.12)}
  .badge.parcial{color:var(--parcial);border-color:rgba(240,168,24,.4);background:rgba(240,168,24,.12)}
  .badge.abierto{color:var(--muted);border-color:var(--line-strong);background:transparent}
  .chip-proj{font-size:10px;font-weight:700;padding:2px 8px;border-radius:99px;border:1px solid}
  .spacer{flex:1}
  .star{width:24px;height:24px;border:none;background:transparent;color:var(--muted-2);cursor:pointer;font-size:15px;border-radius:6px;line-height:1;padding:0}
  .star.on{color:var(--gold)} .star:hover{background:var(--panel-2)}
  .star:focus-visible{outline:2px solid var(--gold);outline-offset:1px}
  .ttl{font-size:13.5px;line-height:1.42;cursor:text;border-radius:6px;word-wrap:break-word;overflow-wrap:anywhere}
  .ttl:hover{text-decoration:underline dashed var(--muted-2);text-underline-offset:3px}
  .card.st-hecho .ttl{text-decoration:line-through;text-decoration-color:var(--muted-2);color:var(--muted)}
  .edit-box{width:100%;background:var(--panel-2);border:1px solid var(--gold);border-radius:8px;color:var(--txt);font:inherit;font-size:13.5px;padding:8px 9px;resize:vertical;line-height:1.4;outline:none}

  .row2{display:flex;align-items:center;gap:7px;margin-top:9px;flex-wrap:wrap}
  select.mini,input[type=date].mini{appearance:none;-webkit-appearance:none;background-color:var(--panel-2);border:1px solid var(--line-strong);border-radius:8px;color:var(--txt);font:inherit;font-size:11px;font-weight:700;padding:4px 22px 4px 9px;cursor:pointer;background-repeat:no-repeat;background-position:right 7px center;background-size:9px;background-image:var(--chev)}
  input[type=date].mini{padding:4px 8px}
  select.mini:focus-visible,input[type=date].mini:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
  select.mini option{background:#242427}
  .sel-alta{color:var(--alta)} .sel-media{color:var(--media)} .sel-baja{color:var(--baja)} .sel-futuro{color:var(--muted)}
  input[type=date].mini::-webkit-calendar-picker-indicator{filter:invert(.6);cursor:pointer}
  input[type=date].mini.dl-over{color:var(--alta);border-color:rgba(229,72,77,.5)}
  .prog{display:flex;align-items:center;gap:9px;flex:1;min-width:120px}
  input[type=range]{-webkit-appearance:none;appearance:none;flex:1;height:5px;border-radius:99px;outline:none;cursor:pointer;background:var(--panel-2)}
  input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:var(--gold);cursor:pointer;border:2px solid #1a1a1c}
  input[type=range]::-moz-range-thumb{width:14px;height:14px;border-radius:50%;background:var(--gold);cursor:pointer;border:2px solid #1a1a1c}
  .pv{font-size:11px;font-weight:800;color:var(--muted);min-width:34px;text-align:right;font-variant-numeric:tabular-nums}
  .del{width:24px;height:24px;border:none;background:transparent;color:var(--muted-2);font-size:16px;cursor:pointer;border-radius:6px;line-height:1}
  .del:hover{color:var(--alta);background:rgba(229,72,77,.12)}
  .del:focus-visible{outline:2px solid var(--gold);outline-offset:1px}

  /* Detalle expandible */
  .det-toggle{background:transparent;border:none;color:var(--muted-2);font:inherit;font-size:11.5px;cursor:pointer;padding:6px 0 0;display:inline-flex;align-items:center;gap:5px}
  .det-toggle:hover{color:var(--gold)}
  .det-toggle .mk{color:var(--gold);font-weight:800}
  .det{margin-top:8px;background:var(--panel-2);border:1px solid var(--line);border-radius:9px;padding:9px 11px;font-size:12px;color:var(--muted);white-space:pre-wrap;line-height:1.5;overflow-wrap:anywhere;cursor:text}
  .det[hidden]{display:none}
  .det-empty{color:var(--muted-2);font-style:italic}
  .det-box{width:100%;background:var(--panel-3);border:1px solid var(--gold);border-radius:8px;color:var(--txt);font:inherit;font-size:12px;padding:9px 11px;resize:vertical;line-height:1.5;outline:none;min-height:120px}

  .foot{margin-top:28px;text-align:center;font-size:11.5px;color:var(--muted-2)}
  .foot .save{color:var(--baja)}
  @media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
</style>
</head>
<body>
<div class="wrap">
  <div class="head">
    <div>
      <div class="eyebrow"><span class="sq"></span> Plan de ejecución</div>
      <h1>MaKo · Qué construir</h1>
      <div class="sub">Prioridades arriba, proyectos en el medio, kanban abajo. Toca el nombre para editar; ★ marca el foco; “Detalle” abre el doc de cada tarea.</div>
      <div class="statline" id="statline"></div>
    </div>
  </div>

  <div class="tools">
    <div class="add">
      <input id="addInput" type="text" placeholder="Nueva tarea…" maxlength="200" aria-label="Nueva tarea">
      <button class="btn" id="addBtn">Agregar</button>
    </div>
    <input id="searchInput" type="text" placeholder="Buscar…" aria-label="Buscar">
    <div class="seg" id="viewSeg" role="tablist" aria-label="Vista">
      <button data-view="proj" class="on">Proyectos</button>
      <button data-view="kanban">Kanban</button>
    </div>
    <button class="btn" id="toggleDone">Ocultar hechas</button>
  </div>

  <section class="foco" id="focoSec"></section>
  <div id="mainView"></div>

  <div class="foot">Tus cambios se guardan solos en este navegador. <span class="save" id="saveState"></span></div>
</div>

<script>
(function(){
  "use strict";
  var TASKS_KEY="mako_plan_v2", UI_KEY="mako_plan_ui_v2";
  var PRIOS=["alta","media","baja","futuro"];
  var PLABEL={alta:"Alta",media:"Media",baja:"Baja",futuro:"A futuro"};
  var SLABEL={hecho:"Hecho",parcial:"Parcial",abierto:"Abierto"};

  var PROJECTS=[
    {id:"doer",   emoji:"🔴", name:"Hacer MaKo DOER", color:"#e5484d"},
    {id:"plat",   emoji:"🧱", name:"Plataforma & Núcleo", color:"#3b82f6"},
    {id:"canales",emoji:"💬", name:"Canales & Mensajería", color:"#8b5cf6"},
    {id:"analy",  emoji:"🔍", name:"Analysts & Generadores", color:"#14b8a6"},
    {id:"growth", emoji:"📈", name:"Growth · Vender MaKo", color:"#f0a818"},
    {id:"ux",     emoji:"✨", name:"UX & Diseño", color:"#ec4899"}
  ];

  // [n, texto, proyecto, prioridad, estado, prog, detalle, foco]
  var SEED=[
    // ── Hacer MaKo DOER ──
    [42,"Retro & Planning: la tab-cerebro","doer","alta","hecho",100,"Base hecha (100%). Es la casa del programa DOER: reportes de rendimiento + plan personalizado, ligada a Experiments. Todo lo de abajo la potencia.",false],
    [55,"Catálogo de fugas: que Retro detecte los patrones","doer","alta","abierto",0,"Que Retro corra un catálogo (la IA juzga, no es regla rígida): escalar no-ganadores, gasto↑/resultados↓, poca variedad (razones de compra), huecos del funnel, escalado incorrecto, muchos cambios de golpe, cobranza recurrente. Metodología Recon de Jan (las 2 señales: intención + ritmo). getSenalesRecon ya calcula las 2 señales. Spec: docs/superpowers/specs/2026-07-10-retro-doer-accountability-design.md",true],
    [56,"Rendición de cuentas: verificar ejecución real + reclamo","doer","alta","abierto",0,"MaKo joinea experimento_tareas por retro_id, distingue aceptado-vs-HECHO, y reclama con base ('no es magia, andá a grabar los creativos'). 4 estados; el retro_id ya se guarda, solo falta leerlo. Spec S1 · Sección 2.",true],
    [54,"El pulso: que la app te diga QUÉ HACER (vista Hoy)","doer","alta","abierto",0,"Chequeo diario barato (no el retro de 13 min) que reclama/avisa por campanita (con sonido) + WhatsApp y surfacea en el SEMÁFORO. To-do semanal / vista Hoy simple. Solo avisa cuando hay motivo (nunca 'todo bien'); también wins definidas. Spec S1 · Sección 3.",true],
    [53,"Modo Simple por default + Avanzado","doer","alta","abierto",0,"Default SIMPLE (las 3 tareas + experimentos a correr). El kanban/detalle va a modo Avanzado.",false],
    [4,"Onboarding progresivo por tab (SIMPLE)","doer","alta","parcial",55,"Onboarding INICIAL apenas entran: solo lo básico (Meta) + veredicto impactante corriendo Experiments. Después, a demanda, MaKo detecta una fuga y te manda a la tab correspondiente ('no estás nutriendo, se te van $X, estos son los pasos'). Conocimiento por tab. Base del wizard hecha; falta el modelo progresivo.",false],
    [57,"Atribución de cash por anuncio (combustible del cerebro)","doer","alta","abierto",0,"meta_ad_id × pagos, granular por anuncio/campaña. Hoy solo hay ROAS agregado. Es EL número de toda decisión de ads y alimenta a Retro.",false],
    [58,"Minería de objeciones (de closing_analyses)","doer","media","abierto",0,"Objeciones recurrentes que matan cierres. La data ya se guarda con handled+quote.",false],
    [59,"Semáforo vivo (alertas con IA + accionables)","doer","media","abierto",0,"Junta señales ya calculadas + tendencia (meta_health_history se escribe y no se lee) + Claude razona alertas nuevas más allá de las hardcodeadas. Es donde surfacea el pulso.",false],
    [18,"MaKo embebido en todas las tabs","doer","media","parcial",30,"WhatsApp ya tiene MaKo. Falta embeberlo en: funnel, leads/CRM, experimentos, email, closing.",false],
    [14,"CRM Automático (leads que avanzan solos)","doer","alta","parcial",40,"Motor T1-T6 hecho pero APAGADO (dry-run, falta CRM_AUTO_ENABLED). Tu backlog: esquema completo de cuándo mover un lead (R1→esperar 3h→buscar en Fathom→asistió/no), pop-up bloqueante para confirmar cambios de MaKo, Instant Form→Nutrición, Nutrición Manual vencida→revisar WhatsApp, R2 confirmó→Facturando, Datos sin Marcar→MaKo intenta completarlos solo, nueva etapa 'Nutrición-Reactivación'. Templates de nutrición automáticos (no config manual). Terminar Onboarding + tab FUNNEL (hoy poco configurable).",false],

    // ── Plataforma & Núcleo ──
    [3,"Perfil de Usuario","plat","alta","hecho",100,"Hecho: /perfil (datos, avatar, zona horaria). Las prefs de notificaciones se movieron a /configuraciones.",false],
    [5,"Usuarios + vista de Admin","plat","alta","hecho",100,"Hecho: /admin (crear cliente, roles, entrar-como). Migraciones 0053/0054.",false],
    [6,"Método: tokens + tutorial","plat","alta","hecho",100,"Hecho: /metodo (un servicio por pantalla, creds cifradas por workspace, tutorial por token).",false],
    [28,"Panel de Equipo (Closers/Setters)","plat","media","hecho",100,"Hecho: /equipo (roles rol_ws, visibilidad por tab). Migración 0058.",false],
    [2,"Ficha del lead (CRM)","plat","alta","hecho",100,"Hecho: 7 tabs (Overview, Tracking, Meetings, Chat, Insights, Deal Details, Historial). Único límite: la tab Chat es solo LECTURA (responder deriva a /whatsapp).",false],
    [12,"Ads Manager: crear/editar campañas + USD","plat","media","hecho",100,"Hecho: crear (12), editar (40) y normalizar a USD (50). Todo en PAUSA. Caveat: gateado al dueño; el CREATE de Meta no se probó en vivo (bloqueo de pago).",false],
    [33,"API 'Analizar' de Meta (recomendaciones)","plat","baja","hecho",100,"Código completo (recos nativas de Meta + sugerencias derivadas por MaKo + análisis con Claude). Las nativas vuelven vacías por bloqueo externo de pago (account_status=3), no del código.",false],
    [7,"Ciberseguridad + eficiencia","plat","alta","parcial",80,"Auditoría hecha (13 seguridad + 14 performance). Los 3 HIGH y los MEDIUM clave fixeados. Falta: hallazgos de performance (LOW) y 'depurar código' (continuo).",false],
    [30,"Protocolo de Beta y versiones","plat","media","abierto",0,"Mejorar la app sin interrumpir a los usuarios.",false],
    [52,"Usar SKILLS en todo el código","plat","baja","parcial",25,"Ya instalamos brainstorming/writing-plans/grilling/decision-maker + las del repo (scaffold, tenant-safe, etc.). Falta aplicarlas de forma sistemática. github.com/vercel-labs/skills",false],
    [17,"Traspaso de cuentas Mauricio → mías (infra)","plat","baja","abierto",0,"Supabase, Vercel, dominio, etc. viven en cuentas de Mauricio. No es prioridad.",false],
    [32,"Dominio propio + ruteo (landing en la raíz)","plat","baja","abierto",0,"Landing en la raíz, no en /vsl.",false],

    // ── Canales & Mensajería ──
    [8,"Email Marketing (Resend)","canales","media","parcial",90,"Código completo (broadcasts, tracking open/click, dominio DKIM/SPF, unsubscribe). Falta go-live: verificar dominio + configurar RESEND_WEBHOOK_SECRET. Envío real gateado por workspace (off por default).",false],
    [9,"Nutrición Automática","canales","media","parcial",70,"Motor completo: 14 cohortes, 3 canales (email, WA oficial, WA no-oficial), anti-baneo (ventana horaria, cap diario, guard 20h). APAGADO por default. Falta go-live: prender flags + dominio + templates WA aprobados por Meta.",false],
    [20,"Reportes por WhatsApp (semáforo/ads/wins)","canales","media","parcial",90,"Hecho para el dueño (crons diario/horario/semanal + dispatcher WA/Telegram/email + ventana 24h). Falta: que los crons de reporte iteren workspaces (hoy single-tenant).",false],
    [41,"WhatsApp + Email NO oficial dentro de MaKo","canales","media","parcial",30,"Evolution (WhatsApp no-oficial por QR) ya existe. Falta que AMBOS sistemas vivan cómodos dentro de MaKo.",false],
    [43,"Responder 'Datos sin Marcar' desde WhatsApp","canales","media","abierto",0,"",false],
    [51,"Listas de Difusión (nutrición y otros casos)","canales","media","abierto",0,"",false],
    [19,"Importar/exportar leads (importados → nutrición)","canales","media","abierto",0,"No existe import/export bulk (solo alta individual). Falta: parser de archivo + mapeo de columnas + enrolar los importados en la máquina de nutrición.",false],
    [16,"Calendly + back-end (UTM/UUID) multi-tenant","canales","futuro","parcial",60,"UTM/UUID ya se capturan bien en el webhook. Falta la config multi-tenant: hoy las URLs están hardcodeadas a la cuenta de Mauricio. 'Cuando vuelva a Baires'.",false],
    [21,"Reportes a leads/clientes post-reunión","canales","futuro","abierto",0,"",false],

    // ── Analysts & Generadores ──
    [24,"Landing Analyst","analy","futuro","abierto",0,"PostHog / MS Clarity en landing y VSL del cliente → session replay + heatmaps de dónde exactamente se cae la gente (más fino que el pixel). Empalma con 'dónde sangra el embudo'. Hoy solo stub comingSoon.",false],
    [25,"VSL Analyst","analy","futuro","abierto",0,"La telemetría de VSL (retención por cuartiles) ya existe como insumo, pero el analista como feature no. Stub.",false],
    [13,"CS Analyst (Customer Success)","analy","futuro","abierto",0,"Closing ya distingue llamadas de entrega de servicio; falta el analista de salud del cliente / churn. Stub.",false],
    [34,"Market Analyst (análisis de competencia)","analy","futuro","abierto",0,"Los competidores sacan ads/funnels todo el tiempo → proceso RECURRENTE + aviso por WhatsApp cuando alguien saca algo nuevo. Stub.",false],
    [39,"Offer Analyst (auditar/mejorar la oferta)","analy","futuro","abierto",0,"Que dentro del onboarding no solo tome los docs de la oferta y los guarde — que la audite, analice y mejore.",false],
    [26,"Ads Writer / GhostWriter","analy","baja","hecho",100,"El copy de anuncios ya lo escribe Ads Writer (lib/ad-copy.ts, /ads-writer). 'GhostWriter' apunta al mismo objetivo → cubierto.",false],
    [29,"Generador de creativos estáticos + video (en masa)","analy","futuro","abierto",0,"Estilo app de Claudio Conde. (Fusión de 29+48.)",false],
    [49,"Generador de Landing Pages (templates)","analy","futuro","abierto",0,"",false],
    [47,"Generador de Contratos","analy","baja","abierto",0,"",false],
    [31,"Cursos en tab Conocimiento (RAG)","analy","baja","parcial",80,"Pipeline transcribir→ordenar por curso/área→cargar y embeber en RAG, funcional. Solo 'Levanta Muertos' viene pre-seedeado; el resto (Bluehackers, etc.) se sube a mano.",false],

    // ── Growth · Vender MaKo ──
    [46,"Oferta Cebolla (planes por nivel de acceso)","growth","futuro","abierto",0,"MaKo hoy se vende a infoproductores +20k, pero PODRÍA venderse a TODO el que corra VSL Funnel limitando el acceso por planes según la situación del lead. El que recién empieza no necesita Experimentos ni CRM; sí WhatsApp, seguimientos, generación de creativos/guiones.",false],
    [45,"Plan de Marketing: ads por cada funcionalidad","growth","futuro","abierto",0,"Claudio Conde hizo 60k SOLO con la feature de creativos estáticos, con cientos de ads atacando ESE ángulo. Yo puedo crear miles de ads atacando CADA funcionalidad de la app.",false],
    [1,"Copy/detalle de cada feature en la landing (/vsl)","growth","futuro","abierto",0,"Tarea de MARKETING (contenido para la ruta /vsl), no una feature de la app. 'Cuando vuelva a Baires'.",false],
    [22,"Thank You Page (post-agenda con instrucciones)","growth","futuro","abierto",0,"Página post-agenda que fuerza ver/seguir instrucciones o se cancela la llamada (estilo confirmar.lovable.app). Hoy no existe.",false],
    [15,"Testimonios (Lucre, Gabi, otros + Infra)","growth","futuro","abierto",0,"",false],
    [27,"Evaluar costos internos + para el cliente","growth","futuro","abierto",0,"'Cuando vuelva a Baires'.",false],
    [23,"Loom tutorial/demo por feature","growth","futuro","abierto",0,"",false],
    [35,"Mapa de calor de uso (qué tabs usan más)","growth","futuro","abierto",0,"",false],

    // ── UX & Diseño ──
    [36,"Rediseño completo de la app","ux","alta","parcial",70,"Falta: Script/Closing Analyst + Experiments + tabs de Perfil + Onboarding.",false],
    [37,"UX SIMPLE (la experiencia entera)","ux","alta","parcial",60,"El norte de UX: que todo sea SIMPLE. Falta: Closing/Script Analyst + Funnel + Onboarding.",false],
    [44,"Administrador de Eventos en MaKo","ux","baja","abierto",0,"",false]
  ];

  function projOf(id){ for(var i=0;i<PROJECTS.length;i++) if(PROJECTS[i].id===id) return PROJECTS[i]; return PROJECTS[PROJECTS.length-1]; }
  function seed(){
    return SEED.map(function(d){
      return {id:"t"+d[0],n:d[0],text:d[1],project:d[2],priority:d[3],status:d[4],prog:d[5]||0,detalle:d[6]||"",foco:!!d[7],deadline:""};
    });
  }

  var tasks=[], view="proj", q="", hideDone=false, openDet={};
  var closedProj={};
  var saveEl=document.getElementById("saveState"), flashTimer;
  function flashSaved(){ saveEl.textContent="✓ guardado"; clearTimeout(flashTimer); flashTimer=setTimeout(function(){saveEl.textContent="";},1300); }

  function load(){
    try{ var raw=localStorage.getItem(TASKS_KEY); if(raw){ tasks=JSON.parse(raw); } else { tasks=seed(); saveNow(); } }
    catch(e){ tasks=seed(); }
    try{ var ui=JSON.parse(localStorage.getItem(UI_KEY)||"{}"); view=ui.view||"proj"; hideDone=!!ui.hideDone; closedProj=ui.closedProj||{}; }catch(e){}
  }
  function saveNow(){ try{ localStorage.setItem(TASKS_KEY,JSON.stringify(tasks)); flashSaved(); }catch(e){} }
  var st; function save(){ clearTimeout(st); st=setTimeout(saveNow,400); }
  function saveUi(){ try{ localStorage.setItem(UI_KEY,JSON.stringify({view:view,hideDone:hideDone,closedProj:closedProj})); }catch(e){} }
  function find(id){ for(var i=0;i<tasks.length;i++) if(tasks[i].id===id) return tasks[i]; return null; }
  function esc(s){ return String(s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];}); }
  function clamp(v){ v=+v; if(isNaN(v))v=0; return Math.max(0,Math.min(100,v)); }
  function prioRank(p){ return {alta:0,media:1,baja:2,futuro:3}[p]; }
  function statRank(s){ return {abierto:0,parcial:1,hecho:2}[s]; }

  function passSearch(t){ if(!q) return true; return ((t.text||"")+" "+(t.detalle||"")).toLowerCase().indexOf(q)>=0; }
  function passDone(t){ return !(hideDone && t.status==="hecho"); }
  function visible(t){ return passSearch(t)&&passDone(t); }

  function dlOver(d){ if(!d) return false; var td=new Date(); td.setHours(0,0,0,0); var due=new Date(d+"T00:00:00"); return !isNaN(due.getTime()) && due<td; }

  // ── tarjeta ──
  function card(t){
    var p=projOf(t.project), det=(t.detalle||"").trim(), isOpen=!!openDet[t.id];
    var prioSel='<select class="mini sel-'+t.priority+'" data-act="prio" aria-label="Prioridad">'+PRIOS.map(function(x){return '<option value="'+x+'"'+(t.priority===x?" selected":"")+'>'+PLABEL[x]+'</option>';}).join("")+'</select>';
    var statSel='<select class="mini" data-act="status" aria-label="Estado">'+["abierto","parcial","hecho"].map(function(x){return '<option value="'+x+'"'+(t.status===x?" selected":"")+'>'+SLABEL[x]+'</option>';}).join("")+'</select>';
    var projChip='<span class="chip-proj" style="color:'+p.color+';border-color:'+p.color+'55;background:'+p.color+'18">'+p.emoji+' '+esc(p.name)+'</span>';
    return '<div class="card p-'+t.priority+' st-'+t.status+'" data-id="'+t.id+'">'+
      '<div class="card-top">'+
        '<span class="num">'+String(t.n).padStart(2,"0")+'</span>'+
        '<span class="badge '+t.status+'">'+SLABEL[t.status]+'</span>'+
        (view==="kanban"?projChip:"")+
        '<span class="spacer"></span>'+
        '<button class="star'+(t.foco?" on":"")+'" data-act="foco" title="Foco" aria-pressed="'+(t.foco?"true":"false")+'">'+(t.foco?"★":"☆")+'</button>'+
        '<button class="del" data-act="del" title="Eliminar" aria-label="Eliminar">×</button>'+
      '</div>'+
      '<div class="ttl" data-act="title" title="Editar">'+esc(t.text)+'</div>'+
      '<div class="row2">'+
        prioSel+statSel+
        '<input type="date" class="mini'+(dlOver(t.deadline)?" dl-over":"")+'" data-act="dl" value="'+(t.deadline||"")+'" aria-label="Deadline">'+
        '<span class="prog"><input type="range" min="0" max="100" step="5" value="'+t.prog+'" data-act="prog" aria-label="Progreso"><span class="pv">'+t.prog+'%</span></span>'+
      '</div>'+
      '<button class="det-toggle" data-act="dettoggle">'+(isOpen?"▾":"▸")+' Detalle '+(det?'<span class="mk">• doc</span>':"")+'</button>'+
      (isOpen?'<div class="det" data-act="det">'+(det?esc(det):'<span class="det-empty">Sin detalle. Clic para escribir el doc de esta tarea.</span>')+'</div>':"")+
    '</div>';
  }

  // ── vistas ──
  function projectView(){
    var html="";
    PROJECTS.forEach(function(p){
      var items=tasks.filter(function(t){return t.project===p.id && visible(t);})
        .sort(function(a,b){ return prioRank(a.priority)-prioRank(b.priority) || statRank(a.status)-statRank(b.status) || a.n-b.n; });
      var all=tasks.filter(function(t){return t.project===p.id;});
      var done=all.filter(function(t){return t.status==="hecho";}).length;
      var avg=all.length?Math.round(all.reduce(function(s,t){return s+t.prog;},0)/all.length):0;
      var closed=!!closedProj[p.id];
      html+='<div class="project'+(closed?" closed":"")+'" data-proj="'+p.id+'" style="--pc:'+p.color+'">'+
        '<div class="proj-head" data-act="projhead">'+
          '<span class="proj-emoji">'+p.emoji+'</span><span class="proj-name">'+esc(p.name)+'</span>'+
          '<span class="proj-bar"><span style="width:'+avg+'%"></span></span>'+
          '<span class="proj-count">'+done+'/'+all.length+' hechas</span>'+
          '<span class="proj-chev">▾</span>'+
        '</div>'+
        '<div class="proj-body">'+(items.length?items.map(card).join(""):'<div class="col-empty">Sin tareas visibles.</div>')+'</div>'+
      '</div>';
    });
    return html;
  }
  function kanbanView(){
    var html='<div class="board">';
    PRIOS.forEach(function(p){
      var items=tasks.filter(function(t){return t.priority===p && visible(t);})
        .sort(function(a,b){ return statRank(a.status)-statRank(b.status) || a.n-b.n; });
      var all=tasks.filter(function(t){return t.priority===p;}).length;
      html+='<section class="col col-'+p+'"><div class="col-head"><span class="col-title"><span class="dot '+p+'"></span>'+PLABEL[p].toUpperCase()+'</span><span class="col-count">'+all+'</span></div><div class="col-body">'+
        (items.length?items.map(card).join(""):'<div class="col-empty">—</div>')+'</div></section>';
    });
    return html+'</div>';
  }
  function renderFoco(){
    var items=tasks.filter(function(t){return t.foco && t.status!=="hecho";})
      .sort(function(a,b){return prioRank(a.priority)-prioRank(b.priority)||a.n-b.n;});
    var el=document.getElementById("focoSec");
    if(!items.length){ el.innerHTML=""; return; }
    el.innerHTML='<div class="sec-lbl">🎯 Foco ahora <span class="cnt">'+items.length+'</span></div>'+
      '<div class="foco-grid">'+items.map(function(t){var p=projOf(t.project);
        return '<div class="foco-card" data-id="'+t.id+'"><div class="ft">'+esc(t.text)+'</div>'+
          '<div class="card-top" style="margin:0"><span class="badge '+t.status+'">'+SLABEL[t.status]+'</span>'+
          '<span class="chip-proj" style="color:'+p.color+';border-color:'+p.color+'55;background:'+p.color+'18">'+p.emoji+' '+esc(p.name)+'</span>'+
          '<span class="spacer"></span><button class="star on" data-act="foco" title="Quitar del foco">★</button></div></div>';
      }).join("")+'</div>';
  }
  function renderStats(){
    var by={hecho:0,parcial:0,abierto:0};
    tasks.forEach(function(t){ by[t.status]=(by[t.status]||0)+1; });
    document.getElementById("statline").innerHTML=
      '<span class="stat"><span class="d" style="background:var(--hecho)"></span>Hechas <b>'+by.hecho+'</b></span>'+
      '<span class="stat"><span class="d" style="background:var(--parcial)"></span>Parciales <b>'+by.parcial+'</b></span>'+
      '<span class="stat"><span class="d" style="background:var(--abierto)"></span>Abiertas <b>'+by.abierto+'</b></span>'+
      '<span class="stat">Total <b>'+tasks.length+'</b></span>';
  }
  function render(){
    renderStats(); renderFoco();
    document.getElementById("mainView").innerHTML = view==="kanban"?kanbanView():projectView();
  }

  // ── edición inline ──
  function editInline(cardEl,t,field){
    var region=cardEl.querySelector('[data-act="'+field+'"]'); if(!region) return;
    var ta=document.createElement("textarea");
    ta.className = field==="det"?"det-box":"edit-box";
    ta.value = field==="title"? t.text : (t.detalle||"");
    ta.rows = field==="det"?7:2;
    region.replaceWith(ta); ta.focus(); ta.setSelectionRange(ta.value.length,ta.value.length);
    ta.addEventListener("blur",function(){
      var v=ta.value.trim();
      if(field==="title"){ if(v) t.text=v; } else { t.detalle=v; }
      save(); render();
    },{once:true});
    ta.addEventListener("keydown",function(e){ if(e.key==="Escape") ta.blur(); if(e.key==="Enter"&&field==="title"){ e.preventDefault(); ta.blur(); } });
  }

  var mv=document.getElementById("mainView"), fs=document.getElementById("focoSec");

  function onInput(e){
    var el=e.target; if(el.getAttribute("data-act")!=="prog") return;
    var cardEl=el.closest(".card"); var t=find(cardEl.dataset.id); if(!t) return;
    t.prog=clamp(el.value); var pv=cardEl.querySelector(".pv"); if(pv) pv.textContent=t.prog+"%"; save();
  }
  function onChange(e){
    var el=e.target, a=el.getAttribute("data-act"); if(["prio","status","prog","dl"].indexOf(a)<0) return;
    var cardEl=el.closest(".card"); var t=find(cardEl.dataset.id); if(!t) return;
    if(a==="prio") t.priority=el.value;
    else if(a==="status"){ t.status=el.value; if(el.value==="hecho"&&t.prog<100) t.prog=100; }
    else if(a==="prog") t.prog=clamp(el.value);
    else if(a==="dl") t.deadline=el.value||"";
    save(); render();
  }
  function onClick(e){
    var btn=e.target.closest("[data-act]"); if(!btn) return;
    var a=btn.getAttribute("data-act");
    if(a==="projhead"){ var pid=btn.closest(".project").dataset.proj; closedProj[pid]=!closedProj[pid]; saveUi(); render(); return; }
    if(["prio","status","prog","dl"].indexOf(a)>=0) return;
    var host=btn.closest("[data-id]"); if(!host) return;
    var t=find(host.dataset.id); if(!t) return;
    if(a==="foco"){ t.foco=!t.foco; save(); render(); }
    else if(a==="del"){ if(confirm('¿Eliminar "'+t.text.slice(0,50)+'"?')){ tasks=tasks.filter(function(x){return x.id!==t.id;}); save(); render(); } }
    else if(a==="title"){ var c=host.closest(".card"); if(c) editInline(c,t,"title"); }
    else if(a==="dettoggle"){ openDet[t.id]=!openDet[t.id]; render(); }
    else if(a==="det"){ var c2=host.closest(".card"); if(c2) editInline(c2,t,"det"); }
  }
  [mv,fs].forEach(function(z){ z.addEventListener("input",onInput); z.addEventListener("change",onChange); z.addEventListener("click",onClick); });

  // toolbar
  document.getElementById("addBtn").addEventListener("click",addTask);
  document.getElementById("addInput").addEventListener("keydown",function(e){ if(e.key==="Enter") addTask(); });
  function addTask(){
    var inp=document.getElementById("addInput"), v=inp.value.trim(); if(!v) return;
    var maxN=tasks.reduce(function(m,t){return Math.max(m,t.n);},0);
    tasks.unshift({id:"t"+Date.now(),n:maxN+1,text:v,project:"doer",priority:"media",status:"abierto",prog:0,detalle:"",foco:false,deadline:""});
    inp.value=""; save(); render(); inp.focus();
  }
  document.getElementById("searchInput").addEventListener("input",function(e){ q=e.target.value.trim().toLowerCase(); render(); });
  document.getElementById("viewSeg").addEventListener("click",function(e){
    var b=e.target.closest("[data-view]"); if(!b) return;
    view=b.getAttribute("data-view"); saveUi();
    this.querySelectorAll("button").forEach(function(x){x.classList.toggle("on",x.getAttribute("data-view")===view);});
    render();
  });
  var tb=document.getElementById("toggleDone");
  tb.addEventListener("click",function(){ hideDone=!hideDone; tb.textContent=hideDone?"Mostrar hechas":"Ocultar hechas"; tb.classList.toggle("active",hideDone); saveUi(); render(); });

  load();
  document.querySelectorAll("#viewSeg button").forEach(function(x){x.classList.toggle("on",x.getAttribute("data-view")===view);});
  tb.textContent=hideDone?"Mostrar hechas":"Ocultar hechas"; tb.classList.toggle("active",hideDone);
  render();
})();
</script>
</body>
</html>
`;

export async function GET() {
  return new Response(HTML, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
