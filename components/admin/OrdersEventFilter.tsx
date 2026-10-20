"use client";

import { useState } from "react";

type EventOption = { id: string; title: string; active: boolean };
export function OrdersEventFilter({ events, eventId = "", eventActivity = "" }: {
  events: EventOption[]; eventId?: string; eventActivity?: string;
}) {
  const [activity, setActivity] = useState(eventActivity);
  const [selected, setSelected] = useState(eventId);
  const matches = (event: EventOption, value: string) => value === "active" ? event.active : value === "inactive" ? !event.active : true;
  return <div className="field">
    <label htmlFor="orders-event-activity">Situação dos eventos</label>
    <select id="orders-event-activity" name="eventActivity" value={activity} onChange={e => {
      const value = e.target.value;
      setActivity(value);
      if (!events.some(event => event.id === selected && matches(event, value))) setSelected("");
    }}>
      <option value="">Todos</option>
      <option value="active">Ativos / atuais e futuros</option>
      <option value="inactive">Inativos / passados</option>
    </select>
    <label htmlFor="orders-event">Evento</label>
    <select id="orders-event" name="eventId" value={selected} onChange={e => setSelected(e.target.value)}>
      <option value="">{activity === "active" ? "Todos os eventos ativos" : activity === "inactive" ? "Todos os eventos inativos/passados" : "Todos os eventos"}</option>
      {events.filter(event => matches(event, activity)).map(event => <option key={event.id} value={event.id}>{event.title}</option>)}
    </select>
  </div>;
}
