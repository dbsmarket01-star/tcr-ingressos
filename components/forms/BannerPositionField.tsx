"use client";

import { useState } from "react";

type BannerPositionFieldProps = {
  defaultValue?: string | null;
  previewImageUrl?: string | null;
};

const bannerPositionOptions = [
  {
    label: "Preservar topo / rosto alto",
    value: "center top",
    help: "Melhor quando a cabeca, data ou titulo ficam cortados no topo."
  },
  {
    label: "Topo com leve respiro",
    value: "center 18%",
    help: "Mantem o topo visivel, mas aproxima um pouco do centro."
  },
  {
    label: "Foco superior equilibrado",
    value: "center 28%",
    help: "Bom para artes com pessoas na parte de cima."
  },
  {
    label: "Centro visual",
    value: "center center",
    help: "Use quando a arte ja foi criada na proporcao ideal."
  },
  {
    label: "Foco inferior",
    value: "center bottom",
    help: "Use quando informacoes importantes ficam na parte de baixo."
  },
  {
    label: "Esquerda superior",
    value: "left top",
    help: "Prioriza conteudo no canto superior esquerdo."
  },
  {
    label: "Direita superior",
    value: "right top",
    help: "Prioriza conteudo no canto superior direito."
  },
  {
    label: "Esquerda central",
    value: "left center",
    help: "Prioriza conteudo na lateral esquerda."
  },
  {
    label: "Direita central",
    value: "right center",
    help: "Prioriza conteudo na lateral direita."
  },
  {
    label: "Esquerda inferior",
    value: "left bottom",
    help: "Prioriza conteudo no canto inferior esquerdo."
  },
  {
    label: "Direita inferior",
    value: "right bottom",
    help: "Prioriza conteudo no canto inferior direito."
  }
];

export function BannerPositionField({
  defaultValue = "center top",
  previewImageUrl
}: BannerPositionFieldProps) {
  const [currentValue, setCurrentValue] = useState(defaultValue || "center top");

  return (
    <div className="bannerPositionTool">
      <label className="field">
        <span>Enquadramento do banner</span>
        <select
          name="bannerPosition"
          value={currentValue}
          onChange={(event) => setCurrentValue(event.target.value)}
        >
          {bannerPositionOptions.map((option) => (
            <option value={option.value} key={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <small>
          Se o topo estiver cortando rosto, microfone ou texto, escolha uma opcao de topo e salve o
          evento.
        </small>
      </label>

      <div className="bannerPositionPreview">
        <span>Previa aproximada do topo publico</span>
        {previewImageUrl ? (
          <div
            className="bannerPreviewFrame"
            style={{
              backgroundImage: `linear-gradient(90deg, rgba(9, 20, 28, 0.78), rgba(9, 20, 28, 0.36)), url("${previewImageUrl}")`,
              backgroundPosition: currentValue
            }}
          >
            <strong>Area do titulo</strong>
          </div>
        ) : (
          <div className="bannerPreviewPlaceholder">
            Envie ou informe uma imagem para conferir o enquadramento visual.
          </div>
        )}
        <p>
          Dica rapida: para banners de palestrante/artista, normalmente "Preservar topo" resolve
          melhor do que "Centro visual".
        </p>
      </div>
    </div>
  );
}
