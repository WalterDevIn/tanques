# PROJECT_STATE

## Estado actual

Prototipo inicial jugable de tanque en navegador.

## Prioridad de diseño

Movilidad del tanque.

El núcleo implementado es un modelo arcade-físico:

- aceleración direccional;
- frenado y reversa;
- rotación dependiente de velocidad;
- velocidad angular limitada;
- fricción lateral para sensación de orugas;
- derrape con Space;
- boost con Shift;
- terrenos con modificadores de agarre;
- checkpoints para probar conducción.

## Archivos principales

- `index.html`: shell del juego.
- `style.css`: presentación general.
- `src/main.js`: loop, input, física, render y reglas.
- `assets/tank_top.png`: sprite top-down extraído del material dado.
- `assets/spritesheet.png`: imagen original de referencia.

## No implementado todavía

- enemigos;
- daño real;
- editor de niveles;
- audio;
- persistencia de mejores tiempos;
- menú de selección de tanque.

## Dirección recomendada

La siguiente feature debería extraer el modelo de movilidad a un módulo independiente y agregar presets de tanque:

- Scout: rápido, poco agarre, giro alto.
- Medium: balanceado.
- Heavy: lento, mucha masa, giro bajo, boost potente.
