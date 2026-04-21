import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { BannerPositionField } from "@/components/forms/BannerPositionField";
import { ImageUploadField } from "@/components/forms/ImageUploadField";
import { requirePermission } from "@/features/auth/auth.service";
import { createEventAction } from "@/features/events/event.actions";

type NewEventPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewEventPage({ searchParams }: NewEventPageProps) {
  await requirePermission("EVENTS");
  const params = searchParams ? await searchParams : {};
  const error = typeof params.error === "string" ? params.error : null;

  return (
    <AdminShell
      title="Novo evento"
      description="Cadastre dados, mídias, mapa de setores, tracking e configurações comerciais do evento."
    >
      <form action={createEventAction} className="card form wideForm">
        {error ? <div className="errorBox">{error}</div> : null}
        <div className="formSection">
          <h2>Dados principais</h2>
          <div className="grid twoColumns">
            <label className="field">
              <span>Nome do evento</span>
              <input name="title" placeholder="Ex: TCR Festival 2026" required />
            </label>
            <label className="field">
              <span>Slug público</span>
              <input name="slug" placeholder="tcr-festival-2026" />
            </label>
          </div>
          <label className="field">
            <span>Subtítulo</span>
            <input name="subtitle" placeholder="Opcional" />
          </label>
          <label className="field">
            <span>Descrição</span>
            <textarea
              name="description"
              minLength={10}
              rows={5}
              placeholder="Explique o evento, artistas, contexto e principais motivos para comprar."
              required
            />
          </label>
          <div className="mediaUploadGrid">
            <ImageUploadField
              name="bannerFile"
              label="Banner do evento"
              recommendedSize="Ideal: 1920 x 840 px"
              usageHint="Use arte horizontal. Mantenha rosto, nome do evento e data na area central segura."
              help="JPG, PNG, WEBP ou GIF ate 10MB."
              aspect="banner"
            />
            <label className="field mediaUrlFallback">
              <span>Ou URL do banner</span>
              <input name="bannerUrl" placeholder="https://..." />
              <small>Use URL apenas se a imagem já estiver hospedada fora do sistema.</small>
            </label>
          </div>
          <BannerPositionField defaultValue="center top" />
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
              <input name="startsAt" type="datetime-local" required />
              <small>Escolha a data e o horário de início do evento.</small>
            </label>
            <label className="field">
              <span>Fim do evento</span>
              <input name="endsAt" type="datetime-local" />
              <small>Opcional. Use apenas se já souber o horário de encerramento.</small>
            </label>
          </div>
          <label className="field">
            <span>Nome do local</span>
            <input name="venueName" placeholder="Ex: Armazem Convention" required />
          </label>
          <label className="field">
            <span>Endereço</span>
            <input name="venueAddress" placeholder="Rua, número, bairro" required />
          </label>
          <div className="grid twoColumns">
            <label className="field">
              <span>Cidade</span>
              <input name="city" required />
            </label>
            <label className="field">
              <span>UF</span>
              <input name="state" maxLength={2} minLength={2} placeholder="SP" required />
            </label>
          </div>
        </div>

        <div className="formSection">
          <h2>Venda e tracking</h2>
          <div className="grid twoColumns">
            <label className="field">
              <span>Início das vendas</span>
              <input name="salesStartsAt" type="datetime-local" />
            </label>
            <label className="field">
              <span>Fim das vendas</span>
              <input name="salesEndsAt" type="datetime-local" />
            </label>
          </div>
          <div className="grid twoColumns">
            <label className="field">
              <span>Meta Pixel ID</span>
              <input name="metaPixelId" inputMode="numeric" placeholder="Ex: 123456789012345" />
              <small>Opcional.</small>
            </label>
            <label className="field">
              <span>Google Tag Manager ID</span>
              <input name="googleTagManagerId" placeholder="Ex: GTM-ABC1234" />
              <small>Opcional.</small>
            </label>
          </div>
          <label className="field">
            <span>Informações importantes</span>
            <textarea name="importantInfo" rows={4} placeholder="Regras, classificação, acesso..." />
          </label>
          <label className="field">
            <span>WhatsApp de suporte</span>
            <input
              name="supportWhatsappUrl"
              placeholder="https://wa.me/55DDDNUMERO?text=..."
            />
            <small>Opcional. Esse link aparece como botão flutuante na página do evento e no pedido pendente.</small>
          </label>
          <label className="field">
            <span>Status inicial</span>
            <select name="status" defaultValue="DRAFT">
              <option value="DRAFT">Rascunho</option>
              <option value="PUBLISHED">Publicado</option>
            </select>
          </label>
        </div>

        <details className="formSection advancedSection" open>
          <summary className="formSectionSummary">
            <div>
              <h2>Captação de leads</h2>
              <p className="muted">Página separada da venda para captar intenção de compra e levar para o grupo de WhatsApp.</p>
            </div>
          </summary>
          <label className="field checkboxField">
            <input name="leadCaptureEnabled" type="checkbox" />
            <span>Ativar página de captação para este evento</span>
          </label>
          <div className="infoBox">
            Link público da captação após salvar: <strong>/lista/{`{slug-do-evento}`}</strong>
          </div>
          <label className="field">
            <span>Título da captação</span>
            <input name="leadCaptureHeadline" placeholder="Ex: Cláudio Duarte em Santo André" />
          </label>
          <label className="field">
            <span>Descrição da captação</span>
            <textarea
              name="leadCaptureDescription"
              rows={4}
              placeholder="Explique rapidamente o evento e convide a pessoa a entrar na lista de interesse."
            />
          </label>
          <div className="grid twoColumns">
            <label className="field">
              <span>Oferta / incentivo</span>
              <input
                name="leadCaptureOfferText"
                placeholder="Ex: Cadastre-se e receba até 20% de desconto na abertura."
              />
            </label>
            <label className="field">
              <span>Texto do botão</span>
              <input name="leadCaptureCtaText" placeholder="Ex: Garantir meu super desconto" />
            </label>
          </div>
          <div className="mediaUploadGrid">
            <ImageUploadField
              name="leadCaptureHeroFile"
              label="Imagem da captação"
              recommendedSize="Ideal: 1600 x 900 px"
              usageHint="Use uma arte bonita e informativa. Essa imagem aparece só na landing de captura, separada da página de venda."
              help="JPG, PNG, WEBP ou GIF até 10MB."
              aspect="banner"
            />
            <label className="field mediaUrlFallback">
              <span>Ou URL da imagem da captação</span>
              <input name="leadCaptureHeroImageUrl" placeholder="https://..." />
            </label>
          </div>
          <label className="field">
            <span>Vídeo do YouTube</span>
            <input
              name="leadCaptureVideoUrl"
              placeholder="https://www.youtube.com/watch?v=... ou https://youtu.be/..."
            />
            <small>Opcional. Se você informar um vídeo, ele aparece abaixo do topo da landing.</small>
          </label>
          <label className="field">
            <span>Link do grupo de WhatsApp</span>
            <input
              name="leadCaptureWhatsappGroupUrl"
              placeholder="https://chat.whatsapp.com/..."
            />
            <small>Esse botão aparece na página de obrigado.</small>
          </label>
          <div className="grid twoColumns">
            <label className="field">
              <span>Título do agradecimento</span>
              <input name="leadCaptureThankYouTitle" placeholder="Ex: Último passo" />
            </label>
            <label className="field">
              <span>Texto do botão final</span>
              <input name="leadCaptureThankYouButtonText" placeholder="Ex: Quero entrar no grupo oficial" />
            </label>
          </div>
          <label className="field">
            <span>Descrição do agradecimento</span>
            <textarea
              name="leadCaptureThankYouDescription"
              rows={3}
              placeholder="Ex: Entre agora no grupo oficial para receber as informações e a abertura com desconto."
            />
          </label>
        </details>

        <div className="formSection">
          <h2>Mapa e setores</h2>
          <p className="muted">
            Escolha um modelo de setores, envie uma imagem própria ou use os lotes como setores. Não há cadeira numerada nesta etapa.
          </p>
          <label className="field">
            <span>Modelo do mapa</span>
            <select name="eventMapTemplate" defaultValue="AUTO">
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
            <span>Observações do mapa</span>
            <textarea
              name="eventMapNotes"
              maxLength={500}
              rows={3}
              placeholder="Ex: Setor ouro próximo ao palco, prata ao fundo, camarote na lateral."
            />
          </label>
          <div className="mediaUploadGrid">
            <ImageUploadField
              name="eventMapFile"
              label="Imagem do mapa"
              recommendedSize="Ideal: 1200 x 900 px"
              usageHint="Mostre palco, setores e acessos principais. A página exibirá o mapa inteiro, sem cortar."
              help="Opcional. JPG, PNG, WEBP ou GIF até 10MB."
              aspect="map"
            />
            <label className="field mediaUrlFallback">
              <span>Ou URL do mapa</span>
              <input name="eventMapImageUrl" placeholder="https://..." />
              <small>Opcional. Pode ser trocado depois na edição do evento.</small>
            </label>
          </div>
          <div className="mediaSizingGuide">
            <div>
              <span>Mapa de setores</span>
              <strong>1200 x 900 px</strong>
              <p>Use proporção 4:3 para auditórios, teatros, galpões e clubes.</p>
            </div>
            <div>
              <span>Exibição pública</span>
              <strong>Sem recorte</strong>
              <p>O mapa aparece inteiro dentro de uma moldura. Se a arte for vertical, pode sobrar margem lateral.</p>
            </div>
          </div>
        </div>

        <details className="formSection advancedSection">
          <summary className="formSectionSummary">
            <div>
              <h2>Conversão da página pública</h2>
              <p className="muted">Textos opcionais para prova social, urgência e botão principal.</p>
            </div>
          </summary>
          <label className="field">
            <span>Prova social</span>
            <input
              name="conversionSocialProofText"
              maxLength={120}
              placeholder="Ex: +1.237 pessoas já garantiram ingresso"
            />
          </label>
          <label className="field">
            <span>Texto de urgência</span>
            <input
              name="conversionUrgencyText"
              maxLength={140}
              placeholder="Ex: Lote promocional vira hoje as 23:59"
              
            />
          </label>
          <label className="field">
            <span>Texto do botão principal</span>
            <input
              name="conversionCtaText"
              maxLength={60}
              placeholder="Ex: Garantir minha vaga agora"
            />
          </label>
          <label className="field">
            <span>Lote em destaque</span>
            <input disabled placeholder="Disponível após criar os lotes do evento" />
            <small>Depois de criar o evento e os lotes, você poderá escolher o lote destacado na edição do evento.</small>
          </label>
        </details>

        <details className="formSection seoPreview advancedSection">
          <summary className="formSectionSummary">
            <div>
              <h2>SEO do evento</h2>
              <p className="muted">Opcional. Se ficar em branco, o sistema gera automaticamente.</p>
            </div>
          </summary>
          <label className="field">
            <span>Título SEO</span>
            <input name="seoTitle" maxLength={70} placeholder="Ex: Fernandinho em Salvador | Ingressos oficiais" />
            <small>Recomendado: até 60 caracteres. Máximo permitido: 70.</small>
          </label>
          <label className="field">
            <span>Descrição SEO</span>
            <textarea
              name="seoDescription"
              maxLength={180}
              rows={3}
              placeholder="Resumo curto que aparece no Google e nas redes sociais."
            />
            <small>Recomendado: ate 155 caracteres. Maximo permitido: 180.</small>
          </label>
          <label className="field">
            <span>Palavras-chave</span>
            <input name="seoKeywords" maxLength={300} placeholder="fernandinho, ingressos, salvador, show gospel" />
            <small>Separe por virgula.</small>
          </label>
          <div className="mediaUploadGrid">
            <ImageUploadField
              name="seoImageFile"
              label="Imagem SEO / compartilhamento"
              recommendedSize="Ideal: 1200 x 630 px"
              usageHint="Imagem usada em WhatsApp, Google e redes sociais quando compartilharem o link."
              help="Opcional. Se ficar vazio, usa o banner do evento."
              emptyText="Usar banner do evento"
              aspect="share"
            />
            <label className="field mediaUrlFallback">
              <span>Ou URL da imagem SEO</span>
              <input name="seoImageUrl" placeholder="https://..." />
              <small>Se ficar em branco, usa o banner do evento.</small>
            </label>
          </div>
          <div className="seoPreviewBox">
            <span>/evento/slug-do-evento</span>
            <strong>Nome do evento | Ingressos TCR Ingressos</strong>
            <p>
              Compre ingressos para o evento com data, local, cidade e descricao organizados para
              aparecer bem no Google Search.
            </p>
          </div>
        </details>

        <div className="formActions">
          <Link className="secondaryButton" href="/admin/events">
            Cancelar
          </Link>
          <button className="button" type="submit">
            Salvar evento
          </button>
        </div>
      </form>
    </AdminShell>
  );
}
