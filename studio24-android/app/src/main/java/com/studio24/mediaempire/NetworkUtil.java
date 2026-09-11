package com.studio24.mediaempire;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.os.Build;

final class NetworkUtil {
    static boolean isOnline(Context context) {
        try {
            ConnectivityManager cm=(ConnectivityManager)context.getSystemService(Context.CONNECTIVITY_SERVICE);
            if(cm==null)return true;
            if(Build.VERSION.SDK_INT>=23){
                android.net.Network n=cm.getActiveNetwork();
                if(n==null)return false;
                NetworkCapabilities c=cm.getNetworkCapabilities(n);
                return c!=null && c.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
            }
        }catch(Exception ignored){}
        return true;
    }
    private NetworkUtil(){}
}
