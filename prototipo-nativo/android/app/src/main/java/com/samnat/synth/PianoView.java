package com.samnat.synth;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.RectF;
import android.view.MotionEvent;
import android.view.View;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

final class PianoView extends View {
    interface NoteListener { void noteOn(int note); void noteOff(int note); }
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Set<Integer> active = new HashSet<>();
    private final Map<Integer, Integer> pointerNotes = new HashMap<>();
    private final int[] whiteNotes = new int[35];
    private final NoteListener listener;
    private static final boolean[] BLACK = {false, true, false, true, false, false, true, false, true, false, true, false};

    PianoView(Context context, NoteListener listener) {
        super(context);
        this.listener = listener;
        setBackgroundColor(0xfff7f8fa);
        setContentDescription("Teclado virtual de cinco oitavas, de Dó 2 a Si 6");
        int index = 0;
        for (int note = 36; note <= 95; note++) if (!BLACK[note % 12]) whiteNotes[index++] = note;
        setLayerType(View.LAYER_TYPE_SOFTWARE, null);
    }

    void setNoteActive(int note, boolean down) {
        if (down) active.add(note); else active.remove(note);
        invalidate();
    }

    private boolean isBlack(int note) { return BLACK[note % 12]; }

    @Override protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        float width = getWidth();
        float height = getHeight();
        if (width <= 0 || height <= 0) return;
        float whiteHeight = height - 3f;
        float whiteWidth = width / whiteNotes.length;
        for (int i = 0; i < whiteNotes.length; i++) {
            int note = whiteNotes[i];
            float left = i * whiteWidth;
            paint.setColor(active.contains(note) ? 0xffb9d6ff : 0xffffffff);
            paint.setStyle(Paint.Style.FILL);
            canvas.drawRect(left, 0, left + whiteWidth, whiteHeight, paint);
            paint.setColor(0xff9ca3af);
            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeWidth(1f);
            canvas.drawRect(left, 0, left + whiteWidth, whiteHeight, paint);
        }
        float blackWidth = whiteWidth * 0.62f;
        float blackHeight = whiteHeight * 0.63f;
        for (int note = 36; note <= 95; note++) {
            if (!isBlack(note)) continue;
            int whiteBefore = countWhiteNotesBefore(note);
            float boundary = whiteBefore * whiteWidth;
            float left = boundary - blackWidth / 2f;
            paint.setColor(active.contains(note) ? 0xff1874e8 : 0xff17191e);
            paint.setStyle(Paint.Style.FILL);
            canvas.drawRoundRect(new RectF(left, 0, left + blackWidth, blackHeight), 0, 0, paint);
            paint.setColor(0xff08090c);
            paint.setStyle(Paint.Style.STROKE);
            canvas.drawRect(left, 0, left + blackWidth, blackHeight, paint);
        }
    }

    private int countWhiteNotesBefore(int note) {
        int count = 0;
        for (int white : whiteNotes) if (white < note) count++;
        return count;
    }

    private int noteAt(float x, float y) {
        float whiteWidth = getWidth() / (float) whiteNotes.length;
        float whiteHeight = getHeight() - 3f;
        float blackWidth = whiteWidth * 0.62f;
        float blackHeight = whiteHeight * 0.63f;
        if (y <= blackHeight) {
            for (int note = 36; note <= 95; note++) {
                if (!isBlack(note)) continue;
                float left = countWhiteNotesBefore(note) * whiteWidth - blackWidth / 2f;
                if (x >= left && x <= left + blackWidth) return note;
            }
        }
        int index = Math.max(0, Math.min(whiteNotes.length - 1, (int) (x / Math.max(1, whiteWidth))));
        return whiteNotes[index];
    }

    private void setPointerNote(int pointer, float x, float y) {
        int next = noteAt(x, y);
        Integer previous = pointerNotes.put(pointer, next);
        if (previous != null && previous == next) return;
        if (previous != null) releasePointerNote(previous);
        if (!active.contains(next)) listener.noteOn(next);
        active.add(next);
        invalidate();
    }

    private void releasePointerNote(int note) {
        if (!pointerNotes.containsValue(note)) {
            active.remove(note);
            listener.noteOff(note);
        }
    }

    @Override public boolean onTouchEvent(MotionEvent event) {
        int action = event.getActionMasked();
        int index = event.getActionIndex();
        int pointer = event.getPointerId(index);
        if (action == MotionEvent.ACTION_DOWN || action == MotionEvent.ACTION_POINTER_DOWN) {
            setPointerNote(pointer, event.getX(index), event.getY(index));
            return true;
        }
        if (action == MotionEvent.ACTION_MOVE) {
            for (int i = 0; i < event.getPointerCount(); i++) setPointerNote(event.getPointerId(i), event.getX(i), event.getY(i));
            return true;
        }
        if (action == MotionEvent.ACTION_UP || action == MotionEvent.ACTION_POINTER_UP || action == MotionEvent.ACTION_CANCEL) {
            Integer note = pointerNotes.remove(pointer);
            if (note != null) releasePointerNote(note);
            return true;
        }
        return true;
    }
}
