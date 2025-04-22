// First, create a new file for custom brand icons
// src/components/icons/BrandIcons.jsx
import React from "react";

export const GoogleIcon = ({ size = 24, className = "" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M17.2 12c0-.6-.2-1.1-.5-1.5H12v3h3c-.2.4-.5.8-.9 1.1l1.5 1.2c.9-.8 1.6-2 1.6-3.8z" />
    <path d="M12 19c2.4 0 4.3-.8 5.7-2.1l-2.6-2.1c-.8.5-1.7.8-3.1.8-2.3 0-4.3-1.6-5-3.7H4.2v2.1C5.6 17 8.6 19 12 19z" />
    <path d="M7 11.5c0-.5.1-1 .3-1.5H4.2V12h2.8z" />
    <path d="M12 7.4c1.3 0 2.5.4 3.4 1.3L18 5.9C16.4 4.4 14.3 3.5 12 3.5c-3.4 0-6.4 2-7.8 5l2.8 2.1c.7-2.1 2.7-3.7 5-3.7z" />
  </svg>
);

export const AppleIcon = ({ size = 24, className = "" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M12 5c-1.8-2.2-4.3-2-5.8-1C4 5.1 3 7.4 3 9.8c0 3.4 2.3 6.2 4 8.2 1.7 2.1 3 3 5 3s3.3-.9 5-3c1.7-2 4-4.8 4-8.2 0-2.4-1-4.8-3.2-5.8-1.5-1-4-.8-5.8 1Z" />
    <path d="M12 5V3" />
  </svg>
);
