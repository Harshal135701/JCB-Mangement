package com.jcb.cmms

import android.app.Activity
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast

class CrashReportActivity : Activity() {

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    val errorMessage = intent.getStringExtra("error_message") ?: "Unknown Error"
    val stackTrace = intent.getStringExtra("stack_trace") ?: "No stack trace recorded"

    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setBackgroundColor(Color.parseColor("#09090B"))
      setPadding(32, 48, 32, 48)
      layoutParams = ViewGroup.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.MATCH_PARENT
      )
    }

    // JCB Header Brand
    val headerLayout = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
    }

    val jcbBadge = TextView(this).apply {
      text = "JCB"
      textSize = 20f
      typeface = Typeface.DEFAULT_BOLD
      setTextColor(Color.BLACK)
      setBackgroundColor(Color.parseColor("#F9B101"))
      setPadding(16, 8, 16, 8)
    }
    headerLayout.addView(jcbBadge)

    val title = TextView(this).apply {
      text = "  CRASH DIAGNOSTIC"
      textSize = 18f
      typeface = Typeface.DEFAULT_BOLD
      setTextColor(Color.WHITE)
    }
    headerLayout.addView(title)
    root.addView(headerLayout)

    val subtitle = TextView(this).apply {
      text = "\nThe application encountered an uncaught exception on startup:"
      textSize = 13f
      setTextColor(Color.parseColor("#A1A1AA"))
    }
    root.addView(subtitle)

    val errBox = TextView(this).apply {
      text = errorMessage
      textSize = 14f
      typeface = Typeface.DEFAULT_BOLD
      setTextColor(Color.parseColor("#EF4444"))
      setPadding(0, 16, 0, 16)
    }
    root.addView(errBox)

    // ScrollView for Stack Trace
    val scrollView = ScrollView(this).apply {
      layoutParams = LinearLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        0,
        1.0f
      )
      setBackgroundColor(Color.parseColor("#18181B"))
      setPadding(20, 20, 20, 20)
    }

    val traceView = TextView(this).apply {
      text = stackTrace
      textSize = 11f
      typeface = Typeface.MONOSPACE
      setTextColor(Color.parseColor("#E4E4E7"))
      setTextIsSelectable(true)
    }
    scrollView.addView(traceView)
    root.addView(scrollView)

    // Action Buttons
    val buttonLayout = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      setPadding(0, 24, 0, 0)
    }

    val copyBtn = Button(this).apply {
      text = "📋 Copy Error Details"
      setBackgroundColor(Color.parseColor("#F9B101"))
      setTextColor(Color.BLACK)
      layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1.0f)
      setOnClickListener {
        val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        val clip = ClipData.newPlainText("JCB Crash Report", "$errorMessage\n\n$stackTrace")
        clipboard.setPrimaryClip(clip)
        Toast.makeText(this@CrashReportActivity, "Crash log copied to clipboard!", Toast.LENGTH_LONG).show()
      }
    }
    buttonLayout.addView(copyBtn)

    val restartBtn = Button(this).apply {
      text = "Restart App"
      setBackgroundColor(Color.parseColor("#27272A"))
      setTextColor(Color.WHITE)
      val params = LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT)
      params.setMargins(16, 0, 0, 0)
      layoutParams = params
      setOnClickListener {
        val restartIntent = packageManager.getLaunchIntentForPackage(packageName)
        restartIntent?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
        startActivity(restartIntent)
        finish()
      }
    }
    buttonLayout.addView(restartBtn)

    root.addView(buttonLayout)
    setContentView(root)
  }
}

