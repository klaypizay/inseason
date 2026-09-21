"use client";
import { useId } from "react";
import { useTimePreference } from "./preferences-provider";

// Keep local HH:mm values unchanged while displaying the coach's chosen clock.
export function TimeInput({
  label,
  value,
  onChange,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  const labelId = useId();
  const twelveHour = useTimePreference() === "12-hour";
  const hour = value ? Number(value.slice(0, 2)) : 0;
  const minute = value ? value.slice(3) : "00";
  const period = hour < 12 ? "AM" : "PM";
  function update(nextHour: number, nextMinute = minute) {
    onChange(`${String(nextHour).padStart(2, "0")}:${nextMinute}`);
  }
  return (
    <div>
      <label htmlFor={labelId + "-hour"} id={labelId}>
        {label}
      </label>
      <div className="time-input" role="group" aria-labelledby={labelId}>
        <select
          id={labelId + "-hour"}
          aria-label={`${label} hour`}
          required={required}
          value={value ? String(twelveHour ? hour % 12 || 12 : hour) : ""}
          onChange={(e) => {
            if (e.target.value === "") return onChange("");
            const selected = Number(e.target.value);
            update(
              twelveHour
                ? (selected % 12) + (period === "PM" ? 12 : 0)
                : selected,
            );
          }}
        >
          <option value="">—</option>
          {Array.from({ length: twelveHour ? 12 : 24 }, (_, index) => {
            const number = index + (twelveHour ? 1 : 0);
            return (
              <option key={number} value={number}>
                {twelveHour ? number : String(number).padStart(2, "0")}
              </option>
            );
          })}
        </select>
        <span aria-hidden="true">:</span>
        <select
          aria-label={`${label} minute`}
          disabled={!value}
          value={minute}
          onChange={(e) => update(hour, e.target.value)}
        >
          {Array.from({ length: 60 }, (_, index) => {
            const number = String(index).padStart(2, "0");
            return <option key={number}>{number}</option>;
          })}
        </select>
        {twelveHour && (
          <select
            aria-label={`${label} AM or PM`}
            disabled={!value}
            value={period}
            onChange={(e) =>
              update((hour % 12) + (e.target.value === "PM" ? 12 : 0))
            }
          >
            <option>AM</option>
            <option>PM</option>
          </select>
        )}
      </div>
    </div>
  );
}
