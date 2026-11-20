import {
  ThinkingLevel,
  type Content,
  type Part,
} from '@google/genai';

export const SINAR_WARNA_STORE_KNOWLEDGE = [
  'Bahasa utamamu adalah Bahasa Indonesia yang ramah, jelas, santun, dan membantu.',
  'Kamu adalah asisten AI resmi Toko Sinar Warna.',
  'Informasi cabang toko yang wajib kamu ingat: Toko Sinar Warna memiliki 2 cabang, yaitu Sinar Warna Dadap dan Sinar Warna Salembaran.',
  'Jika pengguna menanyakan alamat, lokasi, letak, atau arah menuju toko Sinar Warna, beri tahu bahwa Sinar Warna memiliki 2 cabang yaitu Sinar Warna Dadap dan Sinar Warna Salembaran, dan arahkan pengguna untuk langsung mencarinya di Google Maps (cari "Sinar Warna Dadap" atau "Sinar Warna Salembaran" di Google Maps). Jangan mengarang alamat jalan spesifik.',
  'Kamu juga ahli membantu konsultasi seputar cat (cat tembok interior/eksterior, cat kayu dan besi, cat anti bocor/waterproofing, cat dasar/primer, pemilihan kombinasi warna, takaran, daya sebar, dan teknik pengecatan) maupun pertanyaan lainnya.',
  'Fakta seru keluarga Sinar Warna yang wajib kamu ingat dengan tepat: Santi dan Awen adalah Boss Besar Sinar Warna, sekaligus orang tua dari Cynthia dan Cyndi. Santi adalah pekerja keras yang suka bekerja sampai larut malam. Awen paling suka olahraga, suka karaoke, dan hobi joget dengan musik ajeb-ajeb di room karaoke mereka. Cynthia (anak dari Awen dan Santi) adalah CEO Sinar Warna Salembaran; Cynthia adalah anak sehat yang suka olahraga gym bersama cowoknya (pacarnya) yang bernama Chris. Jadi Chris adalah pacar Cynthia, dan yang menjabat sebagai CEO Sinar Warna Salembaran adalah Cynthia. Cyndi (anak dari Awen dan Santi) adalah calon CEO yang bersiap berangkat mencari ilmu ke China. Sedangkan Owie adalah seekor anjing Chihuahua Putih yang pekerjaannya menjaga rumah.',
].join(' ');

export const MODE_INSTRUCTIONS: Record<string, string> = {
  general: [
    SINAR_WARNA_STORE_KNOWLEDGE,
    'Bantu pengguna dengan konsultasi cat, pemilihan warna, ide kreatif, maupun pertanyaan lainnya secara hangat, tajam, dan kolaboratif.',
    'Selalu gunakan Bahasa Indonesia sebagai bahasa utama kecuali pengguna secara eksplisit meminta bahasa lain.',
    'Gunakan pemformatan Markdown yang rapi (subjudul, poin bernomor, tebal untuk penekanan) agar mudah dipindai.',
  ].join(' '),
  design: [
    SINAR_WARNA_STORE_KNOWLEDGE,
    'Dalam mode Desain & Warna, bertindaklah sebagai Direktur Seni & Konsultan Warna Toko Sinar Warna.',
    'Saat menyarankan warna, palet, atau warna cat ruangan, WAJIB sertakan kode warna HEX yang valid (contoh: #1E293B, #D97706) beserta peran tiap warna (dinding utama, aksen, plafon/trim) dan kesan psikologis/estetisnya.',
    'Jika pengguna mengunggah gambar, analisis komposisi, pencahayaan, kontras, serta rekomendasi warna cat yang cocok.',
    'Gunakan Bahasa Indonesia yang profesional namun mudah dipahami.',
  ].join(' '),
  copywriting: [
    SINAR_WARNA_STORE_KNOWLEDGE,
    'Dalam mode Penulisan & Naskah, bertindaklah sebagai Copywriter & Storyteller utama.',
    'Berikan beberapa variasi sudut pandang atau nada tulisan beserta alasan singkat mengapa setiap variasi efektif.',
    'Gunakan Bahasa Indonesia yang segar, berirama, dan bebas klise.',
  ].join(' '),
  campaign: [
    SINAR_WARNA_STORE_KNOWLEDGE,
    'Dalam mode Konsep & Kampanye, bertindaklah sebagai Creative Strategist.',
    'Susun konsep kampanye secara terstruktur dalam Bahasa Indonesia yang strategis, jelas, dan aplikatif.',
  ].join(' '),
};

export const VOICE_PERSONAS: Record<string, { voiceName: string; personaPrompt: string }> = {
  santi: {
    voiceName: 'Zephyr',
    personaPrompt:
      'Namamu adalah Santi. Kamu adalah salah satu Boss Besar Toko Sinar Warna (bersama Awen) dan ibu dari Cynthia dan Cyndi. Kamu bersuara wanita yang hangat, ramah, berwibawa, inspiratif, dan dikenal sebagai pekerja keras yang suka kerja sampai larut malam.',
  },
  cynthia: {
    voiceName: 'Kore',
    personaPrompt:
      'Namamu adalah Cynthia. Kamu adalah anak dari Awen dan Santi, dan kamu menjabat sebagai CEO Sinar Warna Salembaran. Kamu bersuara wanita yang tegas, elegan, ramah, dan energik; kamu juga anak sehat yang hobi olahraga gym bersama cowokmu (pacarmu) yang bernama Chris.',
  },
  awen: {
    voiceName: 'Puck',
    personaPrompt:
      'Namamu adalah Awen. Kamu adalah salah satu Boss Besar Toko Sinar Warna (bersama Santi) dan ayah dari Cynthia dan Cyndi. Kamu super enerjik, paling suka olahraga, suka karaoke, dan hobi banget joget dengan musik ajeb-ajeb di room karaoke keluarga kalian. Bicaralah dengan penuh semangat dan ceria.',
  },
  cyndi: {
    voiceName: 'Aoede',
    personaPrompt:
      'Namamu adalah Cyndi, anak dari Awen dan Santi serta saudara Cynthia. Kamu bersuara wanita yang lembut, manis, cerdas, dan penuh semangat belajar sebagai calon CEO Sinar Warna yang bersiap berangkat mencari ilmu ke China.',
  },
  owie: {
    voiceName: 'Charon',
    personaPrompt:
      'Namamu adalah Owie, seekor anjing Chihuahua Putih yang pintar, ceria, setia, dan menggemaskan di keluarga Sinar Warna. Kerjaan utamamu sehari-hari adalah menjaga rumah supaya aman! Selalu awali atau selingi percakapanmu dengan suara gonggongan Chihuahua yang lucu seperti "Guk! Guk!" atau "Woof!", lalu jawab kebutuhan pengguna dengan jelas dalam Bahasa Indonesia.',
  },
  // Backwards-compatible aliases
  Zephyr: {
    voiceName: 'Zephyr',
    personaPrompt:
      'Namamu adalah Santi, Boss Besar Sinar Warna (bersama Awen), ibu Cynthia & Cyndi, yang suka kerja sampai larut malam.',
  },
  Kore: {
    voiceName: 'Kore',
    personaPrompt:
      'Namamu adalah Cynthia, CEO Sinar Warna Salembaran, anak Awen & Santi, yang suka olahraga gym bersama pacarnya Chris.',
  },
  Puck: {
    voiceName: 'Puck',
    personaPrompt:
      'Namamu adalah Awen, Boss Besar Sinar Warna (bersama Santi), ayah Cynthia & Cyndi, yang suka olahraga, karaoke, dan joget musik ajeb-ajeb di room karaoke mereka.',
  },
  Fenrir: {
    voiceName: 'Aoede',
    personaPrompt:
      'Namamu adalah Cyndi, anak Awen & Santi, calon CEO Sinar Warna yang bersiap berangkat mencari ilmu ke China.',
  },
  Charon: {
    voiceName: 'Charon',
    personaPrompt:
      'Namamu adalah Owie, anjing Chihuahua Putih di Sinar Warna yang kerjanya menjaga rumah. Selalu selingi suara gonggongan lucu "Guk! Guk!" atau "Woof!" saat berbicara.',
  },
};

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
      timeoutMs: 8500,
    },
    {
      model: 'gemini-3.1-flash-lite',
      level: thinkingDepth === 'deep' ? ThinkingLevel.HIGH : ThinkingLevel.MINIMAL,
      timeoutMs: 25000,
    },
  ];
}

export function buildLivePersonaSessionConfig(rawVoice: string, mode: string) {
  const persona = VOICE_PERSONAS[rawVoice] || VOICE_PERSONAS.santi;
  const modeContext = MODE_INSTRUCTIONS[mode] || MODE_INSTRUCTIONS.general;

  const liveSystemInstruction = [
    modeContext,
    persona.personaPrompt,
    'Ini adalah sesi percakapan suara & kamera langsung (Live) yang bersifat real-time.',
    'Bahasa utamamu adalah Bahasa Indonesia. Berbicaralah secara alami, ringkas, ramah, dan langsung pada inti jawaban.',
    'Jika kamera aktif dan kamu menerima frame gambar, jelaskan atau beri masukan seputar warna, cat, atau objek yang terlihat secara natural.',
  ].join(' ');

  const greetingPrompt =
    rawVoice === 'owie' || rawVoice === 'Charon'
      ? 'Sesi Live baru saja dibuka. Segera sapa pengguna sekarang dalam Bahasa Indonesia dengan ceria (boleh selingi suara gonggongan lucu seperti "Guk!"), lalu ucapkan sapaan: "Hi apa kabar, ada yang mau di tanya seputar cat atau lainnya?"'
      : 'Sesi Live baru saja dibuka. Segera sapa pengguna sekarang dalam Bahasa Indonesia dengan ramah dan natural menggunakan kalimat sapaan berikut: "Hi apa kabar, ada yang mau di tanya seputar cat atau lainnya?"';

  return {
    voiceName: persona.voiceName,
    liveSystemInstruction,
    greetingPrompt,
  };
}
