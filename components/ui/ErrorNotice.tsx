import { getFriendlyError } from "@/lib/friendly-error";

type ErrorNoticeProps = {
  message?: unknown;
  title?: string;
  className?: string;
};

export function ErrorNotice({ message, title, className }: ErrorNoticeProps) {
  if (!message) {
    return null;
  }

  const friendlyError = getFriendlyError(message);

  return (
    <div className={["errorNotice", `errorNotice-${friendlyError.kind}`, className].filter(Boolean).join(" ")} role="alert">
      <span aria-hidden="true">{friendlyError.kind === "not-found" ? "?" : "!"}</span>
      <div>
        <strong>{title || friendlyError.title}</strong>
        <p>{friendlyError.message}</p>
      </div>
    </div>
  );
}
