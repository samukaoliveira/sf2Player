package com.samnat.synth;

final class SlotState {
    int channel;
    String soundFontPath = "";
    String soundFontName = "";
    String presetName = "";
    int bank = 0;
    int program = 0;
    int volume = 85;
    int reverb = 0;
    int chorus = 0;
    boolean modulationEnabled = false;
    Integer volumeCc = null;
    String controllerId = "";
    boolean loaded = false;
    boolean loading = false;
    String loadError = "";

    SlotState(int channel) { this.channel = channel; }

    SlotState copy() {
        SlotState result = new SlotState(channel);
        result.soundFontPath = soundFontPath;
        result.soundFontName = soundFontName;
        result.presetName = presetName;
        result.bank = bank;
        result.program = program;
        result.volume = volume;
        result.reverb = reverb;
        result.chorus = chorus;
        result.modulationEnabled = modulationEnabled;
        result.volumeCc = volumeCc;
        result.controllerId = controllerId;
        return result;
    }
}
