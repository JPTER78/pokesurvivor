# Pruebas de seguridad

Tres pruebas, sin tocar el servidor real (todo en local, con los emuladores de Firebase):

| Prueba | Qué comprueba |
|---|---|
| `rules.test.mjs` | `firestore.rules` y `database.rules.json`: lo legítimo pasa y los intentos de saltarse las reglas (HTML en el ranking o el perfil, evadir un baneo, apodos falsos en la lista de amigos, hacerse pasar por otro en la cola de mensajes de la sala...) se rechazan. |
| `client.test.js` | Que `rowOf` (ranking) y `cleanProfile` (perfiles) convierten datos hostiles en datos inofensivos, y `G.U.int` / `G.U.num`. |
| `net.test.js` | Que `js/net/net.js` envía y recibe el formato nuevo de mensajes y que nadie puede ofrecer una conexión haciéndose pasar por el anfitrión. |

## Cómo se ejecutan

Hace falta Node 18+ y Java 11+ (los emuladores de Firebase lo usan).

```bash
cd tools/tests-seguridad
npm install
npm run reglas            # reglas de ahora (con la compatibilidad temporal de la cola de mensajes)
npm run reglas:estricta   # reglas finales (docs/seguridad/database.rules.strict.json)
npm run cliente           # client.test.js + net.test.js (no necesitan emuladores)
```

Todas tienen que acabar con "como se esperaba" / "OK". Si se toca una regla, hay que
añadir aquí el caso que la justifica.
