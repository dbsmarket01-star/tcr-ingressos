"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { sendCrmWhatsAppMessage } from "@/features/crm/whatsapp-chat.actions";

type WhatsAppComposerProps = { canReply: boolean; leadId: string; orderCode: string; phone: string };
const EMOJIS = ["😀", "😊", "🙏", "👍", "❤️", "🎉", "✅", "Olá!", "Obrigado!"];

function ComposerIcon({ name }: { name: "smile" | "clip" | "mic" | "send" | "stop" }) {
  if (name === "mic") return <svg aria-hidden="true" className="crmWaIcon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"/></svg>;
  if (name === "stop") return <svg aria-hidden="true" className="crmWaIcon" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>;
  if (name === "clip") return <svg aria-hidden="true" className="crmWaIcon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path d="m9 13 5.8-5.8a3 3 0 1 1 4.2 4.2l-7.5 7.5a5 5 0 0 1-7.1-7.1l7.1-7.1"/></svg>;
  if (name === "send") return <svg aria-hidden="true" className="crmWaIcon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path d="m3 11 18-8-8 18-2-8-8-2Zm8 2 4-4"/></svg>;
  return <svg aria-hidden="true" className="crmWaIcon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/></svg>;
}

export function WhatsAppComposer({ canReply, leadId, orderCode, phone }: WhatsAppComposerProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [recordedAudio, setRecordedAudio] = useState<File | null>(null);
  const [recording, setRecording] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [optimisticText, setOptimisticText] = useState("");
  const [selectedFile, setSelectedFile] = useState("");
  const [feedback, setFeedback] = useState("");

  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), []);

  function insertEmoji(value: string) {
    const input = textareaRef.current;
    if (!input) return;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    input.value = `${input.value.slice(0, start)}${value}${input.value.slice(end)}`;
    input.focus();
    input.setSelectionRange(start + value.length, start + value.length);
    setEmojiOpen(false);
  }

  async function toggleRecording() {
    if (recording) return recorderRef.current?.stop();
    setFeedback("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        const type = recorder.mimeType || "audio/webm";
        const extension = type.includes("mp4") ? "m4a" : type.includes("mpeg") ? "mp3" : "webm";
        setRecordedAudio(new File(chunksRef.current, `audio-${Date.now()}.${extension}`, { type }));
        setSelectedFile("Áudio gravado");
        setRecording(false);
        stream.getTracks().forEach((track) => track.stop());
      };
      recorder.start();
      setRecording(true);
      setSelectedFile("Gravando áudio… clique novamente para concluir");
    } catch {
      setFeedback("Não foi possível acessar o microfone. Libere a permissão do navegador e tente novamente.");
    }
  }

  async function submit(formData: FormData) {
    if (sending) return;
    if (recordedAudio) formData.set("audio", recordedAudio);
    const text = String(formData.get("text") || "").trim();
    const file = [formData.get("media"), formData.get("audio")].find((value) => value instanceof File && value.size > 0) as File | undefined;
    if (!text && !file) return;
    setSending(true);
    setFeedback("");
    setOptimisticText(text || `Enviando ${file?.name || "arquivo"}…`);
    const result = await sendCrmWhatsAppMessage(formData);
    if (!result.ok) {
      setFeedback(result.message);
      setOptimisticText("");
      setSending(false);
      return;
    }
    formRef.current?.reset();
    setRecordedAudio(null);
    setSelectedFile("");
    setSending(false);
    router.refresh();
    window.setTimeout(() => setOptimisticText(""), 2500);
  }

  const disabled = !canReply || !phone || sending;
  return <div className="crmWhatsappComposerWrap">
    {optimisticText ? <div aria-live="polite" className="crmWhatsappOptimistic"><article className="crmWhatsappBubble isOutbound"><p>{optimisticText}</p><footer><time>Enviando…</time></footer></article></div> : null}
    {feedback ? <p className="crmWhatsappComposerFeedback" role="alert">{feedback}</p> : null}
    <form action={submit} className="crmWhatsappComposer" ref={formRef}>
      <input name="orderCode" type="hidden" value={orderCode}/><input name="leadId" type="hidden" value={leadId}/><input name="phone" type="hidden" value={phone}/>
      <input accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,audio/*" className="crmWhatsappFileInput" disabled={disabled} name="media" onChange={(event) => { setRecordedAudio(null); setSelectedFile(event.target.files?.[0]?.name || ""); }} ref={mediaInputRef} type="file"/>
      <div className="crmWhatsappEmojiControl"><button aria-expanded={emojiOpen} aria-label="Abrir emojis" className="crmWhatsappComposerIcon" disabled={disabled} onClick={() => setEmojiOpen((value) => !value)} type="button"><ComposerIcon name="smile"/></button>{emojiOpen ? <div className="crmWhatsappEmojiPicker">{EMOJIS.map((emoji) => <button key={emoji} onClick={() => insertEmoji(emoji)} type="button">{emoji}</button>)}</div> : null}</div>
      <button aria-label="Anexar foto, vídeo, áudio, PDF ou arquivo" className="crmWhatsappComposerIcon" disabled={disabled} onClick={() => mediaInputRef.current?.click()} title="Anexar foto, vídeo, áudio, PDF ou arquivo" type="button"><ComposerIcon name="clip"/></button>
      <button aria-label={recording ? "Parar gravação" : "Gravar áudio"} className={`crmWhatsappComposerIcon ${recording ? "isRecording" : ""}`} disabled={!canReply || !phone || sending} onClick={() => void toggleRecording()} title={recording ? "Parar e anexar áudio" : "Gravar áudio pelo microfone"} type="button"><ComposerIcon name={recording ? "stop" : "mic"}/></button>
      <label className="crmWhatsappComposerText"><textarea name="text" placeholder={canReply ? "Escreva uma resposta..." : "Aguardando o cliente responder para abrir a janela de 24h"} disabled={disabled} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); formRef.current?.requestSubmit(); } }} ref={textareaRef} rows={1}/>{selectedFile ? <small title={selectedFile}>📎 {selectedFile}</small> : null}</label>
      <button aria-busy={sending} aria-label={sending ? "Enviando mensagem" : "Enviar mensagem"} className="crmWhatsappSend" disabled={disabled || recording} type="submit">{sending ? <span className="buttonSpinner" aria-hidden="true"/> : <ComposerIcon name="send"/>}</button>
    </form>
  </div>;
}
