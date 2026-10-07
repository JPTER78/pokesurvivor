# Publicar el juego gratis en GitHub Pages

El juego es una web estática: GitHub Pages la sirve gratis en
`https://jpter78.github.io/pokemon-survivors/`.

## 1. Crear el repositorio (una vez)

1. Entra en <https://github.com/new> con la cuenta **JPTER78**.
2. Nombre: `pokemon-survivors` · **Public** · **sin** README, .gitignore ni licencia
   (ya vienen en el proyecto).
3. Crear repositorio.

## 2. Subir el proyecto

Desde la carpeta del proyecto (el repositorio local ya está creado y con el
primer commit hecho):

```
git remote add origin https://github.com/JPTER78/pokemon-survivors.git
git push -u origin main
```

La primera vez se abre una ventana para iniciar sesión en GitHub.
Son unos 75 MB, puede tardar unos minutos.

## 3. Activar GitHub Pages

En el repositorio: **Settings → Pages** →
*Source*: **Deploy from a branch** → *Branch*: **main**, carpeta **/ (root)** → **Save**.

En uno o dos minutos estará en <https://jpter78.github.io/pokemon-survivors/>.

## 4. Conectar con Firebase

Si ya seguiste [FIREBASE.md](FIREBASE.md), añade `jpter78.github.io` a los
**dominios autorizados** de Authentication (paso 5) y sube el
`firebase-config.js` rellenado:

```
git add js/core/firebase-config.js
git commit -m "Conectar con Firebase"
git push
```

## 5. Que salga en Google

1. <https://search.google.com/search-console> → **Añadir propiedad** →
   *Prefijo de la URL* → `https://jpter78.github.io/pokemon-survivors/`.
2. Verificación: el método **Etiqueta HTML** te da una línea `<meta ...>`;
   pégala dentro de `<head>` en `index.html`, haz `git push`, y pulsa Verificar.
3. **Inspección de URLs** → pega la dirección → **Solicitar indexación**.

Google tarda de días a semanas en mostrarlo, y al principio sólo aparece si se
busca el nombre exacto.

## Actualizar el juego más adelante

Cada vez que cambies algo:

```
git add -A
git commit -m "Qué has cambiado"
git push
```

GitHub Pages se actualiza solo en uno o dos minutos.

## Recordatorios

- **Nada de dinero**: ni anuncios, ni donaciones a cambio de nada, ni pagos.
  Lo exige la licencia de los sprites (CC BY-NC) y es lo que más reduce el
  riesgo de que Nintendo pida retirarlo.
- Si llega una reclamación de derechos al correo del aviso legal, atiéndela
  rápido: retirar lo que pidan suele cerrar el asunto.
