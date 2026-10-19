# Coturn preparado para un VPS

**Estado: paquete preparado; no desplegado ni conectado al juego.** Rama
`codex/coturn-deployment`. No contrata recursos, no toca DNS y no modifica Firebase.
El operador puede desplegarlo y validarlo siguiendo la [guía de Oracle](ORACLE.md).
La activación en el juego requiere la integración y validación descritas más abajo.

## Qué incluye

- Coturn `4.18.0-r0`, con UDP/TCP 3478 y relé UDP 49160–49559. Red host en Linux.
- API de credenciales en Node 24 y Firebase Admin `14.5.0`, con lockfile.
- Caddy `2.11.7` para HTTPS de la API; certificados renovados automáticamente.
- Generador de configuración y secreto de 256 bits; los archivos privados están
  ignorados por Git. No se genera ni publica ningún secreto de producción ahora.
- Credenciales HMAC temporales; verificación de ID token del proyecto existente
  `pokesurvivor-free`; piloto cerrado mediante una lista de UID autorizados.
- Cuotas de asignaciones, velocidad, memoria y rotación de logs. Destinos privados,
  loopback, metadatos del proveedor y destinos IPv6 bloqueados. Primera versión IPv4.

Coturn transporta los datos entre navegadores cuando no pueden conectar directamente.
La API solo entrega credenciales; no recibe estados de la partida. Firebase sigue
gestionando la señalización como hasta ahora. No hace falta activar Identity Platform,
crear Cloud Functions, habilitar Firestore adicional ni usar una clave de cuenta de servicio.

## Antes del despliegue

Elegir con el autor un VPS Linux dedicado o sin servicios que ocupen 80, 443, 3478,
5349 y 8088, con IPv4 pública estable. Instalar Docker Engine y Compose v2 mediante
las instrucciones oficiales del proveedor/Docker y mantener el reloj sincronizado.
El acceso al grupo Docker equivale a privilegios administrativos del host.

Crear dos registros A: `turn.<dominio>` e `ice.<dominio>` apuntando a la IPv4 pública.
Usar DNS directo, **sin proxy HTTP de Cloudflare**, para ambos en esta configuración.
No publicar registros AAAA todavía. Revisar las restricciones de CAA si existen.

No se ha elegido tamaño ni proveedor: hacen falta estimaciones de concurrencia,
porcentaje de partidas que usarán TURN y transferencia incluida. Las cuotas de abajo
son valores para un piloto, no una promesa de capacidad ni un límite de gasto mensual.

### Puertos del firewall del proveedor y del propio VPS

| Entrada | Origen | Uso |
| --- | --- | --- |
| SSH configurado en el VPS | Solo IP/red de administración | Administración |
| TCP 80 y 443 | Internet | HTTPS de la API y emisión/renovación ACME |
| UDP y TCP 3478 | Internet | Cliente → coturn |
| UDP 49160–49559 | Internet | Puertos de relé; respetar cualquier cambio del rango |
| TCP 5349 | Internet, solo al habilitar `tls` | TURN sobre TLS opcional |
| TCP 8088 | **Nunca abrir** | API interna enlazada a 127.0.0.1 |

La salida debe permitir DNS, HTTPS hacia Google/ACME y UDP hacia los puertos públicos
de los otros jugadores, no solo hacia el rango local 49160–49559. Mantener tráfico
de retorno establecido. No aplicar una política de firewall que corte el SSH actual.
No se proporcionan comandos de firewall destructivos o dependientes del proveedor.

## Preparar los archivos en Linux

Copiar esta carpeta al VPS. Ejecutar como el usuario de despliegue, no como root:

```sh
cd infra/coturn
cp settings.example.json settings.json
# Editar settings.json con un editor antes de seguir.
python3 prepare.py --check
python3 prepare.py
docker compose config --quiet
docker compose pull
docker compose build credentials
```

Campos que hay que cambiar:

- `turnHost`, `apiHost`, `acmeEmail`: nombres reales y correo del operador.
- `publicIp`: IPv4 pública estable.
- `localIp`: dirección de la interfaz, comprobada con `ip -4 address`.
  En un VPS con IP pública directa coincide con `publicIp`. En Oracle/GCP con NAT suele ser
  privada: se genera `external-ip=PUBLICA/PRIVADA`. El NAT debe preservar los puertos.
- `allowedUids`: UID de las cuentas Firebase elegidas para el piloto. Con la lista
  vacía nadie obtiene credenciales, aunque tenga una sesión válida.
- `origins`: orígenes HTTPS exactos autorizados, sin barra final ni comodines.
- `allowAllAuthenticated`: dejar `false` para el piloto. `true` permite todas las
  cuentas no anónimas del proyecto, por lo que aumenta la exposición a abuso.

El generador rechaza marcadores de ejemplo, configuraciones inseguras y rangos
incoherentes. Se conserva el secreto al volver a ejecutarlo. Los contenedores de
coturn y de la API usan el UID/GID del operador; archivos de secretos en modo 0600.
No copiar `.env` de Windows: regenerarlo en Linux. No compartir `runtime/`, `certs/`
ni `settings.json` en una PR. Respaldarlos solo en almacenamiento privado.

## Arranque del piloto

```sh
docker compose up -d
docker compose ps
docker compose logs --tail=80 coturn credentials https
curl --fail http://127.0.0.1:8088/healthz
```

El arranque de Caddy solicita un certificado público real para `apiHost`.
La comprobación de salud solo verifica que la API responde; **no prueba el relé**.
Comprobar que coturn no registra opciones desconocidas, errores de permisos ni
direcciones de escucha inexistentes. `ss -lntup` debe confirmar que 8088 solo escucha
en loopback y que no hay interfaces de administración expuestas.

La API acepta `POST https://ice.<dominio>/v1/ice`, sin cuerpo, con:

```text
Origin: https://pokesurvivor.com
Authorization: Bearer <Firebase ID token de una cuenta piloto>
```

Devuelve `expiresAt` y un array `iceServers` compatible con WebRTC. Nunca devuelve
el secreto compartido. No pegar tokens o credenciales en tickets públicos, comandos
con historial ni webs de terceros. El origen/CORS no sustituye a la autenticación:
los clientes externos pueden falsificar Origin, pero siguen necesitando un token válido.

El SDK verifica firma, emisor, audiencia y caducidad. No consulta revocación/bloqueo
en cada petición: un ID token ya emitido puede seguir aceptándose hasta que expire.
Retirar un UID del piloto y reiniciar la API corta nuevas credenciales para esa cuenta;
las ya emitidas no se revocan por ello. No se registra el encabezado Authorization.
Los logs de coturn pueden contener direcciones IP/usuarios: tratarlos como datos operativos privados.

### Comprobación real del relé, pendiente

Antes de activarlo para todos, probar con dos navegadores/equipos en redes distintas,
incluyendo una conexión móvil, usando credenciales piloto y temporalmente
`iceTransportPolicy: 'relay'` en un entorno de pruebas. Debe abrirse el DataChannel
y transportar mensajes en ambos sentidos. Inspeccionar el par ICE seleccionado:
debe tener candidato `relay`; recoger solo un candidato no demuestra conectividad.

Probar UDP y TCP por separado, TLS si se habilita, reconexión, dos jugadores ambos
tras NAT restrictivo, expiración/renovación, límite de cuota y credenciales inválidas.
Después restaurar `iceTransportPolicy: 'all'`: la conexión directa sigue preferida.
Registrar los resultados con la lista de aceptación de la guía de Oracle.

## TLS para TURN, opcional

El HTTPS de Caddy protege la API; **no convierte el TURN UDP/TCP en TURN TLS**.
El DataChannel WebRTC sigue usando su cifrado DTLS de extremo a extremo, pero para
redes que exijan TURN sobre TLS hay que completar estos pasos:

1. Obtener mediante un cliente ACME un certificado para **`turnHost`**, preferiblemente
   con validación DNS automatizada. No usar un certificado autofirmado en producción.
2. Instalar los archivos reales `certs/fullchain.pem` y `certs/privkey.pem`, legibles
   por el usuario de despliegue; clave en 0600. No montar enlaces simbólicos que
   apunten fuera de la carpeta montada.
3. Configurar `tls: true`, regenerar y recrear coturn y la API. Abrir TCP 5349.
4. Automatizar la renovación ACME con un hook que copie ambos PEM y reinicie coturn
   en una ventana acordada. Caddy NO renueva estos dos archivos externos.

El paquete no ofrece TURN/TLS por 443: ese puerto pertenece al HTTPS de la API.
Si las redes objetivo bloquean también 5349, habrá que usar otra IP o rediseñar la
terminación TLS antes de asegurar cobertura para esas redes.

## Integración posterior en el juego (no activada aquí)

Solicitar las credenciales con `G.DB.fb.auth.currentUser.getIdToken()` y el endpoint
aprobado antes de crear cada RTCPeerConnection (oferta y respuesta). Añadir sus
`iceServers` a los STUN actuales. Cachear por usuario hasta unos minutos antes de
`expiresAt`, limpiar al cerrar sesión, y si la API falla seguir con STUN directo.
El secreto HMAC jamás va en JavaScript público, Firebase cliente ni variables de build.

Las credenciales duran entre 55 y 60 minutos por defecto (se agrupan en intervalos
de cinco minutos). Una conexión puede sobrevivir más que el token del broker, pero
no asumir que las renovaciones de TURN funcionarán indefinidamente: probar partidas
largas y preparar renovación con `setConfiguration` y reinicio ICE coordinado antes
de la caducidad. Si el juego necesita más margen, ajustar `credentialTtl` hasta 7200
segundos, entendiendo la mayor vida útil de las credenciales robadas.

Los timeouts actuales del juego son cortos para algunas redes: comprobarlos en el
piloto. No activar el relé de Realtime Database ni forzar relay en producción.
Esta integración requiere una revisión aparte y la aprobación del autor.

## Operación, límites y apagado

Valores iniciales: 200 asignaciones globales, 12 por usuario TURN, 1 MiB/s por
asignación y 20 MiB/s de capacidad global configurada. Coturn trata entrada/salida
por separado. Una asignación no equivale necesariamente a un jugador; puede haber
varias por conexión. Los nombres de usuario temporales cambian por intervalo:
no interpretar su cuota como un límite permanente por cuenta Firebase.

La API limita a 6 solicitudes/UID/minuto, 30/IP/minuto, 300 globales/minuto y
32 verificaciones simultáneas; contadores locales reiniciados al reiniciar el proceso.
Es una instancia piloto, no un mecanismo distribuido contra abuso. Límites muy bajos
pueden afectar a redes compartidas o a reintentos: ajustar con datos reales.

Vigilar con métricas del proveedor la transferencia de salida acumulada y diaria,
errores de cuota, CPU, memoria, logs y expiración de certificados. Las cuotas de
velocidad no impiden consumir muchos TB/mes. Definir alertas y un procedimiento de
apagado con el autor antes del despliegue general.

```sh
# Detiene nuevas credenciales; las existentes siguen siendo válidas temporalmente.
docker compose stop credentials
# Parada total: corta las partidas que usan este relé.
docker compose stop
```

Cambios en `settings.json`: ejecutar `python3 prepare.py` y
`docker compose up -d --force-recreate` en una ventana acordada; reiniciar coturn
interrumpe asignaciones. Las modificaciones del código de la API requieren además
`docker compose build credentials`. La rotación del secreto debe coordinarse entre
coturn y API: hacer copia privada, sustituir `runtime/auth-secret` por 32 bytes
aleatorios en hexadecimal, regenerar y recrear ambos servicios; las credenciales
anteriores dejan de funcionar. No cambiar el secreto automáticamente en cada arranque.

Para actualizar versiones, revisar las notas de seguridad, fijar la nueva imagen y
probar el piloto. La imagen Node usa la línea mantenida `24-alpine`; al desplegar,
registrar los digests reales de todas las imágenes para poder reproducir/volver atrás.
Un rollback nunca debe restaurar una versión con una vulnerabilidad conocida.

## Validación realizada en este equipo

```sh
node --test infra/coturn/tests/broker.test.mjs
python -m unittest discover -s infra/coturn/tests -p 'test_*.py'
```

8 pruebas del servicio y 5 del generador pasan. Cubren HMAC, expiración, CORS,
autenticación simulada, lista piloto, rate limits, mapeo NAT, rechazo de configuración,
bloqueo de destinos privados y conservación del secreto. SDK oficial cargado y
rechazo de token inválido comprobado sin cuenta de servicio. Lockfile instalado;
`npm audit` reportó cero vulnerabilidades durante la preparación.

**Sin Docker instalado aquí:** no se han ejecutado `docker compose config`, imágenes,
coturn real, ACME, verificación de un ID token real ni pruebas WebRTC/NAT. No se ha
controlado el escritorio. La revisión operativa anterior es obligatoria antes de
considerarlo validado para producción. No cambia ningún archivo del juego, por lo
que no corresponde regenerar el bundle ni añadir novedades de jugadores.

## Referencias oficiales consultadas

- [Coturn: imagen oficial y red host](https://github.com/coturn/coturn/blob/master/docker/coturn/README.md)
- [Release Docker 4.18.0-r0](https://github.com/coturn/coturn/releases/tag/docker/4.18.0-r0)
- [Opciones de la configuración fijada](https://github.com/coturn/coturn/blob/docker/4.18.0-r0/docker/coturn/turnserver.conf)
- [Firebase: verificar ID tokens](https://firebase.google.com/docs/auth/admin/verify-id-tokens)
- [Caddy: HTTPS automático](https://caddyserver.com/docs/automatic-https)
- [Docker: red host](https://docs.docker.com/engine/network/drivers/host/)
