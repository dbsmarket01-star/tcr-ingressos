"use client";

function dispatchInputEvent(element: HTMLTextAreaElement) {
  element.dispatchEvent(new Event("input", { bubbles: true }));
}

export function LeadBroadcastBodyToolbar() {
  function applyBold() {
    const textarea = document.querySelector<HTMLTextAreaElement>('textarea[name="body"]');

    if (!textarea) {
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.slice(start, end);
    const replacement = selectedText ? `**${selectedText}**` : "**texto em negrito**";

    textarea.setRangeText(replacement, start, end, "select");
    textarea.focus();
    dispatchInputEvent(textarea);
  }

  return (
    <div className="leadBroadcastEditorToolbar" aria-label="Ferramentas de formatação da mensagem">
      <button className="leadBroadcastEditorToolButton" type="button" onClick={applyBold} title="Colocar texto selecionado em negrito">
        B
      </button>
      <small>Selecione um trecho e clique em B para deixar em negrito.</small>
    </div>
  );
}
