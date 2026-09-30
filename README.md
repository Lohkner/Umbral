# Umbral — v1.0

**Umbral** es la ficha de personaje para **Armisticio**, juego de rol de
fantasía oscura (*Manual Oficial v1.0*). Es una PWA pensada para el móvil: funciona sin
conexión, se instala en la pantalla de inicio y guarda cada cambio al
momento en el propio dispositivo.

Proyecto hermano de *S&S Companion*: mismo enfoque técnico, código propio.

## Qué incluye (niveles 1–10)

Una ficha sencilla, pensada para mirarla y tocarla en la mesa. Cuatro
pestañas, que se cambian con la barra de abajo o **deslizando el dedo** a
izquierda o derecha (cada una recuerda por dónde ibas):

- **Ficha**:
  - portada con retrato (se toca para elegir una foto, que se recorta al
    centro en 3:4), nombre, nivel e hitos con su «+»; aparecen «Subir de
    nivel» y «Elegir habilidad» cuando tocan;
  - **Estado**: PV y recurso con ±. «Usar» en Maná y Fe tira el dado y baja
    con 1–2. Botones para Descansar y Nuevo combate, y «Fuera de Combate»
    solo cuando estás a 0 PV;
  - **Combate**: la tirada de combate sirve para atacar y para bloquear.
    Se tocan para tirar Combate, Daño, Bloquear (Combate cuerpo a cuerpo
    +2 con escudo) e Iniciativa; el clérigo tiene además Combate mágico.
    La Guardia (defensa pasiva, y desprevenido) y la Armadura se muestran
    sin tirar.
- **Estadísticas**:
  - **Atributos**: arriba se tira la Prueba y abajo la Salvación (ya con la
    Competencia sumada);
  - **Habilidades**: las 13 del manual (Atletismo, Sigilo, Trato…). Se toca
    una y se tira; las entrenadas van marcadas y ya suman la Competencia;
  - **Aptitudes** de la clase, plegada.
- **Equipo**: las 6 ranuras (rareza por colores; propiedades y gemas solo
  si el objeto no es común), la mochila con sus ranuras y las provisiones
  (oro, raciones, pociones, flechas, dosis de veneno, portales, antorchas y
  aceite).
- **Notas**: notas libres, secuelas, **referencia rápida** (cap. 15),
  últimas tiradas y editar, exportar o borrar la ficha.

**Tiradas**: se toca y se tira. La ventaja o desventaja (por Rango o por
circunstancias) se elige después, desde el resultado, y el d20 se repite
con dos dados. El ataque ofrece tirar el daño, y el daño ofrece crítico ×2,
+Furia / +Combo o Emboscada. Crítico al atacar: no se puede bloquear. Al
bloquear: crítico, bloqueas y contraatacas; pifia, daño máximo sin
Armadura. El humano puede repetir una tirada por sesión;
se recupera sola si han pasado más de 6 horas.

**El roll**: al tirar, el dado se queda quieto y es el número el que rueda
dentro, como el rodillo de una tragaperras: cada cara entra por arriba y la
anterior sale por abajo, cada vez más despacio. Los dados se asientan uno
tras otro, con vibración en el móvil. El total y los botones
aparecen cuando se detienen, así que el resultado no se adelanta. Con
«reducir movimiento» se muestra directo.

**Creación**: asistente de 6 pasos (cap. 4) o uno de los cuatro
pregenerados. En el paso de Profesión se elige la Habilidad de la clase (y
otra si la profesión ya la entrena). Las entrenadas se cambian en Notas →
Editar.

**Cálculo automático**: modificadores, Competencia, Rango personal,
Guardia (Aguante), Armadura con su máximo, Bloqueo, dado de clase con los
escalones del arma (limitados por su Rango), PV, ranuras por Fuerza y
avisos de reglas.

**Tarjetas plegables**: recuerdan cómo las dejaste y, plegadas, enseñan una
línea de resumen.

**Identidad**: fondo azul medianoche, títulos en rojo sangre escarlata e
icono del esqueleto sobre azul.

Pendiente para más adelante (cap. 10–12): Leyenda, Renombre, Ascensión y la
hoja del Dominio. También un generador de botín.

## Cambios del Manual Oficial v1.0

- **Habilidades** (cap. 3, revisión del 29-9-2026):
  - son 13 áreas de entrenamiento, cada una con su atributo. Entrenada:
    1d20 + atributo + Competencia; sin entrenar, 1d20 + atributo;
  - la clase entrena 1 a elegir y la profesión 2; si repite, se elige
    otra;
  - lo que antes se llamaba «habilidades» de clase ahora son
    **Aptitudes** (niveles 1, 3, 5, 7 y 9);
  - los pregenerados traen sus Habilidades del manual, y las fichas
    anteriores reciben las de su clase y profesión (se pueden cambiar).
- **Combate**:
  - «Ataque» pasa a llamarse **Combate**, y la misma tirada sirve para
    atacar y para bloquear;
  - desaparecen la **Defensa** y la tirada para evitar ataques;
  - la Guardia es solo defensa pasiva.
- **Bloquear**: con el Combate cuerpo a cuerpo (+2 con escudo), contra el
  resultado del ataque; gasta la Reacción.
- **Recursos**:
  - la **Furia** no se puede gastar en d4, así que no baja de ahí;
  - gastar el **Combo** lo vacía;
  - el **Maná** y la **Fe** en d4 que sacan 1–2 se **agotan** hasta
    descansar.
- **Escudos**: el guerrero, cualquier escudo; el **clérigo, solo el escudo
  estándar** (la app avisa si lleva uno de torre).
- **Nuevos textos**: Aguante (solo Guardia), Golpe Brutal, Combo, Descarga,
  Nova de Escarcha, Luz Sagrada, Represalia, Polimorfia, Martillo sagrado,
  Robo de vida, Espinas y Calavera.
- **Consumibles**: nueva **dosis de veneno**. El manual no dice cuánto
  ocupa, así que la app no le cuenta ranuras.
- **Pregenerados**: iguales al manual (Combate, Guardia, Armadura, bloqueo).
- **Referencia rápida** del cap. 15 en la pestaña Notas, con la prueba de Habilidad entrenada.

Las fichas y copias hechas antes de llamarse Umbral se siguen importando.

## Archivos

| Archivo | Qué hace |
|---|---|
| `js/reglas.js` | Tablas del Manual Oficial v1.0, solo datos. Si el manual cambia, casi todo se toca aquí. |
| `js/motor.js` | Cálculo de la ficha y dados, en funciones puras. |
| `js/almacen.js` | Guardado en `localStorage`, copias e importación. |
| `js/app.js` | Interfaz: pestañas, tiradas, diálogos, asistente. |
| `css/app.css` | Estilo: azul medianoche, títulos escarlata y colores de rareza del manual. |
| `css/fuentes.css` + `fonts/` | Letras instaladas (OFL): IM Fell English SC, EB Garamond, Cinzel y JetBrains Mono. |
| `sw.js` | Caché sin conexión, primero la red: con conexión carga siempre lo último. Sube `CACHE_VERSION` al añadir o quitar archivos. |
| `icons/` | Icono (esqueleto) en versión normal, adaptable para Android, Apple y favicon. |

## Probar en local

```bash
python -m http.server 8735
```

Abre http://localhost:8735. Durante el desarrollo, el service worker sirve
la versión guardada: desregístralo o sube `CACHE_VERSION` para ver los
cambios.
