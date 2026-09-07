export type Testimonial = { id: string; quote: string; name: string; role: string; company: string; portrait: string | null; rating: number };
// Supplied verbatim by the user in section 05 of the revision request.
export const googleReviewsUrl = "https://www.google.com/search?q=Velmont+patentes+e+Marcas&rlz=1C1GCEA_enBR1198BR1198&oq=velmont+&gs_lcrp=EgZjaHJvbWUqCAgAEEUYJxg7MggIABBFGCcYOzIGCAEQRRg7MgYIAhBFGDwyBggDEEUYPDIGCAQQRRg8MgYIBRBFGDwyBggGEEUYPDIGCAcQRRg80gEIMTUyNWowajeoAgCwAgA&sourceid=chrome&source=chrome.ob&ie=UTF-8#lrd=0x94dce3f3dda4bb57:0xb44cbb5fea7e9c6b,1,,,,";
export const testimonials: Testimonial[] = [
  {
    "id": "fernanda-reis",
    "name": "Fernanda Reis",
    "quote": "Recomendo a Velmont de olhos fechados. Super dedicados e competentes. Realmente se preocupam em atender as necessidades dos seus clientes. Trabalho impecável e de muita excelência.",
    "role": "",
    "company": "",
    "portrait": null,
    "rating": 5
  },
  {
    "id": "rodrigo-cuduh",
    "name": "Rodrigo Cuduh",
    "quote": "Excelentes profissionais fazem parte da empresa, assessoria e consultoria completa na abertura de empresas…",
    "role": "",
    "company": "",
    "portrait": null,
    "rating": 5
  },
  {
    "id": "boop",
    "name": "Boop",
    "quote": "Excelente atendimento! Empresa muito séria e transparente. Sempre nos avisando no processo de cadastro da marca.",
    "role": "",
    "company": "",
    "portrait": null,
    "rating": 5
  }
];
