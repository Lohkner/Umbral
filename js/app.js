/* ══════════════════════════════════════════════════════════════
   Umbral — ficha de personaje para Armisticio (Manual Oficial v1.0).
   La ficha se pinta entera desde el estado (App.pj) y cada cambio se
   guarda al momento. Los botones llevan data-acc="acción" y un único
   escuchador los reparte (ACC); los campos, data-campo.
══════════════════════════════════════════════════════════════ */
'use strict';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ico = (id, cls = 'ico') => `<svg class="${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
const S = Motor.signo;
const R = n => ROMANO[n] || '—';

const App = { pj: null, pag: 'ficha', scroll: {} };

/* ── Utilidades de interfaz ─────────────────────────────────── */
function aviso(txt, tipo) {
  const el = document.createElement('div');
  el.className = 'aviso' + (tipo === 'mal' ? ' mal' : '');
  el.textContent = txt;
  $('avisos').appendChild(el);
  setTimeout(() => el.remove(), 2600);
}
function vibrar(p) { try { navigator.vibrate && navigator.vibrate(p); } catch (e) { /* sin vibración */ } }
const calc = () => Motor.calcular(App.pj);
function guardar() { if (App.pj) Almacen.guardar(App.pj); }
function cambio(fn) { fn && fn(); guardar(); render(); }
function pvActual(c) { return App.pj.pv == null ? c.pvMax : App.pj.pv; }
function recursoActual(c) {
  const r = App.pj.recurso;
  return r == null ? c.recurso.inicioIdx : Math.min(r, c.recurso.maxIdx);
}

/* ── Diálogo genérico ───────────────────────────────────────── */
function abrirDlg({ titulo, cuerpo, pie = '', pasos = null, onClick = null, onMontar = null, onChange = null }) {
  const d = $('dlg');
  d.innerHTML = `
    <div class="dlg-cab"><h2 id="dlg_t">${esc(titulo)}</h2>
      <button class="ibtn" data-dlg="cerrar" aria-label="Cerrar">${ico('cerrar')}</button></div>
    ${pasos ? `<div class="pasos">${pasos}</div>` : ''}
    <div class="dlg-cuerpo">${cuerpo}</div>
    ${pie ? `<div class="dlg-pie">${pie}</div>` : ''}`;
  d.setAttribute('aria-labelledby', 'dlg_t');
  App._dlgClick = onClick;
  App._dlgChange = onChange;   // un solo manejador: el diálogo se reutiliza
  $('velo_dlg').hidden = false;
  onMontar && onMontar(d);
}
function cerrarDlg() { $('velo_dlg').hidden = true; $('dlg').innerHTML = ''; App._dlgClick = null; App._dlgChange = null; }
function confirmar(titulo, texto, etiqueta, fn, peligro) {
  abrirDlg({
    titulo, cuerpo: `<p>${esc(texto)}</p>`,
    pie: `<button class="btn" data-dlg="cerrar">Cancelar</button><button class="btn ${peligro ? 'peligro' : 'prim'}" data-dlg="ok">${esc(etiqueta)}</button>`,
    onClick: a => { if (a === 'ok') { cerrarDlg(); fn(); } },
  });
}
/* Pide un número: fijar, sumar o restar */
function pedirNumero(titulo, valor, fn, { operaciones = false, min = 0 } = {}) {
  abrirDlg({
    titulo,
    cuerpo: `<input type="number" inputmode="numeric" id="num_in" value="${operaciones ? '' : esc(valor)}" placeholder="${operaciones ? 'Cantidad' : ''}" aria-label="${esc(titulo)}">
      ${operaciones ? `<p class="leyenda">Ahora: <b>${esc(valor)}</b></p>` : ''}`,
    pie: operaciones
      ? `<button class="btn" data-dlg="restar">Restar</button><button class="btn" data-dlg="fijar">Fijar</button><button class="btn prim" data-dlg="sumar">Sumar</button>`
      : `<button class="btn" data-dlg="cerrar">Cancelar</button><button class="btn prim" data-dlg="fijar">Aceptar</button>`,
    onMontar: d => setTimeout(() => d.querySelector('#num_in')?.focus(), 60),
    onClick: a => {
      const n = parseInt($('num_in').value, 10);
      if (isNaN(n)) { aviso('Escribe un número', 'mal'); return; }
      const v = a === 'sumar' ? valor + n : a === 'restar' ? valor - n : n;
      cerrarDlg(); fn(Math.max(min, v));
    },
  });
}

/* ══════════════════════════════════════════════════════════════
   TIRADAS
   Se toca una casilla y se tira. La ventaja o desventaja (por Rango o
   por circunstancias) se decide después: el resultado ofrece repetir la
   tirada con dos dados. Nada que configurar antes.
══════════════════════════════════════════════════════════════ */
function tirar(cfg, v = 0) {
  const t = Motor.d20(v);
  const nat = t.natural;
  const total = nat + cfg.mod;
  const crit = nat >= (cfg.critMin || 20);
  const pifia = nat === 1;
  apuntar(cfg.titulo, total, `d20${v > 0 ? ' con ventaja' : v < 0 ? ' con desventaja' : ''}: ${t.dados.join(' · ')} ${S(cfg.mod)}`);

  let marcado = false;
  const dados = t.dados.map(n => {
    const es = n === nat && !marcado; if (es) marcado = true;
    return dadoRodando(n, 20, es ? (crit ? 'crit' : pifia ? 'pifia' : '') : 'descartado');
  }).join('');
  const ver = crit ? '<span class="veredicto crit">Crítico</span>' : pifia ? '<span class="veredicto mal">Pifia</span>' : '';
  const nota = crit ? cfg.notaCrit : pifia ? cfg.notaPifia : '';
  const extras = (cfg.extras || []).filter(x => !x.si || x.si({ crit, pifia }));
  const humano = App.pj.raza === 'humano' && !App.pj.repeticionUsada;

  $('tirada').innerHTML = `
    <div class="tirada-t" id="tirada_titulo">${esc(cfg.titulo)}</div>
    <div class="tirada-f">d20 ${S(cfg.mod)}${v ? (v > 0 ? ' · ventaja' : ' · desventaja') : ''}</div>
    <div class="dados">${dados}</div>
    <div class="tirada-res">
      <div class="tirada-total">${total}</div>
      ${ver}
      ${nota ? `<div class="tirada-notas"><div>${esc(nota)}</div></div>` : ''}
      <div class="fila-btn">
        <button class="btn fino" data-tacc="v1">Con ventaja</button>
        <button class="btn fino" data-tacc="v-1">Con desventaja</button>
      </div>
      <div class="fila-btn">
        ${extras.map((x, i) => `<button class="btn fino" data-tacc="${i}">${esc(x.etiqueta)}</button>`).join('')}
        ${humano ? '<button class="btn fino" data-tacc="humano">Repetir</button>' : ''}
        <button class="btn fino prim" data-tacc="cerrar">Cerrar</button>
      </div>
    </div>`;
  App._tirada = { cfg, acciones: extras.map(x => ({ fn: () => x.fn({ crit, pifia }) })) };
  $('velo_tirada').hidden = false;
  rodar(crit ? [15, 40, 15, 40, 30] : pifia ? [40] : [14]);
}

function mostrarSimple({ titulo, formula, dados, total, notas = [], veredicto = '', acciones = [] }) {
  // Las caras del dado que «rueda» salen de la fórmula (d6, 2d8, d10…)
  const caras = +((/d(\d+)/.exec(formula || '') || [])[1] || 6);
  $('tirada').innerHTML = `
    <div class="tirada-t" id="tirada_titulo">${esc(titulo)}</div>
    ${formula ? `<div class="tirada-f">${esc(formula)}</div>` : ''}
    ${dados && dados.length ? `<div class="dados">${dados.map(n => dadoRodando(n, caras, '')).join('')}</div>` : ''}
    <div class="tirada-res">
      <div class="tirada-total">${esc(total)}</div>
      ${veredicto}
      ${notas.length ? `<div class="tirada-notas">${notas.map(n => `<div>${esc(n)}</div>`).join('')}</div>` : ''}
      <div class="fila-btn">
        ${acciones.map((a, i) => `<button class="btn fino" data-tacc="${i}">${esc(a.etiqueta)}</button>`).join('')}
        <button class="btn fino prim" data-tacc="cerrar">Cerrar</button>
      </div>
    </div>`;
  App._tirada = { cfg: null, acciones };
  $('velo_tirada').hidden = false;
  rodar([12]);
}

/* ── El «roll» ──────────────────────────────────────────────────
   El dado se queda quieto y es el número el que rueda dentro, como el
   rodillo de una tragaperras: cada cara entra por arriba y la anterior
   sale por abajo, cada vez más despacio. Los dados se asientan uno tras
   otro y solo entonces aparecen el total y los botones: el resultado no
   se adelanta. Con «reducir movimiento» se muestra directo. Se usa
   setTimeout y no requestAnimationFrame para que funcione igual con la
   pestaña en segundo plano. */
function dadoRodando(valor, caras, clase) {
  return `<span class="dado rodando" data-v="${valor}" data-caras="${caras}" data-c="${clase}"><span class="cara">${1 + Math.floor(Math.random() * caras)}</span></span>`;
}
function ponerCara(d, n, ms, clase = 'entra') {
  d.querySelectorAll('.cara:not(.sale)').forEach(v => {
    v.className = 'cara sale'; v.style.animationDuration = ms + 'ms';
    setTimeout(() => v.remove(), ms);
  });
  const c = document.createElement('span');
  c.className = 'cara ' + clase;
  c.style.animationDuration = ms + 'ms';
  c.textContent = n;
  d.appendChild(c);
}
function rodar(vibracionFinal) {
  clearTimeout(App._rodarT);
  const token = App._rodarToken = (App._rodarToken || 0) + 1;
  const card = $('tirada');
  const dados = [...card.querySelectorAll('.dado[data-v]')];
  const res = card.querySelector('.tirada-res');
  const directo = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const asentar = d => {
    if (directo) d.innerHTML = `<span class="cara">${d.dataset.v}</span>`;
    else ponerCara(d, d.dataset.v, 300, 'asienta');
    d.classList.remove('rodando');
    d.classList.add('asentado');
    if (d.dataset.c) d.classList.add(d.dataset.c);
  };
  const mostrar = () => { res && res.classList.add('visible'); vibrar(vibracionFinal); };
  if (directo || !dados.length) {
    dados.forEach(asentar); mostrar(); return;
  }
  vibrar([6, 50, 6, 60, 6, 80, 6]);
  const esperas = [45, 50, 55, 60, 70, 80, 95, 115, 140, 170];   // ~0,9 s, frenando
  let paso = 0;
  const tic = () => {
    if (token !== App._rodarToken) return;
    const ms = esperas[Math.min(paso, esperas.length - 1)];
    dados.forEach(d => { if (d.classList.contains('rodando')) ponerCara(d, 1 + Math.floor(Math.random() * (+d.dataset.caras || 20)), ms); });
    if (paso < esperas.length) { App._rodarT = setTimeout(tic, esperas[paso++]); return; }
    // se asientan de uno en uno
    dados.forEach((d, i) => setTimeout(() => { if (token === App._rodarToken) asentar(d); }, i * 110));
    App._rodarT = setTimeout(() => { if (token === App._rodarToken) mostrar(); }, (dados.length - 1) * 110 + 160);
  };
  tic();
}

function apuntar(titulo, total, detalle) {
  const h = App.pj.historial || (App.pj.historial = []);
  h.unshift({ t: titulo, total, d: detalle, ts: Date.now() });
  h.length = Math.min(h.length, 30);
  guardar();
}

/* ── Qué se tira ────────────────────────────────────────────── */
const NOM_ATAQUE = { cac: 'Cuerpo a cuerpo', dist: 'A distancia', magia: 'Mágico' };
function cfgPrueba(a) { const c = calc(); return { titulo: `Prueba de ${NOMBRE_ATR[a]}`, mod: c.mods[a] }; }
function cfgSalvacion(a) {
  const c = calc();
  return { titulo: `Salvación de ${NOMBRE_ATR[a]}`, mod: c.mods[a] + c.comp,
    notaCrit: 'Resistes y algo sale a tu favor.', notaPifia: 'Fallas y algo sale mal.' };
}
function cfgAtaque(tipo) {
  const c = calc();
  const suyo = { guerrero: tipo !== 'magia', picaro: tipo !== 'magia', mago: tipo === 'magia', clerigo: true }[App.pj.clase];
  return {
    titulo: `Atacar · ${NOM_ATAQUE[tipo]}`, mod: c.ataque[tipo], critMin: c.critMin,
    notaCrit: 'Alcanzas siempre, no se puede bloquear y el daño se tira dos veces.',
    notaPifia: 'Fallas, y se te rompe el arma o la munición, o el enemigo te ataca gratis.',
    extras: [{ etiqueta: 'Daño', si: r => !r.pifia, fn: r => tiradaDano({ crit: r.crit, d4: !suyo }) }],
  };
}
/* Bloquear (gasta la Reacción): tirada de combate cuerpo a cuerpo, +2 con
   escudo, contra el resultado del ataque. */
function cfgBloqueo() {
  const c = calc();
  return { titulo: 'Bloquear', mod: c.bloqueo,
    notaCrit: 'Bloqueas y contraatacas gratis.', notaPifia: 'No bloqueas: daño máximo y tu Armadura no cuenta.' };
}
function cfgIniciativa() {
  const c = calc();
  return { titulo: 'Iniciativa (CD 12)', mod: c.mods.DES };
}

function tiradaDano({ crit = false, d4 = false, conRecurso = false, emboscada = false } = {}) {
  const c = calc();
  const expr = d4 ? 'd4' : c.dado;
  let total, dados = [], formula = expr + (crit ? ' ×2' : '');
  if (emboscada) { total = Motor.maxDe(expr); formula = `${expr} al máximo`; }
  else {
    const a = Motor.tirar(expr); dados = a.dados.slice(); total = a.total;
    if (crit) { const b = Motor.tirar(expr); dados = dados.concat(b.dados); total += b.total; }
  }
  const idx = recursoActual(c);
  if (conRecurso && idx >= 0) {
    const rr = Motor.tirar(ESCALERA[idx]);
    total += rr.total; dados = dados.concat(rr.dados);
    formula += ` + ${ESCALERA[idx]} de ${c.recurso.nombre}`;
    App.pj.recurso = App.pj.clase === 'guerrero' ? Math.max(0, idx - 1) : -1;
    guardar(); render();
  }
  apuntar('Daño', total, formula);
  const puedeRec = !conRecurso && idx >= 0 && (App.pj.clase === 'guerrero' || App.pj.clase === 'picaro');
  const acciones = [];
  if (!crit && !emboscada) acciones.push({ etiqueta: 'Crítico ×2', fn: () => tiradaDano({ crit: true, d4, conRecurso }) });
  if (puedeRec) acciones.push({ etiqueta: App.pj.clase === 'guerrero' ? '+ Furia' : '+ Combo', fn: () => tiradaDano({ crit, d4, conRecurso: true, emboscada }) });
  if (App.pj.clase === 'picaro' && !emboscada && !crit) acciones.push({ etiqueta: 'Emboscada', fn: () => tiradaDano({ emboscada: true, d4 }) });
  mostrarSimple({ titulo: 'Daño', formula, dados, total, notas: ['Réstale la Armadura del enemigo (mínimo 1).'], acciones });
}

/* ── Recurso ────────────────────────────────────────────────── */
function ajustarRecurso(delta) {
  const c = calc();
  App.pj.recurso = Motor.clamp(recursoActual(c) + delta, c.recurso.min ?? -1, c.recurso.maxIdx);
  guardar(); render();
}
function usarRecurso() {
  const c = calc();
  const idx = recursoActual(c);
  if (idx < 0) { aviso(`No te queda ${c.recurso.nombre}`, 'mal'); return; }
  const t = Motor.tirar(ESCALERA[idx]);
  const baja = t.total <= 2;
  if (baja) App.pj.recurso = idx - 1;
  guardar(); render();
  apuntar(`Usar ${c.recurso.nombre}`, t.total, ESCALERA[idx]);
  mostrarSimple({
    titulo: `Usar ${c.recurso.nombre}`, formula: ESCALERA[idx], dados: t.dados, total: t.total,
    veredicto: baja ? `<span class="veredicto mal">${idx - 1 < 0 ? 'Agotado' : 'Baja un escalón'}</span>` : '<span class="veredicto ok">Se mantiene</span>',
  });
}

/* ── Caer y descansar ───────────────────────────────────────── */
function dlgFueraCombate() {
  abrirDlg({
    titulo: 'Fuera de Combate',
    cuerpo: `<label class="marca"><input type="checkbox" id="fc_golpes"> Me siguieron golpeando en el suelo</label>`,
    pie: '<button class="btn" data-dlg="cerrar">Cancelar</button><button class="btn prim" data-dlg="ok">Tirar d6</button>',
    onClick: a => {
      if (a !== 'ok') return;
      const dos = $('fc_golpes').checked;
      const d1 = Motor.d(6), d2 = dos ? Motor.d(6) : null;
      const n = dos ? Math.min(d1, d2) : d1;
      cerrarDlg();
      const [nom, txt] = FUERA_COMBATE[n];
      const c = calc();
      const acciones = [];
      if (n === 6) App.pj.pv = Math.min(c.pvMax, Motor.tirar('d4').total);
      if (n === 5) App.pj.pv = 1;
      if (n === 4) App.pj.heridas.push('Inconsciente hasta el final del día');
      if (n === 1) App.pj.heridas.push('Muerto');
      if (n === 2) ATRIBUTOS.forEach(a2 => acciones.push({ etiqueta: `−1 ${a2}`, fn: () => cambio(() => {
        App.pj.base[a2] = Math.max(3, (+App.pj.base[a2] || 10) - 1);
        App.pj.heridas.push(`Herida grave: −1 ${NOMBRE_ATR[a2]} para siempre`);
      }) }));
      if (n === 3) ATRIBUTOS.forEach(a2 => acciones.push({ etiqueta: a2, fn: () => cambio(() => {
        App.pj.heridas.push(`Maltrecho: desventaja en ${NOMBRE_ATR[a2]} hasta descansar en la ciudad`);
      }) }));
      guardar(); render();
      apuntar('Fuera de Combate', n, dos ? `2d6: ${d1} · ${d2}` : `d6: ${d1}`);
      mostrarSimple({
        titulo: 'Fuera de Combate', formula: dos ? '2d6, el más bajo' : 'd6', dados: dos ? [d1, d2] : [d1], total: n,
        veredicto: `<span class="veredicto ${n >= 5 ? 'ok' : n === 1 ? 'mal' : 'crit'}">${esc(nom)}</span>`,
        notas: [txt].concat(n === 2 ? ['¿Qué atributo pierde un punto?'] : n === 3 ? ['¿Qué atributo queda maltrecho?'] : []),
        acciones,
      });
    },
  });
}
function dlgDescansar() {
  abrirDlg({
    titulo: 'Descansar',
    cuerpo: `<div class="opciones">${DESCANSOS.map(d => `
      <button class="opcion" data-dlg="${d.id}"><span class="opcion-n">${esc(d.nombre)}<small>${esc(d.coste)}</small></span><span class="opcion-t">${esc(d.txt)}</span></button>`).join('')}</div>`,
    onClick: a => { if (DESCANSOS.some(d => d.id === a)) { cerrarDlg(); descansar(a); } },
  });
}
function descansar(id) {
  const c = calc();
  const pj = App.pj;
  if (id === 'corto') {
    const t = Motor.tirar(c.cl.vida);
    pj.pv = Math.min(c.pvMax, pvActual(c) + t.total);
    guardar(); render();
    apuntar('Descanso corto', t.total, c.cl.vida);
    mostrarSimple({ titulo: 'Descanso corto', formula: c.cl.vida, dados: t.dados, total: `+${t.total}`, notas: [`PV ${pj.pv} / ${c.pvMax}`] });
    return;
  }
  if (id === 'largo') {
    if ((+pj.consumibles.raciones || 0) < 1) { aviso('Sin ración no descansas', 'mal'); return; }
    pj.consumibles.raciones -= 1;
    pj.pv = Math.min(c.pvMax, pvActual(c) + Math.floor(c.pvMax / 2));
    if (!c.recurso.sube) pj.recurso = c.recurso.maxIdx;
    guardar(); render();
    aviso(`+${Math.floor(c.pvMax / 2)} PV · −1 ración`);
    return;
  }
  pj.pv = c.pvMax;
  pj.recurso = c.recurso.sube ? c.recurso.inicioIdx : c.recurso.maxIdx;
  pj.heridas = pj.heridas.filter(h => !/^Maltrecho|^Inconsciente/.test(h));
  guardar(); render();
  aviso('Todo recuperado');
}
function nuevoCombate() {
  const c = calc();
  App.pj.recurso = c.recurso.inicioIdx;
  guardar(); render();
  aviso(`${c.recurso.nombre} ${Motor.escalon(c.recurso.inicioIdx)}`);
}

/* ══════════════════════════════════════════════════════════════
   PINTAR
══════════════════════════════════════════════════════════════ */
const PAGINAS = ['ficha', 'estadisticas', 'equipo', 'notas'];
function render() {
  const enFicha = !!App.pj;
  $('pantalla_inicio').hidden = enFicha;
  $('pantalla_ficha').hidden = !enFicha;
  $('pestanas').hidden = !enFicha;
  $('btn_atras').hidden = !enFicha;
  if (!enFicha) {
    $('barra_nombre').textContent = 'Umbral';
    $('barra_sub').textContent = 'Ficha para Armisticio';
    pintarInicio();
    return;
  }
  const c = calc();
  const pj = App.pj;
  if (!PAGINAS.includes(App.pag)) App.pag = 'ficha';
  $('barra_nombre').textContent = pj.nombre || 'Sin nombre';
  $('barra_sub').textContent = `${RAZAS[pj.raza]?.nombre || ''} · ${c.cl.nombre} · Nivel ${c.nivel}`;
  document.querySelectorAll('.pest').forEach(b => b.classList.toggle('activa', b.dataset.pag === App.pag));
  PAGINAS.forEach(p => { $('pag_' + p).hidden = p !== App.pag; });
  ({ ficha: pintarFicha, estadisticas: pintarEstadisticas, equipo: pintarEquipo, notas: pintarNotas })[App.pag](c);
}

/* ── Cambiar de pestaña ─────────────────────────────────────────
   Con la barra de abajo o deslizando el dedo. Cada pestaña recuerda
   dónde se quedó, y la nueva entra desde el lado hacia el que se va. */
function irA(pag, dir) {
  if (pag === App.pag || !PAGINAS.includes(pag)) return;
  App.scroll[App.pag] = window.scrollY;
  dir = dir || (PAGINAS.indexOf(pag) > PAGINAS.indexOf(App.pag) ? 1 : -1);
  App.pag = pag;
  render();
  window.scrollTo(0, App.scroll[pag] || 0);
  const el = $('pag_' + pag);
  if (el.animate && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el.animate([{ transform: `translateX(${dir * 22}%)`, opacity: 0 }, { transform: 'none', opacity: 1 }],
      { duration: 220, easing: 'cubic-bezier(.2,.8,.3,1)' });
  }
}

/* Deslizar: la página sigue al dedo y, pasado un cuarto de pantalla (o
   con un gesto rápido), cambia a la vecina. Solo gestos claramente
   horizontales; el desplazamiento vertical queda intacto. */
(() => {
  const zona = $('pantalla_ficha');
  let x0 = 0, y0 = 0, t0 = 0, modo = null, el = null;
  const suelta = (e, ms) => {
    if (!e) return;
    e.style.transition = `transform ${ms}ms ease-out, opacity ${ms}ms ease-out`;
    e.style.transform = ''; e.style.opacity = '';
    setTimeout(() => { e.style.transition = ''; }, ms);
  };
  zona.addEventListener('touchstart', e => {
    const t = e.touches[0];
    modo = null; el = $('pag_' + App.pag);
    // Varios dedos, campos de texto o los bordes (gestos del sistema): nada
    if (e.touches.length > 1 || e.target.closest('input,textarea,select,[contenteditable]') ||
        t.clientX < 18 || t.clientX > innerWidth - 18) { modo = 'no'; return; }
    x0 = t.clientX; y0 = t.clientY; t0 = Date.now();
  }, { passive: true });
  zona.addEventListener('touchmove', e => {
    if (modo === 'no') return;
    const t = e.touches[0];
    const dx = t.clientX - x0, dy = t.clientY - y0;
    if (!modo) {
      if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return;
      modo = Math.abs(dx) > Math.abs(dy) * 1.3 ? 'h' : 'no';
      if (modo === 'no') return;
      el.style.transition = 'none';
    }
    const i = PAGINAS.indexOf(App.pag);
    const hay = dx < 0 ? i < PAGINAS.length - 1 : i > 0;
    el.style.transform = `translateX(${hay ? dx : dx / 5}px)`;   // en los extremos, se resiste
    el.style.opacity = hay ? 1 - Math.min(Math.abs(dx) / innerWidth, 1) * .7 : '';
  }, { passive: true });
  const fin = e => {
    const era = modo; modo = null;
    if (era !== 'h') return;
    const t = e.changedTouches[0];
    const dx = (t ? t.clientX : x0) - x0;
    const rapido = Math.abs(dx) > 45 && Date.now() - t0 < 280;
    const i = PAGINAS.indexOf(App.pag);
    const dest = Math.abs(dx) > innerWidth * .25 || rapido ? i + (dx < 0 ? 1 : -1) : i;
    if (dest === i || dest < 0 || dest >= PAGINAS.length) { suelta(el, 200); return; }
    const sale = el;
    sale.style.transition = 'transform .12s ease-in, opacity .12s ease-in';
    sale.style.transform = `translateX(${dx < 0 ? -40 : 40}%)`;
    sale.style.opacity = '0';
    vibrar(4);
    setTimeout(() => {
      sale.style.transition = ''; sale.style.transform = ''; sale.style.opacity = '';
      irA(PAGINAS[dest], dx < 0 ? 1 : -1);
    }, 120);
  };
  zona.addEventListener('touchend', fin);
  zona.addEventListener('touchcancel', () => { if (modo === 'h') suelta(el, 200); modo = null; });
})();

function pintarInicio() {
  const lista = Almacen.lista();
  $('pantalla_inicio').innerHTML = `
    <div class="hero">
      <img class="hero-emblema" src="icons/esqueleto-original.webp" alt="" width="120" height="120">
      <div class="hero-marca">Umbral</div>
      <div class="hero-sub">Ficha para Armisticio</div>
      <div class="hero-filete"></div>
    </div>
    <div class="pagina">
      <button class="btn prim" data-acc="nuevo">${ico('mas')}Nuevo personaje</button>
      <div class="pj-lista">
        ${lista.length ? lista.map(p => `<button class="pj-item" data-acc="abrir" data-id="${esc(p.id)}">
            ${p.retrato ? `<img class="pj-foto" src="${p.retrato}" alt="">` : `<span class="pj-sello">${p.nivel || 1}</span>`}
            <span class="pj-datos"><span class="pj-nom">${esc(p.nombre || 'Sin nombre')}</span>
            <span class="pj-sub">${esc(RAZAS[p.raza]?.nombre || '')} · ${esc(CLASES[p.clase]?.nombre || '')} · Nivel ${p.nivel || 1}</span></span>
          </button>`).join('') : '<p class="vacio">Aún no hay nadie en la frontera.</p>'}
      </div>
      <div class="fila-btn">
        <button class="btn fino" data-acc="pregenerados">Pregenerados</button>
        <button class="btn fino" data-acc="importar">Importar</button>
        <button class="btn fino" data-acc="exportar">Copia</button>
      </div>
      <input type="file" id="archivo" accept="application/json,.json" hidden>
    </div>`;
}

/* ── Tarjetas plegables ─────────────────────────────────────────
   Recuerdan si quedaron abiertas (preferencia de quien juega, aparte en
   arm_folds). Plegadas enseñan una línea de resumen. */
const FOLDS_POR_DEFECTO = { habilidades: false, tiradas: false, referencia: false };
function foldAbierta(id) {
  try { const p = JSON.parse(localStorage.getItem('arm_folds')) || {}; if (id in p) return !!p[id]; } catch (e) { /* sin almacenamiento */ }
  return id in FOLDS_POR_DEFECTO ? FOLDS_POR_DEFECTO[id] : true;
}
function tarjeta(id, titulo, contenido, { peek = '', der = '' } = {}) {
  return `<details class="card fold" data-fold="${id}" ${foldAbierta(id) ? 'open' : ''}>
    <summary class="card-t"><span class="card-tt">${esc(titulo)}</span>
      ${der ? `<span class="der">${der}</span>` : ''}${peek ? `<span class="peek">${peek}</span>` : ''}</summary>
    <div class="fold-cuerpo">${contenido}</div>
  </details>`;
}

function pintarFicha(c) {
  const pj = App.pj;
  const pv = pvActual(c);
  const rec = c.recurso;
  const ri = recursoActual(c);
  const colorRec = { Furia: 'var(--furia)', Combo: 'var(--combo)', Maná: 'var(--mana)', Fe: 'var(--fe)' }[rec.nombre];
  const tramos = ESCALERA.slice(0, rec.maxIdx + 1).map((e, i) => `<i class="${i <= ri ? 'lleno' : ''}"></i>`).join('');
  const puedeSubir = pj.hitos >= c.hitosNecesarios && c.nivel < 10;
  const habPend = NIVELES_HABILIDAD.filter(n => c.nivel >= n).length - pj.habilidades.length;

  // Casillas de tirada: lo que se usa en cada combate
  // Una sola tirada, la de combate, para atacar y para bloquear (v1.0)
  const casillas = [
    { acc: 'ataque', t: c.ataquePrincipal, n: 'Combate', v: S(c.ataque[c.ataquePrincipal]), s: NOM_ATAQUE[c.ataquePrincipal].toLowerCase() },
    { acc: 'dano', n: 'Daño', v: c.dado, s: 'dado de clase' },
    { n: 'Guardia', v: c.guardia, s: `desprevenido ${c.guardiaDesprevenido}` },
  ];
  if (pj.clase === 'clerigo') casillas.push({ acc: 'ataque', t: 'magia', n: 'Combate', v: S(c.ataque.magia), s: 'mágico' });
  if (c.bloqueo != null) casillas.push({ acc: 'bloqueo', n: 'Bloquear', v: S(c.bloqueo), s: 'Reacción' });
  casillas.push({ n: 'Armadura', v: c.armadura, s: `máximo ${c.armaduraMax}` });
  casillas.push({ acc: 'iniciativa', n: 'Iniciativa', v: S(c.mods.DES), s: 'contra 12' });

  $('pag_ficha').innerHTML = `
    ${c.avisos.map(a => `<div class="aviso-f">${esc(a)}</div>`).join('')}
    <div class="card portada">
      <button class="retrato${pj.retrato ? '' : ' sin'}" data-acc="retrato" aria-label="${pj.retrato ? 'Cambiar retrato' : 'Añadir retrato'}">
        ${pj.retrato ? `<img src="${pj.retrato}" alt="Retrato de ${esc(pj.nombre)}">` : `<img class="retrato-fantasma" src="icons/esqueleto-original.webp" alt=""><span>Añadir retrato</span>`}
      </button>
      <div class="portada-nom">${esc(pj.nombre || 'Sin nombre')}</div>
      <div class="portada-sub">${esc(RAZAS[pj.raza]?.nombre)} · ${esc(c.cl.nombre)} · ${esc(PROFESIONES[pj.profesion]?.nombre)}</div>
      <div class="portada-motivo">${esc(pj.motivo)}</div>
      <div class="hitos">
        <span class="hitos-n">Nivel <b>${c.nivel}</b></span>
        <span class="hitos-n">Hitos <b>${pj.hitos}</b>/${c.nivel < 10 ? c.hitosNecesarios : '—'}</span>
        <button class="pm" style="--c:var(--titulo)" data-acc="hitos" data-d="1" aria-label="Sumar un hito">+</button>
      </div>
      ${puedeSubir ? `<button class="btn prim ancho" data-acc="subir">Subir a nivel ${c.nivel + 1}</button>` : ''}
      ${habPend > 0 ? `<button class="btn ancho" data-acc="elegir-hab">Elegir habilidad nueva</button>` : ''}
      <input type="file" id="retrato_in" accept="image/*" hidden>
    </div>

    ${tarjeta('estado', 'Estado', `
      <div class="pv-fila">
        <button class="pm menos" style="--c:var(--sangre-b)" data-acc="pv" data-d="-1" aria-label="Quitar 1 PV">−</button>
        <div class="pv-num"><span class="act">${pv}</span> <span class="max">/ ${c.pvMax}</span></div>
        <button class="pm" style="--c:var(--ok)" data-acc="pv" data-d="1" aria-label="Sumar 1 PV">+</button>
      </div>
      <div class="barra-pv${pv <= c.pvMax / 4 ? ' baja' : ''}"><i style="width:${Math.round(100 * pv / c.pvMax)}%"></i></div>
      <div class="rec" style="--rc:${colorRec}">
        <div class="rec-fila">
          <span class="rec-n">${esc(rec.nombre)}</span>
          ${rec.sube ? '' : `<button class="enlace" data-acc="rec-usar">usar</button>`}
          <span class="rec-v">${ri >= 0 ? ESCALERA[ri] : '—'}</span>
          <button class="pm menos" style="--c:${colorRec}" data-acc="rec" data-d="-1" aria-label="Bajar ${esc(rec.nombre)}">−</button>
          <button class="pm" style="--c:${colorRec}" data-acc="rec" data-d="1" aria-label="Subir ${esc(rec.nombre)}">+</button>
        </div>
        <div class="rec-tramos">${tramos}</div>
      </div>
      <div class="fila-btn" style="margin-top:12px">
        ${pv === 0 ? '<button class="btn fino peligro" data-acc="fuera">Fuera de Combate</button>' : ''}
        ${rec.sube ? '<button class="btn fino" data-acc="nuevo-combate">Nuevo combate</button>' : ''}
        <button class="btn fino" data-acc="descansar">Descansar</button>
      </div>`, { peek: `PV ${pv}/${c.pvMax} · ${rec.nombre} ${ri >= 0 ? ESCALERA[ri] : '—'}` })}

    ${tarjeta('combate', 'Combate', `
      <div class="nums">${casillas.map(k => k.acc
        ? `<button class="num" data-acc="${k.acc}"${k.t ? ` data-t="${k.t}"` : ''}><span class="num-n">${k.n}</span><span class="num-v">${esc(k.v)}</span><span class="num-s">${esc(k.s)}</span></button>`
        : `<div class="num fijo"><span class="num-n">${k.n}</span><span class="num-v">${esc(k.v)}</span><span class="num-s">${esc(k.s)}</span></div>`).join('')}
      </div>`, { peek: `Combate ${S(c.ataque[c.ataquePrincipal])} · Guardia ${c.guardia}` })}`;
}

function pintarEstadisticas(c) {
  const pj = App.pj;
  const habs = c.cl.habilidades.map(([n, t]) => `<div class="hab"><div class="hab-n">${esc(n)}</div><div class="hab-t">${esc(t)}</div></div>`);
  pj.habilidades.forEach(id => {
    for (const est of ESTILOS[pj.clase] || []) {
      const h = est.hab.find(x => x[0] === id);
      if (h) habs.push(`<div class="hab"><div class="hab-n">${esc(h[1])}</div><div class="hab-t">${esc(h[2])}</div></div>`);
    }
  });
  c.efectos.forEach(e => habs.push(`<div class="hab"><div class="hab-t">${esc(e)}</div></div>`));
  if (c.resist.length) habs.push(`<div class="hab"><div class="hab-t">Resistencia: ventaja al resistir ${esc(c.resist.map(r => RESISTENCIAS[r].toLowerCase()).join(', '))}.</div></div>`);

  $('pag_estadisticas').innerHTML = `
    ${tarjeta('atributos', 'Atributos', `
      <div class="atrs">${ATRIBUTOS.map(a => `
        <div class="atr">
          <button class="atr-prueba" data-acc="prueba" data-a="${a}" aria-label="Prueba de ${NOMBRE_ATR[a]}">
            <span class="atr-n">${NOMBRE_ATR[a]}</span>
            <span class="atr-mod">${S(c.mods[a])}</span>
            <span class="atr-val">${c.atr[a]}</span>
          </button>
          <button class="atr-salva" data-acc="salva" data-a="${a}" aria-label="Salvación de ${NOMBRE_ATR[a]}">Salvación ${S(c.mods[a] + c.comp)}</button>
        </div>`).join('')}
      </div>`, { peek: ATRIBUTOS.map(a => `${a[0]} ${S(c.mods[a])}`).join(' · ') })}

    ${tarjeta('habilidades', 'Habilidades', habs.join(''), { peek: `${habs.length}` })}`;
}

const ICO_RANURA = { arma: 'espada', armadura: 'armadura', escudo: 'escudo', amuleto: 'amuleto', anillo1: 'anillo', anillo2: 'anillo' };
function resumenObjeto(it, tipo) {
  const partes = [];
  if (it.ranura === 'armadura') { const a = ARMADURAS.find(x => x.id === it.sub); if (a) partes.push(`Armadura ${a.valor}`); }
  if (it.ranura === 'escudo') { const e = ESCUDOS.find(x => x.id === it.sub); partes.push(e ? `Guardia +${e.guardia}` : 'Secundaria'); }
  (it.props || []).forEach(p => {
    const P = PROPIEDADES.find(x => x && x.id === p.id); if (!P) return;
    let n = P.nombre;
    if (p.id === 'mejora') n = { arma: '+1 escalón', armadura: '+1 Armadura', escudo: '+1 Guardia', joya: `+1 ${p.atr || 'atributo'}` }[tipo] || n;
    if (p.id === 'atributo') n = `+1 ${p.atr || 'atributo'}`;
    if (p.id === 'resistencia') n = `Resistencia ${RESISTENCIAS[p.res] || ''}`.trim();
    if (p.id === 'engaste') return;
    partes.push(n);
  });
  (it.gemas || []).filter(Boolean).forEach(g => partes.push(GEMAS[g].nombre));
  return partes.join(' · ') || RAREZAS[it.rareza]?.nombre || 'Común';
}

function pintarEquipo(c) {
  const pj = App.pj;
  const slots = RANURAS.map(r => {
    const it = pj.equipo[r.id];
    if (!it) return `<button class="slot vacio" data-acc="slot" data-r="${r.id}">
        <span class="slot-ico">${ico(ICO_RANURA[r.id])}</span><span class="slot-datos"><span class="slot-nom">${esc(r.nombre)}</span></span>${ico('mas')}</button>`;
    return `<button class="slot r-${esc(it.rareza || 'comun')}" data-acc="slot" data-r="${r.id}">
        <span class="slot-ico">${ico(ICO_RANURA[r.id])}</span>
        <span class="slot-datos"><span class="slot-nom">${esc(it.nombre || r.nombre)}</span><span class="slot-sub">${esc(resumenObjeto(it, r.tipo))}</span></span>
        <span class="rango">${R(it.rango || 1)}</span></button>`;
  }).join('');
  const lleno = c.ranurasUsadas > c.ranurasMax;
  const inv = pj.inventario.map((it, i) => `
    <div class="inv-item r-${esc(it.rareza || 'comun')}">
      <button class="inv-nom" data-acc="inv-editar" data-i="${i}">${esc(it.nombre || 'Objeto')}</button>
      ${it.ranura !== 'otro' ? `<button class="ibtn" data-acc="inv-equipar" data-i="${i}" aria-label="Equipar">${ico('flecha-arriba')}</button>` : ''}
    </div>`).join('');
  const mats = pj.materiales.map((m, i) => `
    <div class="contador">
      <span class="contador-n"><b>${esc(m.nombre)}</b><small>Rango ${R(m.rango || 1)}</small></span>
      <button class="pm menos" data-acc="mat" data-i="${i}" data-d="-1" aria-label="Quitar">−</button>
      <span class="contador-v">${m.cantidad}</span>
      <button class="pm" data-acc="mat" data-i="${i}" data-d="1" aria-label="Añadir">+</button>
    </div>`).join('');
  const contador = (k, nombre, extra = '') => `
    <div class="contador">
      <span class="contador-n"><b>${nombre}</b>${extra}</span>
      <button class="pm menos" data-acc="cons" data-k="${k}" data-d="-1" aria-label="Quitar">−</button>
      <button class="contador-v" data-acc="cons-num" data-k="${k}">${+pj.consumibles[k] || 0}</button>
      <button class="pm" data-acc="cons" data-k="${k}" data-d="1" aria-label="Añadir">+</button>
    </div>`;
  const luz = Object.entries(DADOS_USO).map(([k, u]) => {
    const v = pj.usos[k];
    const tiene = v != null && v >= 0;
    return `<div class="contador">
      <span class="contador-n"><b>${esc(u.nombre)}</b></span>
      ${tiene ? `<button class="btn fino" data-acc="uso" data-k="${k}">Usar ${ESCALERA[v]}</button>` : `<button class="btn fino" data-acc="uso-nuevo" data-k="${k}">Nuevas</button>`}
    </div>`;
  }).join('');

  $('pag_equipo').innerHTML = `
    ${tarjeta('equipo', 'Equipo', slots)}

    ${tarjeta('mochila', 'Mochila', `
      ${lleno ? '<div class="aviso-f">No cabe todo: lo que sobra se deja atrás.</div>' : ''}
      ${inv || '<p class="vacio">Vacía.</p>'}
      ${mats}
      <div class="fila-btn" style="margin-top:10px">
        <button class="btn fino" data-acc="inv-nuevo">${ico('mas')}Objeto</button>
        <button class="btn fino" data-acc="mat-nuevo">${ico('mas')}Material</button>
      </div>`, { der: `${c.ranurasUsadas}/${c.ranurasMax}` })}

    ${tarjeta('provisiones', 'Provisiones', `
      <div class="contador">
        <span class="contador-n"><b>Oro</b></span>
        <button class="contador-v oro" data-acc="oro">${pj.oro || 0}</button>
      </div>
      ${contador('raciones', 'Raciones')}
      ${contador('pociones', 'Pociones', `<small><button class="enlace" data-acc="pocion-rango">cura ${POCION_CURA[pj.pocionRango || 1]}</button></small>`)}
      ${pj.clase === 'picaro' || +pj.consumibles.flechas ? contador('flechas', 'Flechas') : ''}
      ${pj.clase === 'picaro' || +pj.consumibles.veneno ? contador('veneno', 'Veneno') : ''}
      ${contador('portal', 'Portales')}
      ${luz}`, { peek: `${pj.oro || 0} oro · ${+pj.consumibles.raciones || 0} raciones` })}`;
}

function pintarNotas() {
  const pj = App.pj;
  $('pag_notas').innerHTML = `
    <div class="card">
      <textarea data-campo="notas" placeholder="Pistas, nombres, deudas, lo que prometiste…" aria-label="Notas">${esc(pj.notas)}</textarea>
    </div>
    ${pj.heridas.length ? tarjeta('secuelas', 'Secuelas', pj.heridas.map((h, i) => `<div class="inv-item"><span class="inv-nom">${esc(h)}</span><button class="ibtn" data-acc="herida-borrar" data-i="${i}" aria-label="Quitar">${ico('cerrar')}</button></div>`).join('')) : ''}
    ${tarjeta('referencia', 'Referencia rápida', `
      <div class="ref">
        <div><b>Prueba</b><span>d20 + atributo</span><em>CD de la tarea</em></div>
        <div><b>Salvación</b><span>d20 + atributo + Comp.</span><em>CD del peligro</em></div>
        <div><b>Iniciativa</b><span>d20 + Destreza</span><em>CD 12</em></div>
        <div><b>Atacar</b><span>d20 + Combate</span><em>Guardia del objetivo</em></div>
        <div><b>Bloquear</b><span>d20 + Combate CaC (+2 escudo)</span><em>resultado del ataque</em></div>
        <div><b>Daño recibido</b><span>daño − Armadura</span><em>mínimo 1</em></div>
      </div>
      <p class="leyenda">Rango: 1 por encima, ventaja; 1 por debajo, desventaja; 2 o más, además dominas o estás superado. Atacar: tu arma. Bloquear a un monstruo: tu armadura. Salvación: tu Rango personal.</p>`)}

    ${tarjeta('tiradas', 'Últimas tiradas',
      (pj.historial || []).length ? pj.historial.slice(0, 15).map(h => `<div class="hist"><span>${esc(h.t)}<small>${esc(h.d)}</small></span><b>${esc(h.total)}</b></div>`).join('') : '<p class="vacio">Aún no has tirado.</p>')}
    <div class="fila-btn">
      <button class="btn fino" data-acc="editar-ficha">${ico('lapiz')}Editar</button>
      <button class="btn fino" data-acc="exportar-uno">${ico('copia')}Exportar</button>
      <button class="btn fino peligro" data-acc="borrar-pj">${ico('basura')}Borrar</button>
    </div>`;
}

/* ══════════════════════════════════════════════════════════════
   OBJETOS
══════════════════════════════════════════════════════════════ */
const RANURA_DE_SLOT = { arma: 'arma', armadura: 'armadura', escudo: 'escudo', amuleto: 'joya', anillo1: 'joya', anillo2: 'joya' };
function objetoNuevo(ranura, slot) {
  const sub = { arma: 'cac', armadura: 'cuero', escudo: 'estandar', joya: slot === 'amuleto' ? 'amuleto' : 'anillo', otro: '' }[ranura];
  return { id: Almacen.uid(), nombre: '', ranura, sub, rango: 1, rareza: 'comun', props: [], gemas: [], unico: '', notas: '', ranuras: 1 };
}

/* donde: { slot } o { inv: índice } o { nuevoInv: true } */
function dlgObjeto(donde) {
  const pj = App.pj;
  const orig = donde.slot ? pj.equipo[donde.slot] : donde.inv != null ? pj.inventario[donde.inv] : null;
  const it = orig ? JSON.parse(JSON.stringify(orig)) : objetoNuevo(donde.slot ? RANURA_DE_SLOT[donde.slot] : 'otro', donde.slot);
  if (!Array.isArray(it.props)) it.props = [];
  if (!Array.isArray(it.gemas)) it.gemas = [];
  const fijaRanura = !!donde.slot;

  const tipoProp = () => it.ranura === 'joya' ? 'joya' : it.ranura;
  function cuerpo() {
    const subSel = {
      arma: Object.entries(TIPOS_ARMA).map(([k, v]) => `<option value="${k}" ${it.sub === k ? 'selected' : ''}>${esc(v)}</option>`).join(''),
      armadura: ARMADURAS.filter(a => a.id !== 'ninguna').map(a => `<option value="${a.id}" ${it.sub === a.id ? 'selected' : ''}>${esc(a.nombre)} (${a.tipo}, ${a.valor})</option>`).join(''),
      escudo: ESCUDOS.map(e => `<option value="${e.id}" ${it.sub === e.id ? 'selected' : ''}>${esc(e.nombre)} (Guardia +${e.guardia})</option>`).join('') + `<option value="secundaria" ${it.sub === 'secundaria' ? 'selected' : ''}>Secundaria (foco, carcaj…)</option>`,
      joya: `<option value="amuleto" ${it.sub === 'amuleto' ? 'selected' : ''}>Amuleto</option><option value="anillo" ${it.sub === 'anillo' ? 'selected' : ''}>Anillo</option>`,
    }[it.ranura];
    const nEng = Motor.engastes(it);
    const props = it.props.map((p, i) => {
      const P = PROPIEDADES.find(x => x && x.id === p.id);
      const necesitaAtr = p.id === 'atributo' || (p.id === 'mejora' && tipoProp() === 'joya');
      return `<div class="prop-fila">
        <select data-prop="${i}">${PROPIEDADES.filter(Boolean).map((x, k) => `<option value="${x.id}" ${x.id === p.id ? 'selected' : ''}>${k + 1}. ${esc(x.nombre)}</option>`).join('')}</select>
        ${necesitaAtr ? `<select class="prop-extra" data-prop-atr="${i}">${ATRIBUTOS.map(a => `<option ${p.atr === a ? 'selected' : ''}>${a}</option>`).join('')}</select>` : ''}
        ${p.id === 'resistencia' ? `<select class="prop-extra" data-prop-res="${i}">${Object.entries(RESISTENCIAS).map(([k, v]) => `<option value="${k}" ${p.res === k ? 'selected' : ''}>${v}</option>`).join('')}</select>` : ''}
        <button class="ibtn" data-dlg="prop-quitar" data-i="${i}" aria-label="Quitar propiedad">${ico('cerrar')}</button>
      </div>${P ? `<p class="leyenda" style="margin:-4px 0 2px">${esc(p.id === 'mejora' ? { arma: '+1 escalón de daño', armadura: '+1 Armadura', escudo: '+1 Guardia', joya: '+1 a un atributo' }[tipoProp()] || P.txt : P.txt)}</p>` : ''}`;
    }).join('');
    const gemas = Array.from({ length: nEng }, (_, i) => `<label class="campo"><span>Engaste ${i + 1}</span>
      <select data-gema="${i}"><option value="">Vacío</option>${Object.entries(GEMAS).map(([k, g]) => `<option value="${k}" ${it.gemas[i] === k ? 'selected' : ''}>${esc(g.nombre)} — ${esc(g[tipoProp() === 'arma' ? 'arma' : tipoProp() === 'joya' ? 'joya' : 'armadura'])}</option>`).join('')}</select></label>`).join('');
    const rz = RAREZAS[it.rareza] || RAREZAS.comun;
    return `
      <label class="campo"><span>Nombre</span><input type="text" data-f="nombre" value="${esc(it.nombre)}" placeholder="Hacha común, Sudario de la Veta…"></label>
      ${fijaRanura ? '' : `<label class="campo"><span>Tipo</span><select data-f="ranura">
        ${[['arma', 'Arma o foco'], ['armadura', 'Armadura'], ['escudo', 'Escudo o secundaria'], ['joya', 'Anillo o amuleto'], ['otro', 'Otro objeto']].map(([k, v]) => `<option value="${k}" ${it.ranura === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>`}
      ${subSel ? `<label class="campo"><span>Clase de objeto</span><select data-f="sub">${subSel}</select></label>` : ''}
      ${it.ranura === 'otro' ? `<label class="campo"><span>Ranuras que ocupa</span><input type="number" inputmode="numeric" data-f="ranuras" value="${esc(it.ranuras ?? 1)}"></label>` : ''}
      <div class="rejilla2">
        <label class="campo"><span>Rango</span><select data-f="rango">${[1, 2, 3, 4, 5, 6, 7, 8].map(n => `<option value="${n}" ${+it.rango === n ? 'selected' : ''}>${R(n)}</option>`).join('')}</select></label>
        <label class="campo"><span>Rareza</span><select data-f="rareza">${Object.entries(RAREZAS).map(([k, v]) => `<option value="${k}" ${it.rareza === k ? 'selected' : ''}>${v.nombre}</option>`).join('')}</select></label>
      </div>
      ${it.ranura !== 'otro' && (it.rareza !== 'comun' || it.props.length) ? `
      <div class="campo"><span>Propiedades${rz.props ? ` · ${rz.nombre}: ${rz.props}` : ''}</span>
        <div class="props-lista">${props || '<p class="leyenda">Sin propiedades.</p>'}</div>
        <button class="btn fino" data-dlg="prop-mas">${ico('mas')}Propiedad</button></div>
      ${gemas}
      ${it.rareza === 'legendario' || it.rareza === 'conjunto' ? `<label class="campo"><span>${it.rareza === 'legendario' ? 'Poder único' : 'Bonus de conjunto'}</span><input type="text" data-f="unico" value="${esc(it.unico)}"></label>` : ''}` : ''}
      <label class="campo"><span>Notas</span><input type="text" data-f="notas" value="${esc(it.notas)}"></label>
      ${it.ranura === 'arma' ? `<p class="leyenda">Un objeto nunca sube más escalones que su Rango (${R(it.rango)}), contando las gemas.</p>` : ''}`;
  }
  const leer = d => {
    d.querySelectorAll('[data-f]').forEach(el => {
      const k = el.dataset.f;
      const v = el.value;
      if (k === 'rango' || k === 'ranuras') it[k] = parseInt(v, 10) || (k === 'rango' ? 1 : 0);
      else if (k === 'ranura' && v !== it.ranura) { it.ranura = v; it.sub = objetoNuevo(v).sub; it.props = []; it.gemas = []; }
      else it[k] = v;
    });
    d.querySelectorAll('[data-prop]').forEach(el => { const i = +el.dataset.prop; if (it.props[i].id !== el.value) it.props[i] = { id: el.value }; });
    d.querySelectorAll('[data-prop-atr]').forEach(el => { it.props[+el.dataset.propAtr].atr = el.value; });
    d.querySelectorAll('[data-prop-res]').forEach(el => { it.props[+el.dataset.propRes].res = el.value; });
    d.querySelectorAll('[data-gema]').forEach(el => { it.gemas[+el.dataset.gema] = el.value || null; });
    it.props.forEach(p => {
      if ((p.id === 'atributo' || (p.id === 'mejora' && it.ranura === 'joya')) && !p.atr) p.atr = 'FUE';
      if (p.id === 'resistencia' && !p.res) p.res = 'fuego';
    });
    it.gemas = it.gemas.slice(0, Motor.engastes(it));
  };
  const repintar = () => {
    const d = $('dlg'); leer(d);
    d.querySelector('.dlg-cuerpo').innerHTML = cuerpo();
  };
  const pie = [
    orig ? '<button class="btn peligro" data-dlg="borrar" aria-label="Borrar">' + ico('basura') + '</button>' : '',
    orig && donde.slot ? '<button class="btn" data-dlg="quitar">A la mochila</button>' : '',
    '<button class="btn prim" data-dlg="ok">Guardar</button>',
  ].join('');
  abrirDlg({
    titulo: donde.slot ? RANURAS.find(r => r.id === donde.slot).nombre : 'Objeto',
    cuerpo: cuerpo(), pie,
    onChange: e => { if (e.target.matches('[data-f="ranura"],[data-f="rareza"],[data-prop],[data-f="sub"]')) repintar(); },
    onClick: (a, btn) => {
      const d = $('dlg');
      if (a === 'prop-mas') { leer(d); it.props.push({ id: 'mejora' }); repintar(); return; }
      if (a === 'prop-quitar') { leer(d); it.props.splice(+btn.dataset.i, 1); repintar(); return; }
      if (a === 'borrar') {
        cerrarDlg();
        confirmar('Borrar objeto', `¿Seguro que quieres borrar «${it.nombre || 'este objeto'}»? No se puede deshacer.`, 'Borrar', () => cambio(() => {
          if (donde.slot) pj.equipo[donde.slot] = null; else pj.inventario.splice(donde.inv, 1);
        }), true);
        return;
      }
      if (a === 'quitar') { leer(d); cerrarDlg(); cambio(() => { pj.equipo[donde.slot] = null; pj.inventario.push(it); }); aviso('Guardado en la mochila'); return; }
      if (a === 'ok') {
        leer(d);
        if (!it.nombre.trim()) it.nombre = donde.slot ? RANURAS.find(r => r.id === donde.slot).nombre : 'Objeto';
        cerrarDlg();
        cambio(() => {
          if (donde.slot) pj.equipo[donde.slot] = it;
          else if (donde.inv != null) pj.inventario[donde.inv] = it;
          else pj.inventario.push(it);
        });
      }
    },
  });
}
function equiparDesdeMochila(i) {
  const pj = App.pj;
  const it = pj.inventario[i];
  let slot = { arma: 'arma', armadura: 'armadura', escudo: 'escudo' }[it.ranura];
  if (it.ranura === 'joya') slot = it.sub === 'amuleto' ? 'amuleto' : (!pj.equipo.anillo1 ? 'anillo1' : !pj.equipo.anillo2 ? 'anillo2' : 'anillo1');
  if (!slot) return;
  cambio(() => {
    const previo = pj.equipo[slot];
    pj.equipo[slot] = it;
    pj.inventario.splice(i, 1);
    if (previo) pj.inventario.push(previo);
  });
  aviso(`Equipado: ${it.nombre}`);
}
function dlgMaterial(i, pre) {
  const m = i != null ? App.pj.materiales[i] : { nombre: pre?.nombre || '', rango: 1, cantidad: pre?.cantidad || 1 };
  abrirDlg({
    titulo: 'Material',
    cuerpo: `<label class="campo"><span>Nombre</span><input type="text" id="m_nom" value="${esc(m.nombre)}" placeholder="Hierro, cobalto, piel…"></label>
      <div class="rejilla2">
        <label class="campo"><span>Rango</span><select id="m_rango">${[1, 2, 3, 4, 5, 6, 7, 8].map(n => `<option value="${n}" ${+m.rango === n ? 'selected' : ''}>${R(n)}</option>`).join('')}</select></label>
        <label class="campo"><span>Cantidad</span><input type="number" inputmode="numeric" id="m_cant" value="${esc(m.cantidad)}"></label>
      </div>`,
    pie: '<button class="btn" data-dlg="cerrar">Cancelar</button><button class="btn prim" data-dlg="ok">Guardar</button>',
    onClick: a => {
      if (a !== 'ok') return;
      const nuevo = { nombre: $('m_nom').value.trim() || 'Material', rango: +$('m_rango').value, cantidad: Math.max(0, parseInt($('m_cant').value, 10) || 0) };
      cerrarDlg();
      cambio(() => {
        const mats = App.pj.materiales;
        const igual = mats.findIndex((x, k) => k !== i && x.nombre.toLowerCase() === nuevo.nombre.toLowerCase() && +x.rango === nuevo.rango);
        if (i != null) mats[i] = nuevo;
        else if (igual >= 0) mats[igual].cantidad += nuevo.cantidad;
        else mats.push(nuevo);
      });
    },
  });
}

/* ══════════════════════════════════════════════════════════════
   SUBIR DE NIVEL Y HABILIDADES
══════════════════════════════════════════════════════════════ */
function dlgSubirNivel() {
  const pj = App.pj;
  const c = calc();
  if (c.nivel >= 10) return;
  const nuevo = c.nivel + 1;
  const vida = Motor.tirar(c.cl.vida);
  const mitad = Motor.maxDe(c.cl.vida) / 2;
  const ganaPv = vida.total < mitad ? mitad : vida.total;
  const raza = RAZAS[pj.raza];
  const subidas = ATRIBUTOS.map(a => {
    const valor = (+pj.base[a] || 10) + ((raza.atr || pj.atrHumano) === a ? 1 : 0);
    const t = Motor.d(20);
    return { a, valor, t, sube: t > valor && valor < ATR_MAX };
  });
  const lineas = [];
  lineas.push(`<div class="contador"><span class="contador-n"><b>Vida</b><small>${c.cl.vida}: sacas ${vida.total}${vida.total < mitad ? `, menos de la mitad: sumas ${mitad}` : ''}</small></span><span class="contador-v" style="color:var(--ok)">+${ganaPv}</span></div>`);
  subidas.forEach(s => lineas.push(`<div class="contador"><span class="contador-n"><b>${NOMBRE_ATR[s.a]} ${s.valor}</b><small>d20: ${s.t}${s.sube ? ' — mayor: sube 1' : ' — no sube'}</small></span><span class="contador-v" style="color:${s.sube ? 'var(--ok)' : 'var(--muted)'}">${s.sube ? '+1' : '—'}</span></div>`));
  const extras = [];
  if (COMPETENCIA[nuevo] > c.comp) extras.push(`Competencia ${S(COMPETENCIA[nuevo])}: suben tu Ataque, Guardia, Bloqueo, salvaciones y Armadura máxima.`);
  if (RANGO_PERSONAL[nuevo] > c.rango) extras.push(`Rango personal ${R(RANGO_PERSONAL[nuevo])}.`);
  if (NIVELES_HABILIDAD.includes(nuevo)) extras.push('Eliges una habilidad nueva de tu clase.');
  if (!c.recurso.sube && (nuevo === 5 || nuevo === 9)) extras.push(`Tu ${c.recurso.nombre} sube a ${nuevo === 5 ? 'd10' : 'd12'}.`);
  abrirDlg({
    titulo: `Nivel ${nuevo}`,
    cuerpo: `<p class="nota">Estas son tus tiradas de subida de nivel.</p>${lineas.join('')}
      ${extras.length ? `<div class="tirada-notas">${extras.map(e => `<div>${esc(e)}</div>`).join('')}</div>` : ''}`,
    pie: '<button class="btn prim" data-dlg="ok">Aplicar y subir</button>',
    onClick: a => {
      if (a !== 'ok') return;
      cerrarDlg();
      cambio(() => {
        pj.pvNiveles.push(ganaPv);
        subidas.forEach(s => { if (s.sube) pj.base[s.a] = (+pj.base[s.a] || 10) + 1; });
        pj.nivel = nuevo; pj.hitos = 0;
        pj.pv = Math.min(pvActual(c) + ganaPv, Motor.calcular(pj).pvMax);
        if (!Motor.calcular(pj).recurso.sube) pj.recurso = Motor.calcular(pj).recurso.maxIdx;
      });
      apuntar(`Nivel ${nuevo}`, `+${ganaPv} PV`, subidas.filter(s => s.sube).map(s => s.a).join(', ') || 'sin subidas de atributo');
      aviso(`¡Nivel ${nuevo}!`);
      vibrar([15, 50, 15, 50, 30]);
      if (NIVELES_HABILIDAD.includes(nuevo)) setTimeout(dlgElegirHabilidad, 350);
    },
  });
}
function dlgElegirHabilidad() {
  const pj = App.pj;
  const bloques = (ESTILOS[pj.clase] || []).map(est => `
    <div class="campo"><span>${esc(est.estilo)}${est.nota ? ` · ${esc(est.nota)}` : ''}</span>
      <div class="opciones">${est.hab.map(([id, n, t]) => {
        const ya = pj.habilidades.includes(id);
        return `<button class="opcion${ya ? ' on' : ''}" data-dlg="hab" data-id="${id}" ${ya ? 'disabled' : ''}>
          <span class="opcion-n">${esc(n)}${ya ? ' <small>ya la tienes</small>' : ''}</span><span class="opcion-t">${esc(t)}</span></button>`;
      }).join('')}</div></div>`).join('');
  abrirDlg({
    titulo: 'Habilidad nueva',
    cuerpo: `<p class="nota">Puedes especializarte en un estilo o mezclar.</p>${bloques}`,
    onClick: (a, btn) => {
      if (a !== 'hab') return;
      cerrarDlg();
      cambio(() => pj.habilidades.push(btn.dataset.id));
      aviso('Habilidad aprendida');
    },
  });
}

/* ══════════════════════════════════════════════════════════════
   ASISTENTE DE CREACIÓN (6 pasos del cap. 4)
══════════════════════════════════════════════════════════════ */
function asistente() {
  const pj = Almacen.nuevo();
  const st = { paso: 0, tiradas: {}, sel: null, arma: 'cac', armaNom: '', armadura: 'cuero', escudo: false, oroTirado: null };
  const PASOS = ['Atributos', 'Raza', 'Clase', 'Profesión', 'Equipo', 'Dale vida'];

  const ARMAS_CLASE = { guerrero: ['cac', 'dos', 'dist'], picaro: ['cac', 'dist'], mago: ['foco'], clerigo: ['cac', 'foco'] };
  const NOM_ARMA = { cac: 'Espada común', dos: 'Hacha a dos manos común', dist: 'Arco corto común', foco: 'Foco común' };

  function vista() {
    const p = st.paso;
    let html = '';
    if (p === 0) {
      html = `<p class="nota">Para cada atributo, en orden, tira 3d6 y suma. Después puedes intercambiar dos resultados: toca uno y luego otro. Ningún atributo pasa de 18.</p>
        <button class="btn prim" data-dlg="tirar-atr">${ico('d20')}Tirar 3d6 × 4</button>
        <div class="rejilla2">${ATRIBUTOS.map(a => `
          <div class="tira-atr${st.sel === a ? ' sel' : ''}" data-dlg="sel-atr" data-a="${a}">
            <span class="atr-n">${NOMBRE_ATR[a]}</span>
            <input type="number" inputmode="numeric" data-atr="${a}" value="${pj.base[a]}" aria-label="${NOMBRE_ATR[a]}">
            <small>${st.tiradas[a] ? st.tiradas[a].join(' + ') : ''} · ${S(Motor.mod(pj.base[a]))}</small>
          </div>`).join('')}</div>
        <p class="leyenda">${ATRIBUTOS.map(a => `<b>${NOMBRE_ATR[a]}</b>: ${esc(DESC_ATR[a])}`).join('<br>')}</p>`;
    } else if (p === 1) {
      html = `<div class="opciones">${Object.entries(RAZAS).map(([k, r]) => `
        <button class="opcion${pj.raza === k ? ' on' : ''}" data-dlg="raza" data-k="${k}">
          <span class="opcion-n">${esc(r.nombre)}<small>${r.atr ? '+1 ' + r.atr : '+1 a elegir'}</small></span>
          <span class="opcion-t">${esc(r.rasgo)} ${esc(r.como)}</span></button>`).join('')}</div>
        ${pj.raza === 'humano' ? `<label class="campo"><span>+1 al atributo</span><select id="as_hum">${ATRIBUTOS.map(a => `<option value="${a}" ${pj.atrHumano === a ? 'selected' : ''}>${NOMBRE_ATR[a]}</option>`).join('')}</select></label>` : ''}`;
    } else if (p === 2) {
      html = `<div class="opciones">${Object.entries(CLASES).map(([k, cl]) => `
        <button class="opcion${pj.clase === k ? ' on' : ''}" data-dlg="clase" data-k="${k}">
          <span class="opcion-n">${esc(cl.nombre)}<small>${cl.pv} PV · ${ESCALERA[cl.dado]} · ${esc(cl.recurso.nombre)}</small></span>
          <span class="opcion-t">${esc(cl.resumen)} Atributo principal: ${NOMBRE_ATR[cl.principal]}. Armadura: ${cl.armadura.length ? cl.armadura.join(', ') : 'ninguna'}${cl.escudos.length > 1 ? ' + cualquier escudo' : cl.escudo ? ' + escudo estándar' : ''}.</span></button>`).join('')}</div>`;
    } else if (p === 3) {
      html = `<div class="opciones">${Object.entries(PROFESIONES).map(([k, pr]) => `
        <button class="opcion${pj.profesion === k ? ' on' : ''}" data-dlg="prof" data-k="${k}">
          <span class="opcion-n">${esc(pr.nombre)}<small>${pr.atrR} / ${pr.atrF}</small></span>
          <span class="opcion-t">Recolecta ${esc(pr.recolecta.toLowerCase())} en ${esc(pr.donde.toLowerCase())}. Fabrica ${esc(pr.fabrica.toLowerCase())}.</span></button>`).join('')}</div>`;
    } else if (p === 4) {
      const cl = CLASES[pj.clase];
      const armas = ARMAS_CLASE[pj.clase];
      if (!armas.includes(st.arma)) st.arma = armas[0];
      const arms = ARMADURAS.filter(a => a.tipo === null || cl.armadura.includes(a.tipo));
      if (!arms.find(a => a.id === st.armadura)) st.armadura = arms[arms.length > 1 ? 1 : 0].id;
      html = `<p class="nota">Un arma y una armadura comunes de Rango I, 5 raciones, antorchas y 3d6 × 10 de oro${pj.clase === 'picaro' ? ', y un carcaj con 20 flechas' : ''}.</p>
        <label class="campo"><span>Arma</span><select id="as_arma">${armas.map(k => `<option value="${k}" ${st.arma === k ? 'selected' : ''}>${esc(TIPOS_ARMA[k])}</option>`).join('')}</select></label>
        <label class="campo"><span>Nombre del arma</span><input type="text" id="as_armanom" value="${esc(st.armaNom || NOM_ARMA[st.arma])}"></label>
        <label class="campo"><span>Armadura</span><select id="as_armadura">${arms.map(a => `<option value="${a.id}" ${st.armadura === a.id ? 'selected' : ''}>${esc(a.nombre)}${a.valor ? ` (Armadura ${a.valor})` : ''}</option>`).join('')}</select></label>
        ${cl.escudo ? `<label class="marca"><input type="checkbox" id="as_escudo" ${st.escudo ? 'checked' : ''}> Escudo estándar (Guardia +1, +2 al bloquear)</label>` : ''}
        <button class="btn" data-dlg="tirar-oro">${ico('d20')}${st.oroTirado ? `Oro: ${pj.oro} (${st.oroTirado.join(' + ')} × 10)` : 'Tirar 3d6 × 10 de oro'}</button>`;
    } else {
      html = `<label class="campo"><span>Nombre</span><input type="text" id="as_nom" value="${esc(pj.nombre)}" placeholder="Durn, Selen, Vess…"></label>
        <label class="campo"><span>¿Por qué estás en la frontera?</span><input type="text" id="as_mot" value="${esc(pj.motivo)}" placeholder="Busco fortuna, huyo de algo, quiero venganza…"></label>
        <p class="nota">Una frase basta.</p>`;
    }
    return html;
  }
  function leer() {
    const d = $('dlg');
    d.querySelectorAll('[data-atr]').forEach(el => { pj.base[el.dataset.atr] = Motor.clamp(parseInt(el.value, 10) || 3, 3, 18); });
    if ($('as_hum')) pj.atrHumano = $('as_hum').value;
    if ($('as_arma')) st.arma = $('as_arma').value;
    if ($('as_armanom')) st.armaNom = $('as_armanom').value;
    if ($('as_armadura')) st.armadura = $('as_armadura').value;
    if ($('as_escudo')) st.escudo = $('as_escudo').checked;
    if ($('as_nom')) pj.nombre = $('as_nom').value.trim();
    if ($('as_mot')) pj.motivo = $('as_mot').value.trim();
  }
  function pintar() {
    const ultimo = st.paso === PASOS.length - 1;
    abrirDlg({
      titulo: `Paso ${st.paso + 1} · ${PASOS[st.paso]}`,
      pasos: PASOS.map((_, i) => `<i class="${i <= st.paso ? 'on' : ''}"></i>`).join(''),
      cuerpo: vista(),
      pie: `${st.paso ? '<button class="btn" data-dlg="atras">Atrás</button>' : '<button class="btn" data-dlg="cerrar">Cancelar</button>'}
        <button class="btn prim" data-dlg="${ultimo ? 'fin' : 'sig'}">${ultimo ? 'Crear' : 'Siguiente'}</button>`,
      onChange: e => { if (e.target.id === 'as_arma') { leer(); st.armaNom = NOM_ARMA[st.arma]; pintar(); } },
      onClick: (a, btn, ev) => {
        if (a === 'sel-atr') {
          if (ev && ev.target.tagName === 'INPUT') return;   // escribir el número no selecciona
          leer();
          const at = btn.dataset.a;
          if (!st.sel) st.sel = at;
          else if (st.sel === at) st.sel = null;
          else { const x = pj.base[st.sel]; pj.base[st.sel] = pj.base[at]; pj.base[at] = x; const t = st.tiradas[st.sel]; st.tiradas[st.sel] = st.tiradas[at]; st.tiradas[at] = t; st.sel = null; aviso('Intercambiados'); }
          pintar(); return;
        }
        leer();
        if (a === 'tirar-atr') { ATRIBUTOS.forEach(at => { const t = Motor.tirar('3d6'); pj.base[at] = t.total; st.tiradas[at] = t.dados; }); st.sel = null; vibrar(15); pintar(); return; }
        if (a === 'raza') { pj.raza = btn.dataset.k; pintar(); return; }
        if (a === 'clase') { pj.clase = btn.dataset.k; pintar(); return; }
        if (a === 'prof') { pj.profesion = btn.dataset.k; pintar(); return; }
        if (a === 'tirar-oro') { const t = Motor.tirar('3d6'); pj.oro = t.total * 10; st.oroTirado = t.dados; pintar(); return; }
        if (a === 'atras') { st.paso--; pintar(); return; }
        if (a === 'sig') {
          if (st.paso === 4 && !st.oroTirado) { aviso('Tira tu oro inicial', 'mal'); return; }
          st.paso++; pintar(); return;
        }
        if (a === 'fin') {
          if (!pj.nombre) { aviso('Ponle un nombre', 'mal'); return; }
          const cl = CLASES[pj.clase];
          pj.equipo.arma = { ...objetoNuevo('arma'), nombre: st.armaNom || NOM_ARMA[st.arma], sub: st.arma };
          if (st.armadura !== 'ninguna') pj.equipo.armadura = { ...objetoNuevo('armadura'), nombre: ARMADURAS.find(x => x.id === st.armadura).nombre, sub: st.armadura };
          if (cl.escudo && st.escudo) pj.equipo.escudo = { ...objetoNuevo('escudo'), nombre: 'Escudo estándar', sub: 'estandar' };
          pj.consumibles.raciones = 5;
          pj.usos.antorchas = DADOS_USO.antorchas.nuevo;
          if (pj.clase === 'picaro') pj.consumibles.flechas = 20;
          pj.pv = null; pj.recurso = null;
          Almacen.guardar(pj);
          cerrarDlg();
          abrirPj(pj.id);
          aviso(`${pj.nombre} llega a la frontera`);
        }
      },
    });
  }
  pintar();
}

function crearPregenerado(i) {
  const g = PREGENERADOS[i];
  const pj = Almacen.nuevo();
  Object.assign(pj, { nombre: g.nombre, raza: g.raza, atrHumano: g.atrHumano || 'FUE', clase: g.clase, profesion: g.profesion, motivo: g.motivo, oro: g.oro });
  pj.base = { ...g.base };
  pj.equipo.arma = { ...objetoNuevo('arma'), nombre: g.arma.nombre, sub: g.arma.sub };
  if (g.armadura !== 'ninguna') pj.equipo.armadura = { ...objetoNuevo('armadura'), nombre: ARMADURAS.find(a => a.id === g.armadura).nombre + ' común', sub: g.armadura };
  if (g.escudo) pj.equipo.escudo = { ...objetoNuevo('escudo'), nombre: 'Escudo estándar', sub: g.escudo };
  Object.assign(pj.consumibles, g.consumibles);
  pj.usos.antorchas = g.antorchas;
  pj.materiales = g.materiales.map(m => ({ ...m }));
  Almacen.guardar(pj);
  cerrarDlg();
  abrirPj(pj.id);
  aviso(`${pj.nombre} está listo`);
}

function dlgEditarFicha() {
  const pj = App.pj;
  abrirDlg({
    titulo: 'Editar datos',
    cuerpo: `
      <label class="campo"><span>Nombre</span><input type="text" id="e_nom" value="${esc(pj.nombre)}"></label>
      <label class="campo"><span>Motivo</span><input type="text" id="e_mot" value="${esc(pj.motivo)}"></label>
      <div class="rejilla2">
        <label class="campo"><span>Raza</span><select id="e_raza">${Object.entries(RAZAS).map(([k, r]) => `<option value="${k}" ${pj.raza === k ? 'selected' : ''}>${r.nombre}</option>`).join('')}</select></label>
        <label class="campo"><span>+1 Humano</span><select id="e_hum">${ATRIBUTOS.map(a => `<option ${pj.atrHumano === a ? 'selected' : ''}>${a}</option>`).join('')}</select></label>
        <label class="campo"><span>Clase</span><select id="e_clase">${Object.entries(CLASES).map(([k, c]) => `<option value="${k}" ${pj.clase === k ? 'selected' : ''}>${c.nombre}</option>`).join('')}</select></label>
        <label class="campo"><span>Profesión</span><select id="e_prof">${Object.entries(PROFESIONES).map(([k, p]) => `<option value="${k}" ${pj.profesion === k ? 'selected' : ''}>${p.nombre}</option>`).join('')}</select></label>
      </div>
      <div class="campo"><span>Atributos (sin la raza ni los objetos)</span>
        <div class="rejilla2">${ATRIBUTOS.map(a => `<label class="campo"><span>${NOMBRE_ATR[a]}</span><input type="number" inputmode="numeric" id="e_${a}" value="${esc(pj.base[a])}"></label>`).join('')}</div></div>
      <div class="rejilla2">
        <label class="campo"><span>Nivel</span><input type="number" inputmode="numeric" id="e_niv" value="${esc(pj.nivel)}"></label>
        <label class="campo"><span>PV ganados al subir</span><input type="text" id="e_pvn" value="${esc(pj.pvNiveles.join(', '))}" placeholder="5, 7, 3"></label>
        <label class="campo"><span>Rango de profesión</span><input type="number" inputmode="numeric" id="e_prr" value="${esc(pj.profRango || 1)}"></label>
        <label class="campo"><span>Ajuste de PV máx.</span><input type="number" inputmode="numeric" id="e_pvx" value="${esc(pj.pvExtra || 0)}"></label>
      </div>
      ${pj.retrato ? '<label class="marca"><input type="checkbox" id="e_sinret"> Quitar el retrato</label>' : ''}
      <p class="leyenda">Cambiar el nivel a mano no tira vida ni atributos: úsalo para corregir. Para subir, usa los hitos.</p>`,
    pie: '<button class="btn" data-dlg="cerrar">Cancelar</button><button class="btn prim" data-dlg="ok">Guardar</button>',
    onClick: a => {
      if (a !== 'ok') return;
      cambio(() => {
        pj.nombre = $('e_nom').value.trim() || pj.nombre;
        pj.motivo = $('e_mot').value.trim();
        pj.raza = $('e_raza').value; pj.atrHumano = $('e_hum').value;
        if (pj.clase !== $('e_clase').value) { pj.clase = $('e_clase').value; pj.habilidades = []; pj.recurso = null; }
        pj.profesion = $('e_prof').value;
        ATRIBUTOS.forEach(at => { pj.base[at] = Motor.clamp(parseInt($('e_' + at).value, 10) || 10, 3, 18); });
        pj.nivel = Motor.clamp(parseInt($('e_niv').value, 10) || 1, 1, 10);
        pj.pvNiveles = $('e_pvn').value.split(/[,;\s]+/).map(x => parseInt(x, 10)).filter(n => !isNaN(n));
        pj.profRango = Motor.clamp(parseInt($('e_prr').value, 10) || 1, 1, 8);
        pj.pvExtra = parseInt($('e_pvx').value, 10) || 0;
        if ($('e_sinret')?.checked) pj.retrato = null;
      });
      cerrarDlg();
      aviso('Ficha actualizada');
    },
  });
}

function dlgAjustes() {
  const actual = localStorage.getItem('arm_letra') || 'normal';
  const ops = [['pequena', 'Pequeña', '14.5px'], ['normal', 'Normal', '16px'], ['grande', 'Grande', '17.5px'], ['muy', 'Muy grande', '19px']];
  abrirDlg({
    titulo: 'Ajustes',
    cuerpo: `<div class="campo"><span>Tamaño de letra</span>
      <div class="seg">${ops.map(([k, n]) => `<button data-dlg="letra" data-k="${k}" class="${actual === k ? 'on' : ''}">${n}</button>`).join('')}</div></div>
      <p class="leyenda">Umbral · Armisticio, Manual Oficial v1.0. Todo se guarda en este dispositivo.</p>`,
    onClick: (a, btn) => {
      if (a !== 'letra') return;
      try { localStorage.setItem('arm_letra', btn.dataset.k); } catch (e) { /* sin almacenamiento */ }
      aplicarLetra(); dlgAjustes();
    },
  });
}
function aplicarLetra() {
  const k = (() => { try { return localStorage.getItem('arm_letra'); } catch (e) { return null; } })() || 'normal';
  document.documentElement.style.fontSize = { pequena: '14.5px', normal: '16px', grande: '17.5px', muy: '19px' }[k] || '16px';
}

/* ══════════════════════════════════════════════════════════════
   NAVEGACIÓN Y EVENTOS
══════════════════════════════════════════════════════════════ */
/* ── Retrato ──────────────────────────────────────────────────
   La foto se recorta al centro en 3:4 y se guarda comprimida (JPEG de
   600 × 800 como máximo) dentro de la ficha, para que viaje con ella. */
function cargarRetrato(archivo) {
  const url = URL.createObjectURL(archivo);
  const img = new Image();
  img.onload = () => {
    const ratio = 3 / 4;
    let w = img.naturalWidth, h = img.naturalHeight, sx = 0, sy = 0;
    if (w / h > ratio) { const nw = h * ratio; sx = (w - nw) / 2; w = nw; } else { const nh = w / ratio; sy = (h - nh) / 4; h = nh; }
    const W = Math.min(600, Math.round(w)), H = Math.round(W / ratio);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    cv.getContext('2d').drawImage(img, sx, sy, w, h, 0, 0, W, H);
    URL.revokeObjectURL(url);
    const datos = cv.toDataURL('image/jpeg', 0.82);
    App.pj.retrato = datos;
    if (!Almacen.guardar(App.pj)) { App.pj.retrato = null; aviso('No cabe: el almacenamiento está lleno', 'mal'); }
    render(); aviso('Retrato guardado');
  };
  img.onerror = () => { URL.revokeObjectURL(url); aviso('No se pudo leer la imagen', 'mal'); };
  img.src = url;
}

function abrirPj(id) {
  const pj = Almacen.obtener(id);
  if (!pj) { aviso('No se encontró el personaje', 'mal'); return; }
  App.pj = Almacen.normalizar(pj);
  App.pag = 'ficha'; App.scroll = {};
  // Una sesión nueva: si pasaron más de 6 horas, vuelve el «repetir» humano
  if (Date.now() - (App.pj.editado || 0) > 6 * 3600 * 1000) App.pj.repeticionUsada = false;
  Almacen.activo(id);
  render();
  window.scrollTo(0, 0);
}
function cerrarPj() { App.pj = null; Almacen.activo(null); render(); window.scrollTo(0, 0); }

const ACC = {
  nuevo: () => asistente(),
  pregenerados: () => abrirDlg({
    titulo: 'Pregenerados',
    cuerpo: `<div class="opciones">${PREGENERADOS.map((g, i) => `
      <button class="opcion" data-dlg="pre" data-i="${i}"><span class="opcion-n">${esc(g.nombre)}<small>${esc(CLASES[g.clase].nombre)}</small></span>
      <span class="opcion-t">${esc(RAZAS[g.raza].nombre)} · ${esc(PROFESIONES[g.profesion].nombre)}</span></button>`).join('')}</div>`,
    onClick: (a, btn) => { if (a === 'pre') crearPregenerado(+btn.dataset.i); },
  }),
  importar: () => $('archivo').click(),
  exportar: () => { const n = Almacen.exportar(); aviso(n ? `Copia con ${n} personaje${n === 1 ? '' : 's'}` : 'No hay personajes que copiar', n ? '' : 'mal'); },
  abrir: b => abrirPj(b.dataset.id),
  retrato: () => $('retrato_in')?.click(),
  pv: b => cambio(() => { const c = calc(); App.pj.pv = Motor.clamp(pvActual(c) + (+b.dataset.d), 0, c.pvMax); }),
  rec: b => ajustarRecurso(+b.dataset.d),
  'rec-usar': () => usarRecurso(),
  hitos: b => cambio(() => { App.pj.hitos = Math.max(0, (+App.pj.hitos || 0) + (+b.dataset.d)); }),
  subir: () => dlgSubirNivel(),
  'elegir-hab': () => dlgElegirHabilidad(),
  prueba: b => tirar(cfgPrueba(b.dataset.a)),
  salva: b => tirar(cfgSalvacion(b.dataset.a)),
  ataque: b => tirar(cfgAtaque(b.dataset.t)),
  dano: () => tiradaDano(),
  bloqueo: () => tirar(cfgBloqueo()),
  iniciativa: () => tirar(cfgIniciativa()),
  'nuevo-combate': () => nuevoCombate(),
  descansar: () => dlgDescansar(),
  fuera: () => dlgFueraCombate(),
  slot: b => dlgObjeto({ slot: b.dataset.r }),
  'inv-nuevo': () => dlgObjeto({ nuevoInv: true }),
  'inv-editar': b => dlgObjeto({ inv: +b.dataset.i }),
  'inv-equipar': b => equiparDesdeMochila(+b.dataset.i),
  cons: b => cambio(() => { const k = b.dataset.k; App.pj.consumibles[k] = Math.max(0, (+App.pj.consumibles[k] || 0) + (+b.dataset.d)); }),
  'cons-num': b => pedirNumero(CONSUMIBLES[b.dataset.k].nombre, +App.pj.consumibles[b.dataset.k] || 0, v => cambio(() => { App.pj.consumibles[b.dataset.k] = v; })),
  'pocion-rango': () => cambio(() => { App.pj.pocionRango = (App.pj.pocionRango || 1) % 8 + 1; }),
  uso: b => {
    const k = b.dataset.k; const v = App.pj.usos[k];
    const t = Motor.tirar(ESCALERA[v]);
    const baja = t.total <= 2;
    const nuevo = baja ? v - 1 : v;
    cambio(() => { App.pj.usos[k] = nuevo >= 0 ? nuevo : null; });
    mostrarSimple({ titulo: DADOS_USO[k].nombre, formula: `Dado de Uso ${ESCALERA[v]}`, dados: t.dados, total: t.total,
      veredicto: baja ? `<span class="veredicto mal">${nuevo < 0 ? 'Se acaban' : 'Baja a ' + ESCALERA[nuevo]}</span>` : '<span class="veredicto ok">Aguantan</span>' });
  },
  'uso-nuevo': b => cambio(() => { App.pj.usos[b.dataset.k] = DADOS_USO[b.dataset.k].nuevo; }),
  mat: b => cambio(() => {
    const m = App.pj.materiales[+b.dataset.i];
    m.cantidad = Math.max(0, (+m.cantidad || 0) + (+b.dataset.d));
    if (m.cantidad === 0) App.pj.materiales.splice(+b.dataset.i, 1);
  }),
  'mat-nuevo': () => dlgMaterial(null),
  oro: () => pedirNumero('Oro', +App.pj.oro || 0, v => cambio(() => { App.pj.oro = v; }), { operaciones: true }),
  'herida-borrar': b => cambio(() => { App.pj.heridas.splice(+b.dataset.i, 1); }),
  'editar-ficha': () => dlgEditarFicha(),
  'exportar-uno': () => {
    const blob = new Blob([JSON.stringify(App.pj, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(App.pj.nombre || 'personaje').replace(/[^\wáéíóúñ -]/gi, '').trim() || 'personaje'}.json`;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  },
  'borrar-pj': () => confirmar('Borrar personaje', `¿Borrar a ${App.pj.nombre || 'este personaje'} para siempre? Exporta su ficha antes si quieres conservarla.`, 'Borrar', () => {
    Almacen.borrar(App.pj.id); cerrarPj(); aviso('Personaje borrado');
  }, true),
};

document.addEventListener('click', e => {
  // Diálogo
  const bd = e.target.closest('[data-dlg]');
  if (bd && $('dlg').contains(bd)) {
    const a = bd.dataset.dlg;
    if (a === 'cerrar') { cerrarDlg(); return; }
    App._dlgClick && App._dlgClick(a, bd, e);
    return;
  }
  // Resultado de tirada
  const bt = e.target.closest('[data-tacc]');
  if (bt) {
    const a = bt.dataset.tacc;
    const t = App._tirada;
    $('velo_tirada').hidden = true;
    if (a === 'cerrar') return;
    if (a === 'v1' || a === 'v-1') { tirar(t.cfg, a === 'v1' ? 1 : -1); return; }
    if (a === 'humano') { App.pj.repeticionUsada = true; guardar(); tirar(t.cfg); return; }
    const acc = t.acciones[+a];
    acc && acc.fn();
    return;
  }
  if (e.target === $('velo_tirada')) { $('velo_tirada').hidden = true; return; }
  if (e.target === $('velo_dlg')) { cerrarDlg(); return; }
  // Pestañas
  const p = e.target.closest('.pest');
  if (p) { irA(p.dataset.pag); return; }
  // Acciones
  const b = e.target.closest('[data-acc]');
  if (b && ACC[b.dataset.acc]) { ACC[b.dataset.acc](b, e); }
});

document.addEventListener('change', e => {
  const el = e.target;
  if (App._dlgChange && $('dlg').contains(el)) { App._dlgChange(e); return; }
  if (el.dataset.campo && App.pj) { App.pj[el.dataset.campo] = el.value; guardar(); }
  if (el.id === 'retrato_in' && el.files[0]) { cargarRetrato(el.files[0]); el.value = ''; return; }
  if (el.id === 'archivo' && el.files[0]) {
    const f = el.files[0];
    f.text().then(txt => {
      try { const n = Almacen.importar(txt); aviso(`Importado${n === 1 ? '' : 's'}: ${n}`); render(); }
      catch (err) { aviso(err.message || 'No se pudo importar', 'mal'); }
      el.value = '';
    });
  }
});

document.addEventListener('toggle', e => {
  const d = e.target;
  if (!d.matches || !d.matches('details.fold[data-fold]')) return;
  try { const p = JSON.parse(localStorage.getItem('arm_folds')) || {}; p[d.dataset.fold] = d.open; localStorage.setItem('arm_folds', JSON.stringify(p)); } catch (err) { /* sin almacenamiento */ }
}, true);

document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (!$('velo_tirada').hidden) { $('velo_tirada').hidden = true; return; }
  if (!$('velo_dlg').hidden) cerrarDlg();
});

$('btn_atras').addEventListener('click', cerrarPj);
$('btn_ajustes').addEventListener('click', dlgAjustes);

/* ── Arranque ───────────────────────────────────────────────── */
aplicarLetra();
(() => {
  const id = Almacen.activo();
  if (id && Almacen.obtener(id)) abrirPj(id); else render();
})();
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { /* sin SW */ }));
}
