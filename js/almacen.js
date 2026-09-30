/* ══════════════════════════════════════════════════════════════
   Almacén: personajes en localStorage, guardado automático y copias.
   Cada cambio se guarda al momento: en el móvil no hay botón «Guardar»
   que olvidar. La copia de seguridad es un JSON con todos.
══════════════════════════════════════════════════════════════ */
'use strict';

const Almacen = (() => {
  const CLAVE = 'arm_personajes';
  const CLAVE_ACTIVO = 'arm_activo';
  const VERSION_FICHA = 1;

  const leerTodo = () => {
    try { return JSON.parse(localStorage.getItem(CLAVE)) || {}; } catch (e) { return {}; }
  };
  const escribirTodo = t => {
    try { localStorage.setItem(CLAVE, JSON.stringify(t)); return true; } catch (e) { return false; }
  };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  function nuevo() {
    return {
      v: VERSION_FICHA, id: uid(), creado: Date.now(), editado: Date.now(),
      nombre: '', raza: 'humano', atrHumano: 'FUE', clase: 'guerrero', profesion: 'herrero', motivo: '',
      base: { FUE: 10, DES: 10, VIT: 10, MEN: 10 },
      nivel: 1, hitos: 0, pvNiveles: [], pv: null,
      recurso: null, reaccion: false, repeticionUsada: false,
      aptitudes: [], entrenadas: [],
      equipo: { arma: null, armadura: null, escudo: null, amuleto: null, anillo1: null, anillo2: null },
      inventario: [], consumibles: { raciones: 0, flechas: 0, pociones: 0, portal: 0 },
      pocionRango: 1, usos: { antorchas: null, aceite: null },
      materiales: [], oro: 0, ranurasExtra: 0,
      profRango: 1, profFabricados: 0,
      heridas: [], notas: '', historial: [],
    };
  }

  function lista() {
    return Object.values(leerTodo()).sort((a, b) => (b.editado || 0) - (a.editado || 0));
  }
  function obtener(id) { return leerTodo()[id] || null; }
  function guardar(pj) {
    const t = leerTodo();
    pj.editado = Date.now();
    t[pj.id] = pj;
    return escribirTodo(t);
  }
  function borrar(id) {
    const t = leerTodo(); delete t[id]; escribirTodo(t);
    if (activo() === id) localStorage.removeItem(CLAVE_ACTIVO);
  }
  function activo(id) {
    try {
      if (id !== undefined) { if (id) localStorage.setItem(CLAVE_ACTIVO, id); else localStorage.removeItem(CLAVE_ACTIVO); }
      return localStorage.getItem(CLAVE_ACTIVO);
    } catch (e) { return null; }
  }

  /* Rellena campos que falten (fichas de versiones anteriores) */
  function normalizar(pj) {
    const base = nuevo();
    const r = Object.assign(base, pj);
    r.base = Object.assign(nuevo().base, pj.base || {});
    r.equipo = Object.assign(nuevo().equipo, pj.equipo || {});
    r.consumibles = Object.assign(nuevo().consumibles, pj.consumibles || {});
    r.usos = Object.assign(nuevo().usos, pj.usos || {});
    // Antes del manual con Habilidades, las aptitudes se llamaban «habilidades»
    if (!Array.isArray(pj.aptitudes) && Array.isArray(pj.habilidades)) r.aptitudes = pj.habilidades.slice();
    delete r.habilidades;
    // Fichas sin Habilidades entrenadas: las de su clase y profesión (se pueden cambiar al editar)
    if (!Array.isArray(pj.entrenadas)) r.entrenadas = Motor.entrenadasIniciales(r.clase, r.profesion);
    ['inventario', 'materiales', 'aptitudes', 'entrenadas', 'heridas', 'historial', 'pvNiveles'].forEach(k => { if (!Array.isArray(r[k])) r[k] = []; });
    return r;
  }

  function exportar() {
    const datos = { tipo: 'umbral-respaldo', version: VERSION_FICHA, fecha: new Date().toISOString(), personajes: lista() };
    const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    const f = new Date().toISOString().slice(0, 10);
    a.href = URL.createObjectURL(blob);
    a.download = `umbral-respaldo-${f}.json`;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    return datos.personajes.length;
  }

  /* Acepta una copia completa o una ficha suelta. Devuelve cuántas entraron. */
  function importar(texto) {
    const datos = JSON.parse(texto);
    // Acepta también las copias hechas antes de llamarse Umbral
    const fichas = datos && (datos.tipo === 'umbral-respaldo' || datos.tipo === 'armisticio-respaldo') ? datos.personajes
      : datos && datos.clase && datos.base ? [datos] : null;
    if (!fichas) throw new Error('El archivo no es una ficha ni una copia de Umbral.');
    const t = leerTodo();
    fichas.forEach(f => {
      const pj = normalizar(f);
      if (t[pj.id] && JSON.stringify(t[pj.id]) !== JSON.stringify(pj)) pj.id = uid();   // no pisa otra distinta
      t[pj.id] = pj;
    });
    escribirTodo(t);
    return fichas.length;
  }

  return { nuevo, lista, obtener, guardar, borrar, activo, normalizar, exportar, importar, uid };
})();
