import { founderMedia } from '@/content/founder-media';
export function FounderMedia() {
  return <div className="founder-conversation" data-reveal>
    <div><span className="eyebrow">UMA CONVERSA COM AS FUNDADORAS</span><h3>Antes da estratégia,<br /><em>existe uma boa escuta.</em></h3></div>
    {founderMedia.video && founderMedia.captions ? <video controls playsInline preload="none" poster={founderMedia.poster || undefined} aria-label="Apresentação das fundadoras da Velmont"><source src={founderMedia.video} type="video/mp4" /><track kind="captions" src={founderMedia.captions} srcLang="pt-BR" label="Português" default />Seu navegador não suporta vídeo.</video> : founderMedia.photo ? <img className="founder-joint-photo" src={founderMedia.photo} alt="Danielle e Lisandra, fundadoras da Velmont" width="960" height="540" loading="lazy" /> : <div className="founder-video-placeholder"><span className="video-placeholder-mark" aria-hidden="true">V.</span><div><strong>Apresentação das fundadoras</strong><p>Espaço reservado para vídeo ou fotografia conjunta.</p><span>MATERIAL REAL A INSERIR</span></div></div>}
  </div>;
}
