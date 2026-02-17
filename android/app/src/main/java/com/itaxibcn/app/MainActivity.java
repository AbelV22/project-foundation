package com.itaxibcn.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.itaxibcn.app.tracking.ProTrackingPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register custom plugins BEFORE super.onCreate()
        registerPlugin(ProTrackingPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
