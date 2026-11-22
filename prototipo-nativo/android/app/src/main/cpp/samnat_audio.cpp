#include <jni.h>
#include <aaudio/AAudio.h>
#include <fluidsynth.h>

#include <algorithm>
#include <array>
#include <atomic>
#include <cmath>
#include <cstring>
#include <mutex>
#include <string>
#include <unordered_map>

namespace {
constexpr int kSampleRate = 48000;
constexpr int kChannels = 8;
constexpr size_t kSoundFontCacheLimit = 12;
std::mutex gSynthMutex;
fluid_settings_t* gSettings = nullptr;
fluid_synth_t* gSynth = nullptr;
AAudioStream* gStream = nullptr;
int32_t gOutputDeviceId = AAUDIO_UNSPECIFIED;
std::array<int, kChannels> gSoundFonts{};
std::array<std::string, kChannels> gSoundFontPaths{};
std::unordered_map<std::string, int> gLoadedSoundFonts;
std::atomic<bool> gTestTone{false};
float gTestPhase = 0.0f;

void clearAudio(float* out, int32_t frames) {
    std::memset(out, 0, static_cast<size_t>(frames) * 2 * sizeof(float));
}

aaudio_data_callback_result_t audioCallback(AAudioStream*, void*, void* audioData, int32_t frames) {
    auto* out = static_cast<float*>(audioData);
    clearAudio(out, frames);
    std::unique_lock<std::mutex> lock(gSynthMutex, std::try_to_lock);
    if (lock.owns_lock() && gSynth) {
        fluid_synth_write_float(gSynth, frames, out, 0, 2, out, 1, 2);
    }
    if (gTestTone.load(std::memory_order_relaxed)) {
        constexpr float increment = 2.0f * 3.14159265358979323846f * 440.0f / kSampleRate;
        for (int32_t frame = 0; frame < frames; ++frame) {
            const float sample = 0.12f * std::sin(gTestPhase);
            gTestPhase += increment;
            if (gTestPhase >= 2.0f * 3.14159265358979323846f) gTestPhase -= 2.0f * 3.14159265358979323846f;
            out[frame * 2] += sample;
            out[frame * 2 + 1] += sample;
        }
    }
    for (int32_t i = 0; i < frames * 2; ++i) {
        const float magnitude = std::fabs(out[i]);
        if (magnitude > 0.90f) {
            const float limited = 0.90f + 0.10f * std::tanh((magnitude - 0.90f) / 0.10f);
            out[i] = std::copysign(limited, out[i]);
        }
    }
    return AAUDIO_CALLBACK_RESULT_CONTINUE;
}

void closeLocked() {
    if (gStream) {
        AAudioStream_requestStop(gStream);
        AAudioStream_close(gStream);
        gStream = nullptr;
    }
    if (gSynth) {
        delete_fluid_synth(gSynth);
        gSynth = nullptr;
    }
    if (gSettings) {
        delete_fluid_settings(gSettings);
        gSettings = nullptr;
    }
    gSoundFonts.fill(-1);
    gSoundFontPaths.fill({});
    gLoadedSoundFonts.clear();
    gTestTone.store(false, std::memory_order_relaxed);
}

bool openAudioStreamLocked(int32_t deviceId) {
    AAudioStreamBuilder* builder = nullptr;
    if (AAudio_createStreamBuilder(&builder) != AAUDIO_OK || !builder) return false;
    AAudioStreamBuilder_setDirection(builder, AAUDIO_DIRECTION_OUTPUT);
    AAudioStreamBuilder_setDeviceId(builder, deviceId);
    AAudioStreamBuilder_setFormat(builder, AAUDIO_FORMAT_PCM_FLOAT);
    AAudioStreamBuilder_setChannelCount(builder, 2);
    AAudioStreamBuilder_setSampleRate(builder, kSampleRate);
    AAudioStreamBuilder_setPerformanceMode(builder, AAUDIO_PERFORMANCE_MODE_LOW_LATENCY);
    AAudioStreamBuilder_setSharingMode(builder, AAUDIO_SHARING_MODE_SHARED);
    AAudioStreamBuilder_setDataCallback(builder, audioCallback, nullptr);
    const aaudio_result_t opened = AAudioStreamBuilder_openStream(builder, &gStream);
    AAudioStreamBuilder_delete(builder);
    if (opened != AAUDIO_OK || !gStream || AAudioStream_requestStart(gStream) != AAUDIO_OK) {
        if (gStream) { AAudioStream_close(gStream); gStream = nullptr; }
        return false;
    }
    return true;
}

std::string jniString(JNIEnv* env, jstring value) {
    if (!value) return {};
    const char* chars = env->GetStringUTFChars(value, nullptr);
    if (!chars) return {};
    std::string result(chars);
    env->ReleaseStringUTFChars(value, chars);
    return result;
}

void evictUnusedSoundFontLocked() {
    if (gLoadedSoundFonts.size() < kSoundFontCacheLimit || !gSynth) return;
    for (auto it = gLoadedSoundFonts.begin(); it != gLoadedSoundFonts.end(); ++it) {
        bool active = false;
        for (int id : gSoundFonts) if (id == it->second) { active = true; break; }
        if (active) continue;
        const int id = it->second;
        gLoadedSoundFonts.erase(it);
        fluid_synth_sfunload(gSynth, id, 1);
        return;
    }
}
}

extern "C" JNIEXPORT jboolean JNICALL
Java_com_samnat_synth_NativeAudioEngine_nativeStart(JNIEnv*, jobject) {
    std::lock_guard<std::mutex> lock(gSynthMutex);
    if (gSynth && gStream) return JNI_TRUE;
    closeLocked();
    gSettings = new_fluid_settings();
    if (!gSettings) return JNI_FALSE;
    fluid_settings_setnum(gSettings, "synth.sample-rate", kSampleRate);
    fluid_settings_setnum(gSettings, "synth.gain", 0.4);
    fluid_settings_setint(gSettings, "synth.polyphony", 256);
    fluid_settings_setint(gSettings, "synth.reverb.active", 1);
    fluid_settings_setint(gSettings, "synth.chorus.active", 1);
    gSynth = new_fluid_synth(gSettings);
    if (!gSynth) { closeLocked(); return JNI_FALSE; }
    gSoundFonts.fill(-1);

    if (!openAudioStreamLocked(gOutputDeviceId)) {
        if (gOutputDeviceId == AAUDIO_UNSPECIFIED || !openAudioStreamLocked(AAUDIO_UNSPECIFIED)) {
            closeLocked();
            return JNI_FALSE;
        }
        gOutputDeviceId = AAUDIO_UNSPECIFIED;
    }
    return JNI_TRUE;
}

extern "C" JNIEXPORT void JNICALL
Java_com_samnat_synth_NativeAudioEngine_nativeClose(JNIEnv*, jobject) {
    std::lock_guard<std::mutex> lock(gSynthMutex);
    closeLocked();
}

extern "C" JNIEXPORT jboolean JNICALL
Java_com_samnat_synth_NativeAudioEngine_nativeSelectOutput(JNIEnv*, jobject, jint deviceId) {
    std::lock_guard<std::mutex> lock(gSynthMutex);
    if (!gSynth || !gStream) return JNI_FALSE;
    const int32_t previous = gOutputDeviceId;
    AAudioStream_requestStop(gStream);
    AAudioStream_close(gStream);
    gStream = nullptr;
    gOutputDeviceId = deviceId < 0 ? AAUDIO_UNSPECIFIED : deviceId;
    if (openAudioStreamLocked(gOutputDeviceId)) return JNI_TRUE;
    gOutputDeviceId = previous;
    openAudioStreamLocked(previous);
    return JNI_FALSE;
}

extern "C" JNIEXPORT jstring JNICALL
Java_com_samnat_synth_NativeAudioEngine_nativeLoadSoundFont(JNIEnv* env, jobject, jstring path, jint channel) {
    if (channel < 0 || channel >= kChannels) return env->NewStringUTF("ERRO: canal inválido");
    const std::string filename = jniString(env, path);
    std::lock_guard<std::mutex> lock(gSynthMutex);
    if (!gSynth) return env->NewStringUTF("ERRO: motor de áudio não inicializado");
    const int oldId = gSoundFonts[static_cast<size_t>(channel)];
    int soundFontId = -1;
    auto existing = gLoadedSoundFonts.find(filename);
    if (existing != gLoadedSoundFonts.end()) soundFontId = existing->second;
    else {
        evictUnusedSoundFontLocked();
        // Do not reset programs in other channels when adding a slot's SF2.
        soundFontId = fluid_synth_sfload(gSynth, filename.c_str(), 0);
        if (soundFontId >= 0) gLoadedSoundFonts[filename] = soundFontId;
    }
    if (soundFontId < 0) return env->NewStringUTF("ERRO: FluidSynth não conseguiu abrir o SF2");
    fluid_synth_program_select(gSynth, channel, soundFontId, 0, 0);
    gSoundFonts[static_cast<size_t>(channel)] = soundFontId;
    gSoundFontPaths[static_cast<size_t>(channel)] = filename;
    (void)oldId; // Unreferenced fonts stay cached for fast scene changes.
    std::string result = "OK\n";
    fluid_sfont_t* soundFont = fluid_synth_get_sfont_by_id(gSynth, soundFontId);
    if (soundFont) {
        fluid_sfont_iteration_start(soundFont);
        fluid_preset_t* preset = nullptr;
        while ((preset = fluid_sfont_iteration_next(soundFont)) != nullptr) {
            result += std::to_string(fluid_preset_get_banknum(preset));
            result += '\t';
            result += std::to_string(fluid_preset_get_num(preset));
            result += '\t';
            const char* name = fluid_preset_get_name(preset);
            if (name) result += name;
            result += '\n';
        }
    }
    return env->NewStringUTF(result.c_str());
}

extern "C" JNIEXPORT void JNICALL
Java_com_samnat_synth_NativeAudioEngine_nativeSetProgram(JNIEnv*, jobject, jint channel, jint bank, jint program) {
    if (channel < 0 || channel >= kChannels) return;
    std::lock_guard<std::mutex> lock(gSynthMutex);
    const int id = gSoundFonts[static_cast<size_t>(channel)];
    if (gSynth && id >= 0) fluid_synth_program_select(gSynth, channel, id, bank, program);
}

extern "C" JNIEXPORT void JNICALL
Java_com_samnat_synth_NativeAudioEngine_nativeControlChange(JNIEnv*, jobject, jint channel, jint controller, jint value) {
    if (channel < 0 || channel >= kChannels) return;
    std::lock_guard<std::mutex> lock(gSynthMutex);
    if (gSynth) fluid_synth_cc(gSynth, channel, controller, std::clamp(value, 0, 127));
}

extern "C" JNIEXPORT void JNICALL
Java_com_samnat_synth_NativeAudioEngine_nativeNoteOn(JNIEnv*, jobject, jint channel, jint note, jint velocity) {
    if (channel < 0 || channel >= kChannels) return;
    std::lock_guard<std::mutex> lock(gSynthMutex);
    if (gSynth) fluid_synth_noteon(gSynth, channel, std::clamp(note, 0, 127), std::clamp(velocity, 1, 127));
}

extern "C" JNIEXPORT void JNICALL
Java_com_samnat_synth_NativeAudioEngine_nativeNoteOff(JNIEnv*, jobject, jint channel, jint note) {
    if (channel < 0 || channel >= kChannels) return;
    std::lock_guard<std::mutex> lock(gSynthMutex);
    if (gSynth) fluid_synth_noteoff(gSynth, channel, std::clamp(note, 0, 127));
}

extern "C" JNIEXPORT void JNICALL
Java_com_samnat_synth_NativeAudioEngine_nativeAllNotesOff(JNIEnv*, jobject, jint channel) {
    if (channel < 0 || channel >= kChannels) return;
    std::lock_guard<std::mutex> lock(gSynthMutex);
    if (gSynth) fluid_synth_all_sounds_off(gSynth, channel);
}

extern "C" JNIEXPORT void JNICALL
Java_com_samnat_synth_NativeAudioEngine_nativeClearChannel(JNIEnv*, jobject, jint channel) {
    if (channel < 0 || channel >= kChannels) return;
    std::lock_guard<std::mutex> lock(gSynthMutex);
    if (!gSynth) return;
    const size_t index = static_cast<size_t>(channel);
    const int oldId = gSoundFonts[index];
    fluid_synth_all_sounds_off(gSynth, channel);
    fluid_synth_cc(gSynth, channel, 7, 0);
    gSoundFonts[index] = -1;
    gSoundFontPaths[index].clear();
    // The id is retained in a bounded cache so scene changes can reuse it.
    (void)oldId;
}

extern "C" JNIEXPORT void JNICALL
Java_com_samnat_synth_NativeAudioEngine_nativePitchBend(JNIEnv*, jobject, jint channel, jint value) {
    if (channel < 0 || channel >= kChannels) return;
    std::lock_guard<std::mutex> lock(gSynthMutex);
    if (gSynth) fluid_synth_pitch_bend(gSynth, channel, std::clamp(value, 0, 16383));
}

extern "C" JNIEXPORT void JNICALL
Java_com_samnat_synth_NativeAudioEngine_nativeTestTone(JNIEnv*, jobject, jboolean enabled) {
    gTestTone.store(enabled == JNI_TRUE, std::memory_order_relaxed);
}
