package com.tualingua.tts

import android.app.Activity
import android.content.pm.PackageManager
import android.os.Build
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
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors

@InvokeArg
class SpeakArgs {
    lateinit var text: String
    var lang: String? = null
    var rate: Double? = null
    var voiceId: String? = null
    var engine: String? = null
}

@InvokeArg
class VoicesArgs {
    var engine: String? = null
}

private data class PendingSpeak(
    val text: String,
    val lang: String?,
    val rate: Float,
    val voiceId: String?,
    val engine: String?,
    val invoke: Invoke,
)

private class EngineHandle(
    var engine: TextToSpeech? = null,
    @Volatile var ready: Boolean = false,
    @Volatile var unavailable: Boolean = false,
    var error: String? = null,
    val pending: MutableList<PendingSpeak> = mutableListOf(),
)

@TauriPlugin
class TtsPlugin(private val activity: Activity) : Plugin(activity) {
    private val mainHandler = Handler(Looper.getMainLooper())
    private val handles = ConcurrentHashMap<String, EngineHandle>()
    private val executor = Executors.newSingleThreadExecutor()
    @Volatile private var cachedDefaultEngine: String? = null

    init {
        executor.execute { cachedDefaultEngine = queryDefaultEnginePkg() }
        getOrCreateHandle(null)
    }

    private fun defaultEnginePkg(): String? {
        handles.values.firstOrNull { it.ready }?.engine?.defaultEngine?.let { cachedDefaultEngine = it; return it }
        return cachedDefaultEngine
    }

    private fun queryDefaultEnginePkg(): String? {
        return try {
            val ctx = activity.applicationContext
            val pm = ctx.packageManager
            val intent = android.content.Intent(TextToSpeech.Engine.ACTION_CHECK_TTS_DATA)
            val services = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                pm.queryIntentActivities(intent, PackageManager.ResolveInfoFlags.of(0))
            } else {
                @Suppress("DEPRECATION")
                pm.queryIntentActivities(intent, 0)
            }
            val pkgs = services.mapNotNull { it.activityInfo?.packageName }.distinct()
            pkgs.firstOrNull { it == "com.google.android.tts" } ?: pkgs.firstOrNull()
        } catch (_: Exception) {
            null
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
        val enginePkg = normalizeEngine(args.engine)
        mainHandler.post {
            val handle = getOrCreateHandle(enginePkg)
            if (handle.unavailable) {
                invoke.reject(handle.error ?: "El motor TTS del dispositivo no está disponible")
                return@post
            }
            if (!handle.ready) {
                handle.pending.add(PendingSpeak(text, args.lang, rate, args.voiceId, enginePkg, invoke))
                return@post
            }
            speakNow(handle, text, args.lang, rate, args.voiceId, invoke)
        }
    }

    @Command
    fun stop(invoke: Invoke) {
        mainHandler.post {
            handles.values.forEach { h ->
                rejectPending(h, "Reproducción cancelada")
                h.engine?.stop()
            }
            invoke.resolve(JSObject())
        }
    }

    @Command
    fun status(invoke: Invoke) {
        mainHandler.post {
            val handle = getOrCreateHandle(null)
            val obj = JSObject()
            obj.put("available", handle.ready && !handle.unavailable && handle.engine != null)
            obj.put("engine", defaultEnginePkg() ?: handle.engine?.defaultEngine ?: "android")
            if (handle.error != null) obj.put("error", handle.error)
            invoke.resolve(obj)
        }
    }

    @Command
    fun engines(invoke: Invoke) {
        executor.execute {
            try {
                val pm = activity.packageManager
                val intent = android.content.Intent(TextToSpeech.Engine.ACTION_CHECK_TTS_DATA)
                val services = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    pm.queryIntentActivities(intent, PackageManager.ResolveInfoFlags.of(0))
                } else {
                    @Suppress("DEPRECATION")
                    pm.queryIntentActivities(intent, 0)
                }
                val defaultPkg = defaultEnginePkg()
                val pkgs = services.mapNotNull { it.activityInfo?.packageName }.distinct().toMutableList()
                listOf("com.google.android.tts", "com.samsung.SMT").forEach { known ->
                    if (!pkgs.contains(known)) {
                        try { pm.getPackageInfo(known, 0); pkgs.add(known) } catch (_: Exception) {}
                    }
                }
                val arr = JSArray()
                pkgs.forEach { pkg ->
                    val o = JSObject()
                    o.put("id", pkg)
                    o.put("label", engineLabel(pkg))
                    o.put("default", pkg == defaultPkg)
                    arr.put(o)
                }
                val out = JSObject()
                out.put("engines", arr)
                invoke.resolve(out)
            } catch (e: Exception) {
                Log.w(TAG, "No se pudieron listar motores TTS", e)
                val out = JSObject()
                out.put("engines", JSArray())
                invoke.resolve(out)
            }
        }
    }

    @Command
    fun voices(invoke: Invoke) {
        val args = try { invoke.parseArgs(VoicesArgs::class.java) } catch (_: Exception) { VoicesArgs() }
        val enginePkg = normalizeEngine(args.engine)
        executor.execute {
            val defaultPkg = defaultEnginePkg()
            if (enginePkg == null || enginePkg == defaultPkg) {
                val handle = handles[defaultPkg] ?: handles["__default__"] ?: handles.values.firstOrNull { it.ready }
                if (handle != null && handle.ready) {
                    resolveVoices(invoke, handle.engine)
                    return@execute
                }
                mainHandler.post {
                    val h = getOrCreateHandle(null)
                    if (h.ready) executor.execute { resolveVoices(invoke, h.engine) }
                    else if (h.unavailable) resolveVoices(invoke, null)
                    else h.pending.add(PendingSpeak("__list__", null, 1f, null, null, invoke))
                }
                return@execute
            }
            val handle = handles[enginePkg]
            if (handle != null && handle.ready) {
                resolveVoices(invoke, handle.engine)
                return@execute
            }
            if (handle != null && !handle.unavailable) {
                mainHandler.post { handle.pending.add(PendingSpeak("__list__", null, 1f, null, enginePkg, invoke)) }
                return@execute
            }
            listVoicesFromEngine(enginePkg, invoke)
        }
    }

    override fun onDestroy(activity: AppCompatActivity) {
        mainHandler.post {
            handles.values.forEach { h ->
                rejectPending(h, "Reproducción cancelada")
                try { h.engine?.stop() } catch (_: Exception) {}
                try { h.engine?.shutdown() } catch (_: Exception) {}
                h.engine = null
                h.ready = false
            }
            handles.clear()
        }
    }

    private fun getOrCreateHandle(enginePkg: String?): EngineHandle {
        val key = enginePkg ?: defaultEnginePkg() ?: "__default__"
        handles[key]?.let { return it }
        val handle = EngineHandle()
        handles[key] = handle
        executor.execute {
            try {
                val listener = TextToSpeech.OnInitListener { status ->
                    mainHandler.post {
                        if (status == TextToSpeech.SUCCESS) {
                            handle.ready = true
                            flushPending(handle)
                        } else {
                            handle.unavailable = true
                            handle.error = "TTS init status: $status"
                            rejectPending(handle, handle.error ?: "El motor TTS del dispositivo no está disponible")
                        }
                    }
                }
                val tts = if (enginePkg != null) {
                    TextToSpeech(activity.applicationContext, listener, enginePkg)
                } else {
                    TextToSpeech(activity.applicationContext, listener)
                }
                handle.engine = tts
            } catch (e: Exception) {
                mainHandler.post {
                    handle.unavailable = true
                    handle.error = e.message ?: e.javaClass.simpleName
                    rejectPending(handle, handle.error ?: "El motor TTS del dispositivo no está disponible")
                }
                Log.e(TAG, "No se pudo iniciar TextToSpeech", e)
            }
        }
        return handle
    }

    private fun listVoicesFromEngine(enginePkg: String, invoke: Invoke) {
        try {
            var temp: TextToSpeech? = null
            temp = TextToSpeech(activity.applicationContext, { status ->
                executor.execute {
                    try {
                        resolveVoices(invoke, if (status == TextToSpeech.SUCCESS) temp else null)
                    } finally {
                        try { temp?.shutdown() } catch (_: Exception) {}
                    }
                }
            }, enginePkg)
        } catch (e: Exception) {
            Log.w(TAG, "No se pudieron listar voces para $enginePkg", e)
            resolveVoices(invoke, null)
        }
    }

    private fun resolveVoices(invoke: Invoke, tts: TextToSpeech?) {
        val out = JSObject()
        out.put("voices", voicesPayloadArray(tts))
        invoke.resolve(out)
    }

    private fun voicesPayloadArray(tts: TextToSpeech?): JSArray {
        val arr = JSArray()
        if (tts != null) {
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
        return arr
    }

    private fun voicesPayload(tts: TextToSpeech?): JSObject {
        val out = JSObject()
        out.put("voices", voicesPayloadArray(tts))
        return out
    }

    private fun speakNow(
        handle: EngineHandle,
        text: String,
        lang: String?,
        rate: Float,
        voiceId: String?,
        invoke: Invoke,
    ) {
        val tts = handle.engine
        if (tts == null) {
            invoke.reject(handle.error ?: "El motor TTS del dispositivo no está disponible")
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

    private fun flushPending(handle: EngineHandle) {
        val items = handle.pending.toList()
        handle.pending.clear()
        items.forEach { item ->
            if (item.text == "__list__") {
                executor.execute { resolveVoices(item.invoke, handle.engine) }
            } else {
                speakNow(handle, item.text, item.lang, item.rate, item.voiceId, item.invoke)
            }
        }
    }

    private fun rejectPending(handle: EngineHandle, message: String) {
        val items = handle.pending.toList()
        handle.pending.clear()
        items.forEach { it.invoke.reject(message) }
    }

    private fun normalizeEngine(engine: String?): String? {
        val e = engine?.trim()?.takeIf { it.isNotEmpty() } ?: return null
        return e
    }



    private fun engineLabel(pkg: String): String = when (pkg) {
        "com.google.android.tts" -> "Google Speech Services"
        "com.samsung.SMT" -> "Samsung TTS"
        else -> try {
            val pm = activity.packageManager
            val ai = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                pm.getApplicationInfo(pkg, PackageManager.ApplicationInfoFlags.of(0))
            } else {
                @Suppress("DEPRECATION")
                pm.getApplicationInfo(pkg, 0)
            }
            pm.getApplicationLabel(ai).toString()
        } catch (_: Exception) {
            pkg
        }
    }

    companion object {
        private const val TAG = "TtsPlugin"
    }
}
