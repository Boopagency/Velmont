import { founderMedia } from '@/content/founder-media';
export function FounderMedia() {
  return <div className="founder-conversation" data-reveal>
    <div><span className="eyebrow">UMA CONVERSA COM A FUNDADORA</span><h3>Antes da estratégia,<br /><em>existe uma boa escuta.</em></h3></div>
    {founderMedia.video && founderMedia.captions ? <video controls playsInline preload="none" poster={founderMedia.poster || undefined} aria-label="Apresentação da fundadora da Velmont"><source src={founderMedia.video} type="video/mp4" /><track kind="captions" src={founderMedia.captions} srcLang="pt-BR" label="Português" default />Seu navegador não suporta vídeo.</video> : founderMedia.photo ? <img className="founder-joint-photo" src={founderMedia.photo} alt="Danielle Cubas de Azevedo, fundadora da Velmont" width="960" height="540" loading="lazy" /> : <div className="founder-video-placeholder"><span className="video-placeholder-mark" aria-hidden="true">V.</span><div><strong>Apresentação da fundadora</strong><p>Espaço reservado para uma fotografia, um depoimento ou um vídeo da própria fundadora.</p><span>MATERIAL REAL A INSERIR</span></div></div>}
  </div>;
}
