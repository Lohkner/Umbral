/* ══════════════════════════════════════════════════════════════
   Armisticio Companion — interfaz.
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

const App = {
  pj: null,
  pag: 'personaje',
  rival: { rango: 0, cd: '' },   // contra quién se tira (se conserva mientras dura la sesión)
  vent: 0,                        // ventaja manual para la próxima tirada
  orcoUsado: false,
};

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
══════════════════════════════════════════════════════════════ */
function ventajaTotal(fuentes) {
  const hay = v => fuentes.some(f => f === v);
  const a = hay(1), dv = hay(-1);
  return a && dv ? 0 : a ? 1 : dv ? -1 : 0;
}

/* opts: { titulo, mod, etiquetaMod, rangoMio, cd, critMin, extraVent, notas[], alExito, alFallo, tipo } */
function tirarD20(opts) {
  const r = App.rival;
  const rango = opts.rangoMio != null ? Motor.porRango(opts.rangoMio, r.rango) : { ventaja: 0, extra: null, texto: '' };
  const fuentes = [App.vent, rango.ventaja, opts.extraVent || 0];
  const v = ventajaTotal(fuentes);
  const t = Motor.d20(v);
  const nat = t.natural;
  const total = nat + opts.mod;
  const cd = opts.cd != null && opts.cd !== '' ? +opts.cd : null;
  const crit = nat >= (opts.critMin || 20);
  const pifia = nat === 1;
  let exito = null;
  if (crit) exito = true; else if (pifia) exito = false; else if (cd != null) exito = total >= cd;
  App.vent = 0;
  const res = { ...opts, dados: t.dados, nat, total, cd, crit, pifia, exito, v, rango };
  apuntar(opts.titulo, total, `d20${v > 0 ? ' con ventaja' : v < 0 ? ' con desventaja' : ''}: ${t.dados.join(' · ')} ${S(opts.mod)}`);
  mostrarTirada(res);
  vibrar(crit ? [15, 40, 15] : 12);
  return res;
}

function mostrarTirada(res) {
  const kept = res.dados.length > 1 ? (res.v > 0 ? Math.max(...res.dados) : Math.min(...res.dados)) : res.dados[0];
  let usado = false;
  const dados = res.dados.map(n => {
    const cls = n === kept && !usado ? (usado = true, (res.crit ? ' crit' : res.pifia ? ' pifia' : '')) : ' descartado';
    return `<span class="dado${cls}">${n}</span>`;
  }).join('');
  const notas = [];
  if (res.v > 0) notas.push('Ventaja: te quedas con el más alto.');
  if (res.v < 0) notas.push('Desventaja: te quedas con el más bajo.');
  if (res.rango.texto) notas.push(res.rango.texto + '.');
  if (res.crit) notas.push(res.textoCrit || '20 natural: éxito y algo extra a tu favor.');
  if (res.pifia) notas.push(res.textoPifia || '1 natural: fallo y algo sale mal.');
  if (res.rango.extra === 'domina' && res.textoDomina) notas.push(res.textoDomina);
  if (res.rango.extra === 'superado' && res.textoSuperado) notas.push(res.textoSuperado);
  (res.notas || []).forEach(n => notas.push(n));

  let ver = '';
  if (res.crit) ver = '<span class="veredicto crit">Crítico</span>';
  else if (res.pifia) ver = '<span class="veredicto mal">Pifia</span>';
  else if (res.exito === true) ver = '<span class="veredicto ok">Éxito</span>';
  else if (res.exito === false) ver = '<span class="veredicto mal">Fallo</span>';

  const acciones = (res.acciones || []).filter(a => !a.si || a.si(res));
  const humano = App.pj.raza === 'humano' && !App.pj.repeticionUsada;
  $('tirada').innerHTML = `
    <div class="tirada-t" id="tirada_titulo">${esc(res.titulo)}</div>
    <div class="tirada-f">1d20 ${S(res.mod)}${res.etiquetaMod ? ` (${esc(res.etiquetaMod)})` : ''}${res.cd != null ? ` · contra ${res.cd}` : ''}</div>
    <div class="dados">${dados}</div>
    <div class="tirada-total">${res.total}</div>
    ${ver}
    ${notas.length ? `<div class="tirada-notas">${notas.map(n => `<div>${esc(n)}</div>`).join('')}</div>` : ''}
    <div class="fila-btn">
      ${acciones.map((a, i) => `<button class="btn fino" data-tacc="${i}">${esc(a.etiqueta)}</button>`).join('')}
      ${humano ? '<button class="btn fino" data-tacc="humano">Repetir (Humano)</button>' : ''}
      <button class="btn fino prim" data-tacc="cerrar">Cerrar</button>
    </div>`;
  App._tirada = { res, acciones };
  $('velo_tirada').hidden = false;
}

function mostrarSimple({ titulo, formula, dados, total, notas = [], veredicto = '', acciones = [] }) {
  $('tirada').innerHTML = `
    <div class="tirada-t" id="tirada_titulo">${esc(titulo)}</div>
    ${formula ? `<div class="tirada-f">${esc(formula)}</div>` : ''}
    ${dados && dados.length ? `<div class="dados">${dados.map(n => `<span class="dado">${n}</span>`).join('')}</div>` : ''}
    <div class="tirada-total">${esc(total)}</div>
    ${veredicto}
    ${notas.length ? `<div class="tirada-notas">${notas.map(n => `<div>${esc(n)}</div>`).join('')}</div>` : ''}
    <div class="fila-btn">
      ${acciones.map((a, i) => `<button class="btn fino" data-tacc="${i}">${esc(a.etiqueta)}</button>`).join('')}
      <button class="btn fino prim" data-tacc="cerrar">Cerrar</button>
    </div>`;
  App._tirada = { res: null, acciones };
  $('velo_tirada').hidden = false;
  vibrar(10);
}

function apuntar(titulo, total, detalle) {
  const h = App.pj.historial || (App.pj.historial = []);
  h.unshift({ t: titulo, total, d: detalle, ts: Date.now() });
  h.length = Math.min(h.length, 30);
  guardar();
}

/* ── Tiradas concretas ──────────────────────────────────────── */
function tiradaPrueba(a) {
  const c = calc();
  tirarD20({ titulo: `Prueba de ${NOMBRE_ATR[a]}`, mod: c.mods[a], etiquetaMod: a, cd: App.rival.cd,
    notas: ['Las pruebas no suman Competencia.'] });
}
function tiradaSalvacion(a) {
  const c = calc();
  const notas = [];
  if (c.resist.length) notas.push(`Tus resistencias (${c.resist.map(r => RESISTENCIAS[r]).join(', ')}) dan ventaja contra ese peligro: márcala antes de tirar.`);
  tirarD20({ titulo: `Salvación de ${NOMBRE_ATR[a]}`, mod: c.mods[a] + c.comp, etiquetaMod: `${a} ${S(c.mods[a])} · Comp ${S(c.comp)}`,
    rangoMio: c.rango, cd: App.rival.cd, notas,
    textoDomina: 'Dominas: aunque falles, solo sufres la mitad del efecto.',
    textoSuperado: 'Superado: aunque tengas éxito, sufres la mitad del efecto.' });
}
function tiradaAtaque(tipo) {
  const c = calc();
  const nombres = { cac: 'cuerpo a cuerpo', dist: 'a distancia', magia: 'mágico' };
  const atr = { cac: 'FUE', dist: 'DES', magia: 'MEN' }[tipo];
  // El dado de clase vale para el arma (guerrero y pícaro) o el foco (mago);
  // el clérigo lo usa con su arma y con su magia. Lo demás hace d4.
  const suyo = { guerrero: tipo !== 'magia', picaro: tipo !== 'magia', mago: tipo === 'magia', clerigo: true }[App.pj.clase];
  tirarD20({
    titulo: `Ataque ${nombres[tipo]}`, mod: c.ataque[tipo], etiquetaMod: `${atr} ${S(c.mods[atr])} · Comp ${S(c.comp)}`,
    rangoMio: c.rangoArma, cd: App.rival.cd, critMin: c.critMin,
    textoCrit: 'Crítico: impactas siempre y tiras el daño dos veces.',
    textoPifia: 'Pifia: fallas y el enemigo te ataca gratis, o se rompe el arma o la munición.',
    textoDomina: 'Dominas: si impactas, haces el máximo del dado sin tirar.',
    textoSuperado: 'Superado: aunque impactes, solo haces 1 de daño.',
    notas: suyo ? [] : ['No es la forma de atacar de tu clase: haces d4 de daño.'],
    acciones: [
      { etiqueta: 'Tirar daño', si: r => r.exito !== false, fn: r => tiradaDano({ crit: r.crit, domina: r.rango.extra === 'domina', superado: r.rango.extra === 'superado', d4: !suyo }) },
      { etiqueta: 'Acierto: +1 Combo', si: r => App.pj.clase === 'picaro' && r.exito !== false, fn: () => ajustarRecurso(1) },
    ],
  });
}
function tiradaDefensa() {
  const c = calc();
  tirarD20({
    titulo: 'Evitar un ataque', mod: c.defensa, etiquetaMod: `Defensa (Guardia ${c.guardia} − 10)`,
    rangoMio: c.rangoArmadura, cd: App.rival.cd,
    textoCrit: 'Crítico: evitas el ataque y contraatacas gratis.',
    textoPifia: 'Pifia: te impacta, recibes el daño máximo y tu Armadura no cuenta.',
    textoDomina: 'Tu armadura domina: aunque te impacte, solo recibes 1 de daño.',
    textoSuperado: 'Tu armadura está superada: aunque lo evites, recibes la mitad del daño.',
    acciones: [
      { etiqueta: 'Bloquear (Reacción)', si: r => r.exito === false && c.bloqueo != null && !App.pj.reaccion && !r.pifia, fn: () => tiradaBloqueo() },
      { etiqueta: 'Recibir daño', si: r => r.exito === false, fn: () => dlgDano() },
    ],
  });
}
function tiradaBloqueo() {
  const c = calc();
  if (c.bloqueo == null) { aviso('Necesitas un escudo o un arma cuerpo a cuerpo para bloquear', 'mal'); return; }
  if (App.pj.reaccion) { aviso('Ya gastaste tu Reacción esta ronda', 'mal'); return; }
  App.pj.reaccion = true; guardar(); render();
  tirarD20({
    titulo: 'Bloqueo', mod: c.bloqueo, etiquetaMod: 'FUE + Comp' + (App.pj.equipo.escudo && App.pj.equipo.escudo.sub !== 'secundaria' ? ' + escudo' : ''),
    rangoMio: c.rangoArmadura, cd: App.rival.cd,
    notas: ['Gasta tu Reacción de la ronda. Si igualas o superas la CD de Ataque, no recibes daño.'],
    acciones: [{ etiqueta: 'Recibir daño', si: r => r.exito === false, fn: () => dlgDano() }],
  });
}
function tiradaIniciativa() {
  const c = calc();
  tirarD20({ titulo: '¿Quién actúa primero?', mod: c.mods.DES, etiquetaMod: 'DES', cd: 12, extraVent: c.agil ? 1 : 0,
    notas: ['Con éxito actúas antes que los monstruos; si fallas, después.'].concat(c.agil ? ['Ágil: tiras con ventaja.'] : []) });
}
function tiradaHuir() {
  const c = calc();
  tirarD20({ titulo: 'Huir', mod: c.mods.DES, etiquetaMod: 'DES', cd: 12 });
}

function tiradaDano({ crit = false, domina = false, superado = false, d4 = false, conRecurso = false, emboscada = false } = {}) {
  const c = calc();
  const expr = d4 ? 'd4' : c.dado;
  const notas = [];
  let total, dados = [];
  if (superado) { total = 1; notas.push('Superado: solo 1 de daño.'); }
  else if (domina || emboscada) { total = Motor.maxDe(expr) * (crit ? 2 : 1); notas.push(emboscada ? 'Emboscada: daño máximo del dado.' : 'Dominas: daño máximo del dado.'); }
  else {
    const a = Motor.tirar(expr); dados = a.dados.slice(); total = a.total;
    if (crit) { const b = Motor.tirar(expr); dados = dados.concat(b.dados); total += b.total; notas.push('Crítico: el daño se tira dos veces.'); }
  }
  let formula = expr + (crit ? ' ×2' : '');
  if (conRecurso && !superado) {
    const idx = recursoActual(c);
    if (idx >= 0) {
      const rr = Motor.tirar(ESCALERA[idx]);
      total += rr.total; dados = dados.concat(rr.dados);
      formula += ` + ${ESCALERA[idx]} (${c.recurso.nombre})`;
      if (App.pj.clase === 'guerrero') { App.pj.recurso = idx - 1 < 0 ? 0 : idx - 1; notas.push('Golpe Brutal: la Furia baja un escalón.'); }
      if (App.pj.clase === 'picaro') { App.pj.recurso = -1; notas.push('Eviscerar: el Combo se vacía.'); }
      guardar(); render();
    }
  }
  notas.push('Resta la Armadura del objetivo. El daño mínimo es 1.');
  apuntar('Daño', total, formula);
  mostrarSimple({ titulo: 'Daño', formula, dados, total, notas });
}

/* ── Recurso ────────────────────────────────────────────────── */
function ajustarRecurso(delta) {
  const c = calc();
  let idx = recursoActual(c) + delta;
  idx = Motor.clamp(idx, -1, c.recurso.maxIdx);
  if (!c.recurso.sube && idx < -1) idx = -1;
  App.pj.recurso = idx; guardar(); render();
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
    veredicto: baja ? '<span class="veredicto mal">Baja un escalón</span>' : '<span class="veredicto ok">Se mantiene</span>',
    notas: [baja ? (idx - 1 < 0 ? `Te quedas sin ${c.recurso.nombre} hasta descansar.` : `Ahora: ${ESCALERA[idx - 1]}.`) : 'Con 1 o 2 habría bajado un escalón.'],
  });
}

/* ── Daño recibido y curación ───────────────────────────────── */
function dlgDano() {
  const c = calc();
  const orco = App.pj.raza === 'orco';
  abrirDlg({
    titulo: 'Recibir daño',
    cuerpo: `<input type="number" inputmode="numeric" id="dano_in" placeholder="Daño del golpe" aria-label="Daño recibido">
      <label class="marca"><input type="checkbox" id="dano_arm" ${c.armadura ? 'checked' : ''}> Restar mi Armadura (${c.armadura})</label>
      ${orco ? `<label class="marca"><input type="checkbox" id="dano_orco" ${App.orcoUsado ? 'disabled' : ''}> Rasgo orco: el recurso sube un escalón extra${App.orcoUsado ? ' (ya usado en este combate)' : ''}</label>` : ''}
      <p class="leyenda">El daño mínimo es siempre 1.${App.pj.clase === 'guerrero' ? ' Tu Furia sube un escalón.' : ''}</p>`,
    pie: '<button class="btn" data-dlg="cerrar">Cancelar</button><button class="btn prim" data-dlg="ok">Aplicar</button>',
    onMontar: d => setTimeout(() => d.querySelector('#dano_in')?.focus(), 60),
    onClick: a => {
      if (a !== 'ok') return;
      const n = parseInt($('dano_in').value, 10);
      if (isNaN(n) || n < 0) { aviso('Escribe el daño', 'mal'); return; }
      const final = $('dano_arm')?.checked ? Math.max(1, n - c.armadura) : Math.max(n > 0 ? 1 : 0, n);
      const extraOrco = $('dano_orco')?.checked;
      cerrarDlg();
      recibirDano(final, extraOrco);
    },
  });
}
function recibirDano(n, extraOrco) {
  const c = calc();
  const antes = pvActual(c);
  App.pj.pv = Math.max(0, antes - n);
  let subidas = 0;
  if (App.pj.clase === 'guerrero' && n > 0) subidas++;
  if (extraOrco) { subidas++; App.orcoUsado = true; }
  if (subidas) {
    const idx = recursoActual(c);
    App.pj.recurso = Math.min(c.recurso.maxIdx, Math.max(idx, -1) + subidas);
  }
  guardar(); render();
  aviso(`−${n} PV` + (subidas ? ` · ${c.recurso.nombre} ${Motor.escalon(App.pj.recurso)}` : ''));
  if (App.pj.pv === 0) setTimeout(() => aviso('Has caído: tira Fuera de Combate cuando acabe la pelea', 'mal'), 400);
  vibrar([20, 30, 20]);
}
function dlgCurar() {
  const c = calc();
  const pr = App.pj.pocionRango || 1;
  const pociones = +App.pj.consumibles.pociones || 0;
  abrirDlg({
    titulo: 'Curar',
    cuerpo: `<input type="number" inputmode="numeric" id="cura_in" placeholder="PV que recuperas" aria-label="PV recuperados">
      <button class="btn ancho" data-dlg="pocion" ${pociones ? '' : 'disabled'}>Beber poción de Rango ${R(pr)} (${POCION_CURA[pr]}) · te quedan ${pociones}</button>`,
    pie: '<button class="btn" data-dlg="cerrar">Cancelar</button><button class="btn prim" data-dlg="ok">Curar</button>',
    onClick: a => {
      if (a === 'pocion') {
        const t = Motor.tirar(POCION_CURA[pr]);
        App.pj.consumibles.pociones = pociones - 1;
        App.pj.pv = Math.min(c.pvMax, pvActual(c) + t.total);
        cerrarDlg(); guardar(); render();
        apuntar('Poción', t.total, POCION_CURA[pr]);
        mostrarSimple({ titulo: 'Poción', formula: POCION_CURA[pr], dados: t.dados, total: `+${t.total}`, notas: [`PV: ${App.pj.pv} / ${c.pvMax}`] });
        return;
      }
      if (a !== 'ok') return;
      const n = parseInt($('cura_in').value, 10);
      if (isNaN(n) || n <= 0) { aviso('Escribe cuánto curas', 'mal'); return; }
      App.pj.pv = Math.min(c.pvMax, pvActual(c) + n);
      cerrarDlg(); guardar(); render(); aviso(`+${n} PV`);
    },
  });
}

/* ── Fuera de Combate y descansos ───────────────────────────── */
function dlgFueraCombate() {
  abrirDlg({
    titulo: 'Fuera de Combate',
    cuerpo: `<p class="nota">Tira cuando termine el combate o cuando un compañero te atienda.</p>
      <label class="marca"><input type="checkbox" id="fc_golpes"> Me siguieron golpeando en el suelo (2d6, el más bajo)</label>`,
    pie: '<button class="btn" data-dlg="cerrar">Cancelar</button><button class="btn prim" data-dlg="ok">Tirar</button>',
    onClick: a => {
      if (a !== 'ok') return;
      const dos = $('fc_golpes').checked;
      const d1 = Motor.d(6), d2 = dos ? Motor.d(6) : null;
      const n = dos ? Math.min(d1, d2) : d1;
      cerrarDlg();
      const [nom, txt] = FUERA_COMBATE[n];
      const c = calc();
      const acciones = [];
      if (n === 6) { const t = Motor.tirar('d4'); App.pj.pv = Math.min(c.pvMax, t.total); }
      if (n === 5) App.pj.pv = 1;
      if (n === 4) App.pj.heridas.push('Inconsciente hasta el final del día');
      if (n === 1) App.pj.heridas.push('Muerto');
      if (n === 2) ATRIBUTOS.forEach(a2 => acciones.push({ etiqueta: `−1 ${a2}`, fn: () => cambio(() => {
        App.pj.base[a2] = Math.max(3, (+App.pj.base[a2] || 10) - 1);
        App.pj.heridas.push(`Herida grave: −1 ${NOMBRE_ATR[a2]} para siempre`);
      }) }));
      if (n === 3) ATRIBUTOS.forEach(a2 => acciones.push({ etiqueta: `Maltrecho: ${a2}`, fn: () => cambio(() => {
        App.pj.heridas.push(`Maltrecho: desventaja en ${NOMBRE_ATR[a2]} hasta descansar en la ciudad`);
      }) }));
      guardar(); render();
      apuntar('Fuera de Combate', n, dos ? `2d6: ${d1} · ${d2}` : `d6: ${d1}`);
      mostrarSimple({
        titulo: 'Fuera de Combate', formula: dos ? '2d6, el más bajo' : 'd6', dados: dos ? [d1, d2] : [d1], total: n,
        veredicto: `<span class="veredicto ${n >= 5 ? 'ok' : n === 1 ? 'mal' : 'crit'}">${esc(nom)}</span>`,
        notas: [txt].concat(n === 6 ? [`Te levantas con ${App.pj.pv} PV.`] : n === 2 ? ['Elige el atributo que pierde un punto:'] : n === 3 ? ['Elige el atributo afectado:'] : []),
        acciones,
      });
    },
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
    mostrarSimple({ titulo: 'Descanso corto', formula: `${c.cl.vida} (dado de vida)`, dados: t.dados, total: `+${t.total}`, notas: [`PV: ${pj.pv} / ${c.pvMax}`] });
    return;
  }
  if (id === 'largo') {
    if ((+pj.consumibles.raciones || 0) < 1) { aviso('Sin ración no descansas: al día siguiente, salvación de Vitalidad CD 12', 'mal'); return; }
    pj.consumibles.raciones -= 1;
    pj.pv = Math.min(c.pvMax, pvActual(c) + Math.floor(c.pvMax / 2));
    if (!c.recurso.sube) pj.recurso = c.recurso.maxIdx;
    pj.reaccion = false;
    guardar(); render();
    aviso(`Descanso largo: +${Math.floor(c.pvMax / 2)} PV${!c.recurso.sube ? `, ${c.recurso.nombre} al máximo` : ''} · −1 ración`);
    return;
  }
  pj.pv = c.pvMax;
  pj.recurso = c.recurso.sube ? c.recurso.inicioIdx : c.recurso.maxIdx;
  pj.reaccion = false;
  pj.heridas = pj.heridas.filter(h => !/^Maltrecho|^Inconsciente/.test(h));
  guardar(); render();
  aviso('Descanso en la ciudad: todo recuperado');
}
function nuevoCombate() {
  const c = calc();
  App.pj.reaccion = false; App.orcoUsado = false;
  if (c.recurso.sube) App.pj.recurso = c.recurso.inicioIdx;
  guardar(); render();
  aviso(`Nuevo combate${c.recurso.sube ? ` · ${c.recurso.nombre} ${Motor.escalon(c.recurso.inicioIdx)}` : ''}`);
}

/* ── Profesión ──────────────────────────────────────────────── */
function dlgRecolectar() {
  const c = calc(); const p = PROFESIONES[App.pj.profesion];
  abrirDlg({
    titulo: `Recolectar · ${p.recolecta}`,
    cuerpo: `<p class="nota">${esc(p.donde)}. 1d20 + ${NOMBRE_ATR[p.atrR]} contra la CD del material.</p>
      <div class="opciones">
        <button class="opcion" data-dlg="12"><span class="opcion-n">Habitual <small>CD 12</small></span></button>
        <button class="opcion" data-dlg="14"><span class="opcion-n">Difícil de encontrar <small>CD 14</small></span></button>
        <button class="opcion" data-dlg="16"><span class="opcion-n">Excepcional <small>CD 16</small></span></button>
      </div>`,
    onClick: a => {
      const cd = parseInt(a, 10); if (!cd) return;
      cerrarDlg();
      tirarD20({ titulo: `Recolectar (${p.recolecta})`, mod: c.mods[p.atrR], etiquetaMod: p.atrR, cd,
        textoCrit: 'Crítico: consigues 2 materiales del Rango de la región.',
        notas: ['Con éxito consigues 1 material del Rango de la región.'],
        acciones: [{ etiqueta: 'Añadir material', si: r => r.exito, fn: r => dlgMaterial(null, { nombre: p.material[0].toUpperCase() + p.material.slice(1), cantidad: r.crit ? 2 : 1 }) }] });
    },
  });
}
function dlgFabricar() {
  const c = calc(); const p = PROFESIONES[App.pj.profesion]; const pr = App.pj.profRango || 1;
  const ops = Array.from({ length: pr }, (_, i) => i + 1).map(r =>
    `<button class="opcion" data-dlg="${r}"><span class="opcion-n">Rango ${R(r)} <small>CD ${CD_FABRICAR[r]}</small></span></button>`).join('');
  abrirDlg({
    titulo: `Fabricar · ${p.nombre}`,
    cuerpo: `<p class="nota">${esc(p.fabrica)}. 1d20 + ${NOMBRE_ATR[p.atrF]}. Solo puedes fabricar hasta tu Rango de profesión (${R(pr)}). Si fallas, pierdes un material.</p><div class="opciones">${ops}</div>`,
    onClick: a => {
      const r = parseInt(a, 10); if (!r) return;
      cerrarDlg();
      tirarD20({ titulo: `Fabricar Rango ${R(r)}`, mod: c.mods[p.atrF], etiquetaMod: p.atrF, cd: CD_FABRICAR[r],
        acciones: [{ etiqueta: 'Anotar lo fabricado', si: res => res.exito, fn: () => anotarFabricado(r) }] });
    },
  });
}
function anotarFabricado(r) {
  const pj = App.pj;
  if (r === (pj.profRango || 1)) {
    pj.profFabricados = (pj.profFabricados || 0) + 1;
    if (pj.profFabricados >= 3 && pj.profRango < RANGO_MAX) {
      pj.profRango += 1; pj.profFabricados = 0;
      aviso(`Tu profesión sube a Rango ${R(pj.profRango)} · la primera pieza de un Rango nuevo da 1 hito`);
    } else aviso(`Fabricado (${pj.profFabricados}/3 de Rango ${R(pj.profRango)})`);
  } else aviso('Fabricado');
  guardar(); render();
}

/* ══════════════════════════════════════════════════════════════
   PINTAR
══════════════════════════════════════════════════════════════ */
function render() {
  const enFicha = !!App.pj;
  $('pantalla_inicio').hidden = enFicha;
  $('pantalla_ficha').hidden = !enFicha;
  $('pestanas').hidden = !enFicha;
  $('btn_atras').hidden = !enFicha;
  if (!enFicha) {
    $('barra_nombre').textContent = 'Armisticio';
    $('barra_sub').textContent = 'Ficha de personaje';
    pintarInicio();
    return;
  }
  const c = calc();
  const pj = App.pj;
  $('barra_nombre').textContent = pj.nombre || 'Sin nombre';
  $('barra_sub').textContent = `${RAZAS[pj.raza]?.nombre || ''} · ${c.cl.nombre} · Nivel ${c.nivel}`;
  document.querySelectorAll('.pest').forEach(b => b.classList.toggle('activa', b.dataset.pag === App.pag));
  ['personaje', 'combate', 'equipo', 'diario'].forEach(p => { $('pag_' + p).hidden = p !== App.pag; });
  ({ personaje: pintarPersonaje, combate: pintarCombate, equipo: pintarEquipo, diario: pintarDiario })[App.pag](c);
}

function pintarInicio() {
  const lista = Almacen.lista();
  $('pantalla_inicio').innerHTML = `
    <div class="hero">
      <img class="hero-emblema" src="icons/esqueleto-original.webp" alt="" width="120" height="120">
      <div class="hero-marca">Armisticio</div>
      <div class="hero-sub">La frontera no perdona. Tu equipo, tampoco.</div>
      <div class="hero-filete"></div>
    </div>
    <div class="pagina">
      <div class="fila-btn">
        <button class="btn prim" data-acc="nuevo">${ico('mas')}Nuevo personaje</button>
      </div>
      <div class="fila-btn">
        <button class="btn fino" data-acc="pregenerados">Pregenerados</button>
        <button class="btn fino" data-acc="importar">Importar</button>
      </div>
      <div class="card">
        <div class="card-t">${ico('persona')}Tus personajes<span class="der">${lista.length}</span></div>
        <div class="pj-lista">
          ${lista.length ? lista.map(p => {
            const cl = CLASES[p.clase];
            return `<button class="pj-item" data-acc="abrir" data-id="${esc(p.id)}">
              <span class="pj-sello">${p.nivel || 1}</span>
              <span class="pj-datos"><span class="pj-nom">${esc(p.nombre || 'Sin nombre')}</span>
              <span class="pj-sub">${esc(RAZAS[p.raza]?.nombre || '')} · ${esc(cl?.nombre || '')} · ${esc(PROFESIONES[p.profesion]?.nombre || '')}</span></span>
            </button>`;
          }).join('') : '<p class="vacio">Aún no hay nadie en la frontera. Crea un personaje o usa uno pregenerado.</p>'}
        </div>
      </div>
      <button class="btn fino" data-acc="exportar">${ico('copia')}Copia de seguridad de todos</button>
      <input type="file" id="archivo" accept="application/json,.json" hidden>
    </div>`;
}

function pintarPersonaje(c) {
  const pj = App.pj;
  const pv = pvActual(c);
  const rec = c.recurso;
  const ri = recursoActual(c);
  const colorRec = { Furia: 'var(--furia)', Combo: 'var(--combo)', Maná: 'var(--mana)', Fe: 'var(--fe)' }[rec.nombre];
  const escalones = ESCALERA.slice(0, 5).map((e, i) =>
    `<span class="esc${i <= ri ? ' lleno' : ''}${i === ri ? ' actual' : ''}${i > rec.maxIdx ? ' fuera' : ''}">${e}</span>`).join('');
  const puedeSubir = pj.hitos >= c.hitosNecesarios && c.nivel < 10;
  const habPend = NIVELES_HABILIDAD.filter(n => c.nivel >= n).length - pj.habilidades.length;

  $('pag_personaje').innerHTML = `
    <div class="card portada">
      <div class="portada-nom">${esc(pj.nombre || 'Sin nombre')}</div>
      <div class="portada-sub">${esc(RAZAS[pj.raza]?.nombre)} · ${esc(c.cl.nombre)} · ${esc(PROFESIONES[pj.profesion]?.nombre)}</div>
      <div class="chips">
        <span class="chip">Nivel <b>${c.nivel}</b></span>
        <span class="chip">Rango <b>${R(c.rango)}</b></span>
        <span class="chip">Competencia <b>${S(c.comp)}</b></span>
      </div>
      <div class="portada-motivo">${esc(pj.motivo)}</div>
    </div>

    <div class="card">
      <div class="card-t">${ico('corazon')}Puntos de Vida<span class="der">${esc(c.cl.vida)} por nivel</span></div>
      <div class="pv-fila">
        <button class="pm menos" style="--c:var(--sangre-b)" data-acc="pv" data-d="-1" aria-label="Quitar 1 PV">−</button>
        <div class="pv-num"><span class="act">${pv}</span> <span class="max">/ ${c.pvMax}</span></div>
        <button class="pm" style="--c:var(--ok)" data-acc="pv" data-d="1" aria-label="Sumar 1 PV">+</button>
      </div>
      <div class="barra-pv${pv <= c.pvMax / 4 ? ' baja' : ''}"><i style="width:${Math.round(100 * pv / c.pvMax)}%"></i></div>
      <div class="fila-btn" style="margin-top:12px">
        <button class="btn fino" data-acc="dano">Recibir daño</button>
        <button class="btn fino" data-acc="curar">Curar</button>
      </div>
    </div>

    <div class="card" style="--rc:${colorRec}">
      <div class="card-t">${ico('d20')}${esc(rec.nombre)}<span class="der">${ri >= 0 ? ESCALERA[ri] : 'vacío'}</span></div>
      <div class="escalera">${escalones}</div>
      <div class="fila-btn">
        <button class="btn fino" data-acc="rec" data-d="-1">Bajar</button>
        <button class="btn fino" data-acc="rec" data-d="1">Subir</button>
        ${rec.sube ? '' : `<button class="btn fino prim" data-acc="rec-usar">Usar</button>`}
      </div>
      <p class="nota" style="margin-top:10px">${esc(rec.regla)}</p>
    </div>

    <div class="card">
      <div class="card-t">${ico('persona')}Atributos</div>
      <div class="atrs">
        ${ATRIBUTOS.map(a => `
          <div class="atr">
            <span class="atr-n">${NOMBRE_ATR[a]}</span>
            <span class="atr-mod">${S(c.mods[a])}</span>
            <span class="atr-val">${c.atr[a]}${c.bonus[a] ? ` <em>(${S(c.bonus[a])})</em>` : ''}</span>
            <div class="atr-acc">
              <button data-acc="prueba" data-a="${a}">Prueba</button>
              <button data-acc="salva" data-a="${a}">Salvación</button>
            </div>
          </div>`).join('')}
      </div>
      <p class="nota" style="margin-top:10px">Prueba: 1d20 + modificador. Salvación: además suma tu Competencia (${S(c.comp)}) y compara tu Rango personal (${R(c.rango)}).</p>
    </div>

    <div class="card">
      <div class="card-t">${ico('subir')}Hitos<span class="der">${pj.hitos} / ${c.hitosNecesarios}</span></div>
      <div class="pv-fila">
        <button class="pm menos" data-acc="hitos" data-d="-1" aria-label="Quitar un hito">−</button>
        <div class="pv-num"><span class="act" style="font-size:1.6rem">${pj.hitos}</span> <span class="max">/ ${c.nivel < 10 ? c.hitosNecesarios : '—'}</span></div>
        <button class="pm" style="--c:var(--oxido-b)" data-acc="hitos" data-d="1" aria-label="Sumar un hito">+</button>
      </div>
      <div class="medidor"><i style="width:${Math.min(100, Math.round(100 * pj.hitos / c.hitosNecesarios))}%"></i></div>
      ${puedeSubir ? `<button class="btn prim ancho" data-acc="subir">${ico('flecha-arriba')}Subir a nivel ${c.nivel + 1}</button>` : `<p class="nota">${c.nivel >= 10 ? 'Nivel 10: empieza la Leyenda.' : `Subes de nivel con ${c.hitosNecesarios} hitos (el doble de tu nivel).`}</p>`}
      ${habPend > 0 ? `<button class="btn ancho" style="margin-top:8px" data-acc="elegir-hab">Elegir habilidad nueva (${habPend})</button>` : ''}
    </div>`;
}

function pintarCombate(c) {
  const pj = App.pj;
  const rv = App.rival;
  const hab = c.cl.habilidades.map(([n, t]) => `<div class="hab"><div class="hab-n">${esc(n)} <small>nivel 1</small></div><div class="hab-t">${esc(t)}</div></div>`);
  pj.habilidades.forEach(id => {
    for (const est of ESTILOS[pj.clase] || []) {
      const h = est.hab.find(x => x[0] === id);
      if (h) hab.push(`<div class="hab"><div class="hab-n">${esc(h[1])} <small>${esc(est.estilo)}</small></div><div class="hab-t">${esc(h[2])}</div></div>`);
    }
  });
  const recNom = pj.clase === 'guerrero' ? 'Golpe Brutal' : pj.clase === 'picaro' ? 'Eviscerar' : null;

  $('pag_combate').innerHTML = `
    ${c.avisos.length ? c.avisos.map(a => `<div class="aviso-f">⚠ ${esc(a)}</div>`).join('') : ''}
    <div class="card">
      <div class="card-t">${ico('d20')}Contra quién</div>
      <div class="rival">
        <label class="campo"><span>Rango del rival</span>
          <select data-rival="rango">${[0, 1, 2, 3, 4, 5, 6, 7, 8].map(n => `<option value="${n}" ${+rv.rango === n ? 'selected' : ''}>${n ? 'Rango ' + R(n) : 'Sin comparar'}</option>`).join('')}</select></label>
        <label class="campo"><span>CD o Guardia</span>
          <input type="number" inputmode="numeric" data-rival="cd" value="${esc(rv.cd)}" placeholder="—"></label>
      </div>
      <div class="campo" style="margin-top:10px"><span>Próxima tirada</span>
        <div class="seg">
          <button data-acc="vent" data-v="-1" class="${App.vent < 0 ? 'on' : ''}">Desventaja</button>
          <button data-acc="vent" data-v="0" class="${App.vent === 0 ? 'on' : ''}">Normal</button>
          <button data-acc="vent" data-v="1" class="${App.vent > 0 ? 'on' : ''}">Ventaja</button>
        </div></div>
      <p class="nota" style="margin-top:8px">El Rango del rival se compara solo: tu arma al atacar, tu armadura al defenderte y tu Rango personal en las salvaciones.</p>
    </div>

    <div class="card">
      <div class="card-t">${ico('espada')}Atacar<span class="der">Arma Rango ${R(c.rangoArma)}</span></div>
      <div class="nums">
        <button class="num${c.ataquePrincipal === 'cac' ? ' destacado' : ''}" data-acc="ataque" data-t="cac"><span class="num-n">Cuerpo a cuerpo</span><span class="num-v">${S(c.ataque.cac)}</span></button>
        <button class="num${c.ataquePrincipal === 'dist' ? ' destacado' : ''}" data-acc="ataque" data-t="dist"><span class="num-n">A distancia</span><span class="num-v">${S(c.ataque.dist)}</span></button>
        <button class="num${c.ataquePrincipal === 'magia' ? ' destacado' : ''}" data-acc="ataque" data-t="magia"><span class="num-n">Mágico</span><span class="num-v">${S(c.ataque.magia)}</span></button>
      </div>
      <div class="fila-btn" style="margin-top:10px">
        <button class="btn fino" data-acc="dano-tirar">Daño ${esc(c.dado)}</button>
        ${recNom ? `<button class="btn fino" data-acc="dano-rec">${esc(recNom)}</button>` : ''}
        ${pj.clase === 'picaro' ? '<button class="btn fino" data-acc="dano-embosc">Emboscada</button>' : ''}
      </div>
      ${c.critMin < 20 ? '<p class="nota" style="margin-top:8px">Crítico ampliado: 19 o 20 natural.</p>' : ''}
    </div>

    <div class="card">
      <div class="card-t">${ico('escudo')}Defenderse<span class="der">Armadura Rango ${R(c.rangoArmadura)}</span></div>
      <div class="nums">
        <div class="num"><span class="num-n">Guardia</span><span class="num-v">${c.guardia}</span><span class="num-s">desprevenido ${c.guardiaDesprevenido}</span></div>
        <button class="num destacado" data-acc="defensa"><span class="num-n">Defensa</span><span class="num-v">${S(c.defensa)}</span><span class="num-s">evitar</span></button>
        <div class="num"><span class="num-n">Armadura</span><span class="num-v">${c.armadura}</span><span class="num-s">máx. ${c.armaduraMax}</span></div>
        <button class="num" data-acc="bloqueo" ${c.bloqueo == null ? 'disabled' : ''}><span class="num-n">Bloqueo</span><span class="num-v">${c.bloqueo == null ? '—' : S(c.bloqueo)}</span><span class="num-s">${pj.reaccion ? 'Reacción gastada' : 'Reacción'}</span></button>
        <button class="num" data-acc="iniciativa"><span class="num-n">Iniciativa</span><span class="num-v">${S(c.mods.DES)}</span><span class="num-s">CD 12</span></button>
        <button class="num" data-acc="huir"><span class="num-n">Huir</span><span class="num-v">${S(c.mods.DES)}</span><span class="num-s">CD 12</span></button>
      </div>
      <p class="nota" style="margin-top:8px">${c.atrDef === 'VIT' ? 'Aguante: tu Guardia usa Vitalidad. ' : ''}La Guardia decide si te impactan; la Armadura, cuánto te duele.</p>
    </div>

    <div class="card">
      <div class="card-t">${ico('d20')}Turno</div>
      <div class="fila-btn">
        <button class="btn fino" data-acc="nuevo-combate">Nuevo combate</button>
        <button class="btn fino" data-acc="nueva-ronda">Nueva ronda</button>
      </div>
      <div class="fila-btn" style="margin-top:8px">
        <button class="btn fino peligro" data-acc="fuera">Fuera de Combate</button>
      </div>
      <div class="fila-btn" style="margin-top:8px">
        ${DESCANSOS.map(d => `<button class="btn fino" data-acc="descanso" data-id="${d.id}">${esc(d.nombre)}</button>`).join('')}
      </div>
      <p class="nota" style="margin-top:8px">Corto: tu dado de vida. Largo: una ración, la mitad de tus PV y todo tu Maná o Fe. En la ciudad: todo.</p>
    </div>

    <div class="card">
      <div class="card-t">${ico('diario')}Habilidades</div>
      ${hab.join('')}
      ${c.resist.length || c.efectos.length ? `<div class="hab"><div class="hab-n">Por tu equipo</div>
        ${c.resist.length ? `<div class="hab-t">Resistencia (ventaja en salvaciones): ${esc(c.resist.map(r => RESISTENCIAS[r]).join(', '))}</div>` : ''}
        ${c.efectos.map(e => `<div class="hab-t">${esc(e)}</div>`).join('')}</div>` : ''}
    </div>`;
}

const ICO_RANURA = { arma: 'espada', armadura: 'armadura', escudo: 'escudo', amuleto: 'amuleto', anillo1: 'anillo', anillo2: 'anillo' };
function resumenObjeto(it, tipo) {
  const partes = [];
  if (it.ranura === 'arma') partes.push(TIPOS_ARMA[it.sub] || '');
  if (it.ranura === 'armadura') { const a = ARMADURAS.find(x => x.id === it.sub); if (a) partes.push(`${a.nombre} · Armadura ${a.valor}`); }
  if (it.ranura === 'escudo') { const e = ESCUDOS.find(x => x.id === it.sub); partes.push(e ? `${e.nombre} · Guardia +${e.guardia}` : 'Secundaria'); }
  partes.push(RAREZAS[it.rareza]?.nombre || 'Común');
  (it.props || []).forEach(p => {
    const P = PROPIEDADES.find(x => x && x.id === p.id); if (!P) return;
    let n = P.nombre;
    if (p.id === 'mejora') n = { arma: '+1 escalón', armadura: '+1 Armadura', escudo: '+1 Guardia', joya: `+1 ${p.atr || 'atributo'}` }[tipo] || n;
    if (p.id === 'atributo') n = `+1 ${p.atr || 'atributo'}`;
    if (p.id === 'resistencia') n = `Resistencia ${RESISTENCIAS[p.res] || ''}`.trim();
    partes.push(n);
  });
  (it.gemas || []).filter(Boolean).forEach(g => partes.push(GEMAS[g].nombre));
  return partes.filter(Boolean).join(' · ');
}

function pintarEquipo(c) {
  const pj = App.pj;
  const p = PROFESIONES[pj.profesion];
  const slots = RANURAS.map(r => {
    const it = pj.equipo[r.id];
    if (!it) return `<button class="slot vacio" data-acc="slot" data-r="${r.id}">
        <span class="slot-ico">${ico(ICO_RANURA[r.id])}</span>
        <span class="slot-datos"><span class="slot-nom">${esc(r.nombre)}: vacío</span><span class="slot-sub">Toca para añadir</span></span></button>`;
    return `<button class="slot r-${esc(it.rareza || 'comun')}" data-acc="slot" data-r="${r.id}">
        <span class="slot-ico">${ico(ICO_RANURA[r.id])}</span>
        <span class="slot-datos"><span class="slot-nom">${esc(it.nombre || r.nombre)}</span><span class="slot-sub">${esc(resumenObjeto(it, r.tipo))}</span></span>
        <span class="rango">${R(it.rango || 1)}</span></button>`;
  }).join('');
  const lleno = c.ranurasUsadas > c.ranurasMax;
  const inv = pj.inventario.map((it, i) => `
    <div class="inv-item r-${esc(it.rareza || 'comun')}">
      <span class="inv-nom">${esc(it.nombre || 'Objeto')}${it.rango ? ` <small class="leyenda">R ${R(it.rango)}</small>` : ''}</span>
      <span class="inv-ran">${Motor.ranurasDe(it)} ran.</span>
      ${it.ranura !== 'otro' ? `<button class="ibtn" data-acc="inv-equipar" data-i="${i}" aria-label="Equipar">${ico('flecha-arriba')}</button>` : ''}
      <button class="ibtn" data-acc="inv-editar" data-i="${i}" aria-label="Editar">${ico('lapiz')}</button>
    </div>`).join('');
  const cons = Object.entries(CONSUMIBLES).map(([k, cdef]) => `
    <div class="contador">
      <span class="contador-n"><b>${esc(cdef.nombre)}${k === 'pociones' ? ` · Rango ${R(pj.pocionRango || 1)} (${POCION_CURA[pj.pocionRango || 1]})` : ''}</b><small>${cdef.porRanura} por ranura · ${c.consRanuras[k]} ran.</small></span>
      <button class="pm menos" data-acc="cons" data-k="${k}" data-d="-1" aria-label="Quitar">−</button>
      <button class="contador-v" data-acc="cons-num" data-k="${k}">${+pj.consumibles[k] || 0}</button>
      <button class="pm" data-acc="cons" data-k="${k}" data-d="1" aria-label="Añadir">+</button>
    </div>`).join('');
  const usos = Object.entries(DADOS_USO).map(([k, u]) => {
    const v = pj.usos[k];
    const tiene = v != null && v >= 0;
    return `<div class="contador">
      <span class="contador-n"><b>${esc(u.nombre)}</b><small>${esc(u.txt)}</small></span>
      <span class="contador-v">${tiene ? ESCALERA[v] : '—'}</span>
      ${tiene ? `<button class="btn fino" data-acc="uso" data-k="${k}">Usar</button>` : `<button class="btn fino" data-acc="uso-nuevo" data-k="${k}">Nuevas</button>`}
    </div>`;
  }).join('');
  const mats = pj.materiales.map((m, i) => `
    <div class="contador">
      <span class="contador-n"><b>${esc(m.nombre)}</b><small>Rango ${R(m.rango || 1)}</small></span>
      <button class="pm menos" data-acc="mat" data-i="${i}" data-d="-1" aria-label="Quitar">−</button>
      <span class="contador-v">${m.cantidad}</span>
      <button class="pm" data-acc="mat" data-i="${i}" data-d="1" aria-label="Añadir">+</button>
    </div>`).join('');

  $('pag_equipo').innerHTML = `
    <div class="card">
      <div class="card-t">${ico('armadura')}Equipo puesto</div>
      ${slots}
    </div>

    <div class="card">
      <div class="card-t">${ico('mochila')}Mochila<span class="der">${c.ranurasUsadas} / ${c.ranurasMax} ranuras</span></div>
      <div class="medidor${lleno ? ' lleno' : ''}"><i style="width:${Math.min(100, Math.round(100 * c.ranurasUsadas / Math.max(1, c.ranurasMax)))}%"></i></div>
      ${lleno ? '<div class="aviso-f">⚠ Lo que no cabe se deja atrás.</div>' : ''}
      ${inv || '<p class="vacio">La mochila está vacía.</p>'}
      <div class="fila-btn" style="margin-top:10px">
        <button class="btn fino" data-acc="inv-nuevo">${ico('mas')}Objeto</button>
        <button class="btn fino" data-acc="bolsas">Bolsas (+${pj.ranurasExtra || 0})</button>
      </div>
      <p class="nota" style="margin-top:8px">Tantas ranuras como tu Fuerza (${c.atr.FUE}). Las armas a dos manos y la armadura pesada ocupan 2. Los consumibles y materiales también cuentan.</p>
    </div>

    <div class="card">
      <div class="card-t">${ico('mochila')}Consumibles</div>
      ${cons}
      ${usos}
      <button class="btn fino ancho" style="margin-top:8px" data-acc="pocion-rango">Rango de tus pociones: ${R(pj.pocionRango || 1)}</button>
    </div>

    <div class="card">
      <div class="card-t">${ico('mochila')}Materiales y oro</div>
      ${mats || '<p class="vacio">Sin materiales.</p>'}
      <div class="contador">
        <span class="contador-n"><b>Oro</b><small>Toca para sumar o restar</small></span>
        <button class="contador-v" style="min-width:90px;color:var(--r-raro)" data-acc="oro">${pj.oro || 0}</button>
      </div>
      <button class="btn fino ancho" style="margin-top:8px" data-acc="mat-nuevo">${ico('mas')}Material</button>
    </div>

    <div class="card">
      <div class="card-t">${ico('lapiz')}${esc(p.nombre)}<span class="der">Rango ${R(pj.profRango || 1)} · ${pj.profFabricados || 0}/3</span></div>
      <p class="nota">Recolecta: ${esc(p.recolecta)} (${esc(NOMBRE_ATR[p.atrR])}) en ${esc(p.donde.toLowerCase())}. Fabrica: ${esc(p.fabrica.toLowerCase())} (${esc(NOMBRE_ATR[p.atrF])}).</p>
      <div class="fila-btn" style="margin-top:10px">
        <button class="btn fino" data-acc="recolectar">Recolectar</button>
        <button class="btn fino" data-acc="fabricar">Fabricar</button>
      </div>
    </div>`;
}

function pintarDiario(c) {
  const pj = App.pj;
  $('pag_diario').innerHTML = `
    <div class="card">
      <div class="card-t">${ico('corazon')}Heridas y secuelas</div>
      ${pj.heridas.length ? pj.heridas.map((h, i) => `<div class="inv-item"><span class="inv-nom">${esc(h)}</span><button class="ibtn" data-acc="herida-borrar" data-i="${i}" aria-label="Quitar">${ico('cerrar')}</button></div>`).join('') : '<p class="vacio">Sin secuelas. De momento.</p>'}
    </div>
    <div class="card">
      <div class="card-t">${ico('diario')}Notas</div>
      <textarea data-campo="notas" placeholder="Pistas, nombres, deudas, lo que prometiste…" aria-label="Notas">${esc(pj.notas)}</textarea>
    </div>
    <div class="card">
      <div class="card-t">${ico('d20')}Últimas tiradas</div>
      ${(pj.historial || []).length ? pj.historial.slice(0, 15).map(h => {
        const d = new Date(h.ts);
        return `<div class="hist"><span>${esc(h.t)}<small>${esc(h.d)} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}</small></span><b>${esc(h.total)}</b></div>`;
      }).join('') : '<p class="vacio">Aún no has tirado.</p>'}
    </div>
    <div class="card">
      <div class="card-t">${ico('persona')}Ficha</div>
      <div class="fila-btn">
        <button class="btn fino" data-acc="editar-ficha">${ico('lapiz')}Editar datos</button>
        <button class="btn fino" data-acc="nueva-sesion">Nueva sesión</button>
      </div>
      <div class="fila-btn" style="margin-top:8px">
        <button class="btn fino" data-acc="exportar-uno">${ico('copia')}Exportar ficha</button>
        <button class="btn fino peligro" data-acc="borrar-pj">${ico('basura')}Borrar</button>
      </div>
      <p class="nota" style="margin-top:8px">«Nueva sesión» recupera el rasgo humano de repetir una tirada.</p>
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
      ${it.ranura !== 'otro' ? `
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
          <span class="opcion-t">${esc(cl.resumen)} Atributo principal: ${NOMBRE_ATR[cl.principal]}. Armadura: ${cl.armadura.length ? cl.armadura.join(', ') : 'ninguna'}${cl.escudo ? ' + escudo' : ''}.</span></button>`).join('')}</div>`;
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
        ${cl.escudo ? `<label class="marca"><input type="checkbox" id="as_escudo" ${st.escudo ? 'checked' : ''}> Escudo estándar (Guardia +1, Bloqueo +2)</label>` : ''}
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
      <p class="leyenda">Armisticio Companion · Manual de Prueba v0.1. Todo se guarda en este dispositivo.</p>`,
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
function abrirPj(id) {
  const pj = Almacen.obtener(id);
  if (!pj) { aviso('No se encontró el personaje', 'mal'); return; }
  App.pj = Almacen.normalizar(pj);
  App.pag = 'personaje';
  App.rival = { rango: 0, cd: '' };
  Almacen.activo(id);
  render();
  window.scrollTo(0, 0);
}
function cerrarPj() { App.pj = null; Almacen.activo(null); render(); window.scrollTo(0, 0); }

const ACC = {
  nuevo: () => asistente(),
  pregenerados: () => abrirDlg({
    titulo: 'Pregenerados',
    cuerpo: `<p class="nota">Cuatro personajes de nivel 1, uno por clase, listos para jugar.</p><div class="opciones">${PREGENERADOS.map((g, i) => `
      <button class="opcion" data-dlg="pre" data-i="${i}"><span class="opcion-n">${esc(g.nombre)}<small>${esc(CLASES[g.clase].nombre)}</small></span>
      <span class="opcion-t">${esc(RAZAS[g.raza].nombre)} · ${esc(PROFESIONES[g.profesion].nombre)}. ${esc(g.motivo)}</span></button>`).join('')}</div>`,
    onClick: (a, btn) => { if (a === 'pre') crearPregenerado(+btn.dataset.i); },
  }),
  importar: () => $('archivo').click(),
  exportar: () => { const n = Almacen.exportar(); aviso(n ? `Copia con ${n} personaje${n === 1 ? '' : 's'}` : 'No hay personajes que copiar', n ? '' : 'mal'); },
  abrir: b => abrirPj(b.dataset.id),
  pv: b => cambio(() => { const c = calc(); App.pj.pv = Motor.clamp(pvActual(c) + (+b.dataset.d), 0, c.pvMax); }),
  dano: () => dlgDano(),
  curar: () => dlgCurar(),
  rec: b => ajustarRecurso(+b.dataset.d),
  'rec-usar': () => usarRecurso(),
  prueba: b => tiradaPrueba(b.dataset.a),
  salva: b => tiradaSalvacion(b.dataset.a),
  hitos: b => cambio(() => { App.pj.hitos = Math.max(0, (+App.pj.hitos || 0) + (+b.dataset.d)); }),
  subir: () => dlgSubirNivel(),
  'elegir-hab': () => dlgElegirHabilidad(),
  vent: b => { App.vent = +b.dataset.v; render(); },
  ataque: b => tiradaAtaque(b.dataset.t),
  'dano-tirar': () => tiradaDano(),
  'dano-rec': () => tiradaDano({ conRecurso: true }),
  'dano-embosc': () => tiradaDano({ emboscada: true }),
  defensa: () => tiradaDefensa(),
  bloqueo: () => tiradaBloqueo(),
  iniciativa: () => tiradaIniciativa(),
  huir: () => tiradaHuir(),
  'nuevo-combate': () => nuevoCombate(),
  'nueva-ronda': () => { cambio(() => { App.pj.reaccion = false; }); aviso('Nueva ronda: Reacción disponible'); },
  fuera: () => dlgFueraCombate(),
  descanso: b => descansar(b.dataset.id),
  slot: b => dlgObjeto({ slot: b.dataset.r }),
  'inv-nuevo': () => dlgObjeto({ nuevoInv: true }),
  'inv-editar': b => dlgObjeto({ inv: +b.dataset.i }),
  'inv-equipar': b => equiparDesdeMochila(+b.dataset.i),
  bolsas: () => pedirNumero('Ranuras extra por bolsas', App.pj.ranurasExtra || 0, v => cambio(() => { App.pj.ranurasExtra = v; })),
  cons: b => cambio(() => { const k = b.dataset.k; App.pj.consumibles[k] = Math.max(0, (+App.pj.consumibles[k] || 0) + (+b.dataset.d)); }),
  'cons-num': b => pedirNumero(CONSUMIBLES[b.dataset.k].nombre, +App.pj.consumibles[b.dataset.k] || 0, v => cambio(() => { App.pj.consumibles[b.dataset.k] = v; })),
  'pocion-rango': () => cambio(() => { App.pj.pocionRango = (App.pj.pocionRango || 1) % 8 + 1; }),
  uso: b => {
    const k = b.dataset.k; const v = App.pj.usos[k];
    const t = Motor.tirar(ESCALERA[v]);
    const baja = t.total <= 2;
    const nuevo = baja ? v - 1 : v;
    cambio(() => { App.pj.usos[k] = nuevo >= 0 ? nuevo : null; });
    mostrarSimple({ titulo: `Usar ${DADOS_USO[k].nombre.toLowerCase()}`, formula: `Dado de Uso ${ESCALERA[v]}`, dados: t.dados, total: t.total,
      veredicto: baja ? `<span class="veredicto mal">${nuevo < 0 ? 'Se acaban' : 'Baja a ' + ESCALERA[nuevo]}</span>` : '<span class="veredicto ok">Aguantan</span>',
      notas: [baja ? (nuevo < 0 ? 'Te quedas a oscuras.' : 'Con 1 o 2 baja un escalón.') : 'Con 1 o 2 habría bajado un escalón.'] });
  },
  'uso-nuevo': b => cambio(() => { App.pj.usos[b.dataset.k] = DADOS_USO[b.dataset.k].nuevo; }),
  mat: b => cambio(() => {
    const m = App.pj.materiales[+b.dataset.i];
    m.cantidad = Math.max(0, (+m.cantidad || 0) + (+b.dataset.d));
    if (m.cantidad === 0) App.pj.materiales.splice(+b.dataset.i, 1);
  }),
  'mat-nuevo': () => dlgMaterial(null),
  oro: () => pedirNumero('Oro', +App.pj.oro || 0, v => cambio(() => { App.pj.oro = v; }), { operaciones: true }),
  recolectar: () => dlgRecolectar(),
  fabricar: () => dlgFabricar(),
  'herida-borrar': b => cambio(() => { App.pj.heridas.splice(+b.dataset.i, 1); }),
  'editar-ficha': () => dlgEditarFicha(),
  'nueva-sesion': () => { cambio(() => { App.pj.repeticionUsada = false; }); aviso('Nueva sesión'); },
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
    if (a === 'humano') {
      App.pj.repeticionUsada = true; guardar();
      const r = t.res;
      tirarD20({ ...r, notas: (r.notas || []).concat(['Rasgo humano: repetida (una vez por sesión).']) });
      return;
    }
    const acc = t.acciones[+a];
    acc && acc.fn(t.res);
    return;
  }
  if (e.target === $('velo_tirada')) { $('velo_tirada').hidden = true; return; }
  if (e.target === $('velo_dlg')) { cerrarDlg(); return; }
  // Pestañas
  const p = e.target.closest('.pest');
  if (p) { App.pag = p.dataset.pag; render(); window.scrollTo(0, 0); return; }
  // Acciones
  const b = e.target.closest('[data-acc]');
  if (b && ACC[b.dataset.acc]) { ACC[b.dataset.acc](b, e); }
});

document.addEventListener('change', e => {
  const el = e.target;
  if (App._dlgChange && $('dlg').contains(el)) { App._dlgChange(e); return; }
  if (el.dataset.rival) {
    App.rival[el.dataset.rival] = el.dataset.rival === 'rango' ? +el.value : el.value;
    return;
  }
  if (el.dataset.campo && App.pj) { App.pj[el.dataset.campo] = el.value; guardar(); }
  if (el.id === 'archivo' && el.files[0]) {
    const f = el.files[0];
    f.text().then(txt => {
      try { const n = Almacen.importar(txt); aviso(`Importado${n === 1 ? '' : 's'}: ${n}`); render(); }
      catch (err) { aviso(err.message || 'No se pudo importar', 'mal'); }
      el.value = '';
    });
  }
});

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
