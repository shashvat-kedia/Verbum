package com.sd1998.verbum.verbumclient;

import android.app.Application;
import android.content.Context;
import android.content.res.Resources;
import android.util.Log;

import com.github.nkzawa.socketio.client.IO;
import com.github.nkzawa.socketio.client.Socket;

import java.net.URISyntaxException;

public class VerbumClient extends Application {

    private Resources resources;
    private Context context;
    public static Socket CHAT_SOCKET;

    @Override
    public void onCreate() {
        super.onCreate();

        resources = this.getResources();
        context = getApplicationContext();

        IO.Options opts = new IO.Options();
        opts.forceNew = true;
        opts.reconnection = true;
        opts.port = 8000;

        try {
            CHAT_SOCKET = IO.socket("http://3c016311.ngrok.io", opts);
        } catch (URISyntaxException e) {
            e.printStackTrace();
            Log.e("SOCKET.IO ", e.getMessage());
        }


    }

    public Socket getSocket() {
        return CHAT_SOCKET;
    }
}
