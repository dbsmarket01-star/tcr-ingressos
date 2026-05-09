import Link from "next/link";
import { createPlatformLeadAction } from "@/features/platform-leads/platform-lead.actions";
import { PublicSiteFooter } from "@/components/public/PublicSiteFooter";
import { HomeEventCarousel } from "@/components/public/HomeEventCarousel";
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

function EnvelopeIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 7.5C4 6.67 4.67 6 5.5 6H18.5C19.33 6 20 6.67 20 7.5V16.5C20 17.33 19.33 18 18.5 18H5.5C4.67 18 4 17.33 4 16.5V7.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M5 8L12 13L19 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="6.7" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16 16L20 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5.8 19.2C6.6 16.6 8.9 15 12 15C15.1 15 17.4 16.6 18.2 19.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path d="M4 7H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 12H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 17H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path d="M12 20C12 20 18 14.6 18 10.2C18 6.78 15.31 4 12 4C8.69 4 6 6.78 6 10.2C6 14.6 12 20 12 20Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="12" cy="10.2" r="2.35" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function LightningIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path d="M13.2 3.8L7.8 12H11.5L10.8 20.2L16.2 12H12.5L13.2 3.8Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3L18 5.4V10.2C18 14.2 15.7 17.86 12 19.5C8.3 17.86 6 14.2 6 10.2V5.4L12 3Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CardIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="5.5" width="18" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.5 10H20.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M7.2 15H10.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="8.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7.7V12L15.1 13.9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TicketIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path
        d="M7 5.5H17C17 6.88 18.12 8 19.5 8V16C18.12 16 17 17.12 17 18.5H7C7 17.12 5.88 16 4.5 16V8C5.88 8 7 6.88 7 5.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M12 8.6V10.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 13.6V15.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 4.8L14.17 9.2L19 9.9L15.5 13.3L16.33 18.1L12 15.82L7.67 18.1L8.5 13.3L5 9.9L9.83 9.2L12 4.8Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HeadsetIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path d="M5 12C5 8.13 8.13 5 12 5C15.87 5 19 8.13 19 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M6.5 11.8H7.8C8.46 11.8 9 12.34 9 13V17C9 17.66 8.46 18.2 7.8 18.2H6.5C5.67 18.2 5 17.53 5 16.7V13.3C5 12.47 5.67 11.8 6.5 11.8Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16.2 11.8H17.5C18.33 11.8 19 12.47 19 13.3V16.7C19 17.53 18.33 18.2 17.5 18.2H16.2C15.54 18.2 15 17.66 15 17V13C15 12.34 15.54 11.8 16.2 11.8Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M15.2 19.2C14.5 19.73 13.46 20 12.1 20H11.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

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

  return (
    <main className="shell homePage" id="topo">
      <section className="tcrPremiumHero">
        <header className="tcrPremiumHeader">
          <Link className="tcrPremiumLogo" href="/">
            {organizationContext.brandLogoUrl ? (
              <img alt={organizationContext.brandName} className="brandLogo" src={organizationContext.brandLogoUrl} />
            ) : (
              <>
                <span className="brandMark">{organizationContext.brandMark}</span>
                <span>{organizationContext.brandName}</span>
              </>
            )}
          </Link>

          <nav className="tcrPremiumNav" aria-label="Navegação principal">
            <a href="#eventos">Eventos</a>
            <a href="#como-funciona">Como funciona</a>
            <a href="#ajuda">Ajuda</a>
          </nav>

          <form action="#eventos" className="tcrPremiumHeaderSearch" role="search">
            <SearchIcon />
            <input aria-label="Buscar eventos, artistas ou locais" name="q" placeholder="Buscar eventos, artistas ou locais" type="search" />
          </form>

          <div className="tcrPremiumActions">
            <Link className="tcrPremiumGhostAction" href="/meus-ingressos">
              <TicketIcon />
              <span>Meus ingressos</span>
            </Link>
            <Link className="tcrPremiumTextLink" href="/login">
              <UserIcon />
              <span>Entrar</span>
            </Link>
            <Link className="button" href="/login">
              Criar conta
            </Link>
          </div>

          <details className="tcrPremiumMobileMenu">
            <summary aria-label="Abrir menu">
              <MenuIcon />
            </summary>
            <div className="tcrPremiumMobilePanel">
              <a href="#eventos">Eventos</a>
              <a href="#como-funciona">Como funciona</a>
              <a href="#ajuda">Ajuda</a>
            </div>
          </details>
        </header>

        <div className="tcrPremiumHeroInner">
          <div className="tcrPremiumHeroLead">
            <span className="tcrPremiumEyebrow">Bilheteria oficial</span>
            <h1>
              A forma mais simples
              <br />
              de viver <span>grandes</span>
              <br />
              <span>experiências.</span>
            </h1>
            <p>
              Compra rápida, ambiente seguro e acesso fácil aos seus ingressos.
            </p>
          </div>

          <form action="#eventos" className="tcrPremiumMobileSearch" role="search">
            <label>
              <SearchIcon />
              <input aria-label="Buscar eventos, artistas ou locais" name="q" placeholder="Buscar eventos, artistas ou locais" type="search" />
            </label>
            <label>
              <PinIcon />
              <select aria-label="Cidade">
                <option>Todas as cidades</option>
                <option>São Paulo, SP</option>
                <option>Porto Alegre, RS</option>
                <option>Santa Maria, RS</option>
              </select>
            </label>
            <button className="button" type="submit">
              Buscar eventos
            </button>
          </form>

          <div className="tcrPremiumTrustRow">
            <span>
              <ShieldIcon />
              <strong>Compra 100% segura</strong>
              <small>Seus dados protegidos</small>
            </span>
            <span>
              <CardIcon />
              <strong>Pagamento facilitado</strong>
              <small>Pix, cartão e mais</small>
            </span>
            <span>
              <LightningIcon />
              <strong>Ingresso na hora</strong>
              <small>Entrega após confirmação</small>
            </span>
          </div>

          <div className="tcrPremiumTrustInline" aria-label="Benefícios rápidos">
            <span>Compra 100% segura</span>
            <span>Pagamento facilitado</span>
            <span>Ingresso na hora</span>
          </div>

        </div>
      </section>

      <div className="tcrHeroToEventsBridge" aria-hidden="true" />

      <section className="container tcrEventsSection" id="eventos">
        <div className="tcrSectionHeader">
          <div>
            <span className="eyebrow">Em destaque</span>
            <h2>Próximos eventos</h2>
          </div>
        </div>
        <HomeEventCarousel events={events} />
      </section>

      <section className="container" id="como-funciona">
        <article className="tcrPremiumValueBand">
          <div className="tcrPremiumValueIcon">
            <ShieldIcon />
          </div>
          <div>
            <h3>Sua experiência é nossa prioridade.</h3>
            <p>Tecnologia, segurança e atendimento para você curtir o que realmente importa.</p>
          </div>
          <div className="tcrPremiumValueSupportIcon" aria-hidden="true">
            <HeadsetIcon />
          </div>
        </article>
      </section>

      <PublicSiteFooter
        brandLogoUrl={organizationContext.brandLogoUrl}
        brandName={organizationContext.brandName}
        supportPhone={organizationContext.organization.supportPhone}
        settings={publicSocialSettings}
      />
    </main>
  );
}
