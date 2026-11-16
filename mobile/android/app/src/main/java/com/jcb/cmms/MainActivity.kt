package com.jcb.cmms

import android.content.Intent
import android.os.Bundle
import android.util.Log
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  /**
   * Required by react-native-screens to avoid crash on launch/state restore
   */
  override fun onCreate(savedInstanceState: Bundle?) {
    try {
      super.onCreate(null)
    } catch (t: Throwable) {
      Log.e("JcbCmms", "Crash in MainActivity.onCreate", t)
      val intent = Intent(this, CrashReportActivity::class.java).apply {
        putExtra("error_message", "MainActivity.onCreate failed: ${t.javaClass.simpleName}: ${t.message}")
        putExtra("stack_trace", Log.getStackTraceString(t))
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
      }
      startActivity(intent)
      finish()
    }
  }

  /**
   * Returns the name of the main component registered from JavaScript.
   */
  override fun getMainComponentName(): String = "JcbCmms"

  /**
   * Returns the instance of the [ReactActivityDelegate].
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
