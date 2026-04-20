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
      title={label}
    >
      <span className="whatsappFloatingButtonIcon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" role="presentation">
          <path
            d="M20.52 3.48A11.86 11.86 0 0 0 12.07 0C5.51 0 .17 5.34.17 11.9c0 2.1.55 4.16 1.58 5.97L0 24l6.32-1.66a11.88 11.88 0 0 0 5.75 1.47h.01c6.56 0 11.9-5.34 11.9-11.9 0-3.18-1.24-6.17-3.46-8.43ZM12.08 21.8h-.01a9.9 9.9 0 0 1-5.04-1.38l-.36-.21-3.75.98 1-3.65-.24-.38a9.83 9.83 0 0 1-1.51-5.25c0-5.47 4.45-9.92 9.92-9.92 2.64 0 5.12 1.03 6.98 2.9a9.82 9.82 0 0 1 2.9 7c0 5.47-4.45 9.92-9.9 9.92Zm5.44-7.42c-.3-.15-1.78-.88-2.06-.98-.28-.1-.48-.15-.68.15-.2.3-.78.98-.95 1.18-.18.2-.35.22-.65.08-.3-.15-1.27-.47-2.42-1.49a9.18 9.18 0 0 1-1.68-2.07c-.18-.3-.02-.46.13-.61.14-.14.3-.35.45-.53.15-.18.2-.3.3-.5.1-.2.05-.38-.03-.53-.08-.15-.68-1.63-.94-2.24-.25-.6-.5-.52-.68-.53h-.58c-.2 0-.53.08-.8.38-.28.3-1.05 1.02-1.05 2.5 0 1.47 1.08 2.9 1.23 3.1.15.2 2.12 3.23 5.14 4.53.72.31 1.29.5 1.73.64.73.23 1.4.2 1.93.12.59-.09 1.78-.73 2.03-1.43.25-.7.25-1.3.18-1.43-.08-.13-.28-.2-.58-.35Z"
            fill="currentColor"
          />
        </svg>
      </span>
    </a>
  );
}
