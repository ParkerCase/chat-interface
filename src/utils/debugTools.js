// Add this to a new file: src/utils/debugTools.js
export const checkCorsSetup = async () => {
  try {
    // Create a minimal fetch request with no additional headers
    const response = await fetch("http://147.182.247.128:4000/test-cors", {
      method: "GET",
      mode: "cors",
      credentials: "omit", // Important: do not send credentials
    });

    if (response.ok) {
      const data = await response.json();
      console.log("CORS Check Result:", data);
      return {
        success: true,
        message: "CORS setup is working correctly",
        details: data,
      };
    } else {
      return {
        success: false,
        message: `CORS check failed with status: ${response.status}`,
        status: response.status,
      };
    }
  } catch (error) {
    console.error("CORS Check Error:", error);
    return {
      success: false,
      message: "CORS check failed with error",
      error: error.message,
    };
  }
};
