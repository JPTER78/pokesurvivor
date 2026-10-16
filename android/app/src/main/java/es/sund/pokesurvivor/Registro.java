package es.sund.pokesurvivor;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.os.HandlerThread;
import android.provider.MediaStore;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

/**
 * Registro de diagnóstico en Descargas/PokeSurvivor/registro-<fecha>.txt:
 * errores y avisos del juego, cambios de estado, cortes de red, caídas del
 * motor web... Sirve para saber qué pasó cuando algo falla en la consola (no
 * se manda a ningún sitio). Se guardan los últimos MAX_FICHEROS; se escribe
 * en segundo plano y en tandas, nunca en el hilo de la interfaz.
 */
final class Registro {

    private static final int MAX_FICHEROS = 5;
    private static final String CARPETA = Environment.DIRECTORY_DOWNLOADS + "/PokeSurvivor";
    private static final SimpleDateFormat HORA = new SimpleDateFormat("HH:mm:ss.SSS", Locale.ROOT);

    private static ContentResolver resolver;
    private static Uri fichero;
    private static Handler hilo;
    private static final StringBuilder pendiente = new StringBuilder();

    private Registro() {
    }

    static synchronized void iniciar(Context ctx) {
        if (hilo != null || Build.VERSION.SDK_INT < 29) {
            return; // en Android 9 o anterior no hay MediaStore de Descargas: sin registro
        }
        resolver = ctx.getApplicationContext().getContentResolver();
        HandlerThread t = new HandlerThread("registro");
        t.start();
        hilo = new Handler(t.getLooper());
        hilo.post(() -> {
            try {
                limpiarViejos();
                ContentValues v = new ContentValues();
                v.put(MediaStore.Downloads.DISPLAY_NAME,
                        "registro-" + new SimpleDateFormat("yyyy-MM-dd_HH-mm-ss", Locale.ROOT).format(new Date()) + ".txt");
                v.put(MediaStore.Downloads.MIME_TYPE, "text/plain");
                v.put(MediaStore.Downloads.RELATIVE_PATH, CARPETA);
                fichero = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
            } catch (RuntimeException ignored) {
                fichero = null;
            }
        });
        hilo.postDelayed(new Runnable() {
            @Override
            public void run() {
                volcar();
                hilo.postDelayed(this, 3000);
            }
        }, 3000);
        anotar("app", "inicio · PokéSurvivor " + BuildConfig.VERSION_NAME + " · Android " + Build.VERSION.RELEASE
                + " · " + Build.MANUFACTURER + " " + Build.MODEL);
    }

    static void anotar(String origen, String texto) {
        synchronized (pendiente) {
            pendiente.append(HORA.format(new Date())).append(" [").append(origen).append("] ")
                    .append(texto.replace('\n', ' ')).append('\n');
            if (pendiente.length() > 256 * 1024) {
                pendiente.setLength(0); // sin fichero donde escribir: no crece sin límite
            }
        }
    }

    /** Vuelca lo pendiente ya (al salir de la app o ante una caída). */
    static void ahora() {
        if (hilo != null) {
            hilo.post(Registro::volcar);
        }
    }

    private static void volcar() {
        String texto;
        synchronized (pendiente) {
            if (pendiente.length() == 0 || fichero == null) {
                return;
            }
            texto = pendiente.toString();
            pendiente.setLength(0);
        }
        try (OutputStream out = resolver.openOutputStream(fichero, "wa")) {
            if (out != null) {
                out.write(texto.getBytes(StandardCharsets.UTF_8));
            }
        } catch (Exception ignored) {
            // sin espacio o fichero borrado a mano: se pierde esta tanda
        }
    }

    /** Solo ve (y borra) los ficheros que creó esta app. */
    private static void limpiarViejos() {
        List<Uri> lista = new ArrayList<>();
        String[] col = {MediaStore.Downloads._ID};
        try (Cursor c = resolver.query(MediaStore.Downloads.EXTERNAL_CONTENT_URI, col,
                MediaStore.Downloads.RELATIVE_PATH + " LIKE ? AND " + MediaStore.Downloads.DISPLAY_NAME + " LIKE ?",
                new String[]{CARPETA + "%", "registro-%"}, MediaStore.Downloads.DATE_ADDED + " DESC")) {
            while (c != null && c.moveToNext()) {
                lista.add(Uri.withAppendedPath(MediaStore.Downloads.EXTERNAL_CONTENT_URI, String.valueOf(c.getLong(0))));
            }
        }
        for (int i = MAX_FICHEROS - 1; i < lista.size(); i++) {
            try {
                resolver.delete(lista.get(i), null, null);
            } catch (RuntimeException ignored) {
                // nada
            }
        }
    }
}
