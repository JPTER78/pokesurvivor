package es.sund.pokesurvivor;

import android.annotation.SuppressLint;
import android.app.Presentation;
import android.content.Context;
import android.os.Bundle;
import android.view.Display;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.webkit.WebViewAssetLoader;

import org.json.JSONObject;

/**
 * Segunda pantalla (consolas de dos pantallas como la AYN Thor): un WebView
 * aparte, en la pantalla de abajo, con el panel del juego (second.html).
 *
 * No lleva el juego dentro: el juego le manda un resumen de la partida
 * (js/core/second.js -> PSNativo.segunda -> enviar()) y lo que se toca aquí
 * vuelve al juego como acción (PSNativo.accion -> Acciones.alTocar()).
 *
 * La ventana no coge el foco: así los botones y sticks siguen llegando a
 * MainActivity aunque se toque la pantalla de abajo.
 */
final class SegundaPantalla extends Presentation {

    private static final String PANEL = "https://appassets.androidplatform.net/juego/second.html";

    /** Lo que se toca en el panel (JSON), ya en el hilo principal. */
    interface Acciones {
        void alTocar(String json);
    }

    private final WebViewAssetLoader cargador;
    private final Acciones acciones;
    private WebView web;

    SegundaPantalla(Context contexto, Display pantalla, WebViewAssetLoader cargador, Acciones acciones) {
        super(contexto, pantalla);
        this.cargador = cargador;
        this.acciones = acciones;
    }

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (getWindow() != null) {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                    | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        }
        // Con el contexto de esta pantalla (no el de la actividad): densidad y tamaño de la de abajo.
        web = new WebView(getContext());
        WebSettings ajustes = web.getSettings();
        ajustes.setJavaScriptEnabled(true);
        ajustes.setDomStorageEnabled(true); // el idioma elegido está en localStorage
        ajustes.setAllowFileAccess(false);
        ajustes.setAllowContentAccess(false);
        web.setBackgroundColor(0xFF0A1430);
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return cargador.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return true; // el panel no navega a ningún sitio
            }
        });
        web.addJavascriptInterface(new Puente(), "PSNativo");
        setContentView(web);
        web.loadUrl(PANEL);
    }

    /** Lo que el panel puede decirle a la app. */
    final class Puente {
        @JavascriptInterface
        public String plataforma() {
            return "android";
        }

        @JavascriptInterface
        public void accion(String json) {
            // Llega en un hilo del WebView: al juego se le habla desde el principal.
            web.post(() -> acciones.alTocar(json));
        }
    }

    /** Resumen de la partida (JSON) para el panel. */
    void enviar(String json) {
        if (web != null) {
            web.evaluateJavascript("window.G&&G.Panel&&G.Panel.recibir(" + JSONObject.quote(json) + ")", null);
        }
    }

    /** Quita el panel y suelta su WebView. */
    void cerrar() {
        try {
            dismiss();
        } catch (IllegalArgumentException ignored) {
            // la pantalla ya no está
        }
        if (web != null) {
            web.destroy();
            web = null;
        }
    }
}
