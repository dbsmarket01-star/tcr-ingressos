import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TicketQuantityStepper } from "@/app/evento/[slug]/TicketQuantityStepper";
import { TicketTypeSelector } from "@/app/evento/[slug]/TicketTypeSelector";

function renderTicketPickerForm(children: React.ReactNode) {
  return renderToStaticMarkup(
    React.createElement(
      "form",
      {
        action: "/evento/claudio-duarte-em-catanduva/checkout",
        className: "form",
        method: "get",
        noValidate: true
      },
      children
    )
  );
}

describe("TicketTypeSelector", () => {
  it("does not force a type option when another ticket lot is selected", () => {
    const markup = renderToStaticMarkup(
      React.createElement(TicketTypeSelector, {
        label: "Camarote",
        lotId: "lot_camarote",
        options: [
          {
            id: "option_1",
            label: "Mesa 1"
          }
        ]
      })
    );

    expect(markup).toContain('name="lotOption_lot_camarote"');
    expect(markup).not.toContain('name="lotId"');
    expect(markup).not.toContain("required");
  });

  it("does not submit an unselected regular ticket lot", () => {
    const markup = renderToStaticMarkup(
      React.createElement(TicketQuantityStepper, {
        label: "Pista",
        lotId: "lot_pista",
        max: 4,
        name: "quantity_lot_pista"
      })
    );

    expect(markup).toContain('name="quantity_lot_pista"');
    expect(markup).not.toContain('name="lotId"');
  });

  it("keeps browser validation disabled on the ticket picker form", () => {
    const markup = renderTicketPickerForm(
      React.createElement(TicketTypeSelector, {
        label: "Camarote",
        lotId: "lot_camarote",
        options: [
          {
            id: "option_1",
            label: "Mesa 1"
          }
        ]
      })
    );

    expect(markup).toContain("<form");
    expect(markup).toContain("noValidate");
  });
});
