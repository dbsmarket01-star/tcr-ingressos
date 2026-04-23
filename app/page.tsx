import Link from "next/link";
import { listCachedPublishedEventShowcase } from "@/features/events/event.service";
import { getCurrentOrganizationContext } from "@/features/organizations/organization.service";
import { getPlatformOverview } from "@/features/platform/platform.service";

export const dynamic = "force-dynamic";
export const preferredRegion = "gru1";

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

const platformPillars = [
  {
    title: "Motor único",
    body: "Pagamentos, pedidos, leads, ingressos e check-in continuam centralizados em uma base só."
  },
  {
    title: "Operações independentes",
    body: "Cada cliente roda com domínio, equipe, identidade visual e eventos próprios."
  },
  {
    title: "Escala sem retrabalho",
    body: "A evolução da plataforma acontece uma vez e beneficia todas as bilheterias filhas."
  }
];

const platformAudience = [
  "Produtores que precisam de uma bilheteria própria sem construir tecnologia do zero",
  "Operações com domínio próprio, equipe própria e identidade visual separada",
  "Negócios que precisam vender, validar QR Code, acompanhar leads e operar eventos em uma só base"
];

const platformCapabilityRows = [
  {
    title: "Vendas, tickets e QR Code",
    body: "Checkout, pagamento, emissão de ingresso e validação continuam centralizados na mesma base."
  },
  {
    title: "Leads, landing pages e operação",
    body: "A plataforma sustenta captura, eventos, pedidos, suporte e check-in sem quebrar o fluxo."
  },
  {
    title: "Marca e domínio por cliente",
    body: "Cada bilheteria filha opera com domínio, admin, suporte e identidade visual próprios."
  }
];

const platformControlPoints = [
  {
    title: "Operações filhas",
    body: "Cadastre, configure e acompanhe cada bilheteria a partir do painel master."
  },
  {
    title: "Domínio e branding",
    body: "Cada operação recebe domínio próprio, admin próprio e uma identidade visual separada."
  },
  {
    title: "Base comercial única",
    body: "Pedidos, leads, tickets, QR Code e check-in continuam evoluindo dentro do mesmo motor."
  }
];

export default async function Home() {
  const organizationContext = await getCurrentOrganizationContext();
  const isPlatformHost = organizationContext.isPlatformHost;

  if (isPlatformHost) {
    const platformOverview = await getPlatformOverview();
    const liveOperations = platformOverview.operations.filter((item) => item.isActive);

    return (
      <main className="shell homePage platformHomePage">
        <section className="platformHero">
          <div className="platformHeroGrid">
            <div className="platformHeroContent">
              <div className="brand homeBrand" aria-label={organizationContext.platformName}>
                <span className="brandMark">{organizationContext.brandMark}</span>
                <span>{organizationContext.platformName}</span>
              </div>
              <span className="homeEyebrow">Plataforma SaaS de bilheteria</span>
              <h1>O painel-mãe que cria, sustenta e escala bilheterias com domínio próprio.</h1>
              <p>
                {organizationContext.platformName} nao vende ingressos direto ao publico. Ela fornece o motor, o painel
                e a estrutura para cada bilheteria filha operar com dominio, equipe, branding e rotina comercial proprios.
              </p>

              <div className="platformHeroActions">
                <Link className="button" href="/login">
                  Entrar na plataforma
                </Link>
                <Link className="secondaryButton" href="/admin/operations">
                  Ver operações
                </Link>
              </div>

              <div className="homeTrustStrip" aria-label="Diferenciais da plataforma">
                {["Domínio por operação", "Branding por cliente", "Vendas + leads + QR Code"].map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>

              <div className="platformHeroChecklist">
                <span>Cria a bilheteria filha</span>
                <span>Define domínio e branding</span>
                <span>Entrega uma operação pronta para vender</span>
              </div>

              <div className="platformControlGrid" aria-label="Pontos centrais da plataforma">
                {platformControlPoints.map((item) => (
                  <article className="platformControlCard" key={item.title}>
                    <strong>{item.title}</strong>
                    <p>{item.body}</p>
                  </article>
                ))}
              </div>
            </div>

            <aside className="platformHeroPanel">
              <div className="platformHeroPanelHeader">
                <span className="eyebrow">Resumo da base</span>
                <strong>{organizationContext.platformName}</strong>
              </div>

              <div className="platformHeroMetrics">
                <article>
                  <span>Operações ativas</span>
                  <strong>{platformOverview.activeOrganizations}</strong>
                </article>
                <article>
                  <span>Domínios completos</span>
                  <strong>{platformOverview.fullyConfiguredOrganizations}</strong>
                </article>
                <article>
                  <span>Eventos publicados</span>
                  <strong>{platformOverview.publishedEvents}</strong>
                </article>
                <article>
                  <span>Usuários internos</span>
                  <strong>{platformOverview.totalAdmins}</strong>
                </article>
              </div>

              <div className="platformHeroNote">
                <strong>Modelo operacional</strong>
                <p>
                  Uma plataforma controla o motor. Cada bilheteria filha atende seus próprios produtores e eventos sem
                  misturar domínio, equipe ou identidade.
                </p>
              </div>

              <div className="platformHeroMiniGrid">
                <article>
                  <span>Operações prontas</span>
                  <strong>{liveOperations.filter((item) => item.readinessScore >= 67).length}</strong>
                </article>
                <article>
                  <span>Implantação mínima</span>
                  <strong>Domínio + equipe + branding</strong>
                </article>
              </div>
            </aside>
          </div>
        </section>

        <section className="container platformSection">
          <div className="sectionHeader homeSectionHeader">
            <div>
              <span className="eyebrow">Como a Ingresaas funciona</span>
              <h2>Arquitetura preparada para crescer sem duplicar sistema.</h2>
            </div>
          </div>

          <div className="platformFlowGrid">
            {platformPillars.map((item, index) => (
              <article className="card platformFlowCard" key={item.title}>
                <span>{`0${index + 1}`}</span>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="container platformSection">
          <div className="sectionHeader homeSectionHeader">
            <div>
              <span className="eyebrow">O que a plataforma entrega</span>
              <h2>Uma base técnica única para várias bilheterias operarem com autonomia.</h2>
            </div>
          </div>

          <div className="platformCapabilityGrid">
            {platformCapabilityRows.map((item) => (
              <article className="card platformCapabilityCard" key={item.title}>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="container platformSection">
          <div className="platformSplitGrid">
            <article className="card platformAudienceCard">
              <span className="eyebrow">Para quem a plataforma foi pensada</span>
              <h2>Bilheterias filhas com operação própria, sem reinventar o motor.</h2>
              <div className="homeSupportList">
                {platformAudience.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </article>

            <article className="card platformOnboardingCard">
              <span className="eyebrow">Fluxo de implantação</span>
              <h2>Como nasce uma nova bilheteria dentro da Ingresaas.</h2>
              <ol className="platformChecklist">
                <li>Cadastra a operação no painel master</li>
                <li>Define domínio público e domínio admin</li>
                <li>Configura branding, suporte e equipe inicial</li>
                <li>Publica eventos e libera o fluxo comercial</li>
              </ol>
              <div className="platformOnboardingFootnote">
                Isso mantem cada nova operacao embaixo do mesmo motor, sem duplicar projeto, banco ou fluxo comercial.
              </div>
            </article>
          </div>
        </section>

        <section className="container platformSection">
          <div className="sectionHeader homeSectionHeader">
            <div>
              <span className="eyebrow">Operações embaixo da base</span>
              <h2>Bilheterias já preparadas dentro da plataforma.</h2>
            </div>
            <div className="platformSectionActions">
              <Link className="secondaryButton smallButton" href="/admin">
                Abrir painel master
              </Link>
              <Link className="button smallButton" href="/admin/operations">
                Gerir operações
              </Link>
            </div>
          </div>

          <div className="platformOperationsGrid">
            {liveOperations.map((operation) => (
              <article className="card platformOperationCard" key={operation.id}>
                <div
                  className="platformOperationAccent"
                  style={{ background: operation.primaryColor || "linear-gradient(135deg, #0b7a63, #46a287)" }}
                />
                <div className="platformOperationHeader">
                  <div>
                    <strong>{operation.name}</strong>
                    <span>{operation.publicDomain || "Domínio ainda não configurado"}</span>
                  </div>
                  <span className={`status ${operation.isActive ? "published" : "draft"}`}>
                    {operation.isActive ? "Ativa" : "Inativa"}
                  </span>
                </div>
                <div className="platformOperationMeta">
                  <div>
                    <span>Eventos</span>
                    <strong>{operation.eventCount}</strong>
                  </div>
                  <div>
                    <span>Equipe</span>
                    <strong>{operation.adminCount}</strong>
                  </div>
                  <div>
                    <span>Prontidão</span>
                    <strong>{operation.readinessScore}%</strong>
                  </div>
                </div>
                <div className="platformReadinessBar" aria-label={`Prontidão de ${operation.readinessScore}%`}>
                  <span style={{ width: `${operation.readinessScore}%` }} />
                </div>
                <div className="platformReadinessTags">
                  {operation.readinessItems.map((item) => (
                    <span className={item.done ? "isDone" : "isTodo"} key={item.label}>
                      {item.label}
                    </span>
                  ))}
                </div>
                <p className="muted">
                  {operation.adminDomain
                    ? `Admin em ${operation.adminDomain}`
                    : "Ainda falta apontar o domínio administrativo desta operação."}
                </p>
              </article>
            ))}
          </div>
        </section>
      </main>
    );
  }

  const events = await listCachedPublishedEventShowcase(6, organizationContext.organization.id);
  const featuredEvent = events[0] ?? null;

  return (
    <main className="shell homePage">
      <section className="homeHero">
        <div className="homeHeroInner">
          <div className="homeHeroContent">
            <div className="brand homeBrand" aria-label={organizationContext.brandName}>
              <span className="brandMark">{organizationContext.brandMark}</span>
              <span>{organizationContext.brandName}</span>
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
    </main>
  );
}
