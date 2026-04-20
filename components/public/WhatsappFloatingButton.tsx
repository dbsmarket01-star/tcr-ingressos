type WhatsappFloatingButtonProps = {
  href: string;
  label?: string;
};

export function WhatsappFloatingButton({
  href,
  label = "Falar no WhatsApp"
}: WhatsappFloatingButtonProps) {
  return (
    <a
      className="whatsappFloatingButton"
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      aria-label={label}
    >
      <span className="whatsappFloatingButtonIcon" aria-hidden="true">
        W
      </span>
      <span>{label}</span>
    </a>
  );
}
