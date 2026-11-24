package com.samnat.synth;

import android.content.Context;
import android.media.midi.MidiDevice;
import android.media.midi.MidiDeviceInfo;
import android.media.midi.MidiManager;
import android.media.midi.MidiOutputPort;
import android.media.midi.MidiReceiver;
import android.os.Handler;
import android.os.Looper;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

final class AndroidMidiRouter {
    interface Listener {
        void onDevicesChanged(List<Device> devices);
        void onMidiMessage(String deviceId, int status, int data1, int data2, long timestamp);
    }

    static final class Device {
        final String id;
        final String name;
        Device(String id, String name) { this.id = id; this.name = name; }
        @Override public String toString() { return name; }
    }

    private static final class OpenDevice {
        final MidiDevice device;
        final List<MidiOutputPort> outputs = new ArrayList<>();
        OpenDevice(MidiDevice device) { this.device = device; }
    }

    private interface MessageSink {
        void onMessage(int status, int data1, int data2);
    }

    /** Parses channel messages across callback boundaries without retaining/copying Android's byte array. */
    private static final class MidiStreamParser {
        private int runningStatus = -1;
        private int messageStatus = -1;
        private int dataNeeded;
        private int dataCount;
        private int firstData;

        void accept(byte[] bytes, int offset, int count, MessageSink sink) {
            int end = offset + count;
            for (int i = offset; i < end; i++) {
                int value = bytes[i] & 0xff;
                if (value >= 0xf8) continue; // Real-time bytes may be interleaved anywhere.
                if ((value & 0x80) != 0) {
                    if (value >= 0xf0) {
                        runningStatus = messageStatus = -1;
                        dataNeeded = dataCount = 0;
                        continue;
                    }
                    runningStatus = messageStatus = value;
                    dataNeeded = ((value & 0xf0) == 0xc0 || (value & 0xf0) == 0xd0) ? 1 : 2;
                    dataCount = 0;
                    continue;
                }
                if (messageStatus < 0) {
                    if (runningStatus < 0) continue;
                    messageStatus = runningStatus;
                    dataNeeded = ((messageStatus & 0xf0) == 0xc0 || (messageStatus & 0xf0) == 0xd0) ? 1 : 2;
                    dataCount = 0;
                }
                if (dataCount == 0) firstData = value & 0x7f;
                dataCount++;
                if (dataCount >= dataNeeded) {
                    sink.onMessage(messageStatus, firstData, dataNeeded == 2 ? value & 0x7f : 0);
                    messageStatus = runningStatus;
                    dataCount = 0;
                }
            }
        }
    }

    private final MidiManager manager;
    private final Listener listener;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Map<String, OpenDevice> opened = new HashMap<>();
    private final MidiManager.DeviceCallback callback;

    AndroidMidiRouter(Context context, Listener listener) {
        this.listener = listener;
        manager = (MidiManager) context.getSystemService(Context.MIDI_SERVICE);
        callback = new MidiManager.DeviceCallback() {
            @Override public void onDeviceAdded(MidiDeviceInfo info) { open(info); publish(); }
            @Override public void onDeviceRemoved(MidiDeviceInfo info) { close(String.valueOf(info.getId())); publish(); }
        };
    }

    void start() {
        if (manager == null) return;
        try {
            manager.registerDeviceCallback(callback, handler);
            for (MidiDeviceInfo info : manager.getDevices()) open(info);
            publish();
        } catch (SecurityException ignored) { }
    }

    void stop() {
        if (manager == null) return;
        manager.unregisterDeviceCallback(callback);
        for (String id : new ArrayList<>(opened.keySet())) close(id);
    }

    List<Device> devices() {
        if (manager == null) return Collections.emptyList();
        List<Device> result = new ArrayList<>();
        MidiDeviceInfo[] infos;
        try { infos = manager.getDevices(); } catch (SecurityException ignored) { return result; }
        for (MidiDeviceInfo info : infos) {
            if (info.getOutputPortCount() == 0) continue;
            String name = info.getProperties().getString(MidiDeviceInfo.PROPERTY_NAME);
            if (name == null || name.trim().isEmpty()) name = "Controlador MIDI " + info.getId();
            result.add(new Device(String.valueOf(info.getId()), name));
        }
        return result;
    }

    private void publish() { handler.post(() -> listener.onDevicesChanged(devices())); }

    private void open(MidiDeviceInfo info) {
        if (manager == null || info.getOutputPortCount() == 0) return;
        String id = String.valueOf(info.getId());
        if (opened.containsKey(id)) return;
        try { manager.openDevice(info, device -> {
            if (device == null) return;
            OpenDevice connection = new OpenDevice(device);
            for (int port = 0; port < info.getOutputPortCount(); port++) {
                MidiOutputPort output = device.openOutputPort(port);
                if (output == null) continue;
                MidiStreamParser parser = new MidiStreamParser();
                output.connect(new MidiReceiver() {
                    @Override public void onSend(byte[] data, int offset, int count, long timestamp) throws IOException {
                        parser.accept(data, offset, count, (status, data1, data2) ->
                            listener.onMidiMessage(id, status, data1, data2, timestamp));
                    }
                });
                connection.outputs.add(output);
            }
            synchronized (opened) { opened.put(id, connection); }
            publish();
        }, handler); } catch (SecurityException ignored) { }
    }

    private void close(String id) {
        OpenDevice connection;
        synchronized (opened) { connection = opened.remove(id); }
        if (connection == null) return;
        for (MidiOutputPort output : connection.outputs) {
            try { output.close(); } catch (IOException ignored) { }
        }
        try { connection.device.close(); } catch (IOException ignored) { }
    }
}
