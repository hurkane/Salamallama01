import React, { useEffect } from "react";

const TestGetUserMedia = () => {
  useEffect(() => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then(function (stream) {
          console.log("getUserMedia succeeded:", stream);
        })
        .catch(function (err) {
          console.log("getUserMedia failed:", err);
        });
    } else {
      console.log("getUserMedia is not supported by this browser.");
    }
  }, []);

  return (
    <div>
      <h1>Test GetUserMedia</h1>
      <p>Check the console for results.</p>
    </div>
  );
};

export default TestGetUserMedia;
