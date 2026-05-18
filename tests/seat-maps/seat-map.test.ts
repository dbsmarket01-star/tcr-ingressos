import { describe, expect, it } from "vitest";
import {
  createRestaurantPreset,
  createTableSeats,
  createTheaterSeats,
  getLayoutSeats,
  normalizeSeatMapLayout
} from "@/features/seat-maps/seat-map";
import { eventMapLayoutToFormValue, parseEventMapLayoutFormValue } from "@/features/events/event-map";

describe("seat map layout", () => {
  it("generates table seats around the table center", () => {
    const seats = createTableSeats({
      tableId: "mesa-12",
      sectionId: "ouro",
      tableLabel: "12",
      x: 100,
      y: 100,
      width: 80,
      height: 80,
      shape: "ROUND",
      seats: 8,
      priceInCents: 80000
    });

    expect(seats).toHaveLength(8);
    expect(seats[0]).toMatchObject({
      id: "mesa-12-seat-1",
      sectionId: "ouro",
      tableId: "mesa-12",
      number: "1",
      priceInCents: 80000
    });
    expect(new Set(seats.map((seat) => `${seat.x}:${seat.y}`)).size).toBe(8);
  });

  it("limits generated table seats to twenty places", () => {
    const seats = createTableSeats({
      tableId: "mesa-grande",
      sectionId: "jantar",
      tableLabel: "Mesa grande",
      x: 0,
      y: 0,
      width: 160,
      height: 90,
      shape: "RECTANGLE",
      seats: 40
    });

    expect(seats).toHaveLength(20);
  });

  it("generates theater rows with stable labels", () => {
    const seats = createTheaterSeats({
      sectionId: "plateia",
      x: 50,
      y: 80,
      rows: 2,
      columns: 3,
      priceInCents: 65000
    });

    expect(seats.map((seat) => seat.label)).toEqual(["A1", "A2", "A3", "B1", "B2", "B3"]);
    expect(seats[3]).toMatchObject({
      row: "B",
      number: "1",
      priceInCents: 65000
    });
  });

  it("normalizes a complete restaurant preset", () => {
    const layout = normalizeSeatMapLayout(createRestaurantPreset());

    expect(layout?.kind).toBe("RESTAURANT");
    expect(layout?.sections).toHaveLength(2);
    expect(layout ? getLayoutSeats(layout) : []).toHaveLength(192);
  });

  it("keeps numbered seat maps when event map form values are parsed", () => {
    const stored = parseEventMapLayoutFormValue(JSON.stringify(createRestaurantPreset()));
    const formValue = eventMapLayoutToFormValue(stored);
    const layout = normalizeSeatMapLayout(formValue);

    expect(layout?.kind).toBe("RESTAURANT");
    expect(layout ? getLayoutSeats(layout) : []).toHaveLength(192);
  });
});
