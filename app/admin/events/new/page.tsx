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
      description="Cadastre dados, midias, mapa de setores, tracking e configuracoes comerciais do evento."
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
              <span>Slug publico</span>
              <input name="slug" placeholder="tcr-festival-2026" />
            </label>
          </div>
          <label className="field">
            <span>Subtitulo</span>
            <input name="subtitle" placeholder="Opcional" />
          </label>
          <label className="field">
            <span>Descricao</span>
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
              <small>Use URL apenas se a imagem ja estiver hospedada fora do sistema.</small>
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
              <span>Area segura</span>
              <strong>Centro 80%</strong>
              <p>Evite informacoes vitais coladas nas bordas. Use o enquadramento para corrigir o recorte final.</p>
            </div>
          </div>
        </div>

        <div className="formSection">
          <h2>Data e local</h2>
          <div className="grid twoColumns">
            <label className="field">
              <span>Inicio do evento</span>
              <input name="startsAt" type="datetime-local" required />
              <small>Escolha a data e o horario de inicio do evento.</small>
            </label>
            <label className="field">
              <span>Fim do evento</span>
              <input name="endsAt" type="datetime-local" />
              <small>Opcional. Use apenas se ja souber o horario de encerramento.</small>
            </label>
          </div>
          <label className="field">
            <span>Nome do local</span>
            <input name="venueName" placeholder="Ex: Armazem Convention" required />
          </label>
          <label className="field">
            <span>Endereco</span>
            <input name="venueAddress" placeholder="Rua, numero, bairro" required />
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
              <span>Inicio das vendas</span>
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
            <span>Informacoes importantes</span>
            <textarea name="importantInfo" rows={4} placeholder="Regras, classificacao, acesso..." />
          </label>
          <label className="field">
            <span>Status inicial</span>
            <select name="status" defaultValue="DRAFT">
              <option value="DRAFT">Rascunho</option>
              <option value="PUBLISHED">Publicado</option>
            </select>
          </label>
        </div>

        <div className="formSection">
          <h2>Mapa e setores</h2>
          <p className="muted">
            Escolha um modelo de setores, envie uma imagem propria ou use os lotes como setores. Nao ha cadeira numerada nesta etapa.
          </p>
          <label className="field">
            <span>Modelo do mapa</span>
            <select name="eventMapTemplate" defaultValue="AUTO">
              <option value="AUTO">Automatico pelos lotes</option>
              <option value="AUDITORIUM">Auditorio</option>
              <option value="THEATER">Teatro</option>
              <option value="WAREHOUSE">Galpao / arena</option>
              <option value="CLUB">Clube / pista</option>
              <option value="FREE">Livre por setores</option>
            </select>
            <small>O modelo aparece na pagina publica quando nao houver imagem de mapa enviada.</small>
          </label>
          <label className="field">
            <span>Observacoes do mapa</span>
            <textarea
              name="eventMapNotes"
              maxLength={500}
              rows={3}
              placeholder="Ex: Setor ouro proximo ao palco, prata ao fundo, camarote na lateral."
            />
          </label>
          <div className="mediaUploadGrid">
            <ImageUploadField
              name="eventMapFile"
              label="Imagem do mapa"
              recommendedSize="Ideal: 1200 x 900 px"
              usageHint="Mostre palco, setores e acessos principais. A pagina exibira o mapa inteiro, sem cortar."
              help="Opcional. JPG, PNG, WEBP ou GIF ate 10MB."
              aspect="map"
            />
            <label className="field mediaUrlFallback">
              <span>Ou URL do mapa</span>
              <input name="eventMapImageUrl" placeholder="https://..." />
              <small>Opcional. Pode ser trocado depois na edicao do evento.</small>
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

        <details className="formSection advancedSection">
          <summary className="formSectionSummary">
            <div>
              <h2>Conversao da pagina publica</h2>
              <p className="muted">Textos opcionais para prova social, urgencia e botao principal.</p>
            </div>
          </summary>
          <label className="field">
            <span>Prova social</span>
            <input
              name="conversionSocialProofText"
              maxLength={120}
              placeholder="Ex: +1.237 pessoas ja garantiram ingresso"
            />
          </label>
          <label className="field">
            <span>Texto de urgencia</span>
            <input
              name="conversionUrgencyText"
              maxLength={140}
              placeholder="Ex: Lote promocional vira hoje as 23:59"
            />
          </label>
          <label className="field">
            <span>Texto do botao principal</span>
            <input
              name="conversionCtaText"
              maxLength={60}
              placeholder="Ex: Garantir minha vaga agora"
            />
          </label>
          <label className="field">
            <span>Lote em destaque</span>
            <input disabled placeholder="Disponivel apos criar os lotes do evento" />
            <small>Depois de criar o evento e os lotes, voce podera escolher o lote destacado na edicao do evento.</small>
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
            <span>Titulo SEO</span>
            <input name="seoTitle" maxLength={70} placeholder="Ex: Fernandinho em Salvador | Ingressos oficiais" />
            <small>Recomendado: ate 60 caracteres. Maximo permitido: 70.</small>
          </label>
          <label className="field">
            <span>Descricao SEO</span>
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
