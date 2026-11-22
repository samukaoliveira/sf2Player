package com.samnat.synth;

import java.util.ArrayList;
import java.util.List;

final class SynthScene {
    String name;
    Integer midiChannel;
    Integer midiNote;
    List<SlotState> slots = new ArrayList<>();

    SynthScene(String name) { this.name = name; }
}
