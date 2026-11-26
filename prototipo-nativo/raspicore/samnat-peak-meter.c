#define _GNU_SOURCE
#include <dlfcn.h>
#include <errno.h>
#include <fcntl.h>
#include <pthread.h>
#include <signal.h>
#include <stdatomic.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <time.h>
#include <unistd.h>

/* FluidSynth's ALSA 16-bit driver writes interleaved stereo frames. Measure
 * these samples without changing them or doing IO on the audio thread. */
typedef long (*pcm_writei_fn)(void *, const void *, unsigned long);
static pcm_writei_fn real_writei;
static _Atomic unsigned int peak_sample;
static _Atomic unsigned int saturated_samples;
static int meter_fd = -1;

static void *report_peaks(void *unused) {
  (void)unused;
  sigset_t blocked;
  sigemptyset(&blocked);
  sigaddset(&blocked, SIGPIPE);
  pthread_sigmask(SIG_BLOCK, &blocked, NULL);
  const struct timespec interval = { .tv_sec = 0, .tv_nsec = 250000000L };
  for (;;) {
    nanosleep(&interval, NULL);
    unsigned int peak = atomic_exchange_explicit(&peak_sample, 0, memory_order_relaxed);
    unsigned int clipped = atomic_exchange_explicit(&saturated_samples, 0, memory_order_relaxed);
    char line[64];
    int n = snprintf(line, sizeof(line), "%u %u\n", peak, clipped);
    if (n > 0 && (size_t)n < sizeof(line) && write(meter_fd, line, (size_t)n) < 0 && errno == EPIPE) return NULL;
  }
  return NULL;
}

__attribute__((constructor)) static void initialize_meter(void) {
  real_writei = (pcm_writei_fn)dlsym(RTLD_NEXT, "snd_pcm_writei");
  const char *fd_text = getenv("SAMNAT_METER_FD");
  if (!real_writei || !fd_text) return;
  char *end = NULL;
  long fd = strtol(fd_text, &end, 10);
  if (!end || *end || fd < 3 || fd > 1024) return;
  meter_fd = (int)fd;
  int flags = fcntl(meter_fd, F_GETFL);
  if (flags < 0 || fcntl(meter_fd, F_SETFL, flags | O_NONBLOCK) < 0) {
    meter_fd = -1;
    return;
  }
  pthread_t thread;
  if (pthread_create(&thread, NULL, report_peaks, NULL) == 0) pthread_detach(thread);
  else meter_fd = -1;
}

long snd_pcm_writei(void *pcm, const void *buffer, unsigned long frames) {
  if (!real_writei) { errno = ENOSYS; return -ENOSYS; }
  if (meter_fd >= 0 && buffer) {
    const int16_t *samples = buffer;
    unsigned int peak = 0, clipped = 0;
    for (unsigned long i = 0; i < frames * 2; ++i) {
      int value = samples[i];
      unsigned int magnitude = (unsigned int)(value < 0 ? -value : value);
      if (magnitude > peak) peak = magnitude;
      if (magnitude >= 32767) ++clipped;
    }
    unsigned int previous = atomic_load_explicit(&peak_sample, memory_order_relaxed);
    while (peak > previous && !atomic_compare_exchange_weak_explicit(
      &peak_sample, &previous, peak, memory_order_relaxed, memory_order_relaxed)) {}
    if (clipped) atomic_fetch_add_explicit(&saturated_samples, clipped, memory_order_relaxed);
  }
  return real_writei(pcm, buffer, frames);
}
