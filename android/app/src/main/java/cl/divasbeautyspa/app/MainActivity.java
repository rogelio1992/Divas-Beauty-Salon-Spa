package cl.divasbeautyspa.app;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String APP_URL = "https://divas-beauty-salon-spa.vercel.app/";

    @Override
    public void onStart() {
        super.onStart();
        if (bridge != null && bridge.getWebView() != null) {
            bridge.getWebView().loadUrl(APP_URL);
        }
    }
}
