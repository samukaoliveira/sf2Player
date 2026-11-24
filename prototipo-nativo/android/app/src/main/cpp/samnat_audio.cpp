#include <jni.h>
#include <aaudio/AAudio.h>
#include <fluidsynth.h>

#include <algorithm>
#include <array>
#include <atomic>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <cstring>
#include <mutex>
#include <string>
#include <thread>
#include <unordered_map>

namespace {
constexpr int kSampleRate = 48000;
constexpr int kChannels = 8;
constexpr size_t kSoundFontCacheLimit = 12;
constexpr size_t kAudioCommandQueueCapacity = 4096;
constexpr size_t kAudioCommandQueueMask = kAudioCommandQueueCapacity - 1;
constexpr size_t kRenderRingCapacityFrames = 8192;
constexpr size_t kRenderRingMask = kRenderRingCapacityFrames - 1;
constexpr int kRenderBlockFrames = 256;
constexpr int kMaxCommandsPerCallback = 256;
static_assert((kAudioCommandQueueCapacity & kAudioCommandQueueMask) == 0,
              "Audio command queue capacity must be a power of two");
static_assert((kRenderRingCapacityFrames & kRenderRingMask) == 0,
              "Audio render ring capacity must be a power of two");
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
int gBufferBursts = 1;
std::array<float, kRenderRingCapacityFrames * 2> gRenderRing{};
std::atomic<uint64_t> gRenderWriteFrame{0};
std::atomic<uint64_t> gRenderReadFrame{0};
std::atomic<int> gRenderTargetFrames{512};
std::atomic<bool> gRenderWorkerRunning{false};
std::thread gRenderWorker;
std::atomic<uint64_t> gAudioGeneration{0};
std::atomic<bool> gAudioCommandsEnabled{false};

enum class AudioCommandType : uint8_t {
    NoteOn,
    NoteOff,
    AllNotesOff,
    ControlChange,
    PitchBend,
    ProgramSelect,
};

struct AudioCommand {
    AudioCommandType type{};
    int channel{};
    int data1{};
    int data2{};
    uint64_t generation{};
};

// Bounded MPMC queue: MIDI and UI threads enqueue events without taking the
// synth mutex, and the render worker applies them before FluidSynth renders.
class AudioCommandQueue {
public:
    AudioCommandQueue() {
        for (size_t i = 0; i < cells_.size(); ++i) {
            cells_[i].sequence.store(i, std::memory_order_relaxed);
        }
    }

    bool enqueue(const AudioCommand& command) {
        size_t position = enqueuePosition_.load(std::memory_order_relaxed);
        for (;;) {
            Cell& cell = cells_[position & kAudioCommandQueueMask];
            const size_t sequence = cell.sequence.load(std::memory_order_acquire);
            const intptr_t difference = static_cast<intptr_t>(sequence) - static_cast<intptr_t>(position);
            if (difference == 0) {
                if (enqueuePosition_.compare_exchange_weak(
                        position, position + 1, std::memory_order_relaxed)) {
                    cell.command = command;
                    cell.sequence.store(position + 1, std::memory_order_release);
                    return true;
                }
            } else if (difference < 0) {
                return false;
            } else {
                position = enqueuePosition_.load(std::memory_order_relaxed);
            }
        }
    }

    bool dequeue(AudioCommand& command) {
        size_t position = dequeuePosition_.load(std::memory_order_relaxed);
        for (;;) {
            Cell& cell = cells_[position & kAudioCommandQueueMask];
            const size_t sequence = cell.sequence.load(std::memory_order_acquire);
            const intptr_t difference = static_cast<intptr_t>(sequence) - static_cast<intptr_t>(position + 1);
            if (difference == 0) {
                if (dequeuePosition_.compare_exchange_weak(
                        position, position + 1, std::memory_order_relaxed)) {
                    command = cell.command;
                    cell.sequence.store(position + kAudioCommandQueueCapacity, std::memory_order_release);
                    return true;
                }
            } else if (difference < 0) {
                return false;
            } else {
                position = dequeuePosition_.load(std::memory_order_relaxed);
            }
        }
    }

private:
    struct Cell {
        std::atomic<size_t> sequence{0};
        AudioCommand command{};
    };

    std::array<Cell, kAudioCommandQueueCapacity> cells_{};
    alignas(64) std::atomic<size_t> enqueuePosition_{0};
    alignas(64) std::atomic<size_t> dequeuePosition_{0};
};

AudioCommandQueue gAudioCommands;

bool queueAudioCommand(AudioCommandType type, int channel, int data1 = 0, int data2 = 0) {
    if (!gAudioCommandsEnabled.load(std::memory_order_acquire)) return false;
    const uint64_t generation = gAudioGeneration.load(std::memory_order_acquire);
    return gAudioCommands.enqueue({type, channel, data1, data2, generation});
}

void applyAudioCommand(const AudioCommand& command) {
    if (command.generation != gAudioGeneration.load(std::memory_order_acquire)) return;
    switch (command.type) {
        case AudioCommandType::NoteOn:
            fluid_synth_noteon(gSynth, command.channel, command.data1, command.data2);
            break;
        case AudioCommandType::NoteOff:
            fluid_synth_noteoff(gSynth, command.channel, command.data1);
            break;
        case AudioCommandType::AllNotesOff:
            fluid_synth_all_sounds_off(gSynth, command.channel);
            break;
        case AudioCommandType::ControlChange:
            fluid_synth_cc(gSynth, command.channel, command.data1, command.data2);
            break;
        case AudioCommandType::PitchBend:
            fluid_synth_pitch_bend(gSynth, command.channel, command.data1);
            break;
        case AudioCommandType::ProgramSelect: {
            const int soundFontId = gSoundFonts[static_cast<size_t>(command.channel)];
            if (soundFontId >= 0) {
                fluid_synth_program_select(gSynth, command.channel, soundFontId,
                                           command.data1, command.data2);
            }
            break;
        }
    }
}

void renderWorkerLoop() {
    std::array<float, kRenderBlockFrames * 2> block{};
    while (gRenderWorkerRunning.load(std::memory_order_acquire)) {
        const uint64_t writeFrame = gRenderWriteFrame.load(std::memory_order_relaxed);
        const uint64_t readFrame = gRenderReadFrame.load(std::memory_order_acquire);
        const uint64_t queuedFrames = writeFrame - readFrame;
        const int targetFrames = gRenderTargetFrames.load(std::memory_order_relaxed);
        if (queuedFrames >= static_cast<uint64_t>(targetFrames)) {
            std::this_thread::sleep_for(std::chrono::milliseconds(1));
            continue;
        }

        const size_t freeFrames = kRenderRingCapacityFrames - static_cast<size_t>(queuedFrames);
        const size_t neededFrames = static_cast<size_t>(targetFrames) - static_cast<size_t>(queuedFrames);
        const int frames = static_cast<int>(std::min({
            static_cast<size_t>(kRenderBlockFrames), freeFrames, neededFrames}));
        if (frames <= 0) continue;

        std::unique_lock<std::mutex> lock(gSynthMutex, std::try_to_lock);
        if (!lock.owns_lock() || !gSynth) {
            std::this_thread::sleep_for(std::chrono::milliseconds(1));
            continue;
        }

        AudioCommand command;
        for (int processed = 0; processed < kMaxCommandsPerCallback && gAudioCommands.dequeue(command); ++processed) {
            applyAudioCommand(command);
        }
        fluid_synth_write_float(gSynth, frames, block.data(), 0, 2, block.data(), 1, 2);
        lock.unlock();

        const size_t ringOffset = static_cast<size_t>(writeFrame & kRenderRingMask);
        const size_t firstFrames = std::min(static_cast<size_t>(frames), kRenderRingCapacityFrames - ringOffset);
        std::memcpy(gRenderRing.data() + ringOffset * 2, block.data(), firstFrames * 2 * sizeof(float));
        if (firstFrames < static_cast<size_t>(frames)) {
            const size_t remainingFrames = static_cast<size_t>(frames) - firstFrames;
            std::memcpy(gRenderRing.data(), block.data() + firstFrames * 2,
                        remainingFrames * 2 * sizeof(float));
        }
        gRenderWriteFrame.store(writeFrame + static_cast<uint64_t>(frames), std::memory_order_release);
    }
}

void startRenderWorkerLocked() {
    if (gRenderWorker.joinable()) return;
    gRenderReadFrame.store(0, std::memory_order_relaxed);
    gRenderWriteFrame.store(0, std::memory_order_relaxed);
    gRenderWorkerRunning.store(true, std::memory_order_release);
    try {
        gRenderWorker = std::thread(renderWorkerLoop);
    } catch (...) {
        gRenderWorkerRunning.store(false, std::memory_order_release);
    }
}

void stopRenderWorkerLocked() {
    gRenderWorkerRunning.store(false, std::memory_order_release);
    if (gRenderWorker.joinable()) gRenderWorker.join();
}

void updateRenderTargetLocked(int32_t framesPerBurst) {
    if (framesPerBurst <= 0) return;
    const int requestedBursts = std::max(gBufferBursts, 2);
    const int requestedFrames = framesPerBurst * requestedBursts;
    const int maximumFrames = static_cast<int>(kRenderRingCapacityFrames / 2);
    gRenderTargetFrames.store(
        std::clamp(requestedFrames, kRenderBlockFrames, maximumFrames),
        std::memory_order_relaxed);
}

void clearAudio(float* out, int32_t frames) {
    std::memset(out, 0, static_cast<size_t>(frames) * 2 * sizeof(float));
}

aaudio_data_callback_result_t audioCallback(AAudioStream*, void*, void* audioData, int32_t frames) {
    auto* out = static_cast<float*>(audioData);
    clearAudio(out, frames);
    const uint64_t readFrame = gRenderReadFrame.load(std::memory_order_relaxed);
    const uint64_t writeFrame = gRenderWriteFrame.load(std::memory_order_acquire);
    const size_t availableFrames = static_cast<size_t>(writeFrame - readFrame);
    const size_t framesToCopy = std::min(static_cast<size_t>(frames), availableFrames);
    if (framesToCopy > 0) {
        const size_t ringOffset = static_cast<size_t>(readFrame & kRenderRingMask);
        const size_t firstFrames = std::min(framesToCopy, kRenderRingCapacityFrames - ringOffset);
        std::memcpy(out, gRenderRing.data() + ringOffset * 2, firstFrames * 2 * sizeof(float));
        if (firstFrames < framesToCopy) {
            const size_t remainingFrames = framesToCopy - firstFrames;
            std::memcpy(out + firstFrames * 2, gRenderRing.data(), remainingFrames * 2 * sizeof(float));
        }
        gRenderReadFrame.store(readFrame + framesToCopy, std::memory_order_release);
        if (framesToCopy < static_cast<size_t>(frames)) {
            clearAudio(out + framesToCopy * 2, frames - static_cast<int32_t>(framesToCopy));
        }
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
    gAudioCommandsEnabled.store(false, std::memory_order_release);
    gAudioGeneration.fetch_add(1, std::memory_order_acq_rel);
    stopRenderWorkerLocked();
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
    if (opened != AAUDIO_OK || !gStream) {
        if (gStream) { AAudioStream_close(gStream); gStream = nullptr; }
        return false;
    }
    const int32_t burst = AAudioStream_getFramesPerBurst(gStream);
    if (burst > 0) {
        AAudioStream_setBufferSizeInFrames(gStream, burst * gBufferBursts);
        updateRenderTargetLocked(burst);
    }
    if (AAudioStream_requestStart(gStream) != AAUDIO_OK) {
        AAudioStream_close(gStream);
        gStream = nullptr;
        return false;
    }
    return true;
}

int32_t setBufferBurstsLocked(int bursts) {
    gBufferBursts = std::clamp(bursts, 1, 8);
    if (!gStream) return 0;
    const int32_t burst = AAudioStream_getFramesPerBurst(gStream);
    if (burst <= 0) return AAUDIO_ERROR_INTERNAL;
    const int32_t actualFrames = AAudioStream_setBufferSizeInFrames(gStream, burst * gBufferBursts);
    updateRenderTargetLocked(burst);
    return actualFrames;
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
    startRenderWorkerLocked();
    if (!gRenderWorkerRunning.load(std::memory_order_acquire)) {
        closeLocked();
        return JNI_FALSE;
    }
    gAudioCommandsEnabled.store(true, std::memory_order_release);
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
    // The UI persists 0 for Android's automatic route; AAudio uses -1 for that.
    gOutputDeviceId = deviceId <= 0 ? AAUDIO_UNSPECIFIED : deviceId;
    if (openAudioStreamLocked(gOutputDeviceId)) return JNI_TRUE;
    gOutputDeviceId = previous;
    openAudioStreamLocked(previous);
    return JNI_FALSE;
}

extern "C" JNIEXPORT jint JNICALL
Java_com_samnat_synth_NativeAudioEngine_nativeSetBufferBursts(JNIEnv*, jobject, jint bursts) {
    std::lock_guard<std::mutex> lock(gSynthMutex);
    return setBufferBurstsLocked(bursts);
}

extern "C" JNIEXPORT jint JNICALL
Java_com_samnat_synth_NativeAudioEngine_nativeGetFramesPerBurst(JNIEnv*, jobject) {
    std::lock_guard<std::mutex> lock(gSynthMutex);
    return gStream ? AAudioStream_getFramesPerBurst(gStream) : 0;
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
    queueAudioCommand(AudioCommandType::ProgramSelect, channel, std::max(0, bank), std::clamp(program, 0, 127));
}

extern "C" JNIEXPORT void JNICALL
Java_com_samnat_synth_NativeAudioEngine_nativeControlChange(JNIEnv*, jobject, jint channel, jint controller, jint value) {
    if (channel < 0 || channel >= kChannels) return;
    queueAudioCommand(AudioCommandType::ControlChange, channel,
                      std::clamp(controller, 0, 127), std::clamp(value, 0, 127));
}

extern "C" JNIEXPORT void JNICALL
Java_com_samnat_synth_NativeAudioEngine_nativeNoteOn(JNIEnv*, jobject, jint channel, jint note, jint velocity) {
    if (channel < 0 || channel >= kChannels) return;
    queueAudioCommand(AudioCommandType::NoteOn, channel,
                      std::clamp(note, 0, 127), std::clamp(velocity, 1, 127));
}

extern "C" JNIEXPORT void JNICALL
Java_com_samnat_synth_NativeAudioEngine_nativeNoteOff(JNIEnv*, jobject, jint channel, jint note) {
    if (channel < 0 || channel >= kChannels) return;
    queueAudioCommand(AudioCommandType::NoteOff, channel, std::clamp(note, 0, 127));
}

extern "C" JNIEXPORT void JNICALL
Java_com_samnat_synth_NativeAudioEngine_nativeAllNotesOff(JNIEnv*, jobject, jint channel) {
    if (channel < 0 || channel >= kChannels) return;
    queueAudioCommand(AudioCommandType::AllNotesOff, channel);
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
    queueAudioCommand(AudioCommandType::PitchBend, channel, std::clamp(value, 0, 16383));
}

extern "C" JNIEXPORT void JNICALL
Java_com_samnat_synth_NativeAudioEngine_nativeTestTone(JNIEnv*, jobject, jboolean enabled) {
    gTestTone.store(enabled == JNI_TRUE, std::memory_order_relaxed);
}
