"use client";

export function checkConnectionSpeed() {
  return new Promise((resolve, reject) => {
    if (typeof navigator !== "undefined" && "connection" in navigator) {
      const connection =
        navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (connection?.effectiveType) {
        resolve(Number(connection.downlink) || 0);
        return;
      }
    }

    const xhr = new XMLHttpRequest();
    const url = `/window.svg?cache=${Date.now()}`;
    const startTime = Date.now();

    xhr.open("GET", url, true);
    xhr.responseType = "arraybuffer";

    xhr.onload = function () {
      if (xhr.status === 200) {
        const duration = Math.max((Date.now() - startTime) / 1000, 0.001);
        const fileSizeBits = (xhr.response?.byteLength || 0) * 8;
        const speedMbps = fileSizeBits / duration / (1024 * 1024);
        resolve(Number(speedMbps.toFixed(2)));
      } else {
        reject(new Error("Failed to load file"));
      }
    };

    xhr.onerror = function () {
      reject(new Error("Error in network request"));
    };

    xhr.send();
  });
}
