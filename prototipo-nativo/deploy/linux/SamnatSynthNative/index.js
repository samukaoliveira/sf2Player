const path = require("path");
const { isMainThread } = require("worker_threads");
// Fix so that linux resources are found correctly
// since webpack will bundle them such that the expected path is /dist from cwd
// Qode can preload this launcher inside worker threads. process.chdir() is
// forbidden there, and loading the UI bundle in a worker would start Qt twice.
if (isMainThread) {
    process.chdir(path.resolve(path.dirname(process.execPath)));
    // Now start loading the actual bundle
    require("./dist");
}
