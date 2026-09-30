"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { checkConnectionSpeed } from "../../hooks/useConnectionSpeed";

const DURATION_MS = 30000;

function ConnectionNotification({ message, type, duration, onHide }) {
  const [visible, setVisible] = useState(true);
  const hiddenRef = useRef(false);

  const hideNotification = useCallback(() => {
    if (hiddenRef.current) return;
    hiddenRef.current = true;
    setVisible(false);
    onHide();
  }, [onHide]);

  useEffect(() => {
    hiddenRef.current = false;
    setVisible(true);
    const timer = setTimeout(hideNotification, duration);
    return () => clearTimeout(timer);
  }, [duration, hideNotification, message, type]);

  if (!visible) return null;

  return (
    <div className={`ged-speed-notification ${type}`} onClick={hideNotification} role="status">
      {message}
    </div>
  );
}

export default function ConnectionSpeedNotifier() {
  const [currentNotification, setCurrentNotification] = useState(null);
  const queueRef = useRef([]);
  const isOnlineRef = useRef(true);
  const wasOfflineRef = useRef(false);
  const checkSpeedPendingRef = useRef(false);
  const checkSpeedRef = useRef(() => {});

  const showNextNotification = useCallback(() => {
    if (queueRef.current.length > 0) {
      setCurrentNotification(queueRef.current.shift());
      return;
    }

    setCurrentNotification(null);
    if (checkSpeedPendingRef.current) {
      checkSpeedPendingRef.current = false;
      setTimeout(() => checkSpeedRef.current(), 31000);
    }
  }, []);

  const notifIdRef = useRef(0);

  const addNotification = useCallback((notification) => {
    queueRef.current.push({
      ...notification,
      id: ++notifIdRef.current,
    });
    setCurrentNotification((current) => {
      if (current) return current;
      return queueRef.current.shift() || null;
    });
  }, []);

  useEffect(() => {
    isOnlineRef.current = typeof navigator === "undefined" ? true : navigator.onLine;

    const checkSpeed = () => {
      if (!isOnlineRef.current) return;

      checkConnectionSpeed()
        .then((speed) => {
          if (speed < 1) {
            addNotification({ message: "Débit internet lent !", type: "error" });
          } else if (speed < 5) {
            addNotification({ message: "Débit internet moyen.", type: "warning" });
          } else {
            addNotification({
              message: "Bon débit internet pour envoyer les requêtes.",
              type: "info",
            });
          }
        })
        .catch((error) => {
          console.error("Error checking connection speed:", error);
        });
    };

    checkSpeedRef.current = checkSpeed;

    const updateOnlineStatus = () => {
      isOnlineRef.current = navigator.onLine;
      if (!isOnlineRef.current) {
        wasOfflineRef.current = true;
        addNotification({
          message: "Vous avez perdu la connexion internet !",
          type: "error",
        });
      } else if (wasOfflineRef.current) {
        wasOfflineRef.current = false;
        addNotification({
          message: "Connexion internet rétablie.",
          type: "success",
        });
        checkSpeedPendingRef.current = true;
      }
    };

    checkSpeed();
    const intervalId = setInterval(checkSpeed, 60000);
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, [addNotification]);

  return (
    <>
      {currentNotification && (
        <ConnectionNotification
          key={currentNotification.id}
          message={currentNotification.message}
          type={currentNotification.type}
          duration={DURATION_MS}
          onHide={showNextNotification}
        />
      )}
      <style jsx global>{`
        .ged-speed-notification {
          position: fixed;
          top: calc(4rem + 8px);
          left: 50%;
          transform: translateX(-50%);
          padding: 10px 20px;
          border-radius: 5px;
          color: #fff;
          cursor: pointer;
          z-index: 1000;
          animation: ged-speed-fade-in 0.5s ease;
        }
        .ged-speed-notification.info {
          background-color: #2196f3;
        }
        .ged-speed-notification.warning {
          background-color: #ff9800;
        }
        .ged-speed-notification.error {
          background-color: #f44336;
        }
        .ged-speed-notification.success {
          background-color: #4caf50;
        }
        @keyframes ged-speed-fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </>
  );
}
