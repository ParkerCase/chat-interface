export const SharedSessionManager = {
  saveSession: (session) =>
    localStorage.setItem("claude_session", JSON.stringify(session)),
  getSession: () => {
    try {
      return JSON.parse(localStorage.getItem("claude_session"));
    } catch {
      return null;
    }
  },
  clearSession: () => localStorage.removeItem("claude_session"),
};
