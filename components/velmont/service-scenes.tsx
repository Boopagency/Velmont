import { Icon } from './icons';
export function BrandPerimeter() {
  return <svg className="brand-perimeter" viewBox="0 0 100 100" aria-hidden="true" fill="none"><path d="M32.5 88V10.3L78.2 8.8V84.4L32.5 88L21.8 76V7.2L68.8 6L78.2 8.8M21.8 7.2L32.5 10.3M68.8 6V73L78.2 84.4M21.8 76L68.8 73" pathLength="1" /></svg>;
}

export function PatentScene() {
  const sprite = '/generated/velmont-patent-animation-sprite.webp';
  return <div className="service-art patent-scene" data-scene>
    <svg viewBox="0 0 1000 1000" aria-labelledby="patent-scene-title">
      <title id="patent-scene-title">Invenção mecânica: carcaça, engrenagens e eixo em vista explodida</title>
      <defs>
        <clipPath id="patent-housing"><path d="M0 0H1000V370H0Z" /></clipPath>
        <clipPath id="patent-gears"><path d="M0 370H1000V665H590L530 705H0Z" /></clipPath>
        <clipPath id="patent-shaft"><path d="M0 705H530L590 665H1000V1000H0Z" /></clipPath>
      </defs>
      <path className="engineering-axis" d="M100 720L940 280" />
      <g className="patent-part patent-part-shaft"><g transform="translate(215 -455)" clipPath="url(#patent-shaft)"><image href={sprite} width="1000" height="1000" /></g></g>
      <g className="patent-part patent-part-gears"><g transform="translate(60 -53)" clipPath="url(#patent-gears)"><image href={sprite} width="1000" height="1000" /></g></g>
      <g className="patent-part patent-part-housing"><g transform="translate(-218 392)" clipPath="url(#patent-housing)"><image href={sprite} width="1000" height="1000" /></g></g>
    </svg>
    <span className="art-caption">PROTEÇÃO PARA O QUE VOCÊ INVENTA.</span><span className="art-number" aria-hidden="true">02</span>
  </div>;
}

export function SoftwareScene() {
  return <figure className="software-visual software-scene" data-scene aria-label="Aplicação digital em três camadas: estrutura, criação e autoria">
    <div className="software-scene-stage" aria-hidden="true">
      <div className="app-layer app-layer-structure"><span>01 / ESTRUTURA</span><div className="structure-map"><i /><i /><i /><i /><i /><i /></div></div>
      <div className="app-layer app-layer-creation"><span>02 / CRIAÇÃO</span><div className="creation-lines"><i /><i /><i /><i /></div></div>
      <div className="app-layer app-layer-authored"><div className="app-window-bar"><span><Icon name="grid" /> Projeto autoral</span><span><Icon name="minus" /><Icon name="window" /><Icon name="close" /></span></div><div className="app-window-body"><small>SEU SOFTWARE</small><strong>Uma criação.<br />Muitas camadas de valor.</strong><div className="app-window-rows"><span><i />Interface</span><span><i />Lógica</span><span><i />Documentação</span></div></div><div className="app-window-footer">© Criação autoral<span>03 / AUTORIA</span></div></div>
    </div>
    <figcaption>CRIAÇÃO DIGITAL. PATRIMÔNIO DA SUA EMPRESA.</figcaption>
  </figure>;
}
