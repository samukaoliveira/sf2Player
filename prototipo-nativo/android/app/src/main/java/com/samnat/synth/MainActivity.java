package com.samnat.synth;

import android.app.Activity;
import android.app.ActivityManager;
import android.app.AlertDialog;
import android.app.admin.DevicePolicyManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.media.AudioManager;
import android.media.AudioDeviceInfo;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.net.Uri;
import android.os.BatteryManager;
import android.os.Bundle;
import android.os.Debug;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.provider.OpenableColumns;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.SeekBar;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class MainActivity extends Activity {
    private static final int PICK_SOUNDFONT = 4102;
    private static final int REQUEST_BLUETOOTH_MIDI = 4103;
    private static final int MAX_SLOTS = 8;
    private static final int BG = Color.rgb(247, 248, 250);
    private static final int INK = Color.rgb(34, 46, 64);
    private static final int BLUE = Color.rgb(24, 116, 232);

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final ExecutorService audioQueue = Executors.newSingleThreadExecutor();
    private final ExecutorService fileQueue = Executors.newSingleThreadExecutor();
    private final NativeAudioEngine engine = new NativeAudioEngine();
    private final List<SlotState> slots = new ArrayList<>();
    private final Map<String, Set<Integer>> heldMidiChannels = new HashMap<>();
    private final Set<Integer> activeUiNotes = new HashSet<>();
    private SceneStore sceneStore;
    private AndroidMidiRouter midiRouter;
    private AudioManager audioManager;
    private AudioFocusRequest audioFocusRequest;
    private List<AndroidMidiRouter.Device> midiDevices = new ArrayList<>();
    private String defaultMidiId = "";
    private String currentSceneName = "";
    private String pendingSceneLearn = "";
    private int pendingVolumeLearnChannel = -1;
    private int importSlot = -1;
    private boolean midiChannelRouting = false;
    private boolean engineReady = false;
    private boolean lowBatteryWarningShown = false;
    private long lastCpuTime = 0;
    private long lastWallTime = 0;
    private double appCpuPercent = 0;

    private LinearLayout root;
    private LinearLayout slotList;
    private LinearLayout scenePadList;
    private EditText sceneNameInput;
    private Spinner sceneSelector;
    private Spinner globalMidiSpinner;
    private Spinner routeSpinner;
    private TextView statusView;
    private TextView systemView;
    private TextView batteryView;
    private TextView midiStatusView;
    private TextView slotCountView;
    private PianoView pianoView;
    private long lastCpuWallTime;
    private long lastCpuProcessTime;

    private final BroadcastReceiver batteryReceiver = new BroadcastReceiver() {
        @Override public void onReceive(Context context, Intent intent) {
            if (intent == null) return;
            int level = intent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1);
            int scale = intent.getIntExtra(BatteryManager.EXTRA_SCALE, 100);
            int status = intent.getIntExtra(BatteryManager.EXTRA_STATUS, BatteryManager.BATTERY_STATUS_UNKNOWN);
            int percent = scale > 0 ? Math.round(level * 100f / scale) : level;
            boolean charging = status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL;
            batteryViewUpdate(percent, charging);
            if (percent >= 20 || charging) lowBatteryWarningShown = false;
            if (percent >= 0 && percent < 20 && !charging && !lowBatteryWarningShown) {
                lowBatteryWarningShown = true;
                new AlertDialog.Builder(MainActivity.this).setTitle("Bateria baixa")
                    .setMessage("A carga está abaixo de 20%. Conecte o carregador.")
                    .setPositiveButton("OK", null).show();
            }
        }
    };

    private final Runnable monitorTask = new Runnable() {
        @Override public void run() {
            long wall = SystemClock.elapsedRealtime();
            long cpu = android.os.Process.getElapsedCpuTime();
            if (lastCpuWallTime > 0 && wall > lastCpuWallTime) {
                appCpuPercent = Math.max(0, Math.min(100, (cpu - lastCpuProcessTime) * 100.0 / (wall - lastCpuWallTime)));
            }
            lastCpuWallTime = wall;
            lastCpuProcessTime = cpu;
            ActivityManager.MemoryInfo memory = new ActivityManager.MemoryInfo();
            ((ActivityManager) getSystemService(ACTIVITY_SERVICE)).getMemoryInfo(memory);
            long appMb = Debug.getPss() / 1024;
            long totalMb = memory.totalMem / (1024 * 1024);
            long freeMb = memory.availMem / (1024 * 1024);
            if (systemView != null) systemView.setText(String.format(Locale.getDefault(), "CPU %.0f%%  ·  RAM %d%% (%d MB app)", appCpuPercent, totalMb == 0 ? 0 : (totalMb - freeMb) * 100 / totalMb, appMb));
            handler.postDelayed(this, 5000);
        }
    };

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_LAYOUT_STABLE |
            View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        Window window = getWindow();
        window.setStatusBarColor(BG);
        window.setNavigationBarColor(BG);
        window.getDecorView().setSystemUiVisibility(window.getDecorView().getSystemUiVisibility() | View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);

        sceneStore = new SceneStore(this);
        setVolumeControlStream(AudioManager.STREAM_MUSIC);
        audioManager = (AudioManager) getSystemService(AUDIO_SERVICE);
        requestInstrumentAudioFocus();
        buildUi();
        midiRouter = new AndroidMidiRouter(this, new AndroidMidiRouter.Listener() {
            @Override public void onDevicesChanged(List<AndroidMidiRouter.Device> devices) {
                midiDevices = devices;
                boolean defaultStillConnected = false;
                for (AndroidMidiRouter.Device device : devices) if (device.id.equals(defaultMidiId)) defaultStillConnected = true;
                if (!defaultStillConnected) defaultMidiId = devices.isEmpty() ? "" : devices.get(0).id;
                refreshMidiControls();
                refreshSlots();
                updateMidiStatus();
            }
            @Override public void onMidiMessage(String id, byte[] bytes, int offset, int count) {
                handleMidi(id, bytes, offset, count);
            }
        });
        startMidiWithPermission();
        registerReceiver(batteryReceiver, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
        handler.post(monitorTask);

        // Respect the user's existing media volume after the first launch;
        // initialize to the requested 30% once, then leave their choice alone.
        if (!getPreferences(MODE_PRIVATE).getBoolean("initial-volume-set", false)) {
            audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, Math.max(1, Math.round(audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC) * 0.30f)), 0);
            getPreferences(MODE_PRIVATE).edit().putBoolean("initial-volume-set", true).apply();
        }
        audioQueue.execute(() -> {
            boolean started = engine.start();
            if (started) {
                int preferredOutput = getPreferences(MODE_PRIVATE).getInt("audio-output-id", 0);
                if (preferredOutput != 0) engine.selectOutput(preferredOutput);
            }
            runOnUiThread(() -> {
                engineReady = started;
                setStatus(started ? "Áudio pronto · FluidSynth nativo / AAudio" : "Falha ao abrir AAudio neste dispositivo.");
                if (started) loadInitialScene();
            });
        });
    }

    private void buildUi() {
        boolean landscape = getResources().getConfiguration().orientation == android.content.res.Configuration.ORIENTATION_LANDSCAPE;
        root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(BG);
        root.setPadding(dp(10), dp(5), dp(10), dp(6));
        setContentView(root);
        root.addView(buildHeader(), new LinearLayout.LayoutParams(-1, dp(landscape ? 46 : 62)));
        root.addView(buildMidiBar(landscape), new LinearLayout.LayoutParams(-1, dp(landscape ? 46 : 82)));

        LinearLayout workArea = new LinearLayout(this);
        workArea.setOrientation(landscape ? LinearLayout.HORIZONTAL : LinearLayout.VERTICAL);
        LinearLayout.LayoutParams workParams = new LinearLayout.LayoutParams(-1, 0, 1);
        workParams.topMargin = dp(6);
        workParams.bottomMargin = dp(6);
        root.addView(workArea, workParams);

        if (landscape) {
            ScrollView slotScroll = scroll(buildSlotsPanel());
            ScrollView sceneScroll = scroll(buildScenePanel());
            workArea.addView(slotScroll, new LinearLayout.LayoutParams(0, -1, 1.45f));
            LinearLayout.LayoutParams sceneParams = new LinearLayout.LayoutParams(0, -1, 1f);
            sceneParams.leftMargin = dp(7);
            workArea.addView(sceneScroll, sceneParams);
            root.addView(buildPianoPanel(), new LinearLayout.LayoutParams(-1, dp(145)));
        } else {
            ScrollView mainScroll = new ScrollView(this);
            mainScroll.setFillViewport(false);
            LinearLayout contents = new LinearLayout(this);
            contents.setOrientation(LinearLayout.VERTICAL);
            contents.addView(buildScenePanel());
            contents.addView(buildSlotsPanel());
            mainScroll.addView(contents);
            workArea.addView(mainScroll, new LinearLayout.LayoutParams(-1, -1));
            root.addView(buildPianoPanel(), new LinearLayout.LayoutParams(-1, dp(170)));
        }
        refreshSceneControls();
        refreshMidiControls();
        refreshSlots();
        Intent battery = registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
        if (battery != null) batteryReceiver.onReceive(this, battery);
    }

    @Override public void onConfigurationChanged(android.content.res.Configuration configuration) {
        super.onConfigurationChanged(configuration);
        buildUi();
    }

    private View buildHeader() {
        boolean landscape = getResources().getConfiguration().orientation == android.content.res.Configuration.ORIENTATION_LANDSCAPE;
        LinearLayout bar = new LinearLayout(this);
        bar.setOrientation(LinearLayout.VERTICAL);
        LinearLayout titleRow = new LinearLayout(this);
        titleRow.setGravity(Gravity.CENTER_VERTICAL);
        ImageView logo = new ImageView(this);
        logo.setImageResource(R.drawable.samnat_logo);
        logo.setScaleType(ImageView.ScaleType.FIT_CENTER);
        titleRow.addView(logo, new LinearLayout.LayoutParams(dp(36), dp(36)));
        TextView title = text("SamNat Synth", 18, INK, true);
        LinearLayout.LayoutParams titleParams = landscape
            ? new LinearLayout.LayoutParams(dp(132), -2)
            : new LinearLayout.LayoutParams(0, -2, 1);
        titleParams.leftMargin = dp(7);
        titleRow.addView(title, titleParams);
        statusView = text("Iniciando áudio…", 10, 0xff475467, false);
        statusView.setMaxLines(1);
        statusView.setEllipsize(android.text.TextUtils.TruncateAt.END);
        systemView = text("CPU -- · RAM --", 10, 0xff475467, true);
        if (landscape) {
            addWeighted(titleRow, statusView, 1.3f, dp(40), dp(7));
            LinearLayout.LayoutParams systemParams = new LinearLayout.LayoutParams(dp(155), dp(40));
            systemParams.leftMargin = dp(6);
            titleRow.addView(systemView, systemParams);
        }
        batteryView = text("🔋 --%", 12, INK, true);
        titleRow.addView(batteryView);
        Button exit = button("⏻", "Sair do app", this::confirmExit);
        LinearLayout.LayoutParams exitParams = new LinearLayout.LayoutParams(dp(42), dp(40));
        exitParams.leftMargin = dp(6);
        titleRow.addView(exit, exitParams);
        bar.addView(titleRow, new LinearLayout.LayoutParams(-1, dp(landscape ? 42 : 38)));

        if (landscape) return bar;

        LinearLayout infoRow = new LinearLayout(this);
        infoRow.setGravity(Gravity.CENTER_VERTICAL);
        infoRow.addView(statusView, new LinearLayout.LayoutParams(0, -1, 1.45f));
        systemView.setText("CPU --  ·  RAM --");
        systemView.setGravity(Gravity.RIGHT | Gravity.CENTER_VERTICAL);
        infoRow.addView(systemView, new LinearLayout.LayoutParams(0, -1, 1));
        bar.addView(infoRow, new LinearLayout.LayoutParams(-1, 0, 1));
        return bar;
    }

    private View buildMidiBar(boolean landscape) {
        LinearLayout panel = panel();
        panel.setPadding(dp(7), dp(3), dp(7), dp(3));
        if (landscape) panel.setOrientation(LinearLayout.HORIZONTAL);
        else panel.setOrientation(LinearLayout.VERTICAL);
        globalMidiSpinner = new Spinner(this);
        routeSpinner = new Spinner(this);
        Button connect = button("✓", "Usar controlador selecionado como padrão", () -> {
            if (globalMidiSpinner.getSelectedItem() instanceof AndroidMidiRouter.Device) {
                AndroidMidiRouter.Device device = (AndroidMidiRouter.Device) globalMidiSpinner.getSelectedItem();
                defaultMidiId = device.id;
                updateMidiStatus();
                refreshSlots();
            }
        });
        Button audioTest = button("♫", "Teste de áudio 440 Hz", this::runAudioTest);
        Button output = button("⇧", "Selecionar saída de áudio Android", this::chooseAudioOutput);
        midiStatusView = text("MIDI: buscando…", 10, 0xff667085, false);
        if (landscape) {
            panel.addView(text("MIDI", 13, INK, true));
            addWeighted(panel, globalMidiSpinner, 1.25f, dp(40), dp(7));
            addWeighted(panel, routeSpinner, 1.05f, dp(40), dp(5));
            panel.addView(connect, new LinearLayout.LayoutParams(dp(42), dp(40)));
            addLeft(panel, audioTest, dp(4));
            addLeft(panel, output, dp(4));
            midiStatusView.setMaxLines(1);
            midiStatusView.setEllipsize(android.text.TextUtils.TruncateAt.END);
            addWeighted(panel, midiStatusView, 0.9f, dp(40), dp(7));
        } else {
            LinearLayout row1 = new LinearLayout(this);
            row1.setGravity(Gravity.CENTER_VERTICAL);
            row1.addView(text("MIDI", 13, INK, true));
            addWeighted(row1, globalMidiSpinner, 1, dp(36), dp(5));
            row1.addView(connect, new LinearLayout.LayoutParams(dp(42), dp(36)));
            panel.addView(row1, new LinearLayout.LayoutParams(-1, dp(36)));
            LinearLayout row2 = new LinearLayout(this);
            row2.setGravity(Gravity.CENTER_VERTICAL);
            addWeighted(row2, routeSpinner, 1, dp(36), 0);
            addLeft(row2, audioTest, dp(4));
            addLeft(row2, output, dp(4));
            addWeighted(row2, midiStatusView, 1.15f, dp(36), dp(5));
            panel.addView(row2, new LinearLayout.LayoutParams(-1, dp(36)));
        }
        return panel;
    }

    private void addWeighted(LinearLayout row, View view, float weight, int height, int leftMargin) {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(0, height, weight);
        if (leftMargin > 0) params.leftMargin = leftMargin;
        row.addView(view, params);
    }

    private void addLeft(LinearLayout row, View view, int leftMargin) {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(dp(42), -1);
        params.leftMargin = leftMargin;
        row.addView(view, params);
    }

    private View buildSlotsPanel() {
        LinearLayout panel = panel();
        LinearLayout heading = new LinearLayout(this);
        heading.setGravity(Gravity.CENTER_VERTICAL);
        slotCountView = text("Instrumentos · 1/8", 15, INK, true);
        heading.addView(slotCountView, new LinearLayout.LayoutParams(0, -2, 1));
        heading.addView(button("＋ Timbre", "Adicionar uma parte", this::addSlot));
        panel.addView(heading);
        slotList = new LinearLayout(this);
        slotList.setOrientation(LinearLayout.VERTICAL);
        LinearLayout.LayoutParams listParams = new LinearLayout.LayoutParams(-1, -2);
        listParams.topMargin = dp(7);
        panel.addView(slotList, listParams);
        return panel;
    }

    private View buildScenePanel() {
        LinearLayout panel = panel();
        panel.addView(text("Cenas", 15, INK, true));
        sceneNameInput = new EditText(this);
        sceneNameInput.setSingleLine(true);
        sceneNameInput.setTextSize(14);
        sceneNameInput.setHint("Nome da cena");
        sceneNameInput.setText(currentSceneName);
        LinearLayout.LayoutParams nameParams = new LinearLayout.LayoutParams(-1, dp(44));
        nameParams.topMargin = dp(6);
        panel.addView(sceneNameInput, nameParams);
        LinearLayout actions = new LinearLayout(this);
        actions.addView(button("💾 Salvar", "Salvar cena", this::saveScene), new LinearLayout.LayoutParams(0, dp(42), 1));
        LinearLayout.LayoutParams newParams = new LinearLayout.LayoutParams(0, dp(42), 1);
        newParams.leftMargin = dp(6);
        actions.addView(button("＋ Nova", "Criar cena vazia com um slot", this::newScene), newParams);
        panel.addView(actions);
        TextView padsTitle = text("Acesso rápido · MIDI Learn por cena", 12, 0xff475467, true);
        LinearLayout.LayoutParams padsTitleParams = new LinearLayout.LayoutParams(-1, -2);
        padsTitleParams.topMargin = dp(8);
        panel.addView(padsTitle, padsTitleParams);
        scenePadList = new LinearLayout(this);
        scenePadList.setOrientation(LinearLayout.VERTICAL);
        panel.addView(scenePadList);
        sceneSelector = new Spinner(this);
        LinearLayout.LayoutParams selectorParams = new LinearLayout.LayoutParams(-1, dp(42));
        selectorParams.topMargin = dp(5);
        panel.addView(sceneSelector, selectorParams);
        LinearLayout sceneActions = new LinearLayout(this);
        sceneActions.addView(button("▶ Carregar", "Carregar cena selecionada", () -> {
            Object selected = sceneSelector.getSelectedItem();
            if (selected != null) loadScene(((SceneChoice) selected).name);
        }), new LinearLayout.LayoutParams(0, dp(42), 1));
        LinearLayout.LayoutParams deleteParams = new LinearLayout.LayoutParams(0, dp(42), 1);
        deleteParams.leftMargin = dp(6);
        sceneActions.addView(button("⌫ Remover", "Remover cena selecionada", this::deleteSelectedScene), deleteParams);
        panel.addView(sceneActions);
        panel.addView(text("SoundFonts", 14, INK, true), topMargin(dp(10)));
        TextView importHelp = text("Importe arquivos SF2 pelo seletor do Android. Os arquivos ficam no armazenamento do app.", 11, 0xff667085, false);
        panel.addView(importHelp);
        panel.addView(button("＋ Importar arquivo SF2", "Importar SoundFont do armazenamento do Android", () -> chooseSoundFont(-1)), topMargin(dp(5)));
        panel.addView(button("☁ Baixar do catálogo", "Baixar SoundFont do catálogo do SamNat", this::openSoundFontCatalog), topMargin(dp(4)));
        return panel;
    }

    private View buildPianoPanel() {
        LinearLayout panel = panel();
        panel.setPadding(dp(9), dp(5), dp(9), dp(6));
        TextView title = text("Teclado virtual · 5 oitavas · C2–B6", 12, INK, true);
        panel.addView(title);
        pianoView = new PianoView(this, new PianoView.NoteListener() {
            @Override public void noteOn(int note) {
                activeUiNotes.add(note);
                pianoView.setNoteActive(note, true);
                sendNoteToActiveSlots(note, 100);
                setStatus("Nota " + noteName(note) + " · teclado virtual");
            }
            @Override public void noteOff(int note) {
                activeUiNotes.remove(note);
                pianoView.setNoteActive(note, false);
                for (SlotState slot : slots) if (slot.loaded) engine.noteOff(slot.channel, note);
            }
        });
        LinearLayout.LayoutParams keysParams = new LinearLayout.LayoutParams(-1, 0, 1);
        keysParams.topMargin = dp(4);
        panel.addView(pianoView, keysParams);
        return panel;
    }

    private ScrollView scroll(View child) {
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(false);
        scroll.addView(child);
        return scroll;
    }

    private LinearLayout panel() {
        LinearLayout view = new LinearLayout(this);
        view.setOrientation(LinearLayout.VERTICAL);
        view.setPadding(dp(10), dp(8), dp(10), dp(9));
        view.setBackground(round(0xffffffff, 0xffe1e5eb, 10));
        return view;
    }

    private LinearLayout horizontalPanel() {
        LinearLayout view = panel();
        view.setOrientation(LinearLayout.HORIZONTAL);
        view.setGravity(Gravity.CENTER_VERTICAL);
        view.setPadding(dp(8), dp(3), dp(8), dp(3));
        return view;
    }

    private void refreshSlots() {
        if (slotList == null) return;
        slotList.removeAllViews();
        if (slotCountView != null) slotCountView.setText("Instrumentos · " + slots.size() + "/" + MAX_SLOTS + " partes");
        for (SlotState slot : slots) slotList.addView(buildSlotCard(slot), spacedParams(dp(6)));
    }

    private View buildSlotCard(SlotState slot) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(9), dp(7), dp(9), dp(8));
        card.setBackground(round(Color.WHITE, 0xffe1e5eb, 9));
        LinearLayout header = new LinearLayout(this);
        header.setGravity(Gravity.CENTER_VERTICAL);
        header.addView(text(categoryIcon(slot.soundFontName) + "  Parte " + (slot.channel + 1), 13, INK, true), new LinearLayout.LayoutParams(0, -2, 1));
        header.addView(button("♫ Testar", "Tocar uma nota de teste nesta parte", () -> {
            if (!slot.loaded) { chooseSoundFont(slot.channel); return; }
            engine.noteOn(slot.channel, 60, 95);
            handler.postDelayed(() -> engine.noteOff(slot.channel, 60), 700);
        }));
        if (slots.size() > 1) {
            LinearLayout.LayoutParams removeParams = new LinearLayout.LayoutParams(dp(38), dp(36));
            removeParams.leftMargin = dp(5);
            header.addView(button("−", "Remover esta parte", () -> removeSlot(slot.channel)), removeParams);
        }
        card.addView(header);

        LinearLayout fileLine = new LinearLayout(this);
        fileLine.setGravity(Gravity.CENTER_VERTICAL);
        TextView fileName = text(slot.loaded ? slot.soundFontName : (slot.soundFontName.isEmpty() ? "Sem SoundFont" : slot.soundFontName + " · não importado"), 12, slot.loaded ? 0xff344054 : 0xff667085, false);
        fileLine.addView(fileName, new LinearLayout.LayoutParams(0, -2, 1));
        fileLine.addView(button("Abrir SF2", "Selecionar SoundFont para esta parte", () -> chooseSoundFont(slot.channel)));
        LinearLayout.LayoutParams fileParams = new LinearLayout.LayoutParams(-1, -2);
        fileParams.topMargin = dp(4);
        card.addView(fileLine, fileParams);

        Spinner presetSpinner = new Spinner(this);
        presetSpinner.setEnabled(slot.loaded);
        List<String> presets = slot.loaded ? readPresetList(slot) : new ArrayList<>();
        if (presets.isEmpty()) presets.add("Banco " + slot.bank + " · Programa " + slot.program);
        ArrayAdapter<String> presetAdapter = new ArrayAdapter<>(this, android.R.layout.simple_spinner_item, presets);
        presetAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        presetSpinner.setAdapter(presetAdapter);
        int selectedPreset = presets.indexOf(slot.presetName);
        if (selectedPreset < 0 && slot.loaded) {
            for (int i = 0; i < presets.size(); i++) if (presets.get(i).startsWith(slot.bank + "-" + slot.program + " ·")) { selectedPreset = i; break; }
        }
        if (selectedPreset >= 0) presetSpinner.setSelection(selectedPreset);
        presetSpinner.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener() {
            @Override public void onItemSelected(android.widget.AdapterView<?> parent, View view, int position, long id) {
                if (!slot.loaded) return;
                int[] selected = parsePreset(presets.get(position));
                slot.bank = selected[0]; slot.program = selected[1];
                slot.presetName = presets.get(position);
                engine.setProgram(slot.channel, slot.bank, slot.program);
            }
            @Override public void onNothingSelected(android.widget.AdapterView<?> parent) { }
        });
        card.addView(presetSpinner, new LinearLayout.LayoutParams(-1, dp(40)));

        Spinner librarySpinner = new Spinner(this);
        List<SoundFontChoice> library = soundFontChoices();
        ArrayAdapter<SoundFontChoice> libraryAdapter = new ArrayAdapter<>(this, android.R.layout.simple_spinner_item, library);
        libraryAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        librarySpinner.setAdapter(libraryAdapter);
        int librarySelection = 0;
        for (int i = 1; i < library.size(); i++) if (library.get(i).file.getAbsolutePath().equals(slot.soundFontPath)) librarySelection = i;
        librarySpinner.setSelection(librarySelection);
        librarySpinner.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener() {
            @Override public void onItemSelected(android.widget.AdapterView<?> parent, View view, int position, long id) {
                if (position <= 0 || position >= library.size()) return;
                SoundFontChoice selected = library.get(position);
                if (selected.file.getAbsolutePath().equals(slot.soundFontPath)) return;
                slot.soundFontPath = selected.file.getAbsolutePath();
                slot.soundFontName = selected.file.getName();
                slot.loadError = "";
                if (engineReady) loadSoundFont(slot, true);
                refreshSlots();
            }
            @Override public void onNothingSelected(android.widget.AdapterView<?> parent) { }
        });
        LinearLayout.LayoutParams libraryParams = new LinearLayout.LayoutParams(-1, dp(38));
        libraryParams.topMargin = dp(2);
        card.addView(librarySpinner, libraryParams);

        card.addView(controlRow("Volume " + slot.volume + "%", slot.volume, value -> {
            slot.volume = value;
            if (slot.loaded) engine.setVolume(slot.channel, value);
        }));
        card.addView(controlRow("Reverb " + slot.reverb + "%", slot.reverb, value -> {
            slot.reverb = value;
            if (slot.loaded) engine.setReverb(slot.channel, value);
        }));
        card.addView(controlRow("Chorus " + slot.chorus + "%", slot.chorus, value -> {
            slot.chorus = value;
            if (slot.loaded) engine.setChorus(slot.channel, value);
        }));

        LinearLayout options = new LinearLayout(this);
        options.setGravity(Gravity.CENTER_VERTICAL);
        CheckBox modulation = new CheckBox(this);
        modulation.setText("Modulação");
        modulation.setTextSize(11);
        modulation.setChecked(slot.modulationEnabled);
        modulation.setOnCheckedChangeListener((button, checked) -> slot.modulationEnabled = checked);
        options.addView(modulation, new LinearLayout.LayoutParams(0, dp(38), 1));
        Spinner controllerSpinner = new Spinner(this);
        List<AndroidMidiRouter.Device> choices = midiChoices();
        ArrayAdapter<AndroidMidiRouter.Device> controllerAdapter = new ArrayAdapter<>(this, android.R.layout.simple_spinner_item, choices);
        controllerAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        controllerSpinner.setAdapter(controllerAdapter);
        int selectedDevice = 0;
        for (int i = 1; i < choices.size(); i++) if (choices.get(i).id.equals(slot.controllerId)) selectedDevice = i;
        controllerSpinner.setSelection(selectedDevice);
        controllerSpinner.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener() {
            @Override public void onItemSelected(android.widget.AdapterView<?> parent, View view, int position, long id) {
                if (position < choices.size()) slot.controllerId = choices.get(position).id;
            }
            @Override public void onNothingSelected(android.widget.AdapterView<?> parent) { }
        });
        options.addView(controllerSpinner, new LinearLayout.LayoutParams(0, dp(38), 1.35f));
        Button learn = button(slot.volumeCc == null ? "MIDI Learn" : "CC " + slot.volumeCc, "Associar um controle MIDI ao volume", () -> {
            pendingVolumeLearnChannel = slot.channel;
            setStatus("MIDI Learn · mova o controle de volume da parte " + (slot.channel + 1));
        });
        LinearLayout.LayoutParams learnParams = new LinearLayout.LayoutParams(-2, dp(38));
        learnParams.leftMargin = dp(4);
        options.addView(learn, learnParams);
        card.addView(options);

        TextView memory = text(slot.loading ? "Carregando timbre na memória…" : slot.loaded ? "Timbre na memória · 100% estimado" : slot.loadError.isEmpty() ? "Timbre na memória · 0%" : slot.loadError, 10, slot.loadError.isEmpty() ? 0xff667085 : 0xffb42318, false);
        card.addView(memory);
        if (slot.loading) {
            ProgressBar progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
            progress.setIndeterminate(true);
            card.addView(progress, new LinearLayout.LayoutParams(-1, dp(3)));
        }
        return card;
    }

    private interface ValueChanged { void changed(int value); }

    private View controlRow(String label, int value, ValueChanged listener) {
        LinearLayout row = new LinearLayout(this);
        row.setGravity(Gravity.CENTER_VERTICAL);
        TextView caption = text(label, 10, 0xff475467, false);
        row.addView(caption, new LinearLayout.LayoutParams(dp(90), dp(30)));
        SeekBar seek = new SeekBar(this);
        seek.setMax(100);
        seek.setProgress(value);
        row.addView(seek, new LinearLayout.LayoutParams(0, dp(30), 1));
        seek.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override public void onProgressChanged(SeekBar bar, int progress, boolean fromUser) {
                caption.setText(label.substring(0, label.indexOf(' ')) + " " + progress + "%");
                if (fromUser) listener.changed(progress);
            }
            @Override public void onStartTrackingTouch(SeekBar bar) { }
            @Override public void onStopTrackingTouch(SeekBar bar) { }
        });
        return row;
    }

    private void loadInitialScene() {
        List<SynthScene> scenes = sceneStore.read();
        if (scenes.isEmpty()) return;
        String wanted = currentSceneName.isEmpty() ? scenes.get(0).name : currentSceneName;
        loadScene(wanted);
    }

    private void loadScene(String name) {
        SynthScene scene = null;
        for (SynthScene item : sceneStore.read()) if (item.name.equals(name)) { scene = item; break; }
        if (scene == null) return;
        for (int channel = 0; channel < MAX_SLOTS; channel++) engine.clearChannel(channel);
        heldMidiChannels.clear();
        slotPresets.clear();
        slots.clear();
        int count = Math.max(1, Math.min(MAX_SLOTS, scene.slots.size()));
        for (int i = 0; i < count; i++) {
            SlotState slot = scene.slots.get(i).copy();
            slot.channel = i;
            if (slot.soundFontPath.isEmpty() || !new File(slot.soundFontPath).isFile()) {
                File local = findLocalSoundFont(slot.soundFontName);
                if (local != null) slot.soundFontPath = local.getAbsolutePath();
            }
            slots.add(slot);
        }
        currentSceneName = scene.name;
        pendingSceneLearn = "";
        buildUi();
        setStatus("Cena “" + scene.name + "” carregada.");
        for (SlotState slot : slots) {
            if (!slot.soundFontPath.isEmpty()) loadSoundFont(slot, false);
            else if (!slot.soundFontName.isEmpty()) setStatus("Cena pronta; importe “" + slot.soundFontName + "” para ativar a parte " + (slot.channel + 1) + ".");
        }
    }

    private void newScene() {
        for (int channel = 0; channel < MAX_SLOTS; channel++) engine.clearChannel(channel);
        slotPresets.clear();
        slots.clear();
        slots.add(new SlotState(0));
        currentSceneName = "";
        pendingSceneLearn = "";
        if (sceneNameInput != null) sceneNameInput.setText("");
        buildUi();
        setStatus("Cena nova · um slot vazio. Adicione timbres conforme precisar.");
    }

    private void saveScene() {
        String name = sceneNameInput == null ? "" : sceneNameInput.getText().toString().trim();
        if (name.isEmpty()) { sceneNameInput.setError("Informe um nome para a cena"); return; }
        SynthScene scene = new SynthScene(name);
        for (SlotState slot : slots) scene.slots.add(slot.copy());
        List<SynthScene> scenes = sceneStore.read();
        boolean replaced = false;
        for (int i = 0; i < scenes.size(); i++) if (scenes.get(i).name.equals(name)) {
            scene.midiChannel = scenes.get(i).midiChannel;
            scene.midiNote = scenes.get(i).midiNote;
            scenes.set(i, scene);
            replaced = true;
            break;
        }
        if (!replaced) scenes.add(scene);
        sceneStore.write(scenes);
        currentSceneName = name;
        refreshSceneControls();
        setStatus("Cena “" + name + "” salva.");
    }

    private void deleteSelectedScene() {
        if (sceneSelector == null || !(sceneSelector.getSelectedItem() instanceof SceneChoice)) return;
        String name = ((SceneChoice) sceneSelector.getSelectedItem()).name;
        List<SynthScene> scenes = sceneStore.read();
        for (int i = scenes.size() - 1; i >= 0; i--) if (scenes.get(i).name.equals(name)) scenes.remove(i);
        sceneStore.write(scenes);
        if (name.equals(currentSceneName)) newScene(); else refreshSceneControls();
        setStatus("Cena removida: " + name);
    }

    private void refreshSceneControls() {
        if (sceneSelector == null) return;
        List<SynthScene> scenes = sceneStore.read();
        List<SceneChoice> choices = new ArrayList<>();
        for (SynthScene scene : scenes) choices.add(new SceneChoice(scene.name));
        ArrayAdapter<SceneChoice> adapter = new ArrayAdapter<>(this, android.R.layout.simple_spinner_item, choices);
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        sceneSelector.setAdapter(adapter);
        int selected = 0;
        for (int i = 0; i < choices.size(); i++) if (choices.get(i).name.equals(currentSceneName)) selected = i;
        if (!choices.isEmpty()) sceneSelector.setSelection(selected);
        if (scenePadList != null) {
            scenePadList.removeAllViews();
            for (SynthScene scene : scenes) {
                LinearLayout row = new LinearLayout(this);
                Button launch = button("▶  " + scene.name, "Carregar cena " + scene.name, () -> loadScene(scene.name));
                row.addView(launch, new LinearLayout.LayoutParams(0, dp(40), 1));
                Button learn = button(scene.midiChannel == null ? "MIDI Learn" : "CH " + (scene.midiChannel + 1) + " · " + scene.midiNote, "Associar pad/controlador MIDI à cena", () -> {
                    pendingSceneLearn = scene.name;
                    setStatus("MIDI Learn para “" + scene.name + "”: toque o pad que deseja associar.");
                });
                LinearLayout.LayoutParams learnParams = new LinearLayout.LayoutParams(dp(105), dp(40));
                learnParams.leftMargin = dp(4);
                row.addView(learn, learnParams);
                scenePadList.addView(row, spacedParams(dp(4)));
            }
        }
    }

    private void addSlot() {
        if (slots.size() >= MAX_SLOTS) { Toast.makeText(this, "Limite de oito partes", Toast.LENGTH_SHORT).show(); return; }
        slots.add(new SlotState(slots.size()));
        refreshSlots();
    }

    private void removeSlot(int channel) {
        if (slots.size() <= 1 || channel < 0 || channel >= slots.size()) return;
        for (int i = 0; i < MAX_SLOTS; i++) engine.clearChannel(i);
        slots.remove(channel);
        for (int i = 0; i < slots.size(); i++) slots.get(i).channel = i;
        refreshSlots();
        for (SlotState slot : slots) if (!slot.soundFontPath.isEmpty()) loadSoundFont(slot, false);
    }

    private void chooseSoundFont(int channel) {
        importSlot = channel;
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"application/octet-stream", "application/x-sf2", "audio/soundfont"});
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        startActivityForResult(intent, PICK_SOUNDFONT);
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != PICK_SOUNDFONT || resultCode != RESULT_OK || data == null || data.getData() == null) return;
        Uri uri = data.getData();
        try { getContentResolver().takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION); } catch (Exception ignored) { }
        final int target = importSlot;
        fileQueue.execute(() -> {
            try {
                String name = displayName(uri);
                if (!name.toLowerCase(Locale.ROOT).endsWith(".sf2")) throw new IllegalArgumentException("Selecione um arquivo .sf2");
                File directory = new File(getFilesDir(), "soundfonts");
                if (!directory.exists() && !directory.mkdirs()) throw new IllegalStateException("Não foi possível criar a biblioteca local de SF2");
                String clean = name.replaceAll("[^A-Za-z0-9._() -]", "_");
                File output = new File(directory, clean);
                try (InputStream input = getContentResolver().openInputStream(uri); FileOutputStream stream = new FileOutputStream(output)) {
                    if (input == null) throw new IllegalStateException("O seletor não forneceu acesso ao arquivo");
                    byte[] buffer = new byte[1024 * 256];
                    int length;
                    while ((length = input.read(buffer)) > 0) stream.write(buffer, 0, length);
                }
                runOnUiThread(() -> {
        if (target >= 0 && target < slots.size()) {
                        SlotState slot = slots.get(target);
                        slot.soundFontPath = output.getAbsolutePath();
                        slot.soundFontName = output.getName();
                        slot.loadError = "";
                        refreshSlots();
                        if (engineReady) loadSoundFont(slot, true);
                        else setStatus("SF2 copiado; aguardando o motor de áudio.");
                    } else {
                        refreshSlots();
                        setStatus("SoundFont importado na biblioteca: " + output.getName());
                    }
                });
            } catch (Exception error) {
                runOnUiThread(() -> setStatus("Falha ao importar SF2: " + error.getMessage()));
            }
        });
    }

    private String displayName(Uri uri) {
        String name = "SoundFont.sf2";
        try (android.database.Cursor cursor = getContentResolver().query(uri, null, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int column = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (column >= 0) name = cursor.getString(column);
            }
        } catch (Exception ignored) { }
        return name;
    }

    private void openSoundFontCatalog() {
        importSlot = -1;
        List<SoundFontCatalog.Item> items = SoundFontCatalog.read(this);
        if (items.isEmpty()) { setStatus("Catálogo de SoundFonts vazio."); return; }
        String[] labels = new String[items.size()];
        for (int i = 0; i < items.size(); i++) labels[i] = items.get(i).toString();
        new AlertDialog.Builder(this).setTitle("Baixar SoundFont")
            .setItems(labels, (dialog, which) -> downloadSoundFont(items.get(which)))
            .setNegativeButton("Cancelar", null).show();
    }

    private void downloadSoundFont(SoundFontCatalog.Item item) {
        if (BuildConfig.SOUNDFONT_BASE_URL.isEmpty()) {
            setStatus("URL do catálogo não configurada; importe um arquivo SF2 local.");
            return;
        }
        LinearLayout progressContent = new LinearLayout(this);
        progressContent.setOrientation(LinearLayout.VERTICAL);
        progressContent.setPadding(dp(18), dp(8), dp(18), dp(8));
        TextView progressLabel = text("Conectando ao armazenamento…", 13, INK, false);
        ProgressBar progressBar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progressBar.setMax(100);
        progressBar.setIndeterminate(true);
        progressContent.addView(progressLabel);
        progressContent.addView(progressBar, spacedParams(dp(8)));
        AlertDialog progressDialog = new AlertDialog.Builder(this).setTitle(item.name).setView(progressContent).setNegativeButton("Continuar em segundo plano", null).create();
        progressDialog.show();
        File directory = new File(getFilesDir(), "soundfonts");
        File destination = new File(directory, new File(item.file).getName());
        fileQueue.execute(() -> {
            HttpURLConnection connection = null;
            try {
                if (!directory.exists() && !directory.mkdirs()) throw new IllegalStateException("Não foi possível criar a biblioteca SF2");
                if (destination.isFile() && destination.length() > 128 && isRiffSoundFont(destination)) {
                    runOnUiThread(() -> finishSoundFontDownload(item, destination, progressDialog));
                    return;
                }
                StringBuilder encoded = new StringBuilder(BuildConfig.SOUNDFONT_BASE_URL);
                String[] pathParts = item.file.split("/");
                for (int i = 0; i < pathParts.length; i++) {
                    if (i > 0 && encoded.charAt(encoded.length() - 1) != '/') encoded.append('/');
                    encoded.append(Uri.encode(pathParts[i]));
                }
                connection = (HttpURLConnection) new URL(encoded.toString()).openConnection();
                connection.setConnectTimeout(20000);
                connection.setReadTimeout(60000);
                connection.setRequestProperty("User-Agent", "SamNatSynthAndroid/0.1");
                connection.connect();
                int response = connection.getResponseCode();
                if (response < 200 || response >= 300) throw new IllegalStateException("Servidor respondeu HTTP " + response);
                long total = connection.getContentLengthLong();
                File partial = new File(directory, destination.getName() + ".part");
                try (InputStream input = connection.getInputStream(); FileOutputStream output = new FileOutputStream(partial)) {
                    byte[] buffer = new byte[256 * 1024];
                    long received = 0;
                    int lastPercent = -1;
                    int count;
                    while ((count = input.read(buffer)) != -1) {
                        output.write(buffer, 0, count);
                        received += count;
                        if (total > 0) {
                            int percent = (int) Math.min(99, received * 100 / total);
                            if (percent > lastPercent) {
                                lastPercent = percent;
                                runOnUiThread(() -> {
                                    if (progressDialog.isShowing()) {
                                        progressBar.setIndeterminate(false);
                                        progressBar.setProgress(percent);
                                        progressLabel.setText(String.format(Locale.getDefault(), "Baixando · %d%%", percent));
                                    }
                                });
                            }
                        }
                    }
                }
                if (partial.length() < 128 || !isRiffSoundFont(partial)) {
                    partial.delete();
                    throw new IllegalStateException("O arquivo recebido não parece ser um SF2 válido");
                }
                if (destination.exists() && !destination.delete()) throw new IllegalStateException("Não foi possível atualizar o arquivo existente");
                if (!partial.renameTo(destination)) throw new IllegalStateException("Não foi possível concluir a gravação do SoundFont");
                runOnUiThread(() -> finishSoundFontDownload(item, destination, progressDialog));
            } catch (Exception error) {
                runOnUiThread(() -> {
                    if (progressDialog.isShowing()) progressDialog.dismiss();
                    setStatus("Falha ao baixar " + item.name + ": " + error.getMessage());
                });
            } finally {
                if (connection != null) connection.disconnect();
            }
        });
    }

    private boolean isRiffSoundFont(File file) {
        try (InputStream input = new java.io.FileInputStream(file)) {
            byte[] header = new byte[12];
            if (input.read(header) != header.length) return false;
            return header[0] == 'R' && header[1] == 'I' && header[2] == 'F' && header[3] == 'F' &&
                header[8] == 's' && header[9] == 'f' && header[10] == 'b' && header[11] == 'k';
        } catch (Exception ignored) { return false; }
    }

    private void finishSoundFontDownload(SoundFontCatalog.Item item, File file, AlertDialog dialog) {
        if (dialog.isShowing()) dialog.dismiss();
        List<SlotState> destinations = new ArrayList<>();
        if (importSlot >= 0 && importSlot < slots.size()) destinations.add(slots.get(importSlot));
        else for (SlotState slot : slots) {
            if (slot.soundFontPath.isEmpty() && slot.soundFontName.equalsIgnoreCase(file.getName())) destinations.add(slot);
        }
        for (SlotState slot : destinations) {
            slot.soundFontPath = file.getAbsolutePath();
            slot.soundFontName = file.getName();
            slot.loadError = "";
        }
        refreshSlots();
        for (SlotState slot : destinations) if (engineReady) loadSoundFont(slot, true);
        if (destinations.isEmpty()) {
            setStatus("Download concluído: " + item.name);
        }
    }

    private void loadSoundFont(SlotState slot, boolean report) {
        if (!engineReady || slot.soundFontPath.isEmpty()) return;
        final int channel = slot.channel;
        final String path = slot.soundFontPath;
        final long initialPss = Debug.getPss() * 1024L;
        slot.loading = true;
        slot.loaded = false;
        refreshSlots();
        if (report) setStatus("Carregando " + slot.soundFontName + " na parte " + (channel + 1) + "…");
        audioQueue.execute(() -> {
            String result = engine.loadSoundFont(path, channel);
            String[] lines = result.split("\n");
            boolean ok = lines.length > 0 && lines[0].equals("OK");
            List<String> presets = new ArrayList<>();
            if (ok) for (int i = 1; i < lines.length; i++) {
                String[] parts = lines[i].split("\t", 3);
                if (parts.length == 3) presets.add(parts[0] + "-" + parts[1] + " · " + parts[2]);
            }
            runOnUiThread(() -> {
                if (channel >= slots.size() || slots.get(channel) != slot) return;
                slot.loaded = ok;
                slot.loading = false;
                slot.loadError = ok ? "" : result.replace("ERRO: ", "");
                if (ok) {
                    if (!presets.isEmpty()) {
                        boolean found = false;
                        for (String preset : presets) if (preset.startsWith(slot.bank + "-" + slot.program + " ·")) { slot.presetName = preset; found = true; break; }
                        if (!found) {
                            String[] first = presets.get(0).split(" · ", 2);
                            int[] values = parsePreset(first[0]);
                            slot.bank = values[0]; slot.program = values[1]; slot.presetName = presets.get(0);
                        }
                    }
                    slotPresets.put(channel, presets);
                    engine.setProgram(channel, slot.bank, slot.program);
                    engine.setVolume(channel, slot.volume);
                    engine.setReverb(channel, slot.reverb);
                    engine.setChorus(channel, slot.chorus);
                    refreshSlots();
                    if (report) setStatus("SF2 pronto · " + slot.soundFontName + " · " + Math.max(0, Debug.getPss() * 1024L - initialPss) / (1024 * 1024) + " MB adicionais no processo.");
                } else {
                    refreshSlots();
                    setStatus("Falha ao carregar " + slot.soundFontName + ": " + slot.loadError);
                }
            });
        });
    }

    private List<String> readPresetList(SlotState slot) {
        // Presets are returned by the native loader and kept in the UI during
        // the current process; if a saved scene loads, its program remains selectable.
        return new ArrayList<>(slotPresets.getOrDefault(slot.channel, new ArrayList<>()));
    }

    private List<SoundFontChoice> soundFontChoices() {
        List<SoundFontChoice> result = new ArrayList<>();
        result.add(new SoundFontChoice(null));
        File directory = new File(getFilesDir(), "soundfonts");
        File[] files = directory.listFiles((parent, name) -> name.toLowerCase(Locale.ROOT).endsWith(".sf2"));
        if (files != null) {
            java.util.Arrays.sort(files, (a, b) -> a.getName().compareToIgnoreCase(b.getName()));
            for (File file : files) result.add(new SoundFontChoice(file));
        }
        return result;
    }

    private final Map<Integer, List<String>> slotPresets = new HashMap<>();

    private File findLocalSoundFont(String expectedName) {
        if (expectedName == null || expectedName.isEmpty()) return null;
        File dir = new File(getFilesDir(), "soundfonts");
        File exact = new File(dir, expectedName);
        if (exact.isFile()) return exact;
        File[] files = dir.listFiles((parent, name) -> name.equalsIgnoreCase(expectedName));
        return files == null || files.length == 0 ? null : files[0];
    }

    private void runAudioTest() {
        if (!engineReady) { setStatus("O motor de áudio ainda está iniciando."); return; }
        engine.testTone(true);
        setStatus("Teste de áudio · seno de 440 Hz por 2 segundos");
        handler.postDelayed(() -> {
            engine.testTone(false);
            setStatus("Teste de áudio finalizado.");
        }, 2000);
    }

    private void chooseAudioOutput() {
        AudioDeviceInfo[] available = audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS);
        List<AudioDeviceInfo> outputs = new ArrayList<>();
        List<String> labels = new ArrayList<>();
        labels.add("Padrão Android · troca automática");
        for (AudioDeviceInfo device : available) {
            if (!device.isSink() || !isSelectableOutput(device.getType())) continue;
            outputs.add(device);
            labels.add(device.getProductName() + " · " + audioDeviceType(device.getType()));
        }
        new AlertDialog.Builder(this).setTitle("Saída de áudio").setItems(labels.toArray(new String[0]), (dialog, which) -> {
            int deviceId = which == 0 ? 0 : outputs.get(which - 1).getId();
            String deviceName = labels.get(which);
            audioQueue.execute(() -> {
                boolean selected = engine.selectOutput(deviceId);
                if (selected) getPreferences(MODE_PRIVATE).edit().putInt("audio-output-id", deviceId).apply();
                runOnUiThread(() -> setStatus(selected ? "Saída de áudio: " + deviceName : "Não foi possível abrir essa saída. O Android manterá a rota padrão."));
            });
        }).setNegativeButton("Cancelar", null).show();
    }

    private String audioDeviceType(int type) {
        switch (type) {
            case AudioDeviceInfo.TYPE_BUILTIN_SPEAKER: return "alto-falante";
            case AudioDeviceInfo.TYPE_BUILTIN_EARPIECE: return "auricular";
            case AudioDeviceInfo.TYPE_WIRED_HEADPHONES: return "fone";
            case AudioDeviceInfo.TYPE_WIRED_HEADSET: return "headset";
            case AudioDeviceInfo.TYPE_BLUETOOTH_A2DP: return "Bluetooth";
            case AudioDeviceInfo.TYPE_BLUETOOTH_SCO: return "Bluetooth chamada";
            case AudioDeviceInfo.TYPE_USB_DEVICE:
            case AudioDeviceInfo.TYPE_USB_HEADSET:
            case AudioDeviceInfo.TYPE_USB_ACCESSORY: return "USB";
            case AudioDeviceInfo.TYPE_HDMI:
            case AudioDeviceInfo.TYPE_HDMI_ARC:
            case AudioDeviceInfo.TYPE_HDMI_EARC: return "HDMI";
            default: return "áudio Android";
        }
    }

    private boolean isSelectableOutput(int type) {
        switch (type) {
            case AudioDeviceInfo.TYPE_BUILTIN_SPEAKER:
            case AudioDeviceInfo.TYPE_BUILTIN_EARPIECE:
            case AudioDeviceInfo.TYPE_WIRED_HEADPHONES:
            case AudioDeviceInfo.TYPE_WIRED_HEADSET:
            case AudioDeviceInfo.TYPE_BLUETOOTH_A2DP:
            case AudioDeviceInfo.TYPE_BLUETOOTH_SCO:
            case AudioDeviceInfo.TYPE_BLE_HEADSET:
            case AudioDeviceInfo.TYPE_BLE_SPEAKER:
            case AudioDeviceInfo.TYPE_USB_DEVICE:
            case AudioDeviceInfo.TYPE_USB_HEADSET:
            case AudioDeviceInfo.TYPE_USB_ACCESSORY:
            case AudioDeviceInfo.TYPE_HDMI:
            case AudioDeviceInfo.TYPE_HDMI_ARC:
            case AudioDeviceInfo.TYPE_HDMI_EARC:
            case AudioDeviceInfo.TYPE_HEARING_AID:
            case AudioDeviceInfo.TYPE_LINE_ANALOG:
            case AudioDeviceInfo.TYPE_LINE_DIGITAL:
                return true;
            default: return false;
        }
    }

    private void sendNoteToActiveSlots(int note, int velocity) {
        for (SlotState slot : slots) if (slot.loaded) engine.noteOn(slot.channel, note, velocity);
    }

    private void handleMidi(String deviceId, byte[] bytes, int offset, int count) {
        if (count < 2) return;
        int status = bytes[offset] & 0xff;
        if (status >= 0xf0) return;
        int command = status & 0xf0;
        int midiChannel = status & 0x0f;
        int data1 = bytes[offset + 1] & 0x7f;
        int data2 = count > 2 ? bytes[offset + 2] & 0x7f : 0;
        if ((command == 0x90 && data2 > 0) && !pendingSceneLearn.isEmpty()) {
            saveSceneMidiTrigger(pendingSceneLearn, midiChannel, data1);
            return;
        }
        if (command == 0x90 && data2 > 0) {
            for (SynthScene scene : sceneStore.read()) if (scene.midiChannel != null && scene.midiNote != null && scene.midiChannel == midiChannel && scene.midiNote == data1) {
                runOnUiThread(() -> loadScene(scene.name));
                return;
            }
        }
        List<SlotState> targets = routedSlots(deviceId, midiChannel);
        String key = deviceId + ":" + midiChannel + ":" + data1;
        if (command == 0x90 && data2 > 0) {
            Set<Integer> channels = new HashSet<>();
            for (SlotState slot : targets) if (slot.loaded) { engine.noteOn(slot.channel, data1, data2); channels.add(slot.channel); }
            heldMidiChannels.put(key, channels);
            runOnUiThread(() -> { if (pianoView != null) pianoView.setNoteActive(data1, true); });
        } else if (command == 0x80 || command == 0x90) {
            Set<Integer> channels = heldMidiChannels.remove(key);
            if (channels != null) for (Integer channel : channels) engine.noteOff(channel, data1);
            runOnUiThread(() -> { if (pianoView != null) pianoView.setNoteActive(data1, false); });
        } else if (command == 0xb0) {
            if (pendingVolumeLearnChannel >= 0 && targetForLearn(deviceId, pendingVolumeLearnChannel)) {
                SlotState slot = slots.get(pendingVolumeLearnChannel);
                slot.volumeCc = data1;
                pendingVolumeLearnChannel = -1;
                runOnUiThread(() -> { refreshSlots(); setStatus("CC " + data1 + " associado ao volume."); });
                return;
            }
            for (SlotState slot : targets) {
                if (data1 == 64 || (data1 == 1 && slot.modulationEnabled)) engine.controlChange(slot.channel, data1, data2);
                if (slot.volumeCc != null && slot.volumeCc == data1) {
                    slot.volume = Math.round(data2 * 100f / 127f);
                    engine.setVolume(slot.channel, slot.volume);
                    runOnUiThread(this::refreshSlots);
                }
            }
        } else if (command == 0xe0) {
            int bend = data1 | (data2 << 7);
            for (SlotState slot : targets) if (slot.loaded) engine.pitchBend(slot.channel, bend);
        }
    }

    private boolean targetForLearn(String deviceId, int channel) {
        if (channel < 0 || channel >= slots.size()) return false;
        String selected = slots.get(channel).controllerId;
        return (selected.isEmpty() ? defaultMidiId : selected).equals(deviceId);
    }

    private List<SlotState> routedSlots(String deviceId, int midiChannel) {
        List<SlotState> result = new ArrayList<>();
        for (SlotState slot : slots) {
            String selected = slot.controllerId.isEmpty() ? defaultMidiId : slot.controllerId;
            if (!selected.equals(deviceId)) continue;
            if (midiChannelRouting && midiChannel != slot.channel) continue;
            result.add(slot);
        }
        return result;
    }

    private void saveSceneMidiTrigger(String name, int channel, int note) {
        List<SynthScene> scenes = sceneStore.read();
        for (SynthScene scene : scenes) if (scene.name.equals(name)) { scene.midiChannel = channel; scene.midiNote = note; break; }
        sceneStore.write(scenes);
        pendingSceneLearn = "";
        runOnUiThread(() -> { refreshSceneControls(); setStatus("Pad MIDI associado à cena “" + name + "”."); });
    }

    private void refreshMidiControls() {
        if (globalMidiSpinner == null) return;
        List<AndroidMidiRouter.Device> choices = midiChoices();
        ArrayAdapter<AndroidMidiRouter.Device> adapter = new ArrayAdapter<>(this, android.R.layout.simple_spinner_item, choices);
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        globalMidiSpinner.setAdapter(adapter);
        for (int i = 1; i < choices.size(); i++) if (choices.get(i).id.equals(defaultMidiId)) globalMidiSpinner.setSelection(i);
        List<String> routes = new ArrayList<>();
        routes.add("Todas as partes");
        routes.add("Canal MIDI correspondente");
        ArrayAdapter<String> routeAdapter = new ArrayAdapter<>(this, android.R.layout.simple_spinner_item, routes);
        routeAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        routeSpinner.setAdapter(routeAdapter);
        routeSpinner.setSelection(midiChannelRouting ? 1 : 0);
        routeSpinner.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener() {
            @Override public void onItemSelected(android.widget.AdapterView<?> parent, View view, int position, long id) { midiChannelRouting = position == 1; }
            @Override public void onNothingSelected(android.widget.AdapterView<?> parent) { }
        });
        globalMidiSpinner.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener() {
            @Override public void onItemSelected(android.widget.AdapterView<?> parent, View view, int position, long id) {
                if (position > 0 && position < choices.size()) defaultMidiId = choices.get(position).id;
            }
            @Override public void onNothingSelected(android.widget.AdapterView<?> parent) { }
        });
    }

    private List<AndroidMidiRouter.Device> midiChoices() {
        List<AndroidMidiRouter.Device> result = new ArrayList<>();
        result.add(new AndroidMidiRouter.Device("", "Padrão · primeiro controlador"));
        result.addAll(midiDevices);
        return result;
    }

    private void updateMidiStatus() {
        if (midiStatusView == null) return;
        String name = "nenhum";
        for (AndroidMidiRouter.Device device : midiDevices) if (device.id.equals(defaultMidiId)) name = device.name;
        midiStatusView.setText("MIDI " + midiDevices.size() + " · " + name);
    }

    private void startMidiWithPermission() {
        if (android.os.Build.VERSION.SDK_INT >= 31 &&
            checkSelfPermission(android.Manifest.permission.BLUETOOTH_CONNECT) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{android.Manifest.permission.BLUETOOTH_CONNECT}, REQUEST_BLUETOOTH_MIDI);
            return;
        }
        midiRouter.start();
    }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQUEST_BLUETOOTH_MIDI && midiRouter != null) {
            // USB MIDI remains usable even if the user declines Bluetooth MIDI.
            midiRouter.start();
        }
    }

    private void batteryViewUpdate(int percent, boolean charging) {
        if (batteryView == null) return;
        String symbol = charging ? "⚡" : (percent < 20 ? "🪫" : "🔋");
        batteryView.setText(symbol + " " + Math.max(0, percent) + "%");
        batteryView.setTextColor(percent < 20 && !charging ? 0xffb42318 : INK);
    }

    private void confirmExit() {
        new AlertDialog.Builder(this).setTitle("Sair do SamNat Synth")
            .setMessage("No Android original, um APK comum não pode desligar o aparelho. Sairá do instrumento e voltará à tela inicial do Android.")
            .setNegativeButton("Cancelar", null)
            .setPositiveButton("Sair", (dialog, which) -> {
                try {
                    DevicePolicyManager dpm = (DevicePolicyManager) getSystemService(DEVICE_POLICY_SERVICE);
                    if (dpm.isLockTaskPermitted(getPackageName())) stopLockTask();
                } catch (Exception ignored) { }
                finishAffinity();
            }).show();
    }

    private void requestInstrumentAudioFocus() {
        AudioAttributes attributes = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_MEDIA)
            .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
            .build();
        AudioManager.OnAudioFocusChangeListener listener = change -> {
            if (change == AudioManager.AUDIOFOCUS_LOSS || change == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT) {
                for (int channel = 0; channel < MAX_SLOTS; channel++) engine.allNotesOff(channel);
            }
        };
        audioFocusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
            .setAudioAttributes(attributes)
            .setOnAudioFocusChangeListener(listener, handler)
            .setWillPauseWhenDucked(true)
            .build();
        audioManager.requestAudioFocus(audioFocusRequest);
    }

    private void setStatus(String message) {
        if (statusView != null) statusView.setText(message);
        if (midiStatusView != null && message.startsWith("MIDI")) midiStatusView.setText(message);
    }

    private void runBrightness(int direction) {
        WindowManager.LayoutParams params = getWindow().getAttributes();
        float current = params.screenBrightness < 0 ? 0.5f : params.screenBrightness;
        params.screenBrightness = Math.max(0.05f, Math.min(1f, current + direction * 0.08f));
        getWindow().setAttributes(params);
        setStatus("Brilho " + Math.round(params.screenBrightness * 100) + "%");
    }

    @Override public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BRIGHTNESS_DOWN || keyCode == KeyEvent.KEYCODE_F5) { runBrightness(-1); return true; }
        if (keyCode == KeyEvent.KEYCODE_BRIGHTNESS_UP || keyCode == KeyEvent.KEYCODE_F6) { runBrightness(1); return true; }
        return super.onKeyDown(keyCode, event);
    }

    @Override protected void onResume() {
        super.onResume();
        try {
            DevicePolicyManager dpm = (DevicePolicyManager) getSystemService(DEVICE_POLICY_SERVICE);
            if (dpm.isDeviceOwnerApp(getPackageName())) {
                android.content.ComponentName admin = new android.content.ComponentName(this, com.samnat.synth.admin.KioskAdminReceiver.class);
                dpm.setLockTaskPackages(admin, new String[]{getPackageName()});
            }
            if (dpm.isLockTaskPermitted(getPackageName())) startLockTask();
        } catch (Exception ignored) { }
    }

    @Override protected void onDestroy() {
        handler.removeCallbacks(monitorTask);
        try { unregisterReceiver(batteryReceiver); } catch (Exception ignored) { }
        if (midiRouter != null) midiRouter.stop();
        if (audioManager != null && audioFocusRequest != null) audioManager.abandonAudioFocusRequest(audioFocusRequest);
        fileQueue.shutdown();
        audioQueue.execute(engine::close);
        audioQueue.shutdown();
        super.onDestroy();
    }

    private void parsePresetList(SlotState slot, String raw) {
        List<String> presets = new ArrayList<>();
        String[] lines = raw.split("\n");
        for (int i = 1; i < lines.length; i++) {
            String[] parts = lines[i].split("\t", 3);
            if (parts.length == 3) presets.add(parts[0] + "-" + parts[1] + " · " + parts[2]);
        }
        slotPresets.put(slot.channel, presets);
    }

    private int[] parsePreset(String line) {
        try {
            String[] pieces = line.split(" ·", 2)[0].split("-", 2);
            return new int[]{Integer.parseInt(pieces[0]), Integer.parseInt(pieces[1])};
        } catch (Exception ignored) { return new int[]{0, 0}; }
    }

    private int dp(float value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    private TextView text(String value, int size, int color, boolean bold) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(size);
        view.setTextColor(color);
        if (bold) view.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        view.setGravity(Gravity.CENTER_VERTICAL);
        return view;
    }
    private Button button(String value, String description, Runnable action) {
        Button view = new Button(this);
        view.setText(value);
        view.setTextSize(11);
        view.setMinHeight(dp(36));
        view.setMinimumHeight(dp(36));
        view.setPadding(dp(6), 0, dp(6), 0);
        view.setAllCaps(false);
        view.setTextColor(INK);
        view.setBackground(round(0xffffffff, 0xffd0d5dd, 8));
        view.setContentDescription(description);
        view.setOnClickListener(v -> action.run());
        return view;
    }
    private GradientDrawable round(int color, int stroke, int radius) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(color);
        drawable.setCornerRadius(dp(radius));
        drawable.setStroke(dp(1), stroke);
        return drawable;
    }
    private LinearLayout.LayoutParams spacedParams(int top) {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1, -2);
        params.topMargin = top;
        return params;
    }
    private LinearLayout.LayoutParams topMargin(int top) {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1, -2);
        params.topMargin = top;
        return params;
    }
    private String categoryIcon(String name) {
        String lower = name == null ? "" : name.toLowerCase(Locale.ROOT);
        if (lower.contains("piano")) return "🎹";
        if (lower.contains("string") || lower.contains("violin")) return "🎻";
        if (lower.contains("organ")) return "🎼";
        if (lower.contains("pad")) return "☁";
        if (lower.contains("bass")) return "🎸";
        if (lower.contains("bell") || lower.contains("fx")) return "🔔";
        return "🎵";
    }
    private String noteName(int note) {
        String[] names = {"C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"};
        return names[note % 12] + (note / 12 - 1);
    }

    private static final class SceneChoice {
        final String name;
        SceneChoice(String name) { this.name = name; }
        @Override public String toString() { return name; }
    }

    private static final class SoundFontChoice {
        final File file;
        SoundFontChoice(File file) { this.file = file; }
        @Override public String toString() { return file == null ? "Biblioteca · selecione um timbre" : file.getName(); }
    }
}
