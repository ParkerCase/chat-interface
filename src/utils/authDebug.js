// src/utils/authDebug.js
export const debugAuth = {
  log: function (component, action, data) {
    const timestamp = new Date().toISOString();
    console.log(
      `[${timestamp}] [AuthDebug] [${component}] ${action}`,
      data || ""
    );
  },

  monitorPromise: function (promise, name) {
    this.log("PromiseMonitor", `${name} - Started`);
    const timeoutMs = 5000; // 5 seconds timeout

    // Set a timeout to detect hanging promises
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`${name} - TIMEOUT after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    // Race the actual promise against the timeout
    return Promise.race([
      promise
        .then((result) => {
          this.log("PromiseMonitor", `${name} - Completed successfully`);
          return result;
        })
        .catch((error) => {
          this.log("PromiseMonitor", `${name} - Failed with error`, error);
          throw error;
        }),
      timeoutPromise,
    ]);
  },
};
