package com.sd1998.verbum.verbumclient;

import androidx.appcompat.app.AppCompatActivity;

import android.content.Intent;
import android.os.AsyncTask;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.widget.ProgressBar;

public class MainActivity extends AppCompatActivity {

    private static final String N_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890\"\n',.?;()[]{}:!- ";

    private VerbumClient client;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        client = (VerbumClient) getApplication();
        if (client != null && client.getSocket() != null && !SocketIOService.isInstanceCreated()) {
            startService(new Intent(getBaseContext(), SocketIOService.class));
        }
        String inputData = "";
    }

}
