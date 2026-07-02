# Tank Mobility Browser Game

Juego de tanques para navegador, hecho en HTML5 Canvas y JavaScript puro. El foco del prototipo es la **movilidad del tanque**: inercia, aceleración, frenado, giro dependiente de velocidad, derrape, agarre del terreno y boost.

## Cómo correrlo

No requiere instalación.

```bash
python -m http.server 8000
```

Después abrí:

```text
http://localhost:8000
```

También podés abrir `index.html` directo en el navegador, aunque se recomienda servirlo con un server local.

## Controles

- `W`: acelerar
- `S`: frenar / reversa
- `A` / `D`: girar
- `Space`: freno de mano / derrape fuerte
- `Shift`: boost
- `R`: reiniciar posición
- Mouse: apuntar el cañón
- Click izquierdo: disparo simple

## Diseño del movimiento

El tanque no se mueve como un personaje de 8 direcciones. Tiene un modelo arcade con rasgos físicos:

- La dirección del cuerpo importa.
- El giro depende de la velocidad.
- El chasis conserva inercia.
- Hay fricción lateral para simular orugas.
- El freno de mano reduce tracción y permite derrapar.
- Distintos terrenos modifican agarre y velocidad.
- El boost da empuje corto, pero reduce control fino.

## Estructura

```text
.
├── assets/
│   ├── spritesheet.png
│   └── tank_top.png
├── src/
│   └── main.js
├── index.html
├── style.css
├── PROJECT_STATE.md
└── README.md
```

## Objetivo jugable

Atravesar los checkpoints del circuito practicando curvas, reversa, derrape y control de velocidad. El puntaje central es el tiempo de vuelta y la calidad de conducción.

## Próximo paso recomendado

Separar el movimiento en `src/tankPhysics.js` y agregar tuning por tipo de tanque: ligero, medio y pesado.
