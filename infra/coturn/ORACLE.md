# Despliegue, validación y recuperación en Oracle Cloud

Este documento acompaña al [README](README.md), que contiene los comandos de
configuración, puertos y límites. El servidor no está integrado en el juego:
desplegar esta carpeta no cambia las conexiones de los jugadores.

## 1. Máquina y red

Perfil inicial de laboratorio: Ubuntu ARM64 en Ampere A1 Flex, 2 OCPU, 6 GB de
RAM y disco de arranque de 50 GB. Verificar la elegibilidad Always Free y las
cuotas restantes de la cuenta antes de crear recursos. No confundir créditos
temporales de prueba con recursos gratuitos permanentes. No usar imágenes con
licencias adicionales. Este perfil no constituye una prueba de capacidad.

Usar la región principal de la cuenta. Ninguna región garantiza que una instancia
gratuita permanezca disponible: Oracle puede recuperar instancias inactivas y
puede no haber capacidad para volver a arrancarlas o crearlas. Consultar las
[condiciones vigentes](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm).

- Crear una VCN con subred pública y ruta `0.0.0.0/0` hacia un Internet Gateway.
- Asociar una IPv4 pública, preferiblemente reservada para poder reasignarla dentro
  de la misma región. No se necesita un balanceador ni NAT Gateway para este diseño.
- Aplicar los puertos del README tanto en las Security Lists/NSG de OCI como en el
  firewall de Ubuntu. Conservar las reglas necesarias para administración y retorno.
- `publicIp` es la IP pública de OCI; `localIp` es la IPv4 privada de la VNIC que
  aparece en `ip -4 address`. No intentar enlazar coturn a la IP pública NAT.
- Crear los dos registros DNS A y comprobarlos antes de arrancar Caddy.
- Instalar Python 3, Git y [Docker Engine con Compose v2](https://docs.docker.com/engine/install/ubuntu/).
  Comprobar `docker version` y `docker compose version` como usuario de despliegue.

La imagen coturn, Node y Caddy deben poder descargarse para la arquitectura elegida.
La validación real de las imágenes ARM64 queda pendiente del despliegue en OCI.
Si falla una descarga, detener el despliegue y revisar la versión; no sustituirla
automáticamente por `latest` ni forzar emulación x86.

## 2. Desplegar una revisión concreta

Obtener el repositorio oficial y registrar el SHA que se va a probar:

```sh
git clone --depth 1 https://github.com/JPTER78/pokesurvivor.git
cd pokesurvivor
git rev-parse HEAD
cd infra/coturn
```

No actualizar
automáticamente una rama en producción. Seguir «Preparar los archivos en Linux»
y «Arranque del piloto» del README. Mantener `allowAllAuthenticated: false`, añadir
UID de cuentas piloto y el origen HTTPS exacto del entorno de pruebas.

El juego público no solicita estas credenciales todavía. Para la prueba WebRTC,
el cliente de ensayo debe obtener un ID token del proyecto existente, llamar a
`POST /v1/ice` y usar los `iceServers` devueltos al crear ambos peers. No introducir
el secreto HMAC en el cliente ni copiar tokens a herramientas públicas.

## 3. Registro de aceptación antes de producción

Completar esta tabla en la revisión de despliegue. Publicar solo resultados
resumidos; guardar tokens, IP de jugadores y logs detallados en privado.

| Comprobación | Resultado / fecha / revisión |
| --- | --- |
| SHA, arquitectura, versiones Docker/Compose y digests de imágenes registrados | Pendiente |
| `docker compose config --quiet`, descarga, build y arranque correctos | Pendiente |
| API saludable, HTTPS válido y 8088 accesible solo desde loopback | Pendiente |
| Token Firebase real de piloto aceptado; inválido, anónimo y UID excluido rechazados | Pendiente |
| Dos redes distintas, incluida móvil: candidato seleccionado relay y datos bidireccionales | Pendiente |
| TURN UDP y TURN TCP probados por separado; TLS si se habilita | Pendiente |
| Partida larga supera el TTL inicial con renovación/reconexión comprobada | Pendiente |
| Reinicio del servicio, pérdida de red, cuotas y API inaccesible probados | Pendiente |
| Tráfico, latencia, CPU y memoria medidos con concurrencia objetivo | Pendiente |
| Alertas de transferencia y certificados configuradas; responsable asignado | Pendiente |
| Copia privada y recuperación en una máquina limpia ensayadas | Pendiente |
| Integración del juego revisada: directa preferida, renovación ICE y comportamiento ante fallos | Pendiente |

Una respuesta HTTP correcta o un candidato relay aislado no validan el transporte.
Si el acceso directo falla, volver a STUN cuando la API falle no garantiza conexión:
la integración debe comunicar el fallo y permitir reintentar. Las redes que solo
permiten TLS por 443 necesitan otro diseño; esta versión usa 443 para la API.

No ampliar la lista piloto hasta completar las pruebas relevantes y aprobar la
integración del cliente. La capacidad y continuidad de Always Free no están
garantizadas. Las alertas de presupuesto no son un corte automático del gasto.

## 4. Copia y recuperación

Mantener fuera del VPS una copia privada cifrada de `settings.json`,
`runtime/auth-secret`, certificados TURN si se usan y sus instrucciones de renovación.
Guardar también SHA, digests, DNS, reglas de red y el inventario de recursos OCI.
Para evitar reemitir certificados repetidamente, respaldar de forma segura los
volúmenes `caddy_data` y `caddy_config` con Caddy detenido y restaurarlos conservando
permisos. Contienen claves privadas. No subir ninguna de estas copias al repositorio.

Ante una caída:

1. Distinguir fallo de API, de coturn, de red o de instancia con una comprobación
   externa de HTTPS y una prueba TURN autenticada. No generar carga artificial.
2. Si OCI solo detuvo la máquina, intentar arrancarla; conservar disco y configuración.
3. Si hace falta reemplazarla, crear otra máquina compatible y repetir los pasos 1 y 2.
   No borrar el disco anterior hasta comprobar las copias. Revisar las cuotas porque
   los discos retenidos y máquinas coexistentes también consumen recursos.
4. Reasignar la IP reservada si sigue disponible en esa región, siguiendo la
   [documentación de OCI](https://docs.oracle.com/en-us/iaas/Content/Network/Tasks/managingpublicIPs.htm).
   Si cambia la IP, actualizar ambos registros DNS y `publicIp`. Actualizar siempre
   `localIp` con la nueva VNIC. Un TTL DNS de 300 s ayuda, pero no garantiza que todos
   los clientes abandonen inmediatamente su caché.
5. Restaurar configuración y secreto antes de generar archivos. Crear `runtime/`
   con modo 0700 y `runtime/auth-secret` con 0600, propiedad del usuario de despliegue.
   Restaurar certificados si `tls` está activo. Ejecutar `prepare.py --check`,
   `prepare.py`, validar Compose y arrancar según README. Regenerar `.env` en Linux.
6. Repetir la prueba de relé entre dos redes y restablecer el acceso piloto/general
   solo cuando funcione. Conservar el registro del incidente y tiempo de recuperación.

Coturn no guarda partidas, pero sus asignaciones activas viven en memoria: ninguna
copia ni reasignación de IP recupera las conexiones anteriores. El cliente necesita
reconectar. Conservar el secreto permite utilizar credenciales todavía vigentes;
ante sospecha de filtración, rotarlo y obtener credenciales nuevas.

Este es un procedimiento manual reproducible, no un failover automático ni una
plantilla Terraform. Si no hay capacidad gratuita, esperar o usar un VPS alternativo
aprobado por el operador. No se garantiza un tiempo de recuperación mientras falte
capacidad; un despliegue de pago requiere una decisión explícita del responsable.
