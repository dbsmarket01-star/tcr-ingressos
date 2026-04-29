import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
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
      description="Preencha primeiro o essencial do evento e deixe os blocos avançados para depois."
    >
      <form action={createEventAction} className="card form wideForm">
        {error ? <div className="errorBox">{error}</div> : null}
        <section className="adminPanelHero compact">
          <div>
            <span className="sectionEyebrow">Cadastro guiado</span>
            <h2>Monte o evento em etapas mais claras</h2>
            <p className="muted">Organizamos o cadastro para você preencher identidade, agenda, comercial, captação e mapa sem a sensação de formulário embaralhado.</p>
          </div>
          <div className="formFlowBar" aria-label="Etapas do cadastro">
            <span className="isCurrent">Identidade</span>
            <span>Agenda</span>
            <span>Comercial</span>
            <span>Captação</span>
            <span>Mapa</span>
          </div>
        </section>

        <div className="formSection formSectionTone tonePrimary">
          <div className="formSectionHeader">
            <div>
              <span className="sectionEyebrow">Identidade do evento</span>
              <h2>Dados principais</h2>
            </div>
            <p className="muted">Nome, subtítulo, descrição e artes que formam a primeira impressão da página pública.</p>
          </div>
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
              rows={5}
              placeholder="Opcional. Explique o evento, artistas, contexto e principais motivos para comprar."
            />
          </label>
          <div className="mediaUploadGrid">
            <ImageUploadField
              name="bannerFile"
              label="Banner do evento"
              recommendedSize="Ideal: 1920 x 840 px"
              usageHint="Envie a arte final do evento e use o recorte guiado para simular como ela ficará no topo público."
              help="JPG, PNG, WEBP ou GIF ate 10MB."
              aspect="banner"
              cropFieldName="bannerCrop"
            />
          </div>
          <div className="mediaSizingGuide">
            <div>
              <span>Banner topo</span>
              <strong>1920 x 840 px</strong>
              <p>Use arte horizontal e ajuste o enquadramento na própria prévia guiada antes de salvar.</p>
            </div>
            <div>
              <span>Dica prática</span>
              <strong>Área segura</strong>
              <p>Se título e personagens estiverem no centro útil da arte, o recorte guiado tende a funcionar muito bem no desktop e no mobile.</p>
            </div>
          </div>
        </div>

        <div className="formSection formSectionTone toneSchedule">
          <div className="formSectionHeader">
            <div>
              <span className="sectionEyebrow">Agenda e localização</span>
              <h2>Data e local</h2>
            </div>
            <p className="muted">Defina quando e onde o evento acontece para não deixar dúvida operacional nem para o cliente.</p>
          </div>
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

        <div className="formSection formSectionTone toneSales">
          <div className="formSectionHeader">
            <div>
              <span className="sectionEyebrow">Comercial e rastreamento</span>
              <h2>Venda e tracking</h2>
            </div>
            <p className="muted">Janela de vendas, suporte e publicação. Tracking fica escondido para não poluir o cadastro principal.</p>
          </div>
          <div className="channelFocusGrid">
            <div className="channelFocusCard salesFocusCard">
              <span className="channelFocusEyebrow">Venda de ingressos</span>
              <strong>Página pública, janela de venda, suporte e rastreamento do checkout.</strong>
              <small>Este bloco controla o que entra no ar para vender, receber pedidos e acompanhar campanhas.</small>
            </div>
            <div className="channelFocusChecklist">
              <span className="channelFocusEyebrow">O que configurar aqui</span>
              <ul>
                <li>Quando a venda abre e fecha</li>
                <li>Status publicado ou rascunho</li>
                <li>WhatsApp de suporte ao comprador</li>
                <li>Pixel e GTM quando houver tráfego</li>
              </ul>
            </div>
          </div>
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
          <details className="advancedSection adminInlineDetails">
            <summary className="formSectionSummary">
              <div>
                <span className="sectionEyebrow">Opcional</span>
                <h2>Tracking e campanhas</h2>
                <p className="muted">Preencha apenas quando o evento já estiver pronto para tráfego.</p>
              </div>
            </summary>
            <div className="grid twoColumns">
              <label className="field">
                <span>Meta Pixel ID</span>
                <input name="metaPixelId" inputMode="numeric" placeholder="Ex: 123456789012345" />
              </label>
              <label className="field">
                <span>Token da API de conversão do Meta</span>
                <input name="metaConversionsApiToken" placeholder="Ex: EAA..." type="password" />
                <small>Usado para a venda confirmada subir ao Meta mesmo quando o navegador não devolve a conversão.</small>
              </label>
            </div>
            <div className="grid twoColumns">
              <label className="field">
                <span>Código de teste do Meta</span>
                <input name="metaTestEventCode" placeholder="Ex: TEST12345" />
                <small>Opcional. Bom para validar a CAPI no Events Manager antes do lançamento.</small>
              </label>
              <label className="field">
                <span>Google Tag Manager ID</span>
                <input name="googleTagManagerId" placeholder="Ex: GTM-ABC1234" />
              </label>
            </div>
          </details>
        </div>

        <details className="formSection advancedSection formSectionTone toneLead">
          <summary className="formSectionSummary">
            <div>
              <span className="sectionEyebrow">Pré-lançamento</span>
              <h2>Captação de leads</h2>
              <p className="muted">Página separada da venda para captar intenção de compra e levar para o grupo de WhatsApp.</p>
            </div>
          </summary>
          <div className="channelFocusGrid">
            <div className="channelFocusCard leadFocusCard">
              <span className="channelFocusEyebrow">Captação de leads</span>
              <strong>Landing de pré-lista, página de obrigado e grupo oficial antes da abertura.</strong>
              <small>Use este bloco quando quiser aquecer a audiência, captar contatos e organizar o lançamento antes de vender.</small>
            </div>
            <div className="channelFocusChecklist">
              <span className="channelFocusEyebrow">O que configurar aqui</span>
              <ul>
                <li>Headline, oferta e CTA da landing</li>
                <li>Imagem, vídeo e fotos do local</li>
                <li>Link do grupo de WhatsApp</li>
                <li>Texto da página de obrigado</li>
              </ul>
            </div>
          </div>
          <label className="field checkboxField">
            <input name="leadCaptureEnabled" type="checkbox" />
            <span>Ativar página de captação para este evento</span>
          </label>
          <div className="infoBox">
            Link público da captação após salvar: <strong>/lista/{`{slug-do-evento}`}</strong>
          </div>
          <div className="leadCaptureAdminSections">
            <section className="leadAdminBlock leadAdminBlockMessage">
              <div className="leadAdminBlockHeader">
                <div>
                  <span className="sectionEyebrow">Oferta e mensagem</span>
                  <h3>O texto que convence a pessoa a entrar na lista</h3>
                </div>
                <p className="muted">Aqui entram o título, a explicação curta, a promessa e o texto do botão principal.</p>
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
                <small>Você pode usar **texto** para destacar partes importantes em negrito na landing.</small>
              </label>
              <div className="grid twoColumns">
                <label className="field">
                  <span>Oferta / incentivo</span>
                  <input
                    name="leadCaptureOfferText"
                    placeholder="Ex: Cadastre-se e receba até 20% de desconto na abertura."
                  />
                  <small>Use uma promessa curta e forte. Também aceita **negrito** com **texto**.</small>
                </label>
                <label className="field">
                  <span>Texto do botão</span>
                  <input name="leadCaptureCtaText" placeholder="Ex: Garantir meu super desconto" />
                </label>
              </div>
            </section>

            <section className="leadAdminBlock leadAdminBlockMedia">
              <div className="leadAdminBlockHeader">
                <div>
                  <span className="sectionEyebrow">Mídia da landing</span>
                  <h3>Banner, vídeo e fotos do local</h3>
                </div>
                <p className="muted">Essa parte sustenta a estética da landing e ajuda a deixar a experiência mais forte no mobile e no desktop.</p>
              </div>
              <div className="mediaUploadGrid">
                <ImageUploadField
                  name="leadCaptureHeroFile"
                  label="Imagem da captação"
                  recommendedSize="Ideal: 1600 x 900 px"
                  usageHint="Use uma arte bonita e informativa. O recorte guiado mostra como ela ficará no topo da landing."
                  help="JPG, PNG, WEBP ou GIF até 10MB."
                  aspect="banner"
                  cropFieldName="leadCaptureHeroCrop"
                />
              </div>
              <label className="field">
                <span>Vídeo de apresentação (YouTube)</span>
                <input
                  name="leadCaptureVideoUrl"
                  placeholder="https://www.youtube.com/watch?v=... ou https://youtu.be/..."
                />
                <small>Opcional. Cole só o link do YouTube e ele aparece no meio da landing, logo depois do cadastro.</small>
              </label>
              <label className="field">
                <span>Imagens do local (uma URL por linha)</span>
                <textarea
                  name="leadCaptureVenueGallery"
                  rows={4}
                  placeholder={"https://...\nhttps://...\nhttps://..."}
                />
                <small>Opcional. Use uma URL por linha para mostrar fotos do local na landing de captação.</small>
              </label>
            </section>

            <section className="leadAdminBlock leadAdminBlockConversion">
              <div className="leadAdminBlockHeader">
                <div>
                  <span className="sectionEyebrow">Conversão final</span>
                  <h3>Página de obrigado e grupo de WhatsApp</h3>
                </div>
                <p className="muted">Depois do cadastro, a pessoa precisa cair numa página curta e seguir para o grupo sem ruído.</p>
              </div>
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
                  <input name="leadCaptureThankYouTitle" placeholder="Ex: Seu cadastro foi concluído" />
                </label>
                <label className="field">
                  <span>Texto do botão final</span>
                  <input name="leadCaptureThankYouButtonText" placeholder="Ex: Quero entrar no grupo do WhatsApp" />
                </label>
              </div>
              <label className="field">
                <span>Descrição do agradecimento</span>
                <textarea
                  name="leadCaptureThankYouDescription"
                  rows={3}
                  placeholder="Ex: Último passo: entre no grupo oficial para receber um desconto de até 30% e acompanhar as informações deste lançamento."
                />
                <small>Esse texto aparece após o cadastro. Você também pode destacar trechos com **negrito**.</small>
              </label>
            </section>
          </div>
        </details>

        <details className="formSection advancedSection formSectionTone toneMap">
          <summary className="formSectionSummary">
            <div>
              <span className="sectionEyebrow">Opcional</span>
              <h2>Mapa e setores</h2>
              <p className="muted">Abra este bloco só se realmente quiser exibir mapa na página pública.</p>
            </div>
          </summary>
          <div className="formSectionHeader">
            <div />
            <p className="muted">Organize visualmente palco, setores e referências para o cliente entender melhor o ingresso.</p>
          </div>
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
              cropFieldName="eventMapCrop"
            />
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
        </details>

        <details className="formSection advancedSection formSectionTone toneConversion">
          <summary className="formSectionSummary">
            <div>
              <span className="sectionEyebrow">Opcional</span>
              <h2>Textos de conversão</h2>
              <p className="muted">Use só se quiser dar um tom mais comercial à página pública.</p>
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
              <span className="sectionEyebrow">Opcional</span>
              <h2>SEO do evento</h2>
              <p className="muted">Se você não preencher nada aqui, o sistema já monta o básico sozinho.</p>
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
