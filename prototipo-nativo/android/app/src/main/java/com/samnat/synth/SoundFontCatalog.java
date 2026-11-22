package com.samnat.synth;

import android.content.Context;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

final class SoundFontCatalog {
    static final class Item {
        final String name;
        final String file;
        final String category;
        Item(String name, String file, String category) {
            this.name = name;
            this.file = file;
            this.category = category;
        }
        @Override public String toString() { return category + " · " + name; }
    }

    static List<Item> read(Context context) {
        List<Item> result = new ArrayList<>();
        try (InputStream input = context.getAssets().open("soundfont-catalog.json")) {
            byte[] bytes = new byte[input.available()];
            int offset = 0;
            while (offset < bytes.length) {
                int read = input.read(bytes, offset, bytes.length - offset);
                if (read <= 0) break;
                offset += read;
            }
            JSONArray entries = new JSONArray(new String(bytes, StandardCharsets.UTF_8));
            for (int i = 0; i < entries.length(); i++) {
                JSONObject item = entries.optJSONObject(i);
                if (item == null) continue;
                result.add(new Item(item.optString("name"), item.optString("file"), item.optString("category")));
            }
        } catch (Exception ignored) { }
        return result;
    }
}
