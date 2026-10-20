# Cartel con el QR del portal

> **BORRADOR: no imprimir hasta definir el dominio.** El cartel guardado acá lleva
> una franja roja que lo dice. Cuando el dominio del portal sea el definitivo:
> `npm run cartel-qr -- --final` (con la dirección definitiva, si cambió), y
> actualizar el test que pide la franja (`tests/cartelQr.test.js`).

Dos archivos que apuntan a la dirección fija
`https://app-semillero.vercel.app/consultas`:

- `cartel-consultas-A4.pdf`: cartel A4 (escudo, "Escaneá y venite a jugar al
  básquet", el QR y la dirección escrita debajo). El QR mide unos 11,6 cm.
- `qr-consultas.png` (**sin franja de borrador: no usarlo para imprimir hasta definir el dominio**): sólo el código, negro sobre blanco con su margen, para
  pegarlo en otras piezas (flyers, redes, entradas). Para imprimirlo, no lo
  achiques por debajo de 3 cm de lado.

**La dirección `/consultas` lleva siempre al formulario de consultas vigente**:
el QR impreso no vence aunque se cambie el formulario (se cambia desde la app,
en Coordinación → Familias → Formularios).

## Antes de imprimir

1. **Escaneá el cartel con un celular** (desde la pantalla o una prueba
   impresa) y confirmá que abre el formulario. Los tests verifican que el
   código esté bien armado, pero no hay un lector de QR real en la máquina de
   desarrollo: la prueba definitiva es el teléfono.
2. **El QR codifica el dominio.** Si el portal va a pasar a otro dominio
   (por ejemplo un alias tipo `basquetnewells`), decidilo **antes** de
   imprimir: un cartel ya impreso queda apuntando al dominio con que se generó.
3. `/consultas` tiene que estar funcionando en producción.

## Regenerar

```
npm run cartel-qr                                   # la dirección de arriba, como BORRADOR
npm run cartel-qr -- https://otro-dominio.org/consultas
npm run cartel-qr -- --final                        # sin la franja de borrador
```

Sin dependencias: el código QR sale de `scripts/qr.mjs` y el PDF se escribe a
mano (vectorial, fuente Helvetica). `tests/cartelQr.test.js` falla si los
archivos guardados no son los de la dirección vigente (`URL_POR_DEFECTO` en
`scripts/cartel-qr.mjs`): al cambiarla, regenerar y commitear.
