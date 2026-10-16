package es.sund.pokesurvivor;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * Autoactualización de la APK instalada a mano (sin tienda). Al abrir la app
 * consulta BuildConfig.URL_ACTUALIZACIONES, un version.json:
 *
 *     {"versionCode": 3, "versionName": "1.0.2", "apkUrl": "https://...", "apkSha1": "..."}
 *
 * Si hay una versión más nueva la descarga en segundo plano, comprueba su
 * SHA-1 (nunca se instala nada sin verificarlo) y abre el instalador del
 * sistema. Sin URL configurada (compilación por defecto) no hace nada.
 * Cualquier fallo es silencioso: se sigue jugando con la versión actual.
 */
final class Actualizador {

    private Actualizador() {
    }

    static void comprobar(Activity activity) {
        String url = BuildConfig.URL_ACTUALIZACIONES;
        if (url == null || url.isEmpty()) {
            return;
        }
        new Thread(() -> {
            try {
                JSONObject info = new JSONObject(leerTexto(url));
                if (info.getLong("versionCode") <= versionInstalada(activity)) {
                    return;
                }
                URL base = new URL(url), apk = new URL(base, info.getString("apkUrl"));
                // La APK solo se baja del mismo sitio (https) que publica version.json.
                if (!"https".equals(apk.getProtocol()) || !apk.getHost().equals(base.getHost())) {
                    return;
                }
                String apkUrl = apk.toString();
                String sha1 = info.getString("apkSha1");
                aviso(activity, "Descargando PokéSurvivor " + info.optString("versionName") + "…");

                File destino = new File(activity.getCacheDir(), "actualizacion.apk");
                descargar(apkUrl, destino);
                if (!sha1De(destino).equalsIgnoreCase(sha1)) {
                    destino.delete();
                    aviso(activity, "Actualización descartada: la descarga no coincide con la publicada.");
                    return;
                }
                activity.runOnUiThread(() -> instalar(activity, destino));
            } catch (Exception ignored) {
                // sin conexión o servidor caído: se sigue con la versión actual
            }
        }, "actualizador").start();
    }

    private static long versionInstalada(Activity activity) throws Exception {
        PackageInfo info = activity.getPackageManager().getPackageInfo(activity.getPackageName(), 0);
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? info.getLongVersionCode() : info.versionCode;
    }

    private static HttpURLConnection abrir(String url) throws IOException {
        HttpURLConnection con = (HttpURLConnection) new URL(url).openConnection();
        con.setConnectTimeout(15_000);
        con.setReadTimeout(30_000);
        con.setUseCaches(false);
        if (con.getResponseCode() != 200) {
            con.disconnect();
            throw new IOException("HTTP " + con.getResponseCode());
        }
        return con;
    }

    private static String leerTexto(String url) throws IOException {
        HttpURLConnection con = abrir(url);
        try (InputStream in = con.getInputStream()) {
            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            byte[] trozo = new byte[8192];
            int n;
            while ((n = in.read(trozo)) != -1) {
                buffer.write(trozo, 0, n);
            }
            return buffer.toString(StandardCharsets.UTF_8.name());
        } finally {
            con.disconnect();
        }
    }

    private static void descargar(String url, File destino) throws IOException {
        HttpURLConnection con = abrir(url);
        try (InputStream in = con.getInputStream(); FileOutputStream out = new FileOutputStream(destino)) {
            byte[] trozo = new byte[64 * 1024];
            int n;
            long total = 0;
            while ((n = in.read(trozo)) != -1) {
                total += n;
                if (total > MAX_APK) {
                    throw new IOException("APK demasiado grande");
                }
                out.write(trozo, 0, n);
            }
        } finally {
            con.disconnect();
        }
    }

    /** Tope de la descarga (la APK pesa ~80 MB con todos los sprites): un servidor roto no llena la caché. */
    private static final long MAX_APK = 300L * 1024 * 1024;

    private static String sha1De(File fichero) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-1");
        try (InputStream in = new FileInputStream(fichero)) {
            byte[] trozo = new byte[64 * 1024];
            int n;
            while ((n = in.read(trozo)) != -1) {
                digest.update(trozo, 0, n);
            }
        }
        StringBuilder hex = new StringBuilder();
        for (byte b : digest.digest()) {
            hex.append(String.format("%02x", b));
        }
        return hex.toString();
    }

    private static void instalar(Activity activity, File apk) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !activity.getPackageManager().canRequestPackageInstalls()) {
            Toast.makeText(activity, "Para actualizar, activa «Instalar apps desconocidas» para PokéSurvivor y vuelve a abrirla.",
                    Toast.LENGTH_LONG).show();
            try {
                activity.startActivity(new Intent(android.provider.Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:" + activity.getPackageName())));
            } catch (Exception ignored) {
                // sin pantalla de ajustes: se reintenta al abrir la app
            }
            return;
        }
        try {
            Uri uri = FileProvider.getUriForFile(activity, activity.getPackageName() + ".fileprovider", apk);
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            activity.startActivity(intent);
        } catch (Exception ignored) {
            // sin instalador: se reintenta al abrir la app
        }
    }

    private static void aviso(Activity activity, String texto) {
        activity.runOnUiThread(() -> Toast.makeText(activity, texto, Toast.LENGTH_SHORT).show());
    }
}
