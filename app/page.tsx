import Link from "next/link";
import { createPlatformLeadAction } from "@/features/platform-leads/platform-lead.actions";
import { PublicSiteFooter } from "@/components/public/PublicSiteFooter";
import { listCachedPublishedEventShowcase } from "@/features/events/event.service";
import { getCurrentOrganizationContext } from "@/features/organizations/organization.service";
import { getCompanySettingsByOrganizationId } from "@/features/settings/company-settings.service";

export const dynamic = "force-dynamic";
export const preferredRegion = "gru1";

type HomePageProps = {
  searchParams?: Promise<{
    success?: string;
    error?: string;
  }>;
};

function formatEventCardDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

const trustHighlights = ["Pix e cartão", "QR Code automático", "Check-in seguro"];

const operationalHighlights = [
  "Página pública com foco em conversão",
  "Pedidos, pagamentos e ingressos no mesmo fluxo",
  "Painel administrativo para operação diária"
];

const leadAnnualRevenueBands = [
  "Até R$ 300 mil por ano",
  "De R$ 300 mil a R$ 1 milhão por ano",
  "De R$ 1 milhão a R$ 3 milhões por ano",
  "De R$ 3 milhões a R$ 10 milhões por ano",
  "Acima de R$ 10 milhões por ano"
];

const marketingPillars = [
  {
    title: "Saque e capital de giro",
    body: "Receba com mais liberdade e mantenha mídia, equipe e fornecedores girando sem depender do fim do evento."
  },
  {
    title: "Mais margem por venda",
    body: "Além do ingresso, a operação captura entre 7% e 20% a mais por venda com a própria estrutura."
  },
  {
    title: "Base 100% do cliente",
    body: "Nome, telefone e e-mail ficam na sua base, não no colo de plataforma concorrente."
  }
];

const advantageCards = [
  {
    title: "Autonomia comercial",
    body: "Sua marca aparece primeiro. Seu domínio, sua comunicação e sua lógica comercial ficam no controle da operação."
  },
  {
    title: "Controle financeiro mais rápido",
    body: "Menos atraso entre venda e caixa disponível ajuda a girar campanha, equipe e próximos eventos com mais velocidade."
  },
  {
    title: "Base própria para crescer",
    body: "Cada campanha fortalece uma base que continua sendo sua, o que melhora recorrência, remarketing e independência."
  },
  {
    title: "Operação em um só fluxo",
    body: "Venda, pedido, ticket, QR Code, check-in e lead convivem no mesmo sistema para a equipe operar com menos ruído."
  }
];

const processSteps = [
  "Você preenche o formulário e o comercial entende o perfil da sua operação.",
  "A Ingresaas configura domínio, acesso inicial, identidade visual e estrutura de venda.",
  "Sua bilheteria entra no ar com painel próprio, base própria e fluxo pronto para vender."
];

const securityPoints = [
  {
    title: "Login próprio do cliente",
    body: "Cada operação entra no próprio admin com e-mail e senha, sem misturar equipe, dado ou configuração."
  },
  {
    title: "Acesso separado por papel",
    body: "A plataforma controla quem pode ver dados, mexer em configuração e operar áreas sensíveis."
  },
  {
    title: "Governança central da base",
    body: "A Ingresaas acompanha domínio, branding e saúde da operação sem virar o painel público do cliente."
  }
];

const heroProofPoints = [
  "Venda no próprio domínio e fortaleça sua marca",
  "Ganhe mais caixa e mais velocidade para operar",
  "Pare de entregar seus leads para terceiros"
];

function getPlatformLeadMessage(success?: string, error?: string) {
  if (error) {
    return {
      tone: "error" as const,
      text: error
    };
  }

  if (success === "existing") {
    return {
      tone: "success" as const,
      text: "Seu interesse já estava registrado. Nosso comercial pode continuar a conversa por esse mesmo contato."
    };
  }

  if (success === "created") {
    return {
      tone: "success" as const,
      text: "Recebemos seus dados. Nosso comercial vai falar com você para entender a operação e desenhar a melhor implantação."
    };
  }

  return null;
}

export default async function Home({ searchParams }: HomePageProps) {
  const organizationContext = await getCurrentOrganizationContext();
  const isPlatformHost = organizationContext.isPlatformHost;
  const query = searchParams ? await searchParams : {};

  if (isPlatformHost) {
    const platformLeadMessage = getPlatformLeadMessage(query.success, query.error);

    return (
      <main className="shell homePage platformHomePage">
        <section className="platformMarketingHero">
          <div className="platformMarketingHeroGrid">
            <div className="platformMarketingHeroContent">
              <div className="brand homeBrand" aria-label={organizationContext.platformName}>
                <span className="brandMark">{organizationContext.brandMark}</span>
                <span>{organizationContext.platformName}</span>
              </div>
              <span className="homeEyebrow">Bilheteria própria para produtores e operações</span>
              <h1>Venda no seu domínio, ganhe mais margem e assuma o controle da sua bilheteria.</h1>
              <p>
                A {organizationContext.platformName} foi desenhada para produtores que querem operar com marca própria,
                sacar com mais liberdade, capturar de 7% a 20% a mais por venda e manter a base de clientes 100% sob
                o próprio controle.
              </p>

              <div className="platformMarketingHeroActions">
                <a className="button" href="#quero-minha-bilheteria">
                  Quero conversar com o comercial
                </a>
                <Link className="secondaryButton" href="/login">
                  Já sou cliente
                </Link>
              </div>

              <div className="homeTrustStrip" aria-label="Principais ganhos para a operação">
                {["Saque mais livre", "7% a 20% mais margem", "Base 100% própria"].map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>

              <div className="platformHeroProofList" aria-label="Resumo do valor da plataforma">
                {heroProofPoints.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </div>

            <aside className="platformMarketingHeroPanel" aria-label="Benefícios principais">
              <article className="platformMarketingSummaryCard">
                <span className="eyebrow">Resumo comercial</span>
                <h2>Uma bilheteria própria para vender mais e depender menos de terceiros.</h2>
                <div className="platformMarketingSummaryGrid">
                  <div>
                    <small>Margem extra</small>
                    <strong>7% a 20%</strong>
                  </div>
                  <div>
                    <small>Base de clientes</small>
                    <strong>100% sua</strong>
                  </div>
                  <div>
                    <small>Saque e caixa</small>
                    <strong>Mais agilidade</strong>
                  </div>
                </div>
                <p>
                  O foco da Ingresaas é simples: colocar sua operação para vender com mais autonomia, mais margem e
                  mais controle comercial.
                </p>
              </article>
            </aside>
          </div>
        </section>

        <section className="container platformMarketingSection">
          <div className="platformBenefitGrid">
            {marketingPillars.map((item) => (
              <article className="platformBenefitCard" key={item.title}>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="container platformMarketingSection">
          <div className="sectionHeader homeSectionHeader platformSalesHeader">
            <div>
              <span className="eyebrow">Por que trocar a lógica da operação</span>
              <h2>Uma bilheteria própria muda caixa, margem, dados e autonomia ao mesmo tempo.</h2>
              <p>
                Não é só sobre vender ingresso. É sobre vender com mais controle, mais lucro e uma base própria para
                crescer com mais independência.
              </p>
            </div>
          </div>

          <div className="platformAdvantageGrid">
            {advantageCards.map((item) => (
              <article className="platformAdvantageCard" key={item.title}>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="container platformMarketingSection">
          <article className="platformMarketingBand">
            <div>
              <span className="eyebrow">O que o produtor ganha na prática</span>
              <h2>Mais controle comercial, mais caixa disponível e uma operação com cara de marca própria.</h2>
              <p>
                A base técnica cuida de venda, ticket, QR Code e check-in. A equipe fica mais focada em vender,
                acompanhar resultado e crescer relacionamento com o público.
              </p>
            </div>
            <a className="button" href="#quero-minha-bilheteria">
              Quero minha bilheteria
            </a>
          </article>
        </section>

        <section className="container platformMarketingSection">
          <div className="platformSplitMarketingGrid">
            <article className="platformProcessCard">
              <span className="eyebrow">Como a operação entra</span>
              <h2>Você não precisa construir tecnologia do zero para começar a vender com domínio próprio.</h2>
              <ol className="platformChecklist">
                {processSteps.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            </article>

            <article className="platformSecurityCard">
              <span className="eyebrow">Acesso e segurança</span>
              <h2>O cliente entra com login próprio e a plataforma protege os dados, relatórios e configurações.</h2>
              <div className="platformAccessGrid compactAccessGrid">
                {securityPoints.map((item) => (
                  <article className="platformAccessCard" key={item.title}>
                    <strong>{item.title}</strong>
                    <p>{item.body}</p>
                  </article>
                ))}
              </div>
            </article>
          </div>
        </section>

        <section className="container platformMarketingSection" id="quero-minha-bilheteria">
          <div className="platformLeadSection">
            <div className="platformLeadIntro">
              <span className="eyebrow">Fale com o comercial</span>
              <h2>Conte o perfil da sua produtora e vamos desenhar sua bilheteria própria.</h2>
              <p>
                Preencha seus dados para o time comercial entender nicho, porte e momento da operação. A ideia é
                colocar sua bilheteria no ar com mais velocidade, menos ruído e uma proposta que faça sentido para a
                sua realidade.
              </p>

              <div className="platformLeadMiniStats">
                <article>
                  <span>Margem extra</span>
                  <strong>7% a 20%</strong>
                </article>
                <article>
                  <span>Base do cliente</span>
                  <strong>100% sua</strong>
                </article>
                <article>
                  <span>Fluxo</span>
                  <strong>Saque + venda + lead</strong>
                </article>
              </div>
            </div>

            <form action={createPlatformLeadAction} className="platformLeadForm card">
              <div className="platformLeadFormHeader">
                <strong>Quero conhecer a Ingresaas</strong>
                <p>Preencha e nosso comercial entra em contato para entender a sua operação.</p>
              </div>

              {platformLeadMessage ? (
                <div className={`formFeedback ${platformLeadMessage.tone === "error" ? "error" : "success"}`}>
                  {platformLeadMessage.text}
                </div>
              ) : null}

              <div className="platformLeadFormGrid">
                <label className="platformLeadField">
                  <span>Nome</span>
                  <input name="name" type="text" placeholder="Seu nome completo" required />
                </label>

                <label className="platformLeadField">
                  <span>E-mail</span>
                  <input name="email" type="email" placeholder="voce@empresa.com.br" required />
                </label>

                <label className="platformLeadField">
                  <span>Telefone</span>
                  <input name="phone" type="tel" placeholder="(11) 99999-9999" required />
                </label>

                <label className="platformLeadField">
                  <span>Faturamento anual da produtora</span>
                  <select name="annualRevenueBand" defaultValue="" required>
                    <option value="" disabled>
                      Selecione uma faixa
                    </option>
                    {leadAnnualRevenueBands.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="platformLeadField">
                  <span>@ do Instagram <small>(opcional)</small></span>
                  <input name="instagramHandle" type="text" placeholder="@suaprodutora" />
                </label>

                <label className="platformLeadField platformLeadFieldFull">
                  <span>Nicho principal dos eventos</span>
                  <input name="eventNiche" type="text" placeholder="Gospel, samba, funk, conferências, festivais..." required />
                </label>
              </div>

              <button className="button fullButton" type="submit">
                Quero falar com o comercial
              </button>
            </form>
          </div>
        </section>

        <section className="container platformMarketingSection">
          <article className="platformClosingCta platformMarketingClosing">
            <div>
              <span className="eyebrow">Próximo passo</span>
              <h2>Tenha sua própria bilheteria, preserve sua base e aumente a lucratividade da operação.</h2>
              <p>
                Se a sua produtora já vende evento, já investe em mídia e já movimenta público, faz sentido conversar
                sobre uma estrutura própria para vender com mais controle, mais margem e mais velocidade financeira.
              </p>
            </div>
            <div className="platformClosingActions">
              <a className="button" href="#quero-minha-bilheteria">
                Solicitar contato
              </a>
              <Link className="secondaryButton" href="/login">
                Já sou cliente
              </Link>
            </div>
          </article>
        </section>
      </main>
    );
  }

  const events = await listCachedPublishedEventShowcase(6, organizationContext.organization.id);
  const companySettings = await getCompanySettingsByOrganizationId(organizationContext.organization.id);
  const publicSocialSettings = companySettings as typeof companySettings & {
    instagramUrl?: string | null;
    facebookUrl?: string | null;
    youtubeUrl?: string | null;
    whatsappUrl?: string | null;
  };
  const featuredEvent = events[0] ?? null;

  return (
    <main className="shell homePage">
      <section className="homeHero">
        <div className="homeHeroInner">
          <div className="homeHeroContent">
            <div className="brand homeBrand" aria-label={organizationContext.brandName}>
              {organizationContext.brandLogoUrl ? (
                <img alt={organizationContext.brandName} className="brandLogo" src={organizationContext.brandLogoUrl} />
              ) : (
                <span className="brandMark">{organizationContext.brandMark}</span>
              )}
              {!organizationContext.brandLogoUrl ? <span>{organizationContext.brandName}</span> : null}
            </div>
            <span className="homeEyebrow">Bilheteria oficial</span>
            <h1>Eventos em cartaz com compra segura, operação rápida e experiência profissional.</h1>
            <p>
              Encontre os próximos eventos da {organizationContext.brandName}, escolha seu ingresso em poucos passos e
              receba o QR Code automaticamente após a confirmação do pagamento.
            </p>
            <div className="homeTrustStrip" aria-label="Diferenciais da bilheteria">
              {trustHighlights.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
            <div className="homeHeroStats" aria-label="Indicadores da bilheteria">
              <div>
                <span>Eventos</span>
                <strong>{events.length}</strong>
              </div>
              <div>
                <span>Fluxo</span>
                <strong>Compra e check-in</strong>
              </div>
              <div>
                <span>Pagamento</span>
                <strong>Pix e cartão</strong>
              </div>
            </div>
          </div>

          <aside className="homeFeaturePanel" aria-label="Evento em destaque">
            {featuredEvent ? (
              <article className="homeFeaturedEventCard">
                <div
                  className="homeFeaturedEventMedia"
                  style={{
                    backgroundImage: `linear-gradient(180deg, rgba(8, 20, 29, 0.08), rgba(8, 20, 29, 0.28)), url("${featuredEvent.bannerUrl || "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1200&q=80"}")`
                  }}
                />
                <div className="homeFeaturedEventBody">
                  <span className="eyebrow">Em destaque</span>
                  <h2>{featuredEvent.title}</h2>
                  <p>
                    {formatEventCardDate(featuredEvent.startsAt)} • {featuredEvent.city}, {featuredEvent.state}
                  </p>
                  <strong>{featuredEvent.venueName}</strong>
                  <Link className="button fullButton" href={`/evento/${featuredEvent.slug}`}>
                    Comprar agora
                  </Link>
                </div>
              </article>
            ) : (
              <article className="card homeEmptyState">
                <h3>Nenhum evento em destaque</h3>
                <p className="muted">Assim que a agenda for publicada, os próximos eventos aparecem aqui.</p>
              </article>
            )}
          </aside>
        </div>
      </section>

      <section className="container homeSection">
        <div className="sectionHeader homeSectionHeader">
          <div>
            <span className="eyebrow">Agenda aberta</span>
            <h2>Confira os próximos eventos disponíveis</h2>
          </div>
        </div>

        <div className="homeShowcaseGrid">
          {events.length === 0 ? (
            <article className="card homeEmptyState">
              <h3>Nenhum evento publicado ainda</h3>
              <p className="muted">Assim que um evento for publicado no painel, ele aparecerá automaticamente aqui.</p>
            </article>
          ) : (
            events.map((event) => (
              <article className="card linkCard eventShowcaseCard" key={event.id}>
                <div
                  className="eventShowcaseImage"
                  style={{
                    backgroundImage: `linear-gradient(180deg, rgba(8, 20, 29, 0.06), rgba(8, 20, 29, 0.28)), url("${event.bannerUrl || "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=1400&q=80"}")`
                  }}
                />
                <div className="eventShowcaseBody">
                  <span className="eyebrow">
                    {event.city}, {event.state}
                  </span>
                  <h3>{event.title}</h3>
                  <p className="muted">{formatEventCardDate(event.startsAt)}</p>
                  <strong>{event.venueName}</strong>
                  <Link className="button smallButton" href={`/evento/${event.slug}`}>
                    Comprar agora
                  </Link>
                </div>
              </article>
            ))
          )}
        </div>

        <aside className="homeSupportPanel">
          <span className="eyebrow">Compra assistida</span>
          <h3>Do pedido ao QR Code, tudo em um só lugar.</h3>
          <p>
            A vitrine pública mostra os eventos em cartaz, enquanto o painel interno mantém a operação organizada para
            vendas, ingressos e check-in.
          </p>
          <div className="homeSupportList">
            {operationalHighlights.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </aside>
      </section>
      <PublicSiteFooter brandName={organizationContext.brandName} settings={publicSocialSettings} />
    </main>
  );
}
