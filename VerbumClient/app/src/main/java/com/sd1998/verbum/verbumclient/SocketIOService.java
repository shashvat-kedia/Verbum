package com.sd1998.verbum.verbumclient;

import android.app.Service;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.Resources;
import android.net.Uri;
import android.os.Binder;
import android.os.IBinder;
import android.util.Log;

import com.github.nkzawa.emitter.Emitter;
import com.github.nkzawa.socketio.client.Socket;

import org.apache.commons.io.IOUtils;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;

import okhttp3.MediaType;
import okhttp3.MultipartBody;
import okhttp3.RequestBody;
import okhttp3.ResponseBody;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class SocketIOService extends Service {
    private static final String TAG = SocketIOService.class.getSimpleName();

    public static SocketIOService instance = null;
    private VerbumClient client;
    private SharedPreferences preferences;

    private Emitter.Listener onConnectError;
    private Emitter.Listener onConnect;
    private Emitter.Listener onDisconnect;
    private Emitter.Listener onStartTraining;

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
        onStartTraining = new Emitter.Listener() {
            @Override
            public void call(Object... args) {
                Log.e(TAG, "Starting training");
                try {
                    FileUploadService service =
                            ServiceGenerator.createService(FileUploadService.class);
                    JSONObject messageJson = new JSONObject(args[0].toString());
                    try{
                        File file = File.createTempFile("gradient", ".ser");
                        OutputStream outputStream = new FileOutputStream(file);
                        Resources res = getResources();
                        IOUtils.copy(res.openRawResource(R.raw.gradients) , outputStream);
                        RequestBody requestFile =
                                RequestBody.create(
                                        MediaType.parse(getContentResolver().getType(Uri.fromFile(file))),
                                        file
                                );
                        MultipartBody.Part body =  MultipartBody.Part.createFormData("file", file.getName(), requestFile);
                        Call<ResponseBody> call = service.upload(body, messageJson.getString("modelId"),messageJson.getString("trainingSessionId"), client.getSocket().id());
                        call.enqueue(new Callback<ResponseBody>() {
                            @Override
                            public void onResponse(Call<ResponseBody> call,
                                                   Response<ResponseBody> response) {
                                Log.v("Upload", "success");
                            }

                            @Override
                            public void onFailure(Call<ResponseBody> call, Throwable t) {
                                Log.e("Upload error:", t.getMessage());
                            }
                        });
                    } catch (FileNotFoundException e) {
                        // handle exception here
                    } catch (IOException e) {
                        // handle exception here
                    }
                }
                catch (JSONException exception) {
                    throw new RuntimeException(exception);
                }
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
        client.getSocket().on("start-training", onStartTraining);
        client.getSocket().connect();
    }

    private void disconnectConnection() {
        instance = null;
        client.getSocket().disconnect();
        client.getSocket().off(Socket.EVENT_CONNECT, onConnect);
        client.getSocket().off(Socket.EVENT_DISCONNECT, onDisconnect);
        client.getSocket().off(Socket.EVENT_CONNECT_ERROR, onConnectError);
        client.getSocket().off(Socket.EVENT_CONNECT_TIMEOUT, onConnectError);
        client.getSocket().off("start-training", onStartTraining);
        client.getSocket().disconnect();
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        disconnectConnection();
    }
}
