import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { BannerPositionField } from "@/components/forms/BannerPositionField";
import { ImageUploadField } from "@/components/forms/ImageUploadField";
import { requirePermission } from "@/features/auth/auth.service";
import { updateEventAction } from "@/features/events/event.actions";
import { getEventForManagement } from "@/features/events/event.service";
import { buildEventSeo } from "@/features/seo/event-seo";
import { formatDateTimeInput } from "@/lib/format";

export const dynamic = "force-dynamic";

type EditEventPageProps = {
  params: Promise<{
    eventId: string;
  }>;
};

export default async function EditEventPage({ params }: EditEventPageProps) {
  await requirePermission("EVENTS");
  const { eventId } = await params;
  const event = await getEventForManagement(eventId);

  if (!event) {
    notFound();
  }

  const seo = buildEventSeo(event);
  const mediaReadiness = [
    {
      label: "Banner",
      status: Boolean(event.bannerUrl),
      description: event.bannerUrl ? "Configurado" : "Pendente para conversao"
    },
    {
      label: "Mapa",
      status: Boolean(event.eventMapImageUrl) || event.eventMapTemplate !== "AUTO" || event.lots.length > 0,
      description: event.eventMapImageUrl
        ? "Imagem propria"
        : event.eventMapTemplate !== "AUTO"
          ? "Modelo visual escolhido"
          : event.lots.length > 0
            ? "Automatico pelos lotes"
            : "Pendente"
    },
    {
      label: "Imagem SEO",
      status: Boolean(event.seoImageUrl || event.bannerUrl),
      description: event.seoImageUrl ? "Personalizada" : event.bannerUrl ? "Usando banner" : "Pendente"
    },
    {
      label: "Tracking",
      status: Boolean(event.metaPixelId || event.googleTagManagerId),
      description: event.metaPixelId || event.googleTagManagerId ? "Configurado" : "Sem Pixel/GTM"
    }
  ];

  return (
    <AdminShell
      title="Editar evento"
      description="Atualize os dados principais, publicação e tracking do evento."
    >
      <form action={updateEventAction} className="card form wideForm">
        <input type="hidden" name="eventId" value={event.id} />

        <div className="formSection">
          <h2>Resumo de publicação</h2>
          <div className="mediaReadinessGrid">
            {mediaReadiness.map((item) => (
              <div className={item.status ? "isReady" : "isBlocked"} key={item.label}>
                <span>{item.label}</span>
                <strong>{item.status ? "Ok" : "Atenção"}</strong>
                <small>{item.description}</small>
              </div>
            ))}
          </div>
        </div>

        <div className="formSection">
          <h2>Dados principais</h2>
          <div className="grid twoColumns">
            <label className="field">
              <span>Nome do evento</span>
              <input name="title" defaultValue={event.title} required />
            </label>
            <label className="field">
              <span>Slug público</span>
              <input name="slug" defaultValue={event.slug} required />
            </label>
          </div>
          <label className="field">
            <span>Subtítulo</span>
            <input name="subtitle" defaultValue={event.subtitle ?? ""} />
          </label>
          <label className="field">
            <span>Descrição</span>
            <textarea name="description" rows={5} defaultValue={event.description} required />
          </label>
          <div className="mediaUploadGrid">
            <ImageUploadField
              name="bannerFile"
              label="Trocar banner"
              currentImageUrl={event.bannerUrl}
              recommendedSize="Ideal: 1920 x 840 px"
              usageHint="Use arte horizontal. Mantenha rosto, nome do evento e data na área central segura."
              help="JPG, PNG, WEBP ou GIF ate 10MB para substituir o banner atual."
              emptyText="Sem banner atual"
              aspect="banner"
            />
            <label className="field mediaUrlFallback">
              <span>URL do banner</span>
              <input name="bannerUrl" defaultValue={event.bannerUrl ?? ""} />
              <small>Atual: {event.bannerUrl ? "banner configurado" : "sem banner"}</small>
            </label>
          </div>
          <BannerPositionField defaultValue={event.bannerPosition} previewImageUrl={event.bannerUrl} />
          <div className="mediaSizingGuide">
            <div>
              <span>Banner topo</span>
              <strong>1920 x 840 px</strong>
              <p>Use arte horizontal. Para eventos com palestrante/artista, deixe rosto e texto no centro superior.</p>
            </div>
            <div>
              <span>Área segura</span>
              <strong>Centro 80%</strong>
              <p>Evite informações vitais coladas nas bordas. Use o enquadramento para corrigir o recorte final.</p>
            </div>
          </div>
        </div>

        <div className="formSection">
          <h2>Data e local</h2>
          <div className="grid twoColumns">
            <label className="field">
              <span>Início do evento</span>
              <input
                name="startsAt"
                type="datetime-local"
                defaultValue={formatDateTimeInput(event.startsAt)}
                required
              />
            </label>
            <label className="field">
              <span>Fim do evento</span>
              <input
                name="endsAt"
                type="datetime-local"
                defaultValue={formatDateTimeInput(event.endsAt)}
              />
            </label>
          </div>
          <label className="field">
            <span>Nome do local</span>
            <input name="venueName" defaultValue={event.venueName} required />
          </label>
          <label className="field">
            <span>Endereço</span>
            <input name="venueAddress" defaultValue={event.venueAddress} required />
          </label>
          <div className="grid twoColumns">
            <label className="field">
              <span>Cidade</span>
              <input name="city" defaultValue={event.city} required />
            </label>
            <label className="field">
              <span>UF</span>
              <input name="state" maxLength={2} defaultValue={event.state} required />
            </label>
          </div>
        </div>

        <div className="formSection">
          <h2>Venda e tracking</h2>
          <div className="grid twoColumns">
            <label className="field">
              <span>Início das vendas</span>
              <input
                name="salesStartsAt"
                type="datetime-local"
                defaultValue={formatDateTimeInput(event.salesStartsAt)}
              />
            </label>
            <label className="field">
              <span>Fim das vendas</span>
              <input
                name="salesEndsAt"
                type="datetime-local"
                defaultValue={formatDateTimeInput(event.salesEndsAt)}
              />
            </label>
          </div>
          <div className="grid twoColumns">
            <label className="field">
              <span>Meta Pixel ID</span>
              <input
                name="metaPixelId"
                inputMode="numeric"
                defaultValue={event.metaPixelId ?? ""}
                placeholder="Ex: 123456789012345"
              />
              <small>Somente números. Encontre no Gerenciador de Eventos da Meta.</small>
            </label>
            <label className="field">
              <span>Google Tag Manager ID</span>
              <input
                name="googleTagManagerId"
                defaultValue={event.googleTagManagerId ?? ""}
                placeholder="Ex: GTM-ABC1234"
              />
              <small>Formato esperado: GTM-XXXXXXX.</small>
            </label>
          </div>
          <div className="trackingGuideGrid">
            <div>
              <span>Página do evento</span>
              <strong>view_event / ViewContent</strong>
              <small>Dispara quando o cliente abre a página pública do evento.</small>
            </div>
            <div>
              <span>Pedido criado</span>
              <strong>order_created / InitiateCheckout</strong>
              <small>Dispara quando o cliente cria o pedido e chega ao pagamento.</small>
            </div>
            <div>
              <span>Compra aprovada</span>
              <strong>purchase / Purchase</strong>
              <small>Dispara quando o pedido está pago e com valor em BRL.</small>
            </div>
          </div>
          <label className="field">
            <span>Informações importantes</span>
            <textarea name="importantInfo" rows={4} defaultValue={event.importantInfo ?? ""} />
          </label>
          <label className="field">
            <span>WhatsApp de suporte</span>
            <input
              name="supportWhatsappUrl"
              defaultValue={event.supportWhatsappUrl ?? ""}
              placeholder="https://wa.me/55DDDNUMERO?text=..."
            />
            <small>Opcional. Esse link aparece como botão flutuante na página do evento e no pedido pendente.</small>
          </label>
          <label className="field">
            <span>Status</span>
            <select
              name="status"
              defaultValue={event.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT"}
            >
              <option value="DRAFT">Rascunho</option>
              <option value="PUBLISHED">Publicado</option>
            </select>
          </label>
        </div>

        <div className="formSection">
          <h2>Mapa e setores</h2>
          <p className="muted">
            Escolha um modelo de setores, envie uma imagem própria ou use os lotes como setores. Não há cadeira numerada nesta etapa.
          </p>
          <label className="field">
            <span>Modelo do mapa</span>
            <select name="eventMapTemplate" defaultValue={event.eventMapTemplate}>
              <option value="AUTO">Automático pelos lotes</option>
              <option value="AUDITORIUM">Auditório</option>
              <option value="THEATER">Teatro</option>
              <option value="WAREHOUSE">Galpão / arena</option>
              <option value="CLUB">Clube / pista</option>
              <option value="FREE">Livre por setores</option>
            </select>
            <small>O modelo aparece na página pública quando não houver imagem de mapa enviada.</small>
          </label>
          <label className="field">
            <span>Observacoes do mapa</span>
            <textarea
              name="eventMapNotes"
              maxLength={500}
              rows={3}
              defaultValue={event.eventMapNotes ?? ""}
              placeholder="Ex: Setor ouro proximo ao palco, prata ao fundo, camarote na lateral."
            />
          </label>
          <div className="mediaUploadGrid">
            <ImageUploadField
              name="eventMapFile"
              label="Trocar imagem do mapa"
              currentImageUrl={event.eventMapImageUrl}
              recommendedSize="Ideal: 1200 x 900 px"
              usageHint="A página pública exibirá o mapa inteiro, sem cortar. Se não houver imagem, usa os lotes ativos como setores."
              help="Use JPG, PNG, WEBP ou GIF ate 10MB."
              emptyText="Sem mapa atual"
              aspect="map"
            />
            <label className="field mediaUrlFallback">
              <span>URL do mapa</span>
              <input name="eventMapImageUrl" defaultValue={event.eventMapImageUrl ?? ""} placeholder="https://..." />
              <small>Opcional. Limpe este campo para voltar ao mapa visual padrao.</small>
            </label>
          </div>
          <div className="mediaSizingGuide">
            <div>
              <span>Mapa de setores</span>
              <strong>1200 x 900 px</strong>
              <p>Use proporcao 4:3 para auditórios, teatros, galpões e clubes.</p>
            </div>
            <div>
              <span>Exibicao publica</span>
              <strong>Sem recorte</strong>
              <p>O mapa aparece inteiro dentro de uma moldura. Se a arte for vertical, pode sobrar margem lateral.</p>
            </div>
          </div>
        </div>

        <div className="formSection">
          <h2>Conversão da página pública</h2>
          <p className="muted">
            Controle textos comerciais da página pública. Campos vazios usam automaticamente vendas, estoque e dados do evento.
          </p>
          <label className="field">
            <span>Prova social</span>
            <input
              name="conversionSocialProofText"
              maxLength={120}
              defaultValue={event.conversionSocialProofText ?? ""}
              placeholder="+1.237 pessoas já garantiram ingresso"
            />
          </label>
          <label className="field">
            <span>Texto de urgencia</span>
            <input
              name="conversionUrgencyText"
              maxLength={140}
              defaultValue={event.conversionUrgencyText ?? ""}
              placeholder="Lote promocional vira hoje as 23:59"
            />
          </label>
          <label className="field">
            <span>Texto do botao principal</span>
            <input
              name="conversionCtaText"
              maxLength={60}
              defaultValue={event.conversionCtaText ?? ""}
              placeholder="Garantir minha vaga agora"
            />
          </label>
          <label className="field">
            <span>Lote em destaque</span>
            <select name="highlightedLotId" defaultValue={event.highlightedLotId ?? ""}>
              <option value="">Automatico: primeiro lote disponivel</option>
              {event.lots.map((lot) => (
                <option value={lot.id} key={lot.id}>
                  {lot.name}
                </option>
              ))}
            </select>
            <small>O lote destacado aparece com selo "Mais escolhido" e ja vem com quantidade 1 selecionada.</small>
          </label>
        </div>

        <div className="formSection seoPreview">
          <h2>SEO do evento</h2>
          <p className="muted">
            Se os campos ficarem em branco, a pagina usa a embalagem automatica. Se preencher, sua
            versao personalizada aparece no Google e no compartilhamento social.
          </p>
          <label className="field">
            <span>Titulo SEO</span>
            <input
              name="seoTitle"
              maxLength={70}
              defaultValue={event.seoTitle ?? ""}
              placeholder={seo.title}
            />
            <small>Recomendado: ate 60 caracteres. Maximo permitido: 70.</small>
          </label>
          <label className="field">
            <span>Descricao SEO</span>
            <textarea
              name="seoDescription"
              maxLength={180}
              rows={3}
              defaultValue={event.seoDescription ?? ""}
              placeholder={seo.description}
            />
            <small>Recomendado: ate 155 caracteres. Maximo permitido: 180.</small>
          </label>
          <label className="field">
            <span>Palavras-chave</span>
            <input
              name="seoKeywords"
              maxLength={300}
              defaultValue={event.seoKeywords ?? ""}
              placeholder="fernandinho, ingressos, salvador"
            />
            <small>Separe por virgula.</small>
          </label>
          <div className="mediaUploadGrid">
            <ImageUploadField
              name="seoImageFile"
              label="Trocar imagem SEO / compartilhamento"
              currentImageUrl={event.seoImageUrl || event.bannerUrl}
              recommendedSize="Ideal: 1200 x 630 px"
              usageHint="Essa imagem aparece quando alguem compartilha a pagina do evento."
              help="Opcional. Use uma imagem horizontal para WhatsApp, Google e redes sociais."
              emptyText="Usar banner do evento"
              aspect="share"
            />
            <label className="field mediaUrlFallback">
              <span>URL da imagem SEO</span>
              <input name="seoImageUrl" defaultValue={event.seoImageUrl ?? ""} placeholder={event.bannerUrl ?? "https://..."} />
              <small>Se ficar em branco, usa o banner do evento.</small>
            </label>
          </div>
          <div className="seoPreviewBox">
            <span>{seo.canonicalPath}</span>
            <strong>{seo.title}</strong>
            <p>{seo.description}</p>
          </div>
        </div>

        <div className="formActions">
          <Link className="secondaryButton" href={`/admin/events/${event.id}`}>
            Cancelar
          </Link>
          <button className="button" type="submit">
            Salvar alteracoes
          </button>
        </div>
      </form>
    </AdminShell>
  );
}
