package com.samnat.synth;

final class NativeAudioEngine {
    static { System.loadLibrary("samnat_audio"); }

    boolean start() { return nativeStart(); }
    void close() { nativeClose(); }
    String loadSoundFont(String path, int channel) { return nativeLoadSoundFont(path, channel); }
    void setProgram(int channel, int bank, int program) { nativeSetProgram(channel, bank, program); }
    void setVolume(int channel, int value) { nativeControlChange(channel, 7, percentToMidi(value)); }
    void setReverb(int channel, int value) { nativeControlChange(channel, 91, percentToMidi(value)); }
    void setChorus(int channel, int value) { nativeControlChange(channel, 93, percentToMidi(value)); }
    void setModulation(int channel, int value) { nativeControlChange(channel, 1, value); }
    void noteOn(int channel, int note, int velocity) { nativeNoteOn(channel, note, velocity); }
    void noteOff(int channel, int note) { nativeNoteOff(channel, note); }
    void allNotesOff(int channel) { nativeAllNotesOff(channel); }
    void clearChannel(int channel) { nativeClearChannel(channel); }
    void controlChange(int channel, int controller, int value) { nativeControlChange(channel, controller, value); }
    void pitchBend(int channel, int value) { nativePitchBend(channel, value); }
    void testTone(boolean enabled) { nativeTestTone(enabled); }
    boolean selectOutput(int deviceId) { return nativeSelectOutput(deviceId); }

    private static int percentToMidi(int percent) { return Math.max(0, Math.min(127, Math.round(percent * 127f / 100f))); }
    private native boolean nativeStart();
    private native boolean nativeSelectOutput(int deviceId);
    private native void nativeClose();
    private native String nativeLoadSoundFont(String path, int channel);
    private native void nativeSetProgram(int channel, int bank, int program);
    private native void nativeControlChange(int channel, int controller, int value);
    private native void nativeNoteOn(int channel, int note, int velocity);
    private native void nativeNoteOff(int channel, int note);
    private native void nativeAllNotesOff(int channel);
    private native void nativeClearChannel(int channel);
    private native void nativePitchBend(int channel, int value);
    private native void nativeTestTone(boolean enabled);
}
