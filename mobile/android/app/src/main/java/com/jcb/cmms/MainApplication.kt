package com.jcb.cmms

import android.app.Application
import android.content.Intent
import android.util.Log
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.react.soloader.OpenSourceMergedSoMapping
import com.facebook.soloader.SoLoader
import java.io.File

class MainApplication : Application(), ReactApplication {

  override val reactNativeHost: ReactNativeHost =
      object : DefaultReactNativeHost(this) {
        override fun getPackages(): List<ReactPackage> =
            PackageList(this).packages.apply {
              add(BarcodeScannerPackage())
            }

        override fun getJSMainModuleName(): String = "index"

        override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

        override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
        override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
      }

  override val reactHost: ReactHost?
    get() = if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) getDefaultReactHost(applicationContext, reactNativeHost) else null

  override fun onCreate() {
    super.onCreate()

    // 1. Install UncaughtExceptionHandler to catch all startup crashes and show CrashReportActivity
    val previousHandler = Thread.getDefaultUncaughtExceptionHandler()
    Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
      try {
        val stackTrace = Log.getStackTraceString(throwable)
        Log.e("JcbCmmsCrash", "CRASH DETECTED ON THREAD: ${thread.name}", throwable)

        // Save to internal crash file for debugging
        try {
          val crashFile = File(getExternalFilesDir(null) ?: filesDir, "crash_log.txt")
          crashFile.writeText("Thread: ${thread.name}\nException: ${throwable.javaClass.name}\nMessage: ${throwable.message}\n\n$stackTrace")
        } catch (ignored: Exception) {}

        // Launch CrashReportActivity in isolated process
        val intent = Intent(this, CrashReportActivity::class.java).apply {
          putExtra("error_message", "${throwable.javaClass.simpleName}: ${throwable.message ?: "Unknown Error"}")
          putExtra("stack_trace", stackTrace)
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
        }
        startActivity(intent)
        android.os.Process.killProcess(android.os.Process.myPid())
        System.exit(10)
      } catch (e: Exception) {
        previousHandler?.uncaughtException(thread, throwable)
      }
    }

    // 2. Initialize SoLoader with OpenSourceMergedSoMapping (Mandatory for React Native 0.76+)
    try {
      SoLoader.init(this, OpenSourceMergedSoMapping)
    } catch (e: Throwable) {
      Log.e("JcbCmms", "SoLoader init with OpenSourceMergedSoMapping failed, falling back", e)
      SoLoader.init(this, false)
    }

    if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
      load()
    }
  }
}
