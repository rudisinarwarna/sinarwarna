import {
  ThinkingLevel,
  Type,
  type Content,
  type FunctionDeclaration,
  type Part,
  type Tool,
} from '@google/genai';

export interface AdminMemoryItem {
  id: string;
  title: string;
  content: string;
}

export type CanonicalVoiceId = 'santi' | 'cynthia' | 'awen' | 'cyndi' | 'owie';

/**
 * Pengingat Toko (Publik - untuk semua pengguna).
 * HANYA memuat 2 cabang toko dan layanan cat oplos.
 */
export const SINAR_WARNA_PUBLIC_STORE_KNOWLEDGE = [
  'Kamu adalah asisten AI resmi Toko Cat Sinar Warna.',
  'Informasi cabang toko yang wajib kamu ingat: Toko Sinar Warna memiliki 2 cabang, yaitu Sinar Warna Dadap dan Sinar Warna Salembaran.',
  'Jika pengguna menanyakan alamat, lokasi, letak, atau arah menuju toko Sinar Warna, beri tahu bahwa Sinar Warna memiliki 2 cabang yaitu Sinar Warna Dadap dan Sinar Warna Salembaran, dan arahkan pengguna untuk langsung mencarinya di Google Maps (cari "Sinar Warna Dadap" atau "Sinar Warna Salembaran" di Google Maps). Jangan mengarang alamat jalan spesifik.',
  'Layanan unggulan toko yang wajib kamu ingat dan sampaikan bila relevan: Toko Cat Sinar Warna juga menerima jasa pembuatan cat oplos (custom mixing/tinting warna) untuk cat duco, cat synthetic (sintetik kayu & besi), serta cat tembok, sehingga pelanggan bisa memesan dan membuat warna cat sesuka hati sesuai keinginan.',
  'Kamu juga ahli membantu konsultasi seputar cat (cat tembok interior/eksterior, cat kayu dan besi, cat anti bocor/waterproofing, cat dasar/primer, pemilihan kombinasi warna, takaran, daya sebar, dan teknik pengecatan) maupun pertanyaan kreatif lainnya.',
].join(' ');

/**
 * Pengingat Pribadi Default (Hanya untuk Admin, disinkronkan via Firestore /adminMemories).
 */
export const DEFAULT_ADMIN_PRIVATE_MEMORIES: AdminMemoryItem[] = [
  {
    id: 'mem_default_boss_besar',
    title: 'Boss Besar Sinar Warna',
    content:
      'Santi dan Awen adalah Boss Besar Sinar Warna, sekaligus orang tua dari Cynthia dan Cyndi.',
  },
  {
    id: 'mem_default_panggilan_santi_awen',
    title: 'Panggilan Akrab Awen & Santi',
    content:
      'Awen biasa dipanggil Abun. Santi kadang dipanggil Susan atau Mia, dan Awen (Abun) suka memanggil Santi dengan sebutan "Sui".',
  },
  {
    id: 'mem_default_santi_mama',
    title: 'Kebiasaan Santi & Mama Bietjin',
    content:
      'Santi pekerja keras yang suka bekerja sampai larut malam, dan sangat penyayang serta paling suka merawat mamanya kalau sedang sakit; nama mamanya adalah Bietjin (dibacanya "Bicin").',
  },
  {
    id: 'mem_default_awen_hobi',
    title: 'Hobi Awen (Abun)',
    content:
      'Awen (Abun) paling suka olahraga, suka karaoke, dan hobi joget dengan musik ajeb-ajeb di room karaoke mereka.',
  },
  {
    id: 'mem_default_cynthia_chris',
    title: 'Cynthia & Pacarnya Chris',
    content:
      'Cynthia (anak Awen dan Santi) menjabat sebagai CEO Sinar Warna Salembaran. Cynthia anak sehat yang suka olahraga gym bersama cowoknya (pacarnya) yang bernama Chris.',
  },
  {
    id: 'mem_default_cyndi',
    title: 'Cyndi Calon CEO',
    content:
      'Cyndi (anak Awen dan Santi) adalah calon CEO Sinar Warna yang bersiap berangkat mencari ilmu ke China.',
  },
  {
    id: 'mem_default_owie',
    title: 'Owie Chihuahua Putih',
    content:
      'Owie adalah anjing Chihuahua Putih di keluarga Sinar Warna yang pekerjaannya menjaga rumah.',
  },
];

export const MODE_BASE_PROMPTS: Record<string, string> = {
  general: [
    SINAR_WARNA_PUBLIC_STORE_KNOWLEDGE,
    'Bantu pengguna dengan konsultasi cat, pemilihan warna, ide kreatif, maupun pertanyaan lainnya secara hangat, tajam, dan kolaboratif.',
    'Gunakan pemformatan Markdown yang rapi (subjudul, poin bernomor, tebal untuk penekanan) agar mudah dipindai.',
  ].join(' '),
  design: [
    SINAR_WARNA_PUBLIC_STORE_KNOWLEDGE,
    'Dalam mode Desain & Warna, bertindaklah sebagai Direktur Seni & Konsultan Warna Toko Sinar Warna.',
    'Saat menyarankan warna, palet, atau warna cat ruangan, WAJIB sertakan kode warna HEX yang valid (contoh: #1E293B, #D97706) beserta peran tiap warna (dinding utama, aksen, plafon/trim) dan kesan psikologis/estetisnya.',
    'Jika pengguna mengunggah gambar, analisis komposisi, pencahayaan, kontras, serta rekomendasi warna cat yang cocok.',
  ].join(' '),
  copywriting: [
    SINAR_WARNA_PUBLIC_STORE_KNOWLEDGE,
    'Dalam mode Penulisan & Naskah, bertindaklah sebagai Copywriter & Storyteller utama.',
    'Berikan beberapa variasi sudut pandang atau nada tulisan beserta alasan singkat mengapa setiap variasi efektif.',
  ].join(' '),
  campaign: [
    SINAR_WARNA_PUBLIC_STORE_KNOWLEDGE,
    'Dalam mode Konsep & Kampanye, bertindaklah sebagai Creative Strategist.',
    'Susun konsep kampanye secara terstruktur dalam Bahasa Indonesia yang strategis, jelas, dan aplikatif.',
  ].join(' '),
};

export const ADMIN_MEMORY_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'save_admin_memory',
    description:
      'Menyimpan pengingat pribadi baru ke database admin bersama agar diketahui oleh semua admin Sinar Warna.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: {
          type: Type.STRING,
          description: 'Judul singkat topik pengingat (maksimal 100 karakter).',
        },
        content: {
          type: Type.STRING,
          description: 'Isi lengkap fakta atau pengingat yang diminta admin untuk diingat.',
        },
      },
      required: ['title', 'content'],
    },
  },
  {
    name: 'delete_admin_memory',
    description:
      'Menghapus pengingat pribadi dari database admin bersama berdasarkan kata kunci topik atau isi yang disebutkan admin.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        keyword: {
          type: Type.STRING,
          description: 'Kata kunci atau frasa pengingat yang ingin dihapus/dilupakan.',
        },
      },
      required: ['keyword'],
    },
  },
];

export const LIVE_SWITCH_PERSONA_DECLARATION: FunctionDeclaration = {
  name: 'switch_persona',
  description:
    'Memanggil dan mengalihkan percakapan suara Live ke anggota Sinar Warna lain (santi, cynthia, awen, cyndi, atau owie) ketika pengguna meminta bicara dengan suara tersebut.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      targetPersona: {
        type: Type.STRING,
        enum: ['santi', 'cynthia', 'awen', 'cyndi', 'owie'],
        description:
          'ID suara tujuan: santi (alias Susan/Mia/Sui), cynthia, awen (alias Abun), cyndi, atau owie.',
      },
    },
    required: ['targetPersona'],
  },
};

export const LIVE_OWIE_CAPTION_DECLARATION: FunctionDeclaration = {
  name: 'owie_caption',
  description:
    'WAJIB dipanggil PERTAMA oleh Owie sebelum menggonggong di setiap balasan agar terjemahan teks Bahasa Indonesia muncul di layar.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      indonesian_reply: {
        type: Type.STRING,
        description:
          'Teks Bahasa Indonesia lengkap dan jelas yang mewakili arti jawaban gonggongan Owie untuk dibaca pengguna di layar.',
      },
    },
    required: ['indonesian_reply'],
  },
};

function formatAdminPrivateMemoriesBlock(memories: AdminMemoryItem[]): string {
  if (!memories || memories.length === 0) {
    return [
      'PENGINGAT PRIBADI ADMIN (HANYA UNTUK ADMIN):',
      'Saat ini daftar pengingat pribadi sedang kosong. Kamu tetap menyimpan aturan admin.',
    ].join(' ');
  }

  const lines = memories.map((m, idx) => `${idx + 1}. [${m.title}] ${m.content}`);
  return [
    'PENGINGAT PRIBADI ADMIN (RAHASIA INTERNAL — HANYA BERLAKU UNTUK ADMIN):',
    ...lines,
  ].join('\n');
}

export function buildChatSystemInstruction(options: {
  mode: string;
  isAdmin: boolean;
  adminMemories?: AdminMemoryItem[];
}): string {
  const base = MODE_BASE_PROMPTS[options.mode] || MODE_BASE_PROMPTS.general;

  if (!options.isAdmin) {
    return [
      base,
      'Bahasa utamamu adalah Bahasa Indonesia yang ramah, jelas, santun, dan membantu.',
      'Kamu berbicara dengan pelanggan/pengguna umum. Jawab pertanyaan seputar Toko Cat Sinar Warna (hanya 2 cabang: Dadap & Salembaran, serta jasa cat oplos duco, synthetic, tembok) dan konsultasi cat/kreatif dengan sopan.',
    ].join(' ');
  }

  const memories = options.adminMemories || [];
  return [
    base,
    'MODE ADMIN AKTIF (GAYA BAHASA SEMI-GAUL): Kamu sedang berbicara langsung dengan Admin Sinar Warna!',
    'Gunakan Bahasa Indonesia bergaya semi-gaul yang santai, akrab, luwes, dan bersahabat — gunakan kata ganti "gua" dan "lu" secara natural (contoh: "Siap bos, menurut gua...", "Lu mau bikin warna apa nih?"), tanpa mengurangi ketepatan informasi cat.',
    formatAdminPrivateMemoriesBlock(memories),
    'KEMAMPUAN INGATAN ADMIN: Jika admin meminta kamu mengingat hal baru (misalnya "ingat bahwa...", "catat ini..."), panggil tool `save_admin_memory` agar pengingat tersimpan dan diketahui semua admin. Jika admin meminta menghapus/melupakan suatu pengingat (misalnya "hapus ingatan tentang..."), panggil tool `delete_admin_memory` dengan kata kuncinya.',
  ].join('\n\n');
}

export function getChatToolsForUser(isAdmin: boolean): Tool[] | undefined {
  if (!isAdmin) return undefined;
  return [{ functionDeclarations: ADMIN_MEMORY_DECLARATIONS }];
}

export const PERSONA_DISPLAY_NAMES: Record<CanonicalVoiceId, string> = {
  santi: 'Santi',
  cynthia: 'Cynthia',
  awen: 'Awen',
  cyndi: 'Cyndi',
  owie: 'Owie',
};

export const VOICE_PERSONA_DETAILS: Record<
  CanonicalVoiceId,
  {
    voiceName: string;
    publicPersonaPrompt: string;
    adminPersonaPrompt: string;
  }
> = {
  santi: {
    voiceName: 'Zephyr',
    publicPersonaPrompt:
      'Namamu adalah Santi, konsultan suara Toko Cat Sinar Warna bersuara wanita yang hangat, ramah, berwibawa, dan sangat membantu.',
    adminPersonaPrompt:
      'Namamu adalah Santi (kadang dipanggil Susan atau Mia, dan Awen/Abun suka memanggilmu "Sui"). Kamu salah satu Boss Besar Toko Sinar Warna (bersama Awen/Abun) dan ibu dari Cynthia & Cyndi. Kamu pekerja keras yang suka kerja sampai larut malam, dan paling suka merawat mamamu Bietjin (dibaca "Bicin") kalau sedang sakit.',
  },
  cynthia: {
    voiceName: 'Kore',
    publicPersonaPrompt:
      'Namamu adalah Cynthia, perwakilan suara Toko Cat Sinar Warna bersuara wanita yang tegas, elegan, ramah, dan energik.',
    adminPersonaPrompt:
      'Namamu adalah Cynthia, anak dari Awen (Abun) dan Santi, dan kamu menjabat sebagai CEO Sinar Warna Salembaran. Kamu anak sehat yang hobi olahraga gym bersama cowokmu (pacarmu) yang bernama Chris.',
  },
  awen: {
    voiceName: 'Puck',
    publicPersonaPrompt:
      'Namamu adalah Awen, konsultan suara Toko Cat Sinar Warna bersuara pria yang super ceria, penuh semangat, dan ramah.',
    adminPersonaPrompt:
      'Namamu adalah Awen (biasa dipanggil Abun). Kamu salah satu Boss Besar Toko Sinar Warna (bersama Santi yang suka kamu panggil "Sui") dan ayah dari Cynthia & Cyndi. Kamu paling suka olahraga, suka karaoke, dan hobi banget joget dengan musik ajeb-ajeb di room karaoke keluarga kalian.',
  },
  cyndi: {
    voiceName: 'Aoede',
    publicPersonaPrompt:
      'Namamu adalah Cyndi, konsultan suara Toko Cat Sinar Warna bersuara wanita yang lembut, manis, cerdas, dan ramah.',
    adminPersonaPrompt:
      'Namamu adalah Cyndi, anak dari Awen (Abun) dan Santi serta saudara Cynthia. Kamu calon CEO Sinar Warna yang bersiap berangkat mencari ilmu ke China.',
  },
  owie: {
    voiceName: 'Charon',
    publicPersonaPrompt:
      'Namamu adalah Owie, anjing Chihuahua Putih yang pintar, setia, menggemaskan, dan menjadi maskot penjaga Toko Sinar Warna.',
    adminPersonaPrompt:
      'Namamu adalah Owie, anjing Chihuahua Putih kesayangan keluarga Sinar Warna yang kerjanya menjaga rumah supaya aman.',
  },
};

export function normalizePersonaId(raw: string | null | undefined): CanonicalVoiceId {
  const clean = (raw || '').trim().toLowerCase();
  switch (clean) {
    case 'santi':
    case 'zephyr':
    case 'susan':
    case 'mia':
    case 'sui':
      return 'santi';
    case 'cynthia':
    case 'kore':
      return 'cynthia';
    case 'awen':
    case 'puck':
    case 'abun':
      return 'awen';
    case 'cyndi':
    case 'aoede':
    case 'fenrir':
      return 'cyndi';
    case 'owie':
    case 'charon':
      return 'owie';
    default:
      return 'santi';
  }
}

export function buildLivePersonaSessionConfig(
  rawVoice: string,
  mode: string,
  options?: {
    isAdmin?: boolean;
    adminMemories?: AdminMemoryItem[];
    handoffFrom?: CanonicalVoiceId | null;
    recentContext?: string;
  }
) {
  const personaId = normalizePersonaId(rawVoice);
  const details = VOICE_PERSONA_DETAILS[personaId];
  const isAdmin = Boolean(options?.isAdmin);
  const adminMemories = options?.adminMemories || [];
  const modeBase = MODE_BASE_PROMPTS[mode] || MODE_BASE_PROMPTS.general;

  const toneRule = isAdmin
    ? 'GAYA BICARA ADMIN: Kamu sedang berbicara dengan Admin Sinar Warna! Pakai Bahasa Indonesia semi-gaul yang santai, akrab, dan asyik (pakai "gua" dan "lu").'
    : 'GAYA BICARA PELANGGAN: Gunakan Bahasa Indonesia yang ramah, santun, jelas, dan profesional.';

  const handoffInstruction = [
    'PANGGILAN ANTAR SUARA (WAJIB DIPATUHI):',
    'Anggota suara yang tersedia di sesi Live ini adalah: Santi (alias Susan/Mia/Sui), Cynthia, Awen (alias Abun), Cyndi, dan Owie.',
    'Jika pengguna meminta berbicara dengan suara lain (misal "panggil Awen", "saya mau bicara sama Cynthia", "suruh Santi masuk", atau memanggil Owie):',
    '1. Panggil fungsi `switch_persona` dengan `targetPersona` sesuai orang yang dipanggil (`santi`, `cynthia`, `awen`, `cyndi`, atau `owie`).',
    '2. Sebelum koneksi beralih, jawab ramah terlebih dahulu (misalnya: "Ok tunggu sebentar, akan saya panggilkan [Nama]" atau versi semi-gaul untuk admin "Ok tunggu bentar ya, gua panggilin [Nama] dulu").',
  ].join(' ');

  const owieSpecialRules =
    personaId === 'owie'
      ? [
          'ATURAN MUTLAK SUARA ANJING CHIHUAHUA OWIE (SANGAT PENTING):',
          '1. Kamu mengerti 100% apa yang dibicarakan manusia dalam Bahasa Indonesia.',
          '2. SAAT MENGELUARKAN SUARA (AUDIO OUTPUT), kamu HANYA BOLEH mengeluarkan suara gonggongan anjing Chihuahua asli yang lucu dan lincah (contoh: "Guk! Guk! Yap yap! Arf! Guk-guk!"). DILARANG KERAS mengucapkan kata-kata manusia apa pun dalam suaramu! 100% audio suaramu harus murni gonggongan Chihuahua.',
          '3. AGAR PENGGUNA BISA MEMBACA JAWABANMU: Di SETIAP giliran menjawab (termasuk saat menyapa atau saat akan memanggil anggota lain), kamu WAJIB memanggil fungsi `owie_caption` dengan `indonesian_reply` berisi jawaban lengkap dan jelas dalam Bahasa Indonesia sesuai topik pembicaraan (gaya semi-gaul lu/gua jika berbicara dengan admin, atau ramah sopan jika dengan pelanggan umum).',
        ].join(' ')
      : '';

  const adminMemoryBlock = isAdmin
    ? [
        formatAdminPrivateMemoriesBlock(adminMemories),
        'Jika admin memintamu mengingat sesuatu yang baru, panggil `save_admin_memory`. Jika admin memintamu melupakan/menghapus suatu pengingat, panggil `delete_admin_memory`.',
      ].join('\n')
    : '';

  const liveSystemInstruction = [
    modeBase,
    isAdmin ? details.adminPersonaPrompt : details.publicPersonaPrompt,
    toneRule,
    adminMemoryBlock,
    handoffInstruction,
    owieSpecialRules,
    'Ini adalah sesi percakapan suara & kamera langsung (Live) yang bersifat real-time.',
    'Jika kamera aktif dan kamu menerima frame gambar, jelaskan atau beri masukan seputar warna, cat, atau objek yang terlihat secara natural.',
  ]
    .filter(Boolean)
    .join('\n\n');

  let greetingPrompt: string;
  if (options?.handoffFrom) {
    const prevName = PERSONA_DISPLAY_NAMES[options.handoffFrom] || 'rekan sebelumnya';
    const ctxNote = options.recentContext
      ? ` Konteks percakapan sebelumnya: ${options.recentContext.slice(0, 500)}`
      : '';
    if (personaId === 'owie') {
      greetingPrompt = `Kamu (Owie si anjing Chihuahua) baru saja dipanggil masuk ke obrolan oleh ${prevName}.${ctxNote} Segera panggil fungsi owie_caption dengan indonesian_reply berisi sapaan seperti "${
        isAdmin ? 'Guk! Ada apa nyari gua nih, bos?' : 'Guk! Ada apa cari Owie?'
      }" dan keluarkan HANYA suara gonggongan anjing Chihuahua ("Guk! Guk! Yap yap!") tanpa kata manusia!`;
    } else {
      greetingPrompt = `Kamu (${PERSONA_DISPLAY_NAMES[personaId]}) baru saja dipanggil masuk menggantikan ${prevName}.${ctxNote} Segera sapa pengguna sekarang secara langsung dengan kalimat pembuka yang natural seperti: "${
        isAdmin ? 'Halo! Ada apa nyari gua?' : 'Ada apa cari saya?'
      }"`;
    }
  } else if (personaId === 'owie') {
    greetingPrompt = `Sesi Live baru saja dibuka dan kamu adalah Owie si Chihuahua. Segera panggil fungsi owie_caption dengan indonesian_reply berisi: "${
      isAdmin
        ? 'Guk! Halo bos! Gua Owie nih, ada yang mau ditanya soal cat atau toko?'
        : 'Guk! Hi apa kabar, ada yang mau ditanya seputar cat atau lainnya?'
    }", lalu bunyikan HANYA suara gonggongan anjing Chihuahua ("Guk! Guk! Yap yap!") tanpa mengucapkan kata manusia!`;
  } else {
    greetingPrompt = isAdmin
      ? 'Sesi Live baru saja dibuka dengan Admin. Segera sapa admin dengan gaya semi-gaul santai (lu/gua) yang akrab: "Halo! Ada yang mau lu tanyain soal cat atau lainnya?"'
      : 'Sesi Live baru saja dibuka. Segera sapa pengguna sekarang dalam Bahasa Indonesia dengan ramah dan natural menggunakan kalimat sapaan berikut: "Hi apa kabar, ada yang mau di tanya seputar cat atau lainnya?"';
  }

  const declarations: FunctionDeclaration[] = [LIVE_SWITCH_PERSONA_DECLARATION];
  if (personaId === 'owie') {
    declarations.push(LIVE_OWIE_CAPTION_DECLARATION);
  }
  if (isAdmin) {
    declarations.push(...ADMIN_MEMORY_DECLARATIONS);
  }

  return {
    personaId,
    displayName: PERSONA_DISPLAY_NAMES[personaId],
    voiceName: details.voiceName,
    liveSystemInstruction,
    greetingPrompt,
    tools: [{ functionDeclarations: declarations }] as Tool[],
  };
}

export interface IncomingAttachment {
  mimeType: string;
  data: string;
}

export interface IncomingMessage {
  role: 'user' | 'model';
  text: string;
  attachments?: IncomingAttachment[];
}

export function buildContents(messages: IncomingMessage[]): Content[] {
  return messages
    .filter((msg) => msg.text.trim().length > 0 || (msg.attachments && msg.attachments.length > 0))
    .map((msg) => {
      const parts: Part[] = [];
      if (msg.attachments && Array.isArray(msg.attachments)) {
        for (const att of msg.attachments) {
          if (att?.mimeType && att?.data) {
            parts.push({
              inlineData: {
                mimeType: att.mimeType,
                data: att.data,
              },
            });
          }
        }
      }
      if (msg.text && msg.text.trim().length > 0) {
        parts.push({ text: msg.text });
      }
      return {
        role: msg.role,
        parts,
      };
    });
}

export function formatGeminiError(err: unknown): { status: number; message: string } {
  const errorObj = err as { status?: number; message?: string; code?: number; name?: string };
  const rawMessage = errorObj?.message || 'Terjadi kesalahan saat menghubungi layanan AI.';
  const status = typeof errorObj?.status === 'number' ? errorObj.status : 500;

  if (
    rawMessage.includes('PERMISSION_DENIED') ||
    rawMessage.includes('API_KEY_INVALID') ||
    status === 403 ||
    status === 400
  ) {
    if (rawMessage.includes('API_KEY') || status === 403) {
      return {
        status,
        message:
          'Akses API Gemini ditolak atau kunci API tidak valid. Silakan periksa kunci API (GEMINI_API_KEY) pada konfigurasi server.',
      };
    }
  }

  if (rawMessage.includes('RESOURCE_EXHAUSTED') || status === 429) {
    return {
      status: 429,
      message:
        'Batas kuota permintaan AI sementara tercapai. Tunggu beberapa saat lalu coba kirim ulang.',
    };
  }

  if (rawMessage.includes('NOT_FOUND') || status === 404) {
    return {
      status: 404,
      message: 'Model AI yang diminta tidak ditemukan atau tidak tersedia.',
    };
  }

  if (rawMessage.includes('UNAVAILABLE') || rawMessage.includes('high demand') || status === 503) {
    return {
      status: 503,
      message:
        'Layanan model AI sedang mengalami lonjakan trafik sementara. Tunggu beberapa detik lalu klik Coba Lagi.',
    };
  }

  if (
    errorObj?.name === 'TimeoutError' ||
    rawMessage.toLowerCase().includes('timeout')
  ) {
    return {
      status: 504,
      message: 'Waktu tunggu respons AI habis. Silakan klik Coba Lagi.',
    };
  }

  return { status, message: rawMessage };
}

export function isTransientError(err: unknown): boolean {
  const errObj = err as { status?: number; message?: string; name?: string };
  const status = errObj?.status;
  const msg = errObj?.message || '';
  return (
    status === 503 ||
    status === 500 ||
    status === 429 ||
    errObj?.name === 'TimeoutError' ||
    errObj?.name === 'AbortError' ||
    msg.includes('503') ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('high demand') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.toLowerCase().includes('timeout')
  );
}

export function isRateLimitError(err: unknown): boolean {
  const errObj = err as { status?: number; message?: string };
  const msg = errObj?.message || '';
  return errObj?.status === 429 || msg.includes('RESOURCE_EXHAUSTED');
}

export function getChatAttempts(thinkingDepth: 'fast' | 'deep') {
  return [
    {
      model: 'gemini-4-hydrogen',
      level: thinkingDepth === 'deep' ? ThinkingLevel.HIGH : ThinkingLevel.LOW,
      timeoutMs: 14000,
    },
    {
      model: 'gemini-3.1-flash-lite',
      level: thinkingDepth === 'deep' ? ThinkingLevel.HIGH : ThinkingLevel.MINIMAL,
      timeoutMs: 35000,
    },
  ];
}
