package com.tualingua.tts

import android.app.Activity
import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.speech.tts.Voice
import android.util.Log
import androidx.appcompat.app.AppCompatActivity
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSArray
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import java.util.Locale
import java.util.UUID

@InvokeArg
class SpeakArgs {
    lateinit var text: String
    var lang: String? = null
    var rate: Double? = null
    var voiceId: String? = null
}

private class PendingSpeak(
    val text: String,
    val lang: String?,
    val rate: Float,
    val voiceId: String?,
    val invoke: Invoke,
)

@TauriPlugin
class TtsPlugin(private val activity: Activity) : Plugin(activity) {
    private var engine: TextToSpeech? = null
    private var ready = false
    private var unavailable = false
    private var initError: String? = null
    private val pending = mutableListOf<PendingSpeak>()
    private val mainHandler = Handler(Looper.getMainLooper())

    init {
        try {
            engine = TextToSpeech(activity.applicationContext) { status ->
                mainHandler.post {
                    if (status == TextToSpeech.SUCCESS) {
                        ready = true
                        flushPending()
                    } else {
                        unavailable = true
                        initError = "TTS init status: $status"
                        rejectPending(initError ?: "El motor TTS del dispositivo no está disponible")
                    }
                }
            }
        } catch (e: Exception) {
            unavailable = true
            initError = e.message ?: e.javaClass.simpleName
            Log.e(TAG, "No se pudo iniciar TextToSpeech", e)
        }
    }

    @Command
    fun speak(invoke: Invoke) {
        val args = invoke.parseArgs(SpeakArgs::class.java)
        val text = args.text.trim()
        if (text.isEmpty()) {
            invoke.reject("Texto vacío")
            return
        }
        val rate = (args.rate ?: 1.0).coerceIn(0.5, 1.5).toFloat()
        if (unavailable) {
            invoke.reject(initError ?: "El motor TTS del dispositivo no está disponible")
            return
        }
        if (!ready) {
            pending.add(PendingSpeak(text, args.lang, rate, args.voiceId, invoke))
            return
        }
        speakNow(text, args.lang, rate, args.voiceId, invoke)
    }

    @Command
    fun stop(invoke: Invoke) {
        rejectPending("Reproducción cancelada")
        engine?.stop()
        invoke.resolve(JSObject())
    }

    @Command
    fun status(invoke: Invoke) {
        val obj = JSObject()
        obj.put("available", ready && !unavailable && engine != null)
        obj.put("engine", engine?.defaultEngine ?: "android")
        if (initError != null) obj.put("error", initError)
        invoke.resolve(obj)
    }

    @Command
    fun voices(invoke: Invoke) {
        val arr = JSArray()
        val tts = engine
        if (tts != null && ready) {
            try {
                val vs: Set<Voice>? = tts.voices
                vs?.forEach { v ->
                    val o = JSObject()
                    o.put("id", v.name)
                    o.put("name", v.name)
                    o.put("lang", v.locale?.toLanguageTag() ?: "")
                    o.put("default", v.name == tts.defaultVoice?.name)
                    arr.put(o)
                }
            } catch (e: Exception) {
                Log.w(TAG, "No se pudieron listar voces", e)
            }
        }
        invoke.resolve(arr)
    }

    override fun onDestroy(activity: AppCompatActivity) {
        rejectPending("Reproducción cancelada")
        engine?.stop()
        engine?.shutdown()
        engine = null
        ready = false
    }

    private fun speakNow(text: String, lang: String?, rate: Float, voiceId: String?, invoke: Invoke) {
        val tts = engine
        if (tts == null) {
            invoke.reject(initError ?: "El motor TTS del dispositivo no está disponible")
            return
        }
        applyVoice(tts, voiceId)
        applyLanguage(tts, lang)
        tts.setSpeechRate(rate)
        val utteranceId = "tualingua-${UUID.randomUUID()}"
        val result = tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, utteranceId)
        if (result == TextToSpeech.SUCCESS) {
            invoke.resolve(JSObject())
        } else {
            invoke.reject("El motor TTS rechazó la reproducción")
        }
    }

    private fun applyVoice(tts: TextToSpeech, voiceId: String?) {
        if (voiceId.isNullOrBlank()) return
        try {
            val voice = tts.voices?.firstOrNull { it.name == voiceId }
            if (voice != null) tts.voice = voice
        } catch (e: Exception) {
            Log.w(TAG, "No se pudo aplicar voz $voiceId", e)
        }
    }

    private fun applyLanguage(tts: TextToSpeech, lang: String?) {
        if (lang.isNullOrBlank()) return
        try {
            val locale = Locale.forLanguageTag(lang)
            val result = tts.setLanguage(locale)
            if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
                val base = Locale(locale.language)
                if (base != locale) {
                    val fallback = tts.setLanguage(base)
                    if (fallback == TextToSpeech.LANG_MISSING_DATA ||
                        fallback == TextToSpeech.LANG_NOT_SUPPORTED
                    ) {
                        Log.w(TAG, "Idioma TTS no disponible: $lang")
                    }
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Error aplicando idioma $lang", e)
        }
    }

    private fun flushPending() {
        val items = pending.toList()
        pending.clear()
        items.forEach { speakNow(it.text, it.lang, it.rate, it.voiceId, it.invoke) }
    }

    private fun rejectPending(message: String) {
        val items = pending.toList()
        pending.clear()
        items.forEach { it.invoke.reject(message) }
    }

    companion object {
        private const val TAG = "TtsPlugin"
    }
}
