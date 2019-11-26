package com.sd1998.verbum.verbumclient;

import android.app.Service;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Binder;
import android.os.IBinder;
import android.util.Log;

import com.github.nkzawa.emitter.Emitter;
import com.github.nkzawa.socketio.client.Socket;

import org.json.JSONException;
import org.json.JSONObject;

public class SocketIOService extends Service {
    private static final String TAG = SocketIOService.class.getSimpleName();

    public static SocketIOService instance = null;
    private VerbumClient client;
    private SharedPreferences preferences;

    private Emitter.Listener onConnectError;
    private Emitter.Listener onConnect;
    private Emitter.Listener onDisconnect;

    public static boolean isInstanceCreated() {
        return instance == null ? false : true;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return myBinder;
    }

    private final IBinder myBinder = new LocalBinder();

    public class LocalBinder extends Binder {
        public SocketIOService getService() {
            return SocketIOService.this;
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        client = (VerbumClient) getApplication();
        preferences = getApplicationContext().getSharedPreferences("Verbum", 0);
        onConnectError = new Emitter.Listener() {
            @Override
            public void call(Object... args) {
                Log.e(TAG, args[0].toString());
                Log.e(TAG, "Connection error");
            }
        };
        onConnect = new Emitter.Listener() {
            @Override
            public void call(Object... args) {
                Log.e(TAG, "Connected");
                String prevSocketId = preferences.getString("prevSocketId", "");
                if (prevSocketId.length() != 0){
                    Log.e("TAG", "Sending init event");
                    try {
                        JSONObject jsonObject = new JSONObject();
                        jsonObject.put("prevId", prevSocketId);
                        client.getSocket().emit("init", jsonObject);
                    }
                    catch (JSONException exception) {
                        Log.e(TAG, "Exception: " + exception.getMessage());
                    }
                }
                SharedPreferences.Editor editor = preferences.edit();
                editor.putString("prevSocketId", client.getSocket().id());
                editor.commit();
            }
        };
        onDisconnect = new Emitter.Listener() {
            @Override
            public void call(Object... args) {
                Log.e(TAG, "Disconnected");
            }
        };
    }

    public void notifyTrainingComplete() {
        if (client.getSocket() != null) {
            Log.e(TAG, "Emitting training-complete event");
            client.getSocket().emit("training-complete", 1);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        super.onStartCommand(intent, flags, startId);
        connectConnection();
        return START_STICKY;
    }

    private Runnable onTypingTimeout = new Runnable() {
        @Override
        public void run() {

        }
    };

    private void connectConnection() {
        instance = this;
        client.CHAT_SOCKET = client.getSocket();
        client.getSocket().on(Socket.EVENT_CONNECT_ERROR, onConnectError);
        client.getSocket().on(Socket.EVENT_CONNECT_TIMEOUT, onConnectError);
        client.getSocket().on(Socket.EVENT_CONNECT, onConnect);
        client.getSocket().connect();
    }

    private void disconnectConnection() {
        instance = null;
        client.getSocket().disconnect();
        client.getSocket().off(Socket.EVENT_CONNECT, onConnect);
        client.getSocket().off(Socket.EVENT_DISCONNECT, onDisconnect);
        client.getSocket().off(Socket.EVENT_CONNECT_ERROR, onConnectError);
        client.getSocket().off(Socket.EVENT_CONNECT_TIMEOUT, onConnectError);
        client.getSocket().disconnect();
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        disconnectConnection();
    }
}
