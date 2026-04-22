"use client";

import { useMemo, useState } from "react";

type EventOption = {
  id: string;
  title: string;
};

type AdminUserEventScopeFieldProps = {
  events: EventOption[];
  defaultAccessAllEvents: boolean;
  defaultAllowedEventIds?: string[];
  lockedToAllEvents?: boolean;
};

export function AdminUserEventScopeField({
  events,
  defaultAccessAllEvents,
  defaultAllowedEventIds = [],
  lockedToAllEvents = false
}: AdminUserEventScopeFieldProps) {
  const [scopeMode, setScopeMode] = useState<"ALL" | "SELECTED">(
    lockedToAllEvents || defaultAccessAllEvents ? "ALL" : "SELECTED"
  );

  const allowedSet = useMemo(() => new Set(defaultAllowedEventIds), [defaultAllowedEventIds]);
  const selectionDisabled = lockedToAllEvents || scopeMode === "ALL";

  return (
    <div className="eventScopeField">
      <input type="hidden" name="scopeMode" value={scopeMode} />

      <div className="eventScopeModes" role="radiogroup" aria-label="Escopo de eventos">
        <label className={`eventScopeMode ${scopeMode === "ALL" ? "isActive" : ""}`}>
          <input
            type="radio"
            name="scopeModeVisual"
            value="ALL"
            checked={scopeMode === "ALL"}
            onChange={() => setScopeMode("ALL")}
            disabled={lockedToAllEvents}
          />
          <span>Todos os eventos</span>
        </label>
        <label className={`eventScopeMode ${scopeMode === "SELECTED" ? "isActive" : ""}`}>
          <input
            type="radio"
            name="scopeModeVisual"
            value="SELECTED"
            checked={scopeMode === "SELECTED"}
            onChange={() => setScopeMode("SELECTED")}
            disabled={lockedToAllEvents}
          />
          <span>Eventos específicos</span>
        </label>
      </div>

      <div className={`eventScopeChecklist ${selectionDisabled ? "isDisabled" : ""}`}>
        {events.length === 0 ? (
          <small className="muted">Nenhum evento disponível para selecionar.</small>
        ) : (
          events.map((event) => (
            <label className="checkboxField compact" key={event.id}>
              <input
                type="checkbox"
                name="allowedEventIds"
                value={event.id}
                defaultChecked={allowedSet.has(event.id)}
                disabled={selectionDisabled}
              />
              <span>{event.title}</span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}
