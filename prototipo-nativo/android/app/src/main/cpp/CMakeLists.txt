cmake_minimum_required(VERSION 3.22.1)
project(samnat_android LANGUAGES C CXX)

include(FetchContent)
set(FETCHCONTENT_QUIET OFF)

# FluidSynth is built as a shared LGPL library. This avoids glibc/ALSA/Linux
# audio backends and lets the Android app own the AAudio stream.
set(BUILD_SHARED_LIBS ON CACHE BOOL "Build FluidSynth as a shared library" FORCE)
set(enable-floats ON CACHE BOOL "Use float samples in FluidSynth" FORCE)
set(osal cpp11 CACHE STRING "Use the portable C++ OS abstraction" FORCE)
foreach(option enable-alsa enable-aufile enable-dbus enable-ipv6 enable-jack
        enable-ladspa enable-libsndfile enable-midishare enable-network
        enable-oboe enable-opensles enable-openmp enable-oss enable-dsound
        enable-wasapi enable-waveout enable-winmidi enable-sdl3
        enable-pulseaudio enable-pipewire enable-readline enable-native-dls
        enable-signalsmith)
    set(${option} OFF CACHE BOOL "Not used by SamNat Android" FORCE)
endforeach()
set(enable-threads ON CACHE BOOL "Keep FluidSynth worker threads" FORCE)

FetchContent_Declare(
    fluidsynth
    GIT_REPOSITORY https://github.com/FluidSynth/fluidsynth.git
    GIT_TAG v2.6.0
    GIT_SHALLOW TRUE
    GIT_SUBMODULES gcem
    GIT_SUBMODULES_RECURSE TRUE
    EXCLUDE_FROM_ALL
)
FetchContent_MakeAvailable(fluidsynth)

add_library(samnat_audio SHARED samnat_audio.cpp)
target_compile_features(samnat_audio PRIVATE cxx_std_17)
target_compile_options(samnat_audio PRIVATE -Wall -Wextra -Wno-unused-parameter -O3)
find_library(AAUDIO_LIBRARY aaudio REQUIRED)
find_library(LOG_LIBRARY log REQUIRED)
target_link_libraries(samnat_audio PRIVATE libfluidsynth ${AAUDIO_LIBRARY} ${LOG_LIBRARY})
