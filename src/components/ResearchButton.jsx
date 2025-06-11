import React from "react";

export default function ResearchButton({ onClick }) {
  return (
    <button className="research-btn" onClick={onClick}>
      🔬 Advanced Research
    </button>
  );
}
