package com.samnat.synth;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

final class SceneStore {
    static final int MAX_SLOTS = 8;
    private static final String PREFS = "samnat-scenes-v1";
    private static final String SCENES = "scenes";
    private final SharedPreferences preferences;

    SceneStore(Context context) {
        preferences = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        if (read().isEmpty()) {
            List<SynthScene> scenes = new ArrayList<>();
            scenes.add(defaultScene());
            write(scenes);
        }
    }

    synchronized List<SynthScene> read() {
        List<SynthScene> result = new ArrayList<>();
        try {
            JSONArray scenes = new JSONArray(preferences.getString(SCENES, "[]"));
            for (int i = 0; i < scenes.length(); i++) {
                JSONObject item = scenes.optJSONObject(i);
                if (item == null) continue;
                SynthScene scene = new SynthScene(item.optString("name", "Cena"));
                if (item.has("midiChannel") && !item.isNull("midiChannel")) scene.midiChannel = item.optInt("midiChannel");
                if (item.has("midiNote") && !item.isNull("midiNote")) scene.midiNote = item.optInt("midiNote");
                JSONArray slots = item.optJSONArray("slots");
                if (slots != null) for (int j = 0; j < slots.length() && j < MAX_SLOTS; j++) {
                    JSONObject data = slots.optJSONObject(j);
                    if (data == null) continue;
                    SlotState slot = new SlotState(j);
                    slot.soundFontPath = data.optString("soundFontPath", "");
                    slot.soundFontName = data.optString("soundFontName", "");
                    slot.presetName = data.optString("presetName", "");
                    slot.bank = data.optInt("bank", 0);
                    slot.program = data.optInt("program", 0);
                    slot.volume = data.optInt("volume", j == 0 ? 100 : 0);
                    slot.reverb = data.optInt("reverb", 0);
                    slot.chorus = data.optInt("chorus", 0);
                    slot.modulationEnabled = data.optBoolean("modulationEnabled", false);
                    slot.controllerId = data.optString("controllerId", "");
                    if (data.has("volumeCc") && !data.isNull("volumeCc")) slot.volumeCc = data.optInt("volumeCc");
                    scene.slots.add(slot);
                }
                result.add(scene);
            }
        } catch (Exception ignored) { }
        return result;
    }

    synchronized void write(List<SynthScene> scenes) {
        JSONArray json = new JSONArray();
        try {
            for (SynthScene scene : scenes) {
                JSONObject item = new JSONObject();
                item.put("name", scene.name);
                item.put("midiChannel", scene.midiChannel);
                item.put("midiNote", scene.midiNote);
                JSONArray slots = new JSONArray();
                for (SlotState slot : scene.slots) {
                    JSONObject data = new JSONObject();
                    data.put("soundFontPath", slot.soundFontPath);
                    data.put("soundFontName", slot.soundFontName);
                    data.put("presetName", slot.presetName);
                    data.put("bank", slot.bank);
                    data.put("program", slot.program);
                    data.put("volume", slot.volume);
                    data.put("reverb", slot.reverb);
                    data.put("chorus", slot.chorus);
                    data.put("modulationEnabled", slot.modulationEnabled);
                    data.put("controllerId", slot.controllerId);
                    data.put("volumeCc", slot.volumeCc);
                    slots.put(data);
                }
                item.put("slots", slots);
                json.put(item);
            }
        } catch (Exception ignored) { }
        preferences.edit().putString(SCENES, json.toString()).apply();
    }

    static SynthScene defaultScene() {
        SynthScene scene = new SynthScene("Inicial · 8 timbres");
        String[][] defaults = {
            {"Pianos/k-pc88.sf2", "0", "0"},
            {"Pads/General_Montage_Pads_Warm.sf2", "0", "89"},
            {"Strings e Brass/General_Montage_Strings_Section.sf2", "0", "48"},
            {"Organs/General_Montage_Organs_Drawbar.sf2", "0", "16"},
            {"Pianos/General_Montage_DX7.sf2", "0", "5"},
            {"Synths/General_Montage_Leads.sf2", "0", "81"},
            {"General_Montage_Bells.sf2", "0", "6"},
            {"Bells e FX/General_Montage_FX.sf2", "0", "96"}
        };
        for (int i = 0; i < defaults.length; i++) {
            SlotState slot = new SlotState(i);
            slot.soundFontPath = ""; // Paths are populated by SF2 import; never hard-code a Linux path.
            slot.soundFontName = defaults[i][0].substring(defaults[i][0].lastIndexOf('/') + 1);
            slot.bank = Integer.parseInt(defaults[i][1]);
            slot.program = Integer.parseInt(defaults[i][2]);
            slot.volume = i == 0 ? 100 : 0;
            scene.slots.add(slot);
        }
        return scene;
    }
}
