# Armisticio Companion — v0.1

Ficha de personaje para **Armisticio**, juego de rol de fantasía oscura
(*Manual de Prueba v0.1*). Es una PWA pensada para el móvil: funciona sin
conexión, se instala en la pantalla de inicio y guarda cada cambio al
momento en el propio dispositivo.

Proyecto hermano de *S&S Companion*: mismo enfoque técnico, código propio.

## Qué incluye (niveles 1–10)

- **Ficha resumida, como S&S**:
  - retrato en la portada: se toca para elegir foto, que se recorta al
    centro en 3:4 y se guarda comprimida dentro de la ficha;
  - tarjetas plegables que recuerdan cómo las dejaste y, plegadas, enseñan
    una línea de resumen (PV, modificadores, Ataque/Defensa/Armadura, oro…);
  - PV y recurso juntos en «Estado»;
  - Atacar y Defenderse en una sola tarjeta «Combate»;
  - sin párrafos de reglas a la vista.
- **Creación paso a paso** (cap. 4), en seis pasos:
  1. Atributos: 3d6 en orden, con intercambio de dos resultados.
  2. Raza.
  3. Clase.
  4. Profesión.
  5. Equipo inicial: las armas y armaduras se limitan a lo que la clase
     puede usar, y se tira el oro (3d6 × 10).
  6. Nombre y motivo.
- **Pregenerados**: los cuatro personajes del manual, listos para jugar.
- **Números de combate calculados**:
  - Ataque cuerpo a cuerpo, a distancia y mágico.
  - Guardia (también desprevenido) y Defensa. Aguante: el guerrero usa
    Vitalidad.
  - Armadura con su máximo de 5 + Competencia.
  - Bloqueo, solo con escudo o arma cuerpo a cuerpo.
  - Iniciativa y huida.
- **Tiradas**:
  - d20 + modificador contra una CD o Guardia, con crítico (y crítico
    ampliado) y pifia.
  - Ventaja o desventaja: la manual y la que sale sola al comparar Rangos
    (arma al atacar, armadura al defenderse, Rango personal en las
    salvaciones), con los efectos de «dominas» y «superado».
  - Rasgo humano: repetir una tirada por sesión.
- **Daño**: dado de clase con los escalones del arma (limitados por su
  Rango), crítico doble, Golpe Brutal (suma y baja la Furia), Eviscerar
  (suma y vacía el Combo) y Emboscada.
- **Recurso de clase** en la escalera de dados:
  - la Furia sube al recibir daño, con el escalón extra del orco;
  - el Combo sube con cada acierto;
  - el Maná y la Fe se tiran al usarlos y bajan con 1–2; suben a d10 en el
    nivel 5 y a d12 en el 9.
- **PV**: daño recibido (con la Armadura restada, mínimo 1), curación y
  pociones por Rango.
- **Fuera de Combate**: con sus secuelas (−1 permanente a un atributo,
  Maltrecho…).
- **Descansos**: corto, largo (gasta ración) y en la ciudad.
- **Equipo**:
  - 6 ranuras, con Rango, rareza por colores, propiedades del d12,
    engastes con gemas (efecto según la ranura) y poder único o bonus de
    conjunto.
  - Avisos de armadura no permitida, exceso de Armadura, escalones por
    encima del Rango y gemas sin engaste.
- **Mochila**: ranuras = Fuerza (+ bolsas); las armas a dos manos y la
  armadura pesada ocupan 2.
- **Consumibles**: raciones, flechas, pociones y portales por ranura;
  antorchas y aceite con dado de Uso.
- **Materiales y oro.**
- **Profesión**: recolectar y fabricar con su CD, y Rango de profesión que
  sube cada 3 piezas.
- **Hitos y subida de nivel**:
  - la vida se tira y suma al menos la mitad del dado;
  - cada atributo sube con un d20 mayor que su valor;
  - suben la Competencia y el Rango personal;
  - en los niveles 3, 5, 7 y 9 se elige una habilidad de estilo.
- **Diario**: heridas, notas e historial de tiradas.
- **Datos**: exportar una ficha, copia de seguridad de todos e importar.
- **Tamaño de letra**: cuatro tamaños, con suelo de 12 px en todo el
  texto.

Pendiente para más adelante (cap. 10–12): Leyenda, Renombre, Ascensión y la
hoja del Dominio. También un generador de botín.

## Archivos

| Archivo | Qué hace |
|---|---|
| `js/reglas.js` | Tablas del manual, solo datos. Si el manual cambia, casi todo se toca aquí. |
| `js/motor.js` | Cálculo de la ficha y dados, en funciones puras. |
| `js/almacen.js` | Guardado en `localStorage`, copias e importación. |
| `js/app.js` | Interfaz: pestañas, tiradas, diálogos, asistente. |
| `css/app.css` | Estilo: hierro, óxido y títulos en rojo sangre seca; colores de rareza del manual. |
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
