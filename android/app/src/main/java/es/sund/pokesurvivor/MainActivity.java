package es.sund.pokesurvivor;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Context;
import android.hardware.display.DeviceProductInfo;
import android.hardware.display.DisplayManager;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.Bundle;
import android.view.Choreographer;
import android.view.Display;
import android.view.InputDevice;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.webkit.WebViewAssetLoader;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * PokéSurvivor como app: el juego web va dentro de la APK (assets/juego) y se
 * sirve desde https://appassets.androidplatform.net (origen https normal, así
 * localStorage y Firebase funcionan igual que en el navegador).
 *
 * Los botones y sticks del mando de la consola no llegan al WebView: se
 * leen aquí y se mandan al juego como estado completo (G.Pad.nativo, ver
 * js/core/gamepad.js), una vez por fotograma como mucho.
 *
 * En consolas de dos pantallas (AYN Thor...) la de abajo enseña un panel
 * aparte: ver SegundaPantalla y js/core/second.js.
 */
public class MainActivity extends Activity {

    private static final String INICIO = "https://appassets.androidplatform.net/juego/dev.html";

    private WebView web;
    private final Map<String, Boolean> botones = new LinkedHashMap<>();
    private float lx, ly, rx, ry, hatX, hatY;
    private boolean pendiente = false;

    // Segunda pantalla (si la consola tiene): ver SegundaPantalla.
    private DisplayManager pantallas;
    private SegundaPantalla segunda;
    // Hasta que el juego diga qué quiere el jugador (Ajustes), no se toca la otra pantalla.
    private boolean segundaQuerida = false;
    private boolean aLaVista = false;
    private boolean hayOtra = false; // lo último que se le dijo al juego
    private final DisplayManager.DisplayListener alCambiarPantallas = new DisplayManager.DisplayListener() {
        @Override
        public void onDisplayAdded(int id) {
            revisarSegunda();
        }

        @Override
        public void onDisplayRemoved(int id) {
            revisarSegunda();
        }

        @Override
        public void onDisplayChanged(int id) {
            // Encendida/apagada, o cambio de tamaño (el sistema cierra entonces el panel).
            revisarSegunda();
        }
    };

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        Registro.iniciar(this);
        Thread.UncaughtExceptionHandler previo = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((hilo, e) -> {
            Registro.anotar("app", "CIERRE por excepción: " + android.util.Log.getStackTraceString(e));
            Registro.ahora();
            try { Thread.sleep(300); } catch (InterruptedException ignored) { /* nada */ }
            if (previo != null) previo.uncaughtException(hilo, e);
        });
        vigilarRed();

        // /juego/<ruta> -> assets/juego/<ruta>
        WebViewAssetLoader.AssetsPathHandler assets = new WebViewAssetLoader.AssetsPathHandler(this);
        cargador = new WebViewAssetLoader.Builder()
                .addPathHandler("/juego/", ruta -> assets.handle("juego/" + ruta))
                .build();

        web = crearWeb();
        setContentView(web);
        pantallaCompleta();
        pantallas = (DisplayManager) getSystemService(DISPLAY_SERVICE);
        pantallas.registerDisplayListener(alCambiarPantallas, null);
        if (savedInstanceState != null) {
            web.restoreState(savedInstanceState);
        } else {
            web.loadUrl(INICIO);
            Actualizador.comprobar(this);
        }
    }

    private WebViewAssetLoader cargador;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    private WebView crearWeb() {
        WebView web = new WebView(this);
        WebSettings ajustes = web.getSettings();
        ajustes.setJavaScriptEnabled(true);
        ajustes.setDomStorageEnabled(true);
        ajustes.setDatabaseEnabled(true);
        ajustes.setMediaPlaybackRequiresUserGesture(false);
        ajustes.setAllowFileAccess(false);
        ajustes.setAllowContentAccess(false);
        web.setBackgroundColor(0xFF0A1430);
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(android.webkit.ConsoleMessage m) {
                // Errores y avisos, y los mensajes propios del juego ("[Social] ...").
                String t = m.message();
                if (m.messageLevel() == android.webkit.ConsoleMessage.MessageLevel.ERROR
                        || m.messageLevel() == android.webkit.ConsoleMessage.MessageLevel.WARNING
                        || (t != null && t.startsWith("["))) {
                    Registro.anotar("juego", m.messageLevel() + " " + t
                            + (m.messageLevel() == android.webkit.ConsoleMessage.MessageLevel.ERROR ? " (" + m.sourceId() + ":" + m.lineNumber() + ")" : ""));
                }
                return false;
            }
        });
        web.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                // Solo en el propio juego (nunca en otra página).
                if (url != null && url.startsWith("https://appassets.androidplatform.net/juego/")) {
                    view.evaluateJavascript(DIAGNOSTICO, null);
                }
            }

            @Override
            public boolean onRenderProcessGone(WebView view, android.webkit.RenderProcessGoneDetail detalle) {
                // El motor web se ha caído (memoria...): sin esto, Android cierra la app entera.
                boolean muerte = Build.VERSION.SDK_INT >= 26 && detalle.didCrash();
                Registro.anotar("app", "CAÍDA del motor web (" + (muerte ? "fallo" : "falta de memoria") + "): se recarga el juego");
                Registro.ahora();
                if (view == MainActivity.this.web) {
                    view.destroy();
                    MainActivity.this.web = crearWeb();
                    setContentView(MainActivity.this.web);
                    MainActivity.this.web.loadUrl(INICIO);
                }
                return true;
            }

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return cargador.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                // Enlaces externos (créditos, apoyar...): fuera de la app, al navegador.
                // Solo webs (http/https): nunca intent:, market:, tel:... aunque el juego los enlazara.
                if (!"appassets.androidplatform.net".equals(request.getUrl().getHost())) {
                    String esquema = request.getUrl().getScheme();
                    if (!"https".equals(esquema) && !"http".equals(esquema)) {
                        return true;
                    }
                    try {
                        startActivity(new android.content.Intent(android.content.Intent.ACTION_VIEW, request.getUrl()));
                    } catch (Exception ignored) {
                        // sin navegador: se ignora
                    }
                    return true;
                }
                return false;
            }
        });
        // Su mera existencia le dice al juego que va dentro de la app (sin service worker).
        web.addJavascriptInterface(new Puente(), "PSNativo");
        return web;
    }

    /**
     * Diagnóstico dentro del juego (va al registro por la consola): cambios
     * de estado de la partida, avisos en pantalla, la sala y la conexión con
     * los demás. Solo lee; no cambia nada del juego. Sin identificadores (ni
     * de la sala ni de los jugadores): el registro está en Descargas.
     */
    private static final String DIAGNOSTICO = "(function(){if(window.__diag)return;window.__diag=1;"
            + "var log=function(t){console.log('[Diag] '+t)};"
            + "var esperar=setInterval(function(){if(!window.G||!G.UI||!G.Game||!G.Social||!G.Net)return;clearInterval(esperar);"
            + "var t0=G.UI.toast;G.UI.toast=function(x){if(x)log('aviso: '+x);return t0.apply(this,arguments)};"
            + "var est='';setInterval(function(){var e=G.Game.state+(G.Coop&&G.Coop.active?' coop('+G.Coop.players().length+')':'');"
            + "if(e!==est){est=e;log('estado: '+e)}},500);"
            + "G.Social.on(function(w){var r=G.Social.room;if(w!=='room'||!r)log('sala: '+w+(r?' miembros '+r.members.length+(r.isHost?' (anfitrión)':''):' (sin sala)'))});"
            + "G.Net.onPeer(function(u,m){log('red: jugador '+m)});"
            + "addEventListener('offline',function(){log('navegador SIN conexión')});addEventListener('online',function(){log('navegador con conexión')});"
            + "log('diagnóstico activo')},500)})()";

    /** Cortes de red del sistema, para cuadrarlos con lo que pasa en el juego. */
    private void vigilarRed() {
        try {
            android.net.ConnectivityManager cm = (android.net.ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm == null || Build.VERSION.SDK_INT < 24) {
                return;
            }
            cm.registerDefaultNetworkCallback(new android.net.ConnectivityManager.NetworkCallback() {
                @Override
                public void onAvailable(android.net.Network n) {
                    Registro.anotar("red", "red disponible");
                }

                @Override
                public void onLost(android.net.Network n) {
                    Registro.anotar("red", "RED PERDIDA");
                }
            });
        } catch (RuntimeException e) {
            Registro.anotar("red", "sin vigilancia de red: " + e);
        }
    }

    /** Lo que el juego puede preguntar o pedir a la app (llega en un hilo del WebView). */
    final class Puente {
        @JavascriptInterface
        public String plataforma() {
            return "android";
        }

        /** ¿Hay una segunda pantalla donde poner el panel? */
        @JavascriptInterface
        public boolean segundaDisponible() {
            return otraPantalla() != null;
        }

        /** Resumen de la partida (JSON) para el panel de la segunda pantalla. */
        @JavascriptInterface
        public void segunda(String json) {
            runOnUiThread(() -> {
                if (segunda != null) {
                    segunda.enviar(json);
                }
            });
        }

        /** Ajustes > Segunda pantalla > Apagada: se suelta la pantalla de abajo. */
        @JavascriptInterface
        public void segundaVisible(boolean si) {
            runOnUiThread(() -> {
                segundaQuerida = si;
                revisarSegunda();
            });
        }
    }

    // ---------------- segunda pantalla ----------------

    /**
     * La otra pantalla de la consola (la de abajo en una de dos), o null. Sólo
     * pantallas integradas: una tele por HDMI o un envío inalámbrico se quedan
     * como estén (duplicando el juego), no se les pone el panel.
     */
    private Display otraPantalla() {
        int mia = Build.VERSION.SDK_INT >= 30 && getDisplay() != null
                ? getDisplay().getDisplayId()
                : getWindowManager().getDefaultDisplay().getDisplayId();
        for (Display d : pantallas.getDisplays()) {
            boolean privada = (d.getFlags() & Display.FLAG_PRIVATE) != 0;
            if (d.getDisplayId() != mia && !privada && d.getState() != Display.STATE_OFF && integrada(d)) {
                return d;
            }
        }
        return null;
    }

    /** ¿Es una pantalla de la propia consola (no HDMI, ni inalámbrica, ni virtual)? */
    private static boolean integrada(Display d) {
        // Display.getType() dice justo esto, pero no es API pública: se intenta y,
        // si el sistema no deja, se deduce de lo que sí lo es.
        try {
            Object tipo = Display.class.getMethod("getType").invoke(d);
            if (tipo instanceof Integer) {
                return (Integer) tipo == 1; // Display.TYPE_INTERNAL
            }
        } catch (ReflectiveOperationException | RuntimeException ignored) {
            // API oculta bloqueada en este sistema
        }
        if (Build.VERSION.SDK_INT >= 31) {
            // Las inalámbricas y virtuales no tienen datos del panel; un monitor por cable dice que lo es.
            DeviceProductInfo info = d.getDeviceProductInfo();
            if (info == null) {
                return false;
            }
            int c = info.getConnectionToSinkType();
            return c != DeviceProductInfo.CONNECTION_TO_SINK_DIRECT && c != DeviceProductInfo.CONNECTION_TO_SINK_TRANSITIVE;
        }
        return !d.getName().toUpperCase(java.util.Locale.ROOT).contains("HDMI");
    }

    /** Pone, cambia o quita el panel según las pantallas que haya y lo que quiera el jugador. */
    private void revisarSegunda() {
        Display d = aLaVista && segundaQuerida ? otraPantalla() : null;
        // !isShowing(): el sistema lo ha cerrado por su cuenta (la pantalla cambió de tamaño).
        if (segunda != null && (d == null || !segunda.isShowing()
                || segunda.getDisplay().getDisplayId() != d.getDisplayId())) {
            segunda.cerrar();
            segunda = null;
        }
        if (d != null && segunda == null) {
            SegundaPantalla nueva = new SegundaPantalla(this, d, cargador, this::accionSegunda);
            try {
                nueva.show();
                segunda = nueva;
            } catch (WindowManager.BadTokenException e) {
                nueva.cerrar(); // la pantalla ha desaparecido entre medias, o no admite ventanas nuestras
            }
        }
        boolean hay = otraPantalla() != null;
        if (hay != hayOtra) {
            hayOtra = hay;
            web.evaluateJavascript("window.G&&G.Second&&G.Second.pantalla(" + hay + ")", null);
        }
    }

    /** Lo que se toca en el panel (cambiar de ataque, pausa, cartas...) va al juego. */
    private void accionSegunda(String json) {
        web.evaluateJavascript("window.G&&G.Second&&G.Second.accion(" + JSONObject.quote(json) + ")", null);
    }

    private void pantallaCompleta() {
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) {
                c.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            pantallaCompleta();
        }
    }

    // ---------------- mando ----------------

    /** Nombre lógico del botón (el que entiende gamepad.js), o null si no es de mando. */
    private static String boton(int codigo) {
        switch (codigo) {
            case KeyEvent.KEYCODE_BUTTON_A:
            case KeyEvent.KEYCODE_DPAD_CENTER:
                return "a";
            case KeyEvent.KEYCODE_BUTTON_B:
            case KeyEvent.KEYCODE_BACK:
                return "b";
            case KeyEvent.KEYCODE_BUTTON_X: return "x";
            case KeyEvent.KEYCODE_BUTTON_Y: return "y";
            case KeyEvent.KEYCODE_BUTTON_L1: return "l1";
            case KeyEvent.KEYCODE_BUTTON_R1: return "r1";
            case KeyEvent.KEYCODE_BUTTON_L2: return "l2";
            case KeyEvent.KEYCODE_BUTTON_R2: return "r2";
            case KeyEvent.KEYCODE_BUTTON_START: return "start";
            case KeyEvent.KEYCODE_BUTTON_SELECT: return "select";
            case KeyEvent.KEYCODE_BUTTON_THUMBL: return "l3";
            case KeyEvent.KEYCODE_BUTTON_THUMBR: return "r3";
            case KeyEvent.KEYCODE_DPAD_UP: return "up";
            case KeyEvent.KEYCODE_DPAD_DOWN: return "down";
            case KeyEvent.KEYCODE_DPAD_LEFT: return "left";
            case KeyEvent.KEYCODE_DPAD_RIGHT: return "right";
            default: return null;
        }
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent e) {
        String b = boton(e.getKeyCode());
        if (b == null) {
            return super.dispatchKeyEvent(e); // teclado físico, volumen...: lo normal
        }
        if (e.getAction() == KeyEvent.ACTION_DOWN) {
            if (e.getRepeatCount() == 0) {
                botones.put(b, true);
                avisar();
            }
        } else if (e.getAction() == KeyEvent.ACTION_UP) {
            botones.remove(b);
            avisar();
        }
        return true; // el WebView no lo ve: nada de scroll ni foco nativo
    }

    @Override
    public boolean dispatchGenericMotionEvent(MotionEvent e) {
        boolean deMando = (e.getSource() & InputDevice.SOURCE_JOYSTICK) == InputDevice.SOURCE_JOYSTICK
                || (e.getSource() & InputDevice.SOURCE_GAMEPAD) == InputDevice.SOURCE_GAMEPAD;
        if (!deMando || e.getAction() != MotionEvent.ACTION_MOVE) {
            return super.dispatchGenericMotionEvent(e);
        }
        lx = e.getAxisValue(MotionEvent.AXIS_X);
        ly = e.getAxisValue(MotionEvent.AXIS_Y);
        boolean enRx = derechoEnRx(e);
        rx = e.getAxisValue(enRx ? MotionEvent.AXIS_RX : MotionEvent.AXIS_Z);
        ry = e.getAxisValue(enRx ? MotionEvent.AXIS_RY : MotionEvent.AXIS_RZ);
        // Cruceta como eje (muchas consolas la mandan así en vez de con teclas).
        hatX = e.getAxisValue(MotionEvent.AXIS_HAT_X);
        hatY = e.getAxisValue(MotionEvent.AXIS_HAT_Y);
        // Gatillos analógicos.
        gatillo("l2", Math.max(e.getAxisValue(MotionEvent.AXIS_LTRIGGER), e.getAxisValue(MotionEvent.AXIS_BRAKE)));
        gatillo("r2", Math.max(e.getAxisValue(MotionEvent.AXIS_RTRIGGER), e.getAxisValue(MotionEvent.AXIS_GAS)));
        avisar();
        return true;
    }

    private int mandoVisto = -1;
    private boolean mandoEnRx;

    /**
     * Stick derecho: casi siempre en Z/RZ. Algunos mandos (los de estilo
     * Nintendo) no tienen esos ejes y lo mandan en RX/RY: sólo entonces se
     * leen esos. Se mira una vez por mando.
     */
    private boolean derechoEnRx(MotionEvent e) {
        InputDevice m = e.getDevice();
        if (m == null) {
            return false;
        }
        if (m.getId() != mandoVisto) {
            mandoVisto = m.getId();
            int s = e.getSource();
            mandoEnRx = m.getMotionRange(MotionEvent.AXIS_Z, s) == null && m.getMotionRange(MotionEvent.AXIS_RZ, s) == null
                    && m.getMotionRange(MotionEvent.AXIS_RX, s) != null && m.getMotionRange(MotionEvent.AXIS_RY, s) != null;
        }
        return mandoEnRx;
    }

    private final Map<String, Boolean> gatillos = new LinkedHashMap<>();

    private void gatillo(String nombre, float valor) {
        if (valor > 0.5f) {
            gatillos.put(nombre, true);
        } else if (valor < 0.3f) {
            gatillos.remove(nombre);
        }
    }

    /** Agrupa los cambios y los manda al juego en el siguiente fotograma. */
    private void avisar() {
        if (pendiente) {
            return;
        }
        pendiente = true;
        Choreographer.getInstance().postFrameCallback(t -> {
            pendiente = false;
            web.evaluateJavascript("window.G&&G.Pad&&G.Pad.nativo(" + estado() + ")", null);
        });
    }

    private String estado() {
        JSONObject o = new JSONObject();
        try {
            JSONObject b = new JSONObject();
            for (String k : botones.keySet()) b.put(k, true);
            for (String k : gatillos.keySet()) b.put(k, true);
            if (hatX < -0.5f) b.put("left", true);
            if (hatX > 0.5f) b.put("right", true);
            if (hatY < -0.5f) b.put("up", true);
            if (hatY > 0.5f) b.put("down", true);
            o.put("btn", b);
            o.put("lx", lx);
            o.put("ly", ly);
            o.put("rx", rx);
            o.put("ry", ry);
        } catch (JSONException ignored) {
            // claves fijas: no pasa
        }
        return o.toString();
    }

    // ---------------- Wi-Fi ----------------

    /**
     * Sin esto, el ahorro de energía del Wi-Fi de las consolas (Retroid...)
     * corta la conexión unos segundos de vez en cuando. En el cooperativo eso
     * basta para que Firebase dé al jugador por desconectado y lo saque de la
     * sala («La sala se ha cerrado»), aunque el juego siga en pantalla. Mientras
     * la app está delante, el Wi-Fi va en modo baja latencia (como los juegos online).
     */
    private WifiManager.WifiLock wifi;

    @SuppressWarnings("deprecation")
    private void wifiSinAhorro(boolean activar) {
        try {
            if (wifi == null) {
                WifiManager wm = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
                if (wm == null) {
                    return;
                }
                int modo = Build.VERSION.SDK_INT >= 29 ? WifiManager.WIFI_MODE_FULL_LOW_LATENCY : WifiManager.WIFI_MODE_FULL_HIGH_PERF;
                wifi = wm.createWifiLock(modo, "PokeSurvivor:juego");
                wifi.setReferenceCounted(false);
            }
            if (activar) {
                wifi.acquire();
            } else if (wifi.isHeld()) {
                wifi.release();
            }
        } catch (RuntimeException ignored) {
            // sin Wi-Fi o sin permiso: se juega igual
        }
    }

    // ---------------- ciclo de vida ----------------

    @Override
    protected void onPause() {
        Registro.anotar("app", "app en segundo plano");
        Registro.ahora();
        wifiSinAhorro(false);
        // Suelta todo: si no, un botón pulsado al salir se queda "pegado".
        botones.clear();
        gatillos.clear();
        lx = ly = rx = ry = hatX = hatY = 0;
        web.evaluateJavascript("window.G&&G.Pad&&G.Pad.nativo(" + estado() + ")", null);
        web.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        wifiSinAhorro(true);
        Registro.anotar("app", "app delante · Wi-Fi " + (wifi != null && wifi.isHeld() ? "sin ahorro" : "normal"));
    }

    @Override
    protected void onStart() {
        super.onStart();
        aLaVista = true;
        revisarSegunda();
    }

    @Override
    protected void onStop() {
        aLaVista = false;
        revisarSegunda();
        super.onStop();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    @Override
    protected void onDestroy() {
        pantallas.unregisterDisplayListener(alCambiarPantallas);
        if (segunda != null) {
            segunda.cerrar();
            segunda = null;
        }
        web.destroy();
        super.onDestroy();
    }
}
