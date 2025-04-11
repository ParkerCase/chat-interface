import React, { useState } from "react";
import {
  Shield,
  Clock,
  AlertTriangle,
  CheckCircle,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useNotifications } from "../../context/NotificationContext";
import "./SecurityCenter.css";

function SecurityCenter() {
  const { securityEvents } = useNotifications();
  const [expandedEvent, setExpandedEvent] = useState(null);

  const toggleEvent = (id) => {
    setExpandedEvent(expandedEvent === id ? null : id);
  };

  const formatDate = (isoString) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString();
    } catch (e) {
      return isoString;
    }
  };

  // Group events by date
  const groupedEvents = securityEvents.reduce((groups, event) => {
    try {
      const date = new Date(event.timestamp).toLocaleDateString();
      if (!groups[date]) groups[date] = [];
      groups[date].push(event);
      return groups;
    } catch (e) {
      const fallback = "Unknown Date";
      if (!groups[fallback]) groups[fallback] = [];
      groups[fallback].push(event);
      return groups;
    }
  }, {});

  const getEventIcon = (type) => {
    switch (type) {
      case "success":
        return <CheckCircle size={18} className="event-icon success" />;
      case "warning":
        return <AlertTriangle size={18} className="event-icon warning" />;
      case "error":
        return <AlertTriangle size={18} className="event-icon error" />;
      default:
        return <Info size={18} className="event-icon info" />;
    }
  };

  return (
    <div className="security-center">
      <div className="security-center-header">
        <Shield className="security-icon" />
        <h2>Security Center</h2>
      </div>

      {securityEvents.length === 0 ? (
        <div className="no-events">
          <p>No security events to display.</p>
        </div>
      ) : (
        <div className="security-timeline">
          {Object.entries(groupedEvents).map(([date, events]) => (
            <div key={date} className="timeline-group">
              <div className="timeline-date">{date}</div>

              <div className="timeline-events">
                {events.map((event) => (
                  <div
                    key={event.id}
                    className={`timeline-event ${event.type} ${
                      expandedEvent === event.id ? "expanded" : ""
                    }`}
                  >
                    <div
                      className="event-header"
                      onClick={() => toggleEvent(event.id)}
                    >
                      {getEventIcon(event.type)}
                      <div className="event-summary">
                        <h4>{event.title}</h4>
                        <p>{event.message}</p>
                      </div>
                      <div className="event-time">
                        <Clock size={14} />
                        <span>{formatDate(event.timestamp).split(",")[1]}</span>
                      </div>
                      <button className="expand-button">
                        {expandedEvent === event.id ? (
                          <ChevronUp size={16} />
                        ) : (
                          <ChevronDown size={16} />
                        )}
                      </button>
                    </div>

                    {expandedEvent === event.id && event.details && (
                      <div className="event-details">
                        {Object.entries(event.details).map(([key, value]) => (
                          <div key={key} className="detail-row">
                            <span className="detail-label">{key}:</span>
                            <span className="detail-value">
                              {key === "time"
                                ? formatDate(value)
                                : value.toString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default SecurityCenter;
