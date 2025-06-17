// Test callback component to verify routing
import React, { useEffect } from "react";

function TestCallback() {
  useEffect(() => {
    console.log("TestCallback component mounted");
    console.log("Current URL:", window.location.href);
    console.log("URL params:", Object.fromEntries(new URLSearchParams(window.location.search)));
    
    // Store in sessionStorage for persistence
    sessionStorage.setItem("testCallbackLoaded", "true");
    sessionStorage.setItem("testCallbackURL", window.location.href);
  }, []);

  return (
    <div style={{ padding: "20px", background: "#f0f0f0", margin: "20px" }}>
      <h1>TEST CALLBACK COMPONENT</h1>
      <p>This component loaded successfully!</p>
      <p>Current URL: {window.location.href}</p>
      <p>URL Parameters:</p>
      <pre>{JSON.stringify(Object.fromEntries(new URLSearchParams(window.location.search)), null, 2)}</pre>
    </div>
  );
}

export default TestCallback;
