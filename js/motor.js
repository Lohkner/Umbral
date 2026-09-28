/* ══════════════════════════════════════════════════════════════
   Motor de reglas: todo lo que se calcula a partir de la ficha.
   Funciones puras (no tocan el DOM). La ficha guarda solo lo que el
   jugador decide o tira; lo derivado se recalcula siempre aquí.
══════════════════════════════════════════════════════════════ */
'use strict';

const Motor = (() => {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function mod(v) {
    for (const [a, b, m] of TABLA_MOD) if (v >= a && v <= b) return m;
    return v < 3 ? -3 : 3;
  }
  const signo = n => (n >= 0 ? '+' : '−') + Math.abs(n);

  /* ── Dados ─────────────────────────────────────────────────── */
  const d = caras => 1 + Math.floor(Math.random() * caras);
  function parse(expr) {                       // 'd8', '2d10' → {n, caras}
    const m = /^(\d*)d(\d+)$/.exec(String(expr).trim());
    return m ? { n: +(m[1] || 1), caras: +m[2] } : null;
  }
  function tirar(expr) {
    const p = parse(expr);
    if (!p) return { total: 0, dados: [] };
    const dados = Array.from({ length: p.n }, () => d(p.caras));
    return { total: dados.reduce((a, b) => a + b, 0), dados, max: p.n * p.caras };
  }
  const maxDe = expr => { const p = parse(expr); return p ? p.n * p.caras : 0; };
  const escalon = i => (i < 0 ? '—' : ESCALERA[clamp(i, 0, ESCALERA.length - 1)]);

  /* Ventaja por diferencia de Rango (cap. 3) */
  function porRango(mio, suyo) {
    if (!suyo) return { ventaja: 0, extra: null, texto: '' };
    const dif = mio - suyo;
    if (dif >= 2) return { ventaja: 1, extra: 'domina', texto: 'Dominas: ventaja y algo extra a tu favor' };
    if (dif === 1) return { ventaja: 1, extra: null, texto: 'Un Rango por encima: ventaja' };
    if (dif === 0) return { ventaja: 0, extra: null, texto: 'Mismo Rango: tiras normal' };
    if (dif === -1) return { ventaja: -1, extra: null, texto: 'Un Rango por debajo: desventaja' };
    return { ventaja: -1, extra: 'superado', texto: 'Superado: desventaja y algo extra en tu contra' };
  }

  /* d20 con ventaja (1), normal (0) o desventaja (−1) */
  function d20(ventaja) {
    const a = d(20);
    if (!ventaja) return { dados: [a], natural: a };
    const b = d(20);
    return { dados: [a, b], natural: ventaja > 0 ? Math.max(a, b) : Math.min(a, b) };
  }

  /* ── Objetos ───────────────────────────────────────────────── */
  const props = it => (it && Array.isArray(it.props) ? it.props : []);
  const tiene = (it, id) => props(it).filter(p => p.id === id).length;
  const gemas = it => (it && Array.isArray(it.gemas) ? it.gemas.filter(Boolean) : []);
  const engastes = it => tiene(it, 'engaste');

  /* Ranuras de mochila que ocupa un objeto (cap. 6) */
  function ranurasDe(it) {
    if (!it) return 0;
    if (it.ranuras != null && it.ranura === 'otro') return +it.ranuras || 0;
    if (it.ranura === 'arma' && it.sub === 'dos') return 2;
    if (it.ranura === 'armadura') {
      const a = ARMADURAS.find(x => x.id === it.sub);
      if (a && a.tipo === 'pesada') return 2;
    }
    return 1;
  }

  /* Escalones de daño que da un arma o foco, limitados por su Rango */
  function escalonesArma(it) {
    if (!it) return 0;
    const n = tiene(it, 'mejora') + gemas(it).filter(g => g === 'rubi').length;
    return Math.min(n, it.rango || 1);
  }

  /* ── Cálculo de la ficha ───────────────────────────────────── */
  function calcular(pj) {
    const cl = CLASES[pj.clase] || CLASES.guerrero;
    const nivel = clamp(+pj.nivel || 1, 1, 10);
    const comp = COMPETENCIA[nivel];
    const rango = RANGO_PERSONAL[nivel];
    const eq = pj.equipo || {};
    const puestos = RANURAS.map(r => eq[r.id]).filter(Boolean);

    // Atributos: base + raza + objetos (máx. 18)
    const bonus = { FUE: 0, DES: 0, VIT: 0, MEN: 0 };
    const raza = RAZAS[pj.raza];
    if (raza) { const a = raza.atr || pj.atrHumano; if (a) bonus[a] += 1; }
    const fuentesAtr = { FUE: [], DES: [], VIT: [], MEN: [] };
    RANURAS.forEach(r => {
      const it = eq[r.id]; if (!it) return;
      props(it).forEach(p => {
        const esJoyaMejora = p.id === 'mejora' && r.tipo === 'joya';
        if ((p.id === 'atributo' || esJoyaMejora) && p.atr && bonus[p.atr] != null) {
          bonus[p.atr] += 1; fuentesAtr[p.atr].push(it.nombre || r.nombre);
        }
      });
      if (r.tipo === 'joya') gemas(it).forEach(g => {
        const a = { rubi: 'FUE', calavera: 'VIT', topacio: 'MEN' }[g];
        if (a) { bonus[a] += 1; fuentesAtr[a].push(GEMAS[g].nombre); }
      });
    });
    const atr = {}, mods = {};
    ATRIBUTOS.forEach(a => {
      atr[a] = clamp((+pj.base?.[a] || 10) + bonus[a], 3, ATR_MAX);
      mods[a] = mod(atr[a]);
    });

    // Arma, escudo, armadura
    const arma = eq.arma || null;
    const escudo = eq.escudo && eq.escudo.sub !== 'secundaria' ? eq.escudo : null;
    const escData = escudo ? ESCUDOS.find(e => e.id === escudo.sub) || ESCUDOS[0] : null;
    const armadura = eq.armadura || null;
    const armData = armadura ? ARMADURAS.find(a => a.id === armadura.sub) || ARMADURAS[0] : ARMADURAS[0];

    // Guardia (defensa pasiva): 10 + DES (VIT con Aguante) + Competencia + escudo + otros
    const aguante = pj.clase === 'guerrero';
    const atrDef = aguante ? 'VIT' : 'DES';
    let guardiaOtros = 0;
    if (escudo) guardiaOtros += tiene(escudo, 'mejora') + gemas(escudo).filter(g => g === 'zafiro').length;
    const guardiaEscudo = escData ? escData.guardia : 0;
    const guardia = 10 + comp + mods[atrDef] + guardiaEscudo + guardiaOtros + (+pj.guardiaExtra || 0);
    const guardiaDesprevenido = guardia - guardiaEscudo;

    // Armadura (RD): pieza + propiedades + gemas + otros, máx. 5 + Competencia
    let armOtros = 0;
    if (armadura) armOtros += tiene(armadura, 'mejora') + gemas(armadura).filter(g => g === 'zafiro').length;
    const armBruta = armData.valor + armOtros + (+pj.armaduraExtra || 0);
    const armMax = 5 + comp;
    const armaduraRD = Math.min(armBruta, armMax);

    // PV máximos
    let pvObjetos = 0;
    puestos.forEach(it => { pvObjetos += 2 * tiene(it, 'pv'); });
    [armadura, escudo].forEach(it => { if (it) pvObjetos += 2 * gemas(it).filter(g => g === 'rubi').length; });
    const pvNiveles = (pj.pvNiveles || []).reduce((a, b) => a + (+b || 0), 0);
    const pvMax = Math.max(1, cl.pv + pvNiveles + pvObjetos + (+pj.pvExtra || 0));

    // Combate: lo que se suma para atacar (y, el cuerpo a cuerpo, para bloquear)
    const ataque = { cac: mods.FUE + comp, dist: mods.DES + comp, magia: mods.MEN + comp };
    const tipoArma = arma?.sub || 'cac';
    const ataquePrincipal = tipoArma === 'dist' ? 'dist' : tipoArma === 'foco' ? 'magia' : 'cac';

    // Bloquear: Combate cuerpo a cuerpo, +2 con escudo; necesita escudo o arma CaC
    const puedeBloquear = !!escudo || (arma && (arma.sub === 'cac' || arma.sub === 'dos'));
    const bloqueo = puedeBloquear ? mods.FUE + comp + (escData ? escData.bloqueo : 0) : null;

    // Dado de clase y escalones del arma
    const escArma = escalonesArma(arma);
    const dadoBase = cl.dado;
    const dado = escalon(dadoBase + escArma);

    // Recurso
    const rec = cl.recurso;
    const inicioExtra = puestos.reduce((a, it) => a + tiene(it, 'recurso'), 0) > 0 ? 1 : 0;
    let recMax = rec.max;
    if (!rec.sube) recMax = nivel >= 9 ? 4 : nivel >= 5 ? 3 : 2;
    const recInicio = rec.sube ? Math.min(rec.inicio + inicioExtra, recMax) : recMax;

    // Efectos de objetos
    const resist = new Set(), efectos = [];
    let critMin = 20;
    puestos.forEach(it => {
      props(it).forEach(p => {
        if (p.id === 'resistencia' && p.res) resist.add(p.res);
        if (p.id === 'critico') critMin = 19;
        if (['robo', 'espinas', 'agil', 'hallazgo'].includes(p.id)) {
          const P = PROPIEDADES.find(x => x && x.id === p.id); efectos.push(`${P.nombre}: ${P.txt}`);
        }
      });
    });
    RANURAS.forEach(r => {
      const it = eq[r.id]; if (!it) return;
      gemas(it).forEach(g => {
        const G = GEMAS[g]; if (!G) return;
        if (r.tipo === 'joya' && g === 'zafiro') resist.add('frio');
        const lugar = r.tipo === 'arma' ? 'arma' : r.tipo === 'joya' ? 'joya' : 'armadura';
        if (!(g === 'rubi') && !(r.tipo === 'joya') && !(g === 'zafiro' && lugar === 'armadura'))
          efectos.push(`${G.nombre} (${it.nombre || r.nombre}): ${G[lugar]}`);
      });
      if (it.unico) efectos.push(`${it.nombre || r.nombre}: ${it.unico}`);
    });
    const agil = puestos.some(it => tiene(it, 'agil'));

    // Mochila: tantas ranuras como Fuerza (+ bolsas)
    const ranurasMax = atr.FUE + (+pj.ranurasExtra || 0);
    const inv = pj.inventario || [];
    let ranurasUsadas = inv.reduce((a, it) => a + ranurasDe(it), 0);
    const cons = pj.consumibles || {};
    const consRanuras = {};
    Object.entries(CONSUMIBLES).forEach(([k, c]) => {
      const n = +cons[k] || 0;
      consRanuras[k] = n > 0 && c.porRanura ? Math.ceil(n / c.porRanura) : 0;
      ranurasUsadas += consRanuras[k];
    });
    Object.keys(DADOS_USO).forEach(k => { if (pj.usos && pj.usos[k] != null && pj.usos[k] >= 0) ranurasUsadas += 1; });
    const matRanuras = (pj.materiales || []).reduce((a, m) => a + ((+m.cantidad || 0) > 0 ? 1 : 0), 0);
    ranurasUsadas += matRanuras;

    // Avisos
    const avisos = [];
    if (armData.tipo && !cl.armadura.includes(armData.tipo))
      avisos.push(`${cl.nombre}: no puede llevar armadura ${armData.tipo}.`);
    if (escudo && !cl.escudo) avisos.push(`${cl.nombre}: no puede llevar escudo.`);
    else if (escudo && !(cl.escudos || []).includes(escudo.sub)) avisos.push(`${cl.nombre}: solo puede llevar escudo estándar.`);
    if (armBruta > armMax) avisos.push(`Tu Armadura sería ${armBruta}, pero el máximo es ${armMax} (5 + Competencia): se pierde el resto.`);
    if (ranurasUsadas > ranurasMax) avisos.push(`Llevas ${ranurasUsadas} ranuras y solo tienes ${ranurasMax}: lo que no cabe se deja atrás.`);
    RANURAS.forEach(r => {
      const it = eq[r.id]; if (!it) return;
      if (gemas(it).length > engastes(it)) avisos.push(`${it.nombre || r.nombre}: tiene más gemas que engastes.`);
      if (r.tipo === 'arma') {
        const n = tiene(it, 'mejora') + gemas(it).filter(g => g === 'rubi').length;
        if (n > (it.rango || 1)) avisos.push(`${it.nombre || 'Arma'}: un objeto no sube más escalones que su Rango (${ROMANO[it.rango || 1]}).`);
      }
    });

    return {
      cl, nivel, comp, rango, atr, mods, bonus, fuentesAtr,
      ataque, ataquePrincipal, guardia, guardiaDesprevenido, atrDef,
      armadura: armaduraRD, armaduraBruta: armBruta, armaduraMax: armMax, armData,
      bloqueo, pvMax, dado, dadoBase, escArma,
      rangoArma: arma?.rango || 1, rangoArmadura: armadura?.rango || 1,
      recurso: { ...rec, maxIdx: recMax, inicioIdx: recInicio },
      resist: [...resist], efectos, critMin, agil,
      ranurasMax, ranurasUsadas, consRanuras, avisos,
      hitosNecesarios: hitosParaSubir(nivel),
    };
  }

  return { mod, signo, d, tirar, parse, maxDe, escalon, porRango, d20, calcular, ranurasDe, escalonesArma, clamp, engastes, gemas, tiene };
})();
