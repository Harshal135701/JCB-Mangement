package com.jcb.cmms

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning

class BarcodeScannerModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "BarcodeScannerModule"

    @ReactMethod
    fun scanBarcode(promise: Promise) {
        val activity = currentActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "Current activity is null")
            return
        }

        activity.runOnUiThread {
            try {
                // Scans BOTH QR Codes and all 1D Barcodes (Code 128, Code 39, EAN, UPC, etc.)
                val options = GmsBarcodeScannerOptions.Builder()
                    .setBarcodeFormats(Barcode.FORMAT_ALL_FORMATS)
                    .enableAutoZoom()
                    .build()

                val scanner = GmsBarcodeScanning.getClient(activity, options)
                scanner.startScan()
                    .addOnSuccessListener { barcode: Barcode ->
                        val code = barcode.rawValue ?: barcode.displayValue ?: ""
                        promise.resolve(code)
                    }
                    .addOnCanceledListener {
                        promise.reject("CANCELLED", "User dismissed scan window")
                    }
                    .addOnFailureListener { e: Exception ->
                        promise.reject("SCAN_FAILED", e.message ?: "Failed to scan barcode")
                    }
            } catch (e: Exception) {
                promise.reject("ERROR", e.message ?: "Scanner initialization error")
            }
        }
    }
}
