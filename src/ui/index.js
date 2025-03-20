// src/components/ui/index.js
// This bridges the UI components from your backend to your frontend

import React from "react";

// Basic input components
export const Input = (props) => <input className="form-input" {...props} />;
export const Button = ({
  variant = "default",
  size = "md",
  asChild,
  className = "",
  children,
  ...props
}) => {
  const baseClass = "btn";
  const variantClass = variant ? `btn-${variant}` : "";
  const sizeClass = size ? `btn-${size}` : "";

  const Element = asChild
    ? React.cloneElement(React.Children.only(children), {
        ...props,
        className: `${baseClass} ${variantClass} ${sizeClass} ${className}`,
      })
    : "button";

  return asChild ? (
    Element
  ) : (
    <Element
      className={`${baseClass} ${variantClass} ${sizeClass} ${className}`}
      {...props}
    >
      {children}
    </Element>
  );
};

export const Textarea = (props) => (
  <textarea className="form-textarea" {...props} />
);
export const Label = ({ children, ...props }) => (
  <label className="form-label" {...props}>
    {children}
  </label>
);
export const Select = (props) => <select className="form-select" {...props} />;

// Card components
export const Card = ({ className = "", children, ...props }) => (
  <div className={`card ${className}`} {...props}>
    {children}
  </div>
);
export const CardHeader = (props) => <div className="card-header" {...props} />;
export const CardTitle = (props) => <h3 className="card-title" {...props} />;
export const CardDescription = (props) => (
  <p className="card-description" {...props} />
);
export const CardContent = (props) => (
  <div className="card-content" {...props} />
);
export const CardBody = (props) => <div className="card-body" {...props} />;
export const CardFooter = (props) => <div className="card-footer" {...props} />;

// Dialog components
export const Dialog = ({ open, onOpenChange, children }) =>
  open ? (
    <div className="dialog-overlay" onClick={() => onOpenChange(false)}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  ) : null;
export const DialogContent = (props) => (
  <div className="dialog-content" {...props} />
);
export const DialogHeader = (props) => (
  <div className="dialog-header" {...props} />
);
export const DialogTitle = (props) => (
  <h3 className="dialog-title" {...props} />
);
export const DialogFooter = (props) => (
  <div className="dialog-footer" {...props} />
);

// Alert components
export const Alert = ({ variant = "default", children, ...props }) => (
  <div className={`alert alert-${variant}`} {...props}>
    {children}
  </div>
);
export const AlertTitle = (props) => <h4 className="alert-title" {...props} />;

// Misc components
export const Spinner = ({ size = "md", className = "", ...props }) => (
  <div className={`spinner spinner-${size} ${className}`} {...props} />
);
export const Avatar = (props) => <div className="avatar" {...props} />;
export const Badge = ({ variant = "default", children, ...props }) => (
  <span className={`badge badge-${variant}`} {...props}>
    {children}
  </span>
);
export const Table = (props) => <table className="table" {...props} />;

// Tabs components
export const Tabs = ({ defaultValue, children, ...props }) => {
  const [activeTab, setActiveTab] = React.useState(defaultValue);

  return (
    <div className="tabs" {...props}>
      {React.Children.map(children, (child) => {
        if (
          child.type.name === "TabsList" ||
          child.type.name === "TabsContent"
        ) {
          return React.cloneElement(child, { activeTab, setActiveTab });
        }
        return child;
      })}
    </div>
  );
};

export const TabsList = ({ activeTab, setActiveTab, children, ...props }) => (
  <div className="tabs-list" {...props}>
    {React.Children.map(children, (child) => {
      if (child.type.name === "TabsTrigger") {
        return React.cloneElement(child, { activeTab, setActiveTab });
      }
      return child;
    })}
  </div>
);

export const TabsTrigger = ({
  value,
  activeTab,
  setActiveTab,
  children,
  disabled,
  ...props
}) => (
  <button
    className={`tabs-trigger ${activeTab === value ? "active" : ""} ${
      disabled ? "disabled" : ""
    }`}
    onClick={() => !disabled && setActiveTab(value)}
    disabled={disabled}
    {...props}
  >
    {children}
  </button>
);

export const TabsContent = ({ value, activeTab, children, ...props }) =>
  activeTab === value ? (
    <div className="tabs-content" {...props}>
      {children}
    </div>
  ) : null;

// Popover components
export const Popover = ({ open, onOpenChange, children }) => {
  return (
    <div className="popover-container">
      {React.Children.map(children, (child) => {
        if (
          child.type.name === "PopoverTrigger" ||
          child.type.name === "PopoverContent"
        ) {
          return React.cloneElement(child, { open, onOpenChange });
        }
        return child;
      })}
    </div>
  );
};

export const PopoverTrigger = ({ open, onOpenChange, children, ...props }) => (
  <div onClick={() => onOpenChange(!open)} {...props}>
    {children}
  </div>
);

export const PopoverContent = ({ open, children, ...props }) =>
  open ? (
    <div className="popover-content" {...props}>
      {children}
    </div>
  ) : null;
