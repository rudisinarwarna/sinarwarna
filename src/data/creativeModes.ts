import type { CreativeModeConfig, StarterPrompt } from '../types/chat';

export const CREATIVE_MODES: CreativeModeConfig[] = [
  {
    id: 'general',
    label: 'Umum & Ideasi',
    shortLabel: 'Ideasi',
    description: 'Tanya jawab apa saja, cari solusi masalah umum, ideasi, hingga konsultasi cat.',
    placeholder: 'Tanyakan apa saja, cari solusi masalah, atau konsultasi seputar cat...',
  },
  {
    id: 'design',
    label: 'Desain & Warna',
    shortLabel: 'Desain',
    description: 'Palet warna (lengkap dengan kode HEX), arah seni, tata letak UI, dan moodboard.',
    placeholder: 'Minta palet warna, kritik visual, atau arah seni untuk proyek Anda...',
  },
  {
    id: 'copywriting',
    label: 'Penulisan & Naskah',
    shortLabel: 'Naskah',
    description: 'Copywriting iklan, skrip video pendek, storytelling merek, dan penyuntingan nada.',
    placeholder: 'Tempel draf tulisan atau minta naskah kreatif dengan nada tertentu...',
  },
  {
    id: 'campaign',
    label: 'Konsep & Kampanye',
    shortLabel: 'Kampanye',
    description: 'Strategi peluncuran, kalender konten, aktivasi merek, dan materi presentasi.',
    placeholder: 'Jelaskan target audiens atau produk untuk menyusun kampanye kreatif...',
  },
];

export const STARTER_PROMPTS: StarterPrompt[] = [
  {
    id: 'palette-artisan',
    mode: 'design',
    title: 'Palet Warna & Moodboard',
    prompt:
      'Buatkan 5 warna palet lengkap dengan kode HEX dan arah visual untuk merek kopi artisan bernuansa Nusantara modern.',
  },
  {
    id: 'headline-launch',
    mode: 'copywriting',
    title: 'Variasi Headline Peluncuran',
    prompt:
      'Tulis 5 variasi headline dan sub-headline iklan yang puitis namun tegas untuk peluncuran aplikasi catatan visual.',
  },
  {
    id: 'reels-script',
    mode: 'copywriting',
    title: 'Skrip Video Pendek 45 Detik',
    prompt:
      'Susun skrip video pendek berdurasi 45 detik lengkap dengan hook 3 detik pertama untuk kreator desain interior.',
  },
  {
    id: 'campaign-launch',
    mode: 'campaign',
    title: 'Konsep Kampanye Produk',
    prompt:
      'Rancang konsep kampanye peluncuran selama 2 minggu untuk studio keramik lokal yang menyasar audiens urban.',
  },
];
