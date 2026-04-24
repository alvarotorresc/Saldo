package app.saldo;

import android.os.Bundle;
import android.view.WindowManager;

import com.getcapacitor.BridgeActivity;

/**
 * FLAG_SECURE prevents the task switcher and the system from capturing the
 * WebView contents into the Recents thumbnail and blocks most third-party
 * screen recorders from sampling Saldo. Mirrors the privacy posture of other
 * finance apps.
 */
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        getWindow().setFlags(
            WindowManager.LayoutParams.FLAG_SECURE,
            WindowManager.LayoutParams.FLAG_SECURE
        );
        super.onCreate(savedInstanceState);
    }
}
