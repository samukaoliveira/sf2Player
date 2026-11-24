# Distributed under the OSI-approved BSD 3-Clause License.  See accompanying
# file Copyright.txt or https://cmake.org/licensing for details.

cmake_minimum_required(VERSION ${CMAKE_VERSION}) # this file comes with cmake

# If CMAKE_DISABLE_SOURCE_CHANGES is set to true and the source directory is an
# existing directory in our source tree, calling file(MAKE_DIRECTORY) on it
# would cause a fatal error, even though it would be a no-op.
if(NOT EXISTS "/home/samuka/workspace/sf2Player/prototipo-nativo/android/app/.cxx/Debug/30584g51/arm64-v8a/_deps/fluidsynth-src")
  file(MAKE_DIRECTORY "/home/samuka/workspace/sf2Player/prototipo-nativo/android/app/.cxx/Debug/30584g51/arm64-v8a/_deps/fluidsynth-src")
endif()
file(MAKE_DIRECTORY
  "/home/samuka/workspace/sf2Player/prototipo-nativo/android/app/.cxx/Debug/30584g51/arm64-v8a/_deps/fluidsynth-build"
  "/home/samuka/workspace/sf2Player/prototipo-nativo/android/app/.cxx/Debug/30584g51/arm64-v8a/_deps/fluidsynth-subbuild/fluidsynth-populate-prefix"
  "/home/samuka/workspace/sf2Player/prototipo-nativo/android/app/.cxx/Debug/30584g51/arm64-v8a/_deps/fluidsynth-subbuild/fluidsynth-populate-prefix/tmp"
  "/home/samuka/workspace/sf2Player/prototipo-nativo/android/app/.cxx/Debug/30584g51/arm64-v8a/_deps/fluidsynth-subbuild/fluidsynth-populate-prefix/src/fluidsynth-populate-stamp"
  "/home/samuka/workspace/sf2Player/prototipo-nativo/android/app/.cxx/Debug/30584g51/arm64-v8a/_deps/fluidsynth-subbuild/fluidsynth-populate-prefix/src"
  "/home/samuka/workspace/sf2Player/prototipo-nativo/android/app/.cxx/Debug/30584g51/arm64-v8a/_deps/fluidsynth-subbuild/fluidsynth-populate-prefix/src/fluidsynth-populate-stamp"
)

set(configSubDirs )
foreach(subDir IN LISTS configSubDirs)
    file(MAKE_DIRECTORY "/home/samuka/workspace/sf2Player/prototipo-nativo/android/app/.cxx/Debug/30584g51/arm64-v8a/_deps/fluidsynth-subbuild/fluidsynth-populate-prefix/src/fluidsynth-populate-stamp/${subDir}")
endforeach()
if(cfgdir)
  file(MAKE_DIRECTORY "/home/samuka/workspace/sf2Player/prototipo-nativo/android/app/.cxx/Debug/30584g51/arm64-v8a/_deps/fluidsynth-subbuild/fluidsynth-populate-prefix/src/fluidsynth-populate-stamp${cfgdir}") # cfgdir has leading slash
endif()
