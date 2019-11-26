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
        TextGenerationAsnyTask runner = new TextGenerationAsnyTask();
        runner.execute(inputData);
    }

    class TextGenerationAsnyTask extends AsyncTask<String, Integer, String> {

        @Override
        protected void onPreExecute() {
            super.onPreExecute();
        }

        @Override
        protected String doInBackground(String... strings) {
            String inputData = strings[0].substring(0, N_CHARS);
            return inputData;
        }
    }
}
