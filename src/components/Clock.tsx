
import React, { useState, useEffect } from "react";

interface ClockProps {
  className?: string;
}

export function Clock({ className }: ClockProps) {
  const [time, setTime] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }));
    };
    updateTime();
    const clockInterval = setInterval(updateTime, 1000);
    return () => clearInterval(clockInterval);
  }, []);

  return <span className={className}>{time}</span>;
}
