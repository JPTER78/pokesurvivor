// Reloj para seguir la partida en grupo con la pestaña oculta (ver bgTicker en
// game.js). El navegador deja de llamar a requestAnimationFrame y frena los
// temporizadores de una página oculta, pero no los de un Worker.
// Va aparte (no en app.min.js): la CSP no deja crear Workers desde un blob.
setInterval(() => postMessage(0), 1000 / 30);
