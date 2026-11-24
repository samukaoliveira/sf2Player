# Install script for directory: /home/samuka/workspace/sf2Player/prototipo-nativo/android/app/.cxx/Debug/30584g51/arm64-v8a/_deps/fluidsynth-src/src

# Set the install prefix
if(NOT DEFINED CMAKE_INSTALL_PREFIX)
  set(CMAKE_INSTALL_PREFIX "/usr/local")
endif()
string(REGEX REPLACE "/$" "" CMAKE_INSTALL_PREFIX "${CMAKE_INSTALL_PREFIX}")

# Set the install configuration name.
if(NOT DEFINED CMAKE_INSTALL_CONFIG_NAME)
  if(BUILD_TYPE)
    string(REGEX REPLACE "^[^A-Za-z0-9_]+" ""
           CMAKE_INSTALL_CONFIG_NAME "${BUILD_TYPE}")
  else()
    set(CMAKE_INSTALL_CONFIG_NAME "Debug")
  endif()
  message(STATUS "Install configuration: \"${CMAKE_INSTALL_CONFIG_NAME}\"")
endif()

# Set the component getting installed.
if(NOT CMAKE_INSTALL_COMPONENT)
  if(COMPONENT)
    message(STATUS "Install component: \"${COMPONENT}\"")
    set(CMAKE_INSTALL_COMPONENT "${COMPONENT}")
  else()
    set(CMAKE_INSTALL_COMPONENT)
  endif()
endif()

# Install shared libraries without execute permission?
if(NOT DEFINED CMAKE_INSTALL_SO_NO_EXE)
  set(CMAKE_INSTALL_SO_NO_EXE "1")
endif()

# Is this installation the result of a crosscompile?
if(NOT DEFINED CMAKE_CROSSCOMPILING)
  set(CMAKE_CROSSCOMPILING "TRUE")
endif()

# Set path to fallback-tool for dependency-resolution.
if(NOT DEFINED CMAKE_OBJDUMP)
  set(CMAKE_OBJDUMP "/home/samuka/Android/Sdk/ndk/30.0.16248370/toolchains/llvm/prebuilt/linux-x86_64/bin/llvm-objdump")
endif()

if(CMAKE_INSTALL_COMPONENT STREQUAL "fluidsynth_program" OR NOT CMAKE_INSTALL_COMPONENT)
  if(EXISTS "$ENV{DESTDIR}${CMAKE_INSTALL_PREFIX}/bin/fluidsynth" AND
     NOT IS_SYMLINK "$ENV{DESTDIR}${CMAKE_INSTALL_PREFIX}/bin/fluidsynth")
    file(RPATH_CHECK
         FILE "$ENV{DESTDIR}${CMAKE_INSTALL_PREFIX}/bin/fluidsynth"
         RPATH "")
  endif()
  file(INSTALL DESTINATION "${CMAKE_INSTALL_PREFIX}/bin" TYPE EXECUTABLE FILES "/home/samuka/workspace/sf2Player/prototipo-nativo/android/app/build/intermediates/cxx/Debug/30584g51/obj/arm64-v8a/fluidsynth")
  if(EXISTS "$ENV{DESTDIR}${CMAKE_INSTALL_PREFIX}/bin/fluidsynth" AND
     NOT IS_SYMLINK "$ENV{DESTDIR}${CMAKE_INSTALL_PREFIX}/bin/fluidsynth")
    if(CMAKE_INSTALL_DO_STRIP)
      execute_process(COMMAND "/home/samuka/Android/Sdk/ndk/30.0.16248370/toolchains/llvm/prebuilt/linux-x86_64/bin/llvm-strip" "$ENV{DESTDIR}${CMAKE_INSTALL_PREFIX}/bin/fluidsynth")
    endif()
  endif()
endif()

if(CMAKE_INSTALL_COMPONENT STREQUAL "fluidsynth_runtime" OR NOT CMAKE_INSTALL_COMPONENT)
  if(EXISTS "$ENV{DESTDIR}${CMAKE_INSTALL_PREFIX}/lib/libfluidsynth.so" AND
     NOT IS_SYMLINK "$ENV{DESTDIR}${CMAKE_INSTALL_PREFIX}/lib/libfluidsynth.so")
    file(RPATH_CHECK
         FILE "$ENV{DESTDIR}${CMAKE_INSTALL_PREFIX}/lib/libfluidsynth.so"
         RPATH "")
  endif()
  file(INSTALL DESTINATION "${CMAKE_INSTALL_PREFIX}/lib" TYPE SHARED_LIBRARY FILES "/home/samuka/workspace/sf2Player/prototipo-nativo/android/app/build/intermediates/cxx/Debug/30584g51/obj/arm64-v8a/libfluidsynth.so")
  if(EXISTS "$ENV{DESTDIR}${CMAKE_INSTALL_PREFIX}/lib/libfluidsynth.so" AND
     NOT IS_SYMLINK "$ENV{DESTDIR}${CMAKE_INSTALL_PREFIX}/lib/libfluidsynth.so")
    if(CMAKE_INSTALL_DO_STRIP)
      execute_process(COMMAND "/home/samuka/Android/Sdk/ndk/30.0.16248370/toolchains/llvm/prebuilt/linux-x86_64/bin/llvm-strip" "$ENV{DESTDIR}${CMAKE_INSTALL_PREFIX}/lib/libfluidsynth.so")
    endif()
  endif()
endif()

if(CMAKE_INSTALL_COMPONENT STREQUAL "fluidsynth_development" OR NOT CMAKE_INSTALL_COMPONENT)
endif()

if(CMAKE_INSTALL_COMPONENT STREQUAL "fluidsynth_development" OR NOT CMAKE_INSTALL_COMPONENT)
  file(INSTALL DESTINATION "${CMAKE_INSTALL_PREFIX}/include/fluidsynth" TYPE FILE FILES
    "/home/samuka/workspace/sf2Player/prototipo-nativo/android/app/.cxx/Debug/30584g51/arm64-v8a/_deps/fluidsynth-src/include/fluidsynth/audio.h"
    "/home/samuka/workspace/sf2Player/prototipo-nativo/android/app/.cxx/Debug/30584g51/arm64-v8a/_deps/fluidsynth-src/include/fluidsynth/event.h"
    "/home/samuka/workspace/sf2Player/prototipo-nativo/android/app/.cxx/Debug/30584g51/arm64-v8a/_deps/fluidsynth-src/include/fluidsynth/gen.h"
    "/home/samuka/workspace/sf2Player/prototipo-nativo/android/app/.cxx/Debug/30584g51/arm64-v8a/_deps/fluidsynth-src/include/fluidsynth/ladspa.h"
    "/home/samuka/workspace/sf2Player/prototipo-nativo/android/app/.cxx/Debug/30584g51/arm64-v8a/_deps/fluidsynth-src/include/fluidsynth/log.h"
    "/home/samuka/workspace/sf2Player/prototipo-nativo/android/app/.cxx/Debug/30584g51/arm64-v8a/_deps/fluidsynth-src/include/fluidsynth/midi.h"
    "/home/samuka/workspace/sf2Player/prototipo-nativo/android/app/.cxx/Debug/30584g51/arm64-v8a/_deps/fluidsynth-src/include/fluidsynth/misc.h"
    "/home/samuka/workspace/sf2Player/prototipo-nativo/android/app/.cxx/Debug/30584g51/arm64-v8a/_deps/fluidsynth-src/include/fluidsynth/mod.h"
    "/home/samuka/workspace/sf2Player/prototipo-nativo/android/app/.cxx/Debug/30584g51/arm64-v8a/_deps/fluidsynth-src/include/fluidsynth/seq.h"
    "/home/samuka/workspace/sf2Player/prototipo-nativo/android/app/.cxx/Debug/30584g51/arm64-v8a/_deps/fluidsynth-src/include/fluidsynth/seqbind.h"
    "/home/samuka/workspace/sf2Player/prototipo-nativo/android/app/.cxx/Debug/30584g51/arm64-v8a/_deps/fluidsynth-src/include/fluidsynth/settings.h"
    "/home/samuka/workspace/sf2Player/prototipo-nativo/android/app/.cxx/Debug/30584g51/arm64-v8a/_deps/fluidsynth-src/include/fluidsynth/sfont.h"
    "/home/samuka/workspace/sf2Player/prototipo-nativo/android/app/.cxx/Debug/30584g51/arm64-v8a/_deps/fluidsynth-src/include/fluidsynth/shell.h"
    "/home/samuka/workspace/sf2Player/prototipo-nativo/android/app/.cxx/Debug/30584g51/arm64-v8a/_deps/fluidsynth-src/include/fluidsynth/synth.h"
    "/home/samuka/workspace/sf2Player/prototipo-nativo/android/app/.cxx/Debug/30584g51/arm64-v8a/_deps/fluidsynth-src/include/fluidsynth/types.h"
    "/home/samuka/workspace/sf2Player/prototipo-nativo/android/app/.cxx/Debug/30584g51/arm64-v8a/_deps/fluidsynth-src/include/fluidsynth/voice.h"
    "/home/samuka/workspace/sf2Player/prototipo-nativo/android/app/.cxx/Debug/30584g51/arm64-v8a/_deps/fluidsynth-build/include/fluidsynth/version.h"
    )
endif()

if(CMAKE_INSTALL_COMPONENT STREQUAL "fluidsynth_development" OR NOT CMAKE_INSTALL_COMPONENT)
  file(INSTALL DESTINATION "${CMAKE_INSTALL_PREFIX}/include" TYPE FILE FILES "/home/samuka/workspace/sf2Player/prototipo-nativo/android/app/.cxx/Debug/30584g51/arm64-v8a/_deps/fluidsynth-build/include/fluidsynth.h")
endif()

if(CMAKE_INSTALL_COMPONENT STREQUAL "fluidsynth_development" OR NOT CMAKE_INSTALL_COMPONENT)
  if(EXISTS "$ENV{DESTDIR}${CMAKE_INSTALL_PREFIX}/lib/cmake/fluidsynth/FluidSynth-shared-targets.cmake")
    file(DIFFERENT _cmake_export_file_changed FILES
         "$ENV{DESTDIR}${CMAKE_INSTALL_PREFIX}/lib/cmake/fluidsynth/FluidSynth-shared-targets.cmake"
         "/home/samuka/workspace/sf2Player/prototipo-nativo/android/app/.cxx/Debug/30584g51/arm64-v8a/_deps/fluidsynth-build/src/CMakeFiles/Export/6a6ea4714c6c3916014c1d187313a071/FluidSynth-shared-targets.cmake")
    if(_cmake_export_file_changed)
      file(GLOB _cmake_old_config_files "$ENV{DESTDIR}${CMAKE_INSTALL_PREFIX}/lib/cmake/fluidsynth/FluidSynth-shared-targets-*.cmake")
      if(_cmake_old_config_files)
        string(REPLACE ";" ", " _cmake_old_config_files_text "${_cmake_old_config_files}")
        message(STATUS "Old export file \"$ENV{DESTDIR}${CMAKE_INSTALL_PREFIX}/lib/cmake/fluidsynth/FluidSynth-shared-targets.cmake\" will be replaced.  Removing files [${_cmake_old_config_files_text}].")
        unset(_cmake_old_config_files_text)
        file(REMOVE ${_cmake_old_config_files})
      endif()
      unset(_cmake_old_config_files)
    endif()
    unset(_cmake_export_file_changed)
  endif()
  file(INSTALL DESTINATION "${CMAKE_INSTALL_PREFIX}/lib/cmake/fluidsynth" TYPE FILE FILES "/home/samuka/workspace/sf2Player/prototipo-nativo/android/app/.cxx/Debug/30584g51/arm64-v8a/_deps/fluidsynth-build/src/CMakeFiles/Export/6a6ea4714c6c3916014c1d187313a071/FluidSynth-shared-targets.cmake")
  if(CMAKE_INSTALL_CONFIG_NAME MATCHES "^([Dd][Ee][Bb][Uu][Gg])$")
    file(INSTALL DESTINATION "${CMAKE_INSTALL_PREFIX}/lib/cmake/fluidsynth" TYPE FILE FILES "/home/samuka/workspace/sf2Player/prototipo-nativo/android/app/.cxx/Debug/30584g51/arm64-v8a/_deps/fluidsynth-build/src/CMakeFiles/Export/6a6ea4714c6c3916014c1d187313a071/FluidSynth-shared-targets-debug.cmake")
  endif()
endif()

string(REPLACE ";" "\n" CMAKE_INSTALL_MANIFEST_CONTENT
       "${CMAKE_INSTALL_MANIFEST_FILES}")
if(CMAKE_INSTALL_LOCAL_ONLY)
  file(WRITE "/home/samuka/workspace/sf2Player/prototipo-nativo/android/app/.cxx/Debug/30584g51/arm64-v8a/_deps/fluidsynth-build/src/install_local_manifest.txt"
     "${CMAKE_INSTALL_MANIFEST_CONTENT}")
endif()
