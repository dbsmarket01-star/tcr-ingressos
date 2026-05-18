import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { HotelLotFields } from "@/components/forms/HotelLotFields";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { requirePermission } from "@/features/auth/auth.service";
import { listHotelsForOrganization } from "@/features/hospitality/hotel.service";
import { updateTicketLotAction } from "@/features/lots/lot.actions";
import { getTicketLotForEdit } from "@/features/lots/lot.service";

export const dynamic = "force-dynamic";

type EditLotPageProps = {
  params: Promise<{
    eventId: string;
    lotId: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const ticketHighlightColorOptions = [
  { label: "Sem destaque", value: "" },
  { label: "Ouro", value: "#d7a629" },
  { label: "Prata", value: "#8f9aa6" },
  { label: "Roxo", value: "#7c3aed" },
  { label: "Azul", value: "#2563eb" },
  { label: "Verde", value: "#28734f" }
];

export default async function EditLotPage({ params, searchParams }: EditLotPageProps) {
  const admin = await requirePermission("EVENTS");
  const { eventId, lotId } = await params;
  const query = searchParams ? await searchParams : {};
  const [lot, hotels] = await Promise.all([
    getTicketLotForEdit(eventId, lotId),
    listHotelsForOrganization(admin.organizationId)
  ]);

  if (!lot) {
    notFound();
  }

  return (
    <AdminShell
      title="Editar ingresso"
      description={`Atualize nome, preço, taxas, quantidade e regras de venda de ${lot.event.title}.`}
    >
      {typeof query.error === "string" ? <ErrorNotice message={query.error} className="spacedSection" /> : null}

      <form action={updateTicketLotAction} className="card form wideForm">
        <input type="hidden" name="eventId" value={lot.eventId} />
        <input type="hidden" name="eventSlug" value={lot.event.slug} />
        <input type="hidden" name="lotId" value={lot.id} />

        <div className="formSection">
          <h2>Dados do ingresso</h2>
          <label className="field">
            <span>Nome</span>
            <input name="name" defaultValue={lot.name} required />
          </label>
          <label className="field">
            <span>Descrição</span>
            <textarea
              name="description"
              defaultValue={lot.description ?? ""}
              placeholder={"Ex:\nSetor de cadeiras\nPor ordem de chegada\nSetor em frente ao palco\nUm ingresso para esse evento"}
              rows={5}
            />
            <small>Opcional. Para usar tópicos, coloque uma informação por linha.</small>
          </label>
          <label className="checkboxField">
            <input
              name="descriptionAsList"
              type="checkbox"
              value="true"
              defaultChecked={lot.descriptionAsList}
            />
            <span>Mostrar a descrição como lista de tópicos na página pública.</span>
          </label>
          <label className="field">
            <span>Destaque visual do ingresso</span>
            <select name="highlightColor" defaultValue={lot.highlightColor ?? ""}>
              {ticketHighlightColorOptions.map((option) => (
                <option value={option.value} key={option.value || "none"}>
                  {option.label}
                </option>
              ))}
            </select>
            <small>Opcional. Adiciona um traço discreto na lateral do ingresso na página pública.</small>
          </label>
          <div className="formSection compactFormSection">
            <div className="formSectionHeader">
              <div>
                <span className="sectionEyebrow">Camarotes e tipos</span>
                <h2>Opções individuais do ingresso</h2>
              </div>
              <p className="muted">
                Use para vender um único ingresso com um seletor de camarotes. Cada opção fica com estoque próprio.
              </p>
            </div>
            <label className="checkboxField">
              <input
                name="hasTypeOptions"
                type="checkbox"
                value="true"
                defaultChecked={lot.hasTypeOptions}
              />
              <span>Este ingresso possui tipos/camarotes individuais.</span>
            </label>
            <label className="field">
              <span>Tipos disponíveis</span>
              <textarea
                name="typeOptionsText"
                defaultValue={lot.typeOptions.map((option) => option.label).join("\n")}
                placeholder={"Ex:\nCamarote 01\nCamarote 02\nCamarote 04\nCamarote 08"}
                rows={6}
              />
              <small>Informe um tipo por linha. Tipos já vendidos não serão apagados do histórico.</small>
            </label>
          </div>
          <div className="formSection compactFormSection">
            <div className="formSectionHeader">
              <div>
                <span className="sectionEyebrow">Dados opcionais no checkout</span>
                <h2>Pergunta sobre igreja</h2>
              </div>
              <p className="muted">
                Mostra um campo opcional para o comprador informar a igreja/parceiro do grupo.
              </p>
            </div>
            <label className="checkboxField">
              <input
                name="churchQuestionEnabled"
                type="checkbox"
                value="true"
                defaultChecked={lot.churchQuestionEnabled}
              />
              <span>Mostrar o campo opcional “De qual igreja você é?” neste ingresso.</span>
            </label>
          </div>
          <div className="grid twoColumns">
            <label className="field">
              <span>Preço</span>
              <input
                name="price"
                type="number"
                min="10"
                step="0.01"
                defaultValue={(lot.priceInCents / 100).toFixed(2)}
                required
              />
              <small>Valor mínimo aceito pelo Asaas: R$ 10,00.</small>
            </label>
            <label className="field">
              <span>Quantidade total</span>
              <input name="totalQuantity" type="number" min="1" defaultValue={lot.totalQuantity} required />
              <small>
                Já vendidos/reservados: {lot.soldQuantity + lot.reservedQuantity}. O total não pode ser menor que isso.
              </small>
            </label>
          </div>
          <label className="field">
            <span>QR Codes por compra/unidade</span>
            <input
              name="admissionsPerUnit"
              type="number"
              min="1"
              max="100"
              defaultValue={lot.admissionsPerUnit}
              required
            />
            <small>Use 1 para ingresso normal. Ex: camarote para 8 pessoas = 8 QR Codes individuais.</small>
          </label>
        </div>

        <HotelLotFields
          hotels={hotels}
          defaultHasHotel={lot.hasHotel}
          defaultHotelId={lot.hotelId}
          defaultHotel={lot.hotel}
        />

        <div className="formSection">
          <h2>Taxas e parcelamento</h2>
          <div className="grid twoColumns">
            <label className="field">
              <span>Taxa sobre ingresso (%)</span>
              <input
                name="serviceFeePercent"
                type="number"
                min="0"
                max="30"
                step="0.01"
                defaultValue={(lot.serviceFeeBps / 100).toFixed(2)}
                required
              />
            </label>
            <label className="field">
              <span>Desconto no Pix</span>
              <select
                name="pixDiscountType"
                defaultValue={
                  lot.pixDiscountPercentBps > 0 ? "PERCENTAGE" : lot.pixDiscountFixedInCents > 0 ? "FIXED" : "NONE"
                }
              >
                <option value="NONE">Sem desconto</option>
                <option value="PERCENTAGE">Percentual</option>
                <option value="FIXED">Valor fixo</option>
              </select>
            </label>
          </div>
          <div className="grid twoColumns">
            <label className="field">
              <span>Desconto Pix (%)</span>
              <input
                name="pixDiscountPercent"
                type="number"
                min="0"
                max="100"
                step="0.01"
                defaultValue={(lot.pixDiscountPercentBps / 100).toFixed(2)}
              />
            </label>
            <label className="field">
              <span>Desconto Pix (R$)</span>
              <input
                name="pixDiscountFixed"
                type="number"
                min="0"
                step="0.01"
                defaultValue={(lot.pixDiscountFixedInCents / 100).toFixed(2)}
              />
            </label>
          </div>
          <div className="grid twoColumns">
            <label className="field">
              <span>Juros do cartão por parcela (%)</span>
              <input
                name="cardInterestPercentPerInstallment"
                type="number"
                min="0"
                max="10"
                step="0.01"
                defaultValue={(lot.cardInterestBpsPerInstallment / 100).toFixed(2)}
                required
              />
            </label>
          </div>
          <label className="field">
            <span>Cobrar juros a partir da parcela</span>
            <select name="cardInterestStartsAtInstallment" defaultValue={String(lot.cardInterestStartsAtInstallment)}>
              {Array.from({ length: 10 }, (_, index) => index + 1).map((installment) => (
                <option value={installment} key={installment}>
                  {installment}x
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="formSection">
          <h2>Regras de venda</h2>
          <p className="muted">
            Use o status para tirar um ingresso do ar sem excluir o lote. Ingressos pausados não aparecem no site e não entram no checkout.
          </p>
          <div className="grid twoColumns">
            <label className="field">
              <span>Mínimo por pedido</span>
              <input name="minPerOrder" type="number" min="1" defaultValue={lot.minPerOrder} required />
            </label>
            <label className="field">
              <span>Máximo por pedido</span>
              <input name="maxPerOrder" type="number" min="1" defaultValue={lot.maxPerOrder} required />
            </label>
          </div>
          <label className="field">
            <span>Status</span>
            <select name="status" defaultValue={lot.status}>
              <option value="DRAFT">Rascunho</option>
              <option value="ACTIVE">Ativo</option>
              <option value="PAUSED">Pausado</option>
              <option value="CLOSED">Encerrado</option>
            </select>
          </label>
        </div>

        <div className="formActions">
          <Link className="secondaryButton" href={`/admin/events/${lot.eventId}/lots`}>
            Cancelar
          </Link>
          <button className="button" type="submit">
            Salvar ingresso
          </button>
        </div>
      </form>
    </AdminShell>
  );
}
