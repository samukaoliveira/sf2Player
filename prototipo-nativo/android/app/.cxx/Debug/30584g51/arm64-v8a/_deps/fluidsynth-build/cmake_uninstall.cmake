IF(NOT EXISTS "/home/samuka/workspace/sf2Player/prototipo-nativo/android/app/.cxx/Debug/30584g51/arm64-v8a/_deps/fluidsynth-build/install_manifest.txt")
  MESSAGE(FATAL_ERROR "Cannot find install manifest: \"/home/samuka/workspace/sf2Player/prototipo-nativo/android/app/.cxx/Debug/30584g51/arm64-v8a/_deps/fluidsynth-build/install_manifest.txt\"")
ENDIF(NOT EXISTS "/home/samuka/workspace/sf2Player/prototipo-nativo/android/app/.cxx/Debug/30584g51/arm64-v8a/_deps/fluidsynth-build/install_manifest.txt")

FILE(READ "/home/samuka/workspace/sf2Player/prototipo-nativo/android/app/.cxx/Debug/30584g51/arm64-v8a/_deps/fluidsynth-build/install_manifest.txt" files)
STRING(REGEX REPLACE "\n" ";" files "${files}")
FOREACH(file ${files})
  MESSAGE(STATUS "Uninstalling \"${file}\"")
  IF(EXISTS "${file}")
    EXEC_PROGRAM(
      "/home/samuka/Android/Sdk/cmake/3.31.1/bin/cmake" ARGS "-E remove \"${file}\""
      OUTPUT_VARIABLE rm_out
      RETURN_VALUE rm_retval
      )
    IF("${rm_retval}" STREQUAL 0)
    ELSE("${rm_retval}" STREQUAL 0)
      MESSAGE(FATAL_ERROR "Problem when removing \"${file}\"")
    ENDIF("${rm_retval}" STREQUAL 0)
  ELSE(EXISTS "${file}")
    MESSAGE(STATUS "File \"${file}\" does not exist.")
  ENDIF(EXISTS "${file}")
ENDFOREACH(file)
