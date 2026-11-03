// Browser script of the bio page (/links). The page is prerendered by bio.tsx;
// this is all the JavaScript it loads (no React), so it stays fast on phones.
import { bioMessage, type Interest } from '@/content/bio';
import { captureAttribution, prepareLeadProtection, submitLead } from '@/lib/lead-capture';
import { publicEnv } from '@/lib/public-env';
import { whatsappUrl } from '@/lib/site';

captureAttribution();
const lead = document.getElementById('bio-lead') as HTMLDialogElement;
const privacy = document.getElementById('bio-privacy') as HTMLDialogElement;
const form = lead.querySelector('form')!;
const field = (name: string) => {
  const value = new FormData(form).get(name);
  return typeof value === 'string' ? value.trim() : '';
};

document.addEventListener('click', (event) => {
  const target = (event.target as Element).closest<HTMLElement>('[data-interest], [data-privacy], [data-close]');
  if (!target) return;
  if ('close' in target.dataset) return target.closest('dialog')?.close();
  event.preventDefault();
  if ('privacy' in target.dataset) return privacy.showModal();
  // "" = another creation: the person picks it in the form.
  for (const radio of form.querySelectorAll<HTMLInputElement>('input[name=interest]')) radio.checked = radio.value === target.dataset.interest;
  lead.showModal();
  // Turnstile starts while the person types, so the hand-off does not wait for it.
  prepareLeadProtection(form);
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const interest = field('interest') as Interest;
  const name = field('name');
  const company = field('company');
  if (publicEnv.leadCapture) await submitLead({ name, company, interest, website: field('website'), source: 'link-bio' });
  location.assign(whatsappUrl(bioMessage(interest, name, company)));
});
