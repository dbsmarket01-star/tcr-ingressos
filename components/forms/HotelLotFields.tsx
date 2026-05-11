"use client";

import { useMemo, useState } from "react";

type HotelOption = {
  id: string;
  name: string;
  city: string;
  state: string;
};

type HotelLotFieldsProps = {
  hotels: HotelOption[];
  defaultHasHotel?: boolean;
  defaultHotelId?: string | null;
  defaultHotel?: {
    name?: string | null;
    city?: string | null;
    state?: string | null;
    internalNotes?: string | null;
    availableRooms?: number | null;
  } | null;
};

export function HotelLotFields({
  hotels,
  defaultHasHotel = false,
  defaultHotelId,
  defaultHotel
}: HotelLotFieldsProps) {
  const [hasHotel, setHasHotel] = useState(defaultHasHotel);
  const [hotelMode, setHotelMode] = useState(defaultHotelId ? "existing" : "new");

  const selectedHotelLabel = useMemo(() => {
    const hotel = hotels.find((item) => item.id === defaultHotelId);
    return hotel ? `${hotel.name} - ${hotel.city}/${hotel.state}` : "";
  }, [defaultHotelId, hotels]);

  return (
    <div className="formSection hotelLotSection">
      <div className="formSectionHeader">
        <div>
          <span className="sectionEyebrow">HOME LIST / hotelaria</span>
          <h2>Hospedagem vinculada ao ingresso</h2>
        </div>
        <p className="muted">
          Ative apenas quando este ingresso inclui hotel e precisa coletar dados dos hóspedes no checkout.
        </p>
      </div>

      <fieldset className="segmentedField">
        <legend>Este ingresso possui hotel?</legend>
        <label>
          <input
            checked={hasHotel}
            name="hasHotel"
            onChange={() => setHasHotel(true)}
            type="radio"
            value="true"
          />
          <span>Sim</span>
        </label>
        <label>
          <input
            checked={!hasHotel}
            name="hasHotel"
            onChange={() => setHasHotel(false)}
            type="radio"
            value="false"
          />
          <span>Não</span>
        </label>
      </fieldset>

      {hasHotel ? (
        <div className="hotelLotFields">
          <fieldset className="segmentedField compactSegmentedField">
            <legend>Hotel</legend>
            <label>
              <input
                checked={hotelMode === "existing"}
                disabled={hotels.length === 0}
                onChange={() => setHotelMode("existing")}
                type="radio"
                value="existing"
              />
              <span>Selecionar cadastrado</span>
            </label>
            <label>
              <input
                checked={hotelMode === "new"}
                onChange={() => setHotelMode("new")}
                type="radio"
                value="new"
              />
              <span>Criar novo hotel</span>
            </label>
          </fieldset>

          {hotelMode === "existing" && hotels.length > 0 ? (
            <label className="field">
              <span>Hotel cadastrado</span>
              <select name="hotelId" defaultValue={defaultHotelId ?? ""} required={hotelMode === "existing"}>
                <option value="">Selecione um hotel</option>
                {hotels.map((hotel) => (
                  <option value={hotel.id} key={hotel.id}>
                    {hotel.name} - {hotel.city}/{hotel.state}
                  </option>
                ))}
              </select>
              {selectedHotelLabel ? <small>Atual: {selectedHotelLabel}</small> : null}
            </label>
          ) : null}

          {hotelMode === "new" ? (
            <div className="hotelCreateGrid">
              <label className="field">
                <span>Nome do hotel</span>
                <input name="newHotelName" defaultValue={defaultHotelId ? "" : defaultHotel?.name ?? ""} required />
              </label>
              <label className="field">
                <span>Cidade</span>
                <input name="newHotelCity" defaultValue={defaultHotelId ? "" : defaultHotel?.city ?? ""} required />
              </label>
              <label className="field">
                <span>Estado</span>
                <input
                  name="newHotelState"
                  defaultValue={defaultHotelId ? "" : defaultHotel?.state ?? ""}
                  maxLength={2}
                  required
                />
              </label>
              <label className="field">
                <span>Quantidade de quartos disponível</span>
                <input
                  name="newHotelAvailableRooms"
                  defaultValue={defaultHotelId ? "" : defaultHotel?.availableRooms ?? ""}
                  min="0"
                  type="number"
                />
              </label>
              <label className="field hotelNotesField">
                <span>Observações internas</span>
                <textarea
                  name="newHotelInternalNotes"
                  defaultValue={defaultHotelId ? "" : defaultHotel?.internalNotes ?? ""}
                  rows={3}
                />
              </label>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
