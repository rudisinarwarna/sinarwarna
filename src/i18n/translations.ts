import type { AppLanguage } from '../services/maintenanceManager';

export interface AppTranslations {
  common: {
    close: string;
    cancel: string;
    save: string;
    delete: string;
    retry: string;
    loading: string;
    verifiedAccount: string;
    verifiedAdmin: string;
    primaryAdmin: string;
    adminPlus: string;
    admin: string;
    verifiedFallbackName: string;
  };
  header: {
    openSidebar: string;
    openMenu: string;
    newChat: string;
    signIn: string;
    switchToLight: string;
    switchToDark: string;
    dismissNotice: string;
  };
  verificationBanner: {
    unverifiedNoticePrefix: string;
    unverifiedNoticeMiddle: string;
    unverifiedNoticeSuffix: string;
    resendEmail: string;
    sending: string;
    checkAgain: string;
    checking: string;
    dismissAria: string;
    resentOk: string;
    resentErr: string;
    verifiedOk: string;
    stillUnverified: string;
    checkErr: string;
  };
  welcome: {
    greetingPrefix: string;
    subtitle: string;
  };
  sidebar: {
    closeSidebar: string;
    closeMenu: string;
    newChat: string;
    historyCloud: string;
    historyUnverified: string;
    historyGuest: string;
    searchPlaceholder: string;
    searchAria: string;
    emptyGuest: string;
    emptyCloud: string;
    emptySearch: string;
    deleteConv: string;
    settings: string;
    defaultCreatorName: string;
    signOut: string;
    checkingAccount: string;
    signInOrRegister: string;
    connecting: string;
  };
  composer: {
    placeholder: string;
    ariaLabel: string;
    maxImagesError: string;
    unsupportedFormatError: string;
    maxSizeError: string;
    fileReadError: string;
    speechNotSupported: string;
    imageBtn: string;
    imageTooltip: string;
    cameraBtn: string;
    cameraTooltip: string;
    micStopTooltip: string;
    micStartTooltip: string;
    micInfoTooltip: string;
    liveBtn: string;
    liveTooltip: string;
    stopTooltip: string;
    sendTooltip: string;
    disclaimer: string;
    speechLang: string;
  };
  messageBubble: {
    attachmentLabel: string;
    retryBtn: string;
    thinkingAria: string;
    copy: string;
    copied: string;
    regenerate: string;
    moreConcise: string;
    moreConcisePrompt: string;
    newVariations: string;
    newVariationsPrompt: string;
    adminRawErrorBadge: string;
    webSourcesLabel: string;
  };
  settings: {
    dialogAria: string;
    title: string;
    closeAria: string;
    tabGeneral: string;
    tabAdmin: string;
    themeTitle: string;
    themeDesc: string;
    themeLight: string;
    themeDark: string;
    langTitle: string;
    langDesc: string;
    langId: string;
    langEn: string;
    langZh: string;
    liveTranscriptTitle: string;
    liveTranscriptDesc: string;
    liveTranscriptOn: string;
    liveTranscriptOff: string;
    installTitle: string;
    installDesc: string;
    alreadyInstalled: string;
    processing: string;
    androidBtn: string;
    androidHintInstallable: string;
    androidHintChrome: string;
    androidGuideTitle: string;
    androidStep1: string;
    androidStep2: string;
    androidStep3: string;
    safariBtn: string;
    safariHint: string;
    safariGuideTitle: string;
    safariStep1: string;
    safariStep2Prefix: string;
    safariStep2Share: string;
    safariStep2Suffix: string;
    safariStep3Prefix: string;
    safariStep3AddHome: string;
    safariStep3Middle: string;
    safariStep3Add: string;
  };
  auth: {
    dialogAria: string;
    close: string;
    welcomeTitlePrefix: string;
    welcomeSubtitle: string;
    modalTitlePrefix: string;
    modalSubtitle: string;
    tabLogin: string;
    tabRegister: string;
    fullNameLabel: string;
    fullNamePlaceholder: string;
    emailLabel: string;
    emailPlaceholder: string;
    passwordLabel: string;
    forgotPassword: string;
    passwordPlaceholder: string;
    hidePassword: string;
    showPassword: string;
    processingLogin: string;
    processingRegister: string;
    loginWithEmail: string;
    registerAccount: string;
    orContinueWith: string;
    connecting: string;
    errEnterEmail: string;
    errPasswordLength: string;
    errResetNeedEmail: string;
    infoResetSent: string;
    infoRedirectGoogle: string;
    infoRedirectApple: string;
  };
  camera: {
    dialogAria: string;
    title: string;
    switchCamera: string;
    closeCamera: string;
    takePhoto: string;
    permissionError: string;
  };
  installPrompt: {
    dialogAria: string;
    title: string;
    desc: string;
    closeAria: string;
    step1Prefix: string;
    step1Share: string;
    step1Suffix: string;
    step2Prefix: string;
    step2AddHome: string;
    step2Middle: string;
    step2Add: string;
    installing: string;
    installWebApp: string;
    installSafari: string;
    later: string;
  };
  liveStudio: {
    dialogAria: string;
    title: string;
    selectVoiceAria: string;
    reconnect: string;
    tapToUnblockAudio: string;
    callingVoice: string;
    connectingVoice: string;
    listeningWith: string;
    owieBarkingWithText: string;
    owieBarking: string;
    speakingSuffix: string;
    paused: string;
    disconnected: string;
    micMutedHint: string;
    connectingCamTo: string;
    cameraFront: string;
    cameraBack: string;
    camLabelPrefix: string;
    speakPrompt: string;
    closeBubble: string;
    distanceLabel: string;
    trafficLabel: string;
    owieBarkTranslationTag: string;
    camOffTooltip: string;
    camOnTooltip: string;
    switchToFrontTooltip: string;
    switchToBackTooltip: string;
    frontShort: string;
    backShort: string;
    unmuteMicTooltip: string;
    muteMicTooltip: string;
    resumeLiveTooltip: string;
    pauseLiveTooltip: string;
    endCallTooltip: string;
    micDeniedError: string;
    camDeniedError: string;
    wsConnectError: string;
    wsDisconnectedPrefix: string;
    wsDisconnectedSuffix: string;
    gpsUnsupportedTitle: string;
    gpsUnsupportedDesc: string;
    gpsTrafficOk: string;
    webSourcesTitle: string;
    openGoogleMaps: string;
    endingLiveNotice: string;
    audioSpeakerLabel: string;
    audioEarpieceLabel: string;
    audioRouteToEarpieceTooltip: string;
    audioRouteToSpeakerTooltip: string;
  };
  admin: {
    modalAria: string;
    modalTitle: string;
    modalSubBasic: string;
    modalSubFull: string;
    closeModalAria: string;
    maintenanceTitle: string;
    maintenanceOn: string;
    maintenanceOff: string;
    maintenanceDescOn: string;
    maintenanceDescOff: string;
    maintenanceReasonPrefix: string;
    maintenanceTurnOff: string;
    maintenanceTurnOn: string;
    maintenanceFeedbackOn: string;
    maintenanceFeedbackOff: string;
    maintenanceManualReason: string;
    maintenanceSimulatedError: string;
    defaultThemeTitle: string;
    defaultThemeDesc: string;
    defaultThemeDark: string;
    defaultThemeLight: string;
    defaultThemeSavedDark: string;
    defaultThemeSavedLight: string;
  };
  errors: {
    emptyAiReply: string;
    connectAiError: string;
    requestFailedPrefix: string;
    streamUnavailable: string;
    loadCloudHistoryFail: string;
    loadMessagesFail: string;
    deleteCloudFail: string;
    boundaryTitle: string;
    boundaryFallback: string;
    boundaryDbPrefix: string;
    boundaryReload: string;
  };
}

const ID_TRANSLATIONS: AppTranslations = {
  common: {
    close: 'Tutup',
    cancel: 'Batal',
    save: 'Simpan',
    delete: 'Hapus',
    retry: 'Coba Lagi',
    loading: 'Memuat...',
    verifiedAccount: 'Akun Terverifikasi',
    verifiedAdmin: 'Admin Terverifikasi',
    primaryAdmin: 'Admin Utama Terverifikasi',
    adminPlus: 'Admin+ Terverifikasi',
    admin: 'Admin Terverifikasi',
    verifiedFallbackName: 'Terverifikasi',
  },
  header: {
    openSidebar: 'Buka panel samping',
    openMenu: 'Buka menu',
    newChat: 'Percakapan Baru',
    signIn: 'Masuk',
    switchToLight: 'Ganti ke tema terang',
    switchToDark: 'Ganti ke tema gelap',
    dismissNotice: 'Tutup pemberitahuan',
  },
  verificationBanner: {
    unverifiedNoticePrefix: 'Akun',
    unverifiedNoticeMiddle: 'belum terverifikasi. Verifikasi email untuk menyimpan riwayat percakapan (sementara obrolan tidak disimpan ke riwayat).',
    unverifiedNoticeSuffix: '',
    resendEmail: 'Kirim Ulang Email',
    sending: 'Mengirim...',
    checkAgain: 'Sudah Verifikasi? Cek Ulang',
    checking: 'Memeriksa...',
    dismissAria: 'Tutup banner verifikasi',
    resentOk: 'Email verifikasi telah dikirim ulang. Periksa kotak masuk atau folder spam Anda.',
    resentErr: 'Gagal mengirim ulang email verifikasi. Coba beberapa saat lagi.',
    verifiedOk: 'Email berhasil diverifikasi! Riwayat Cloud sekarang aktif.',
    stillUnverified: 'Email Anda belum terverifikasi. Klik tautan verifikasi di email Anda lalu tekan Cek Ulang.',
    checkErr: 'Gagal memeriksa status verifikasi email.',
  },
  welcome: {
    greetingPrefix: 'Hai, selamat datang di',
    subtitle: 'Ada yang mau di tanya seputar cat atau lainnya?',
  },
  sidebar: {
    closeSidebar: 'Tutup panel samping',
    closeMenu: 'Tutup menu',
    newChat: 'Percakapan Baru',
    historyCloud: 'Riwayat Cloud',
    historyUnverified: 'Riwayat (Belum Verifikasi)',
    historyGuest: 'Riwayat (Mode Tamu)',
    searchPlaceholder: 'Cari riwayat...',
    searchAria: 'Cari riwayat percakapan',
    emptyGuest: 'Belum daftar/masuk akun. Obrolan sementara ini tidak disimpan di riwayat dan akan hilang setelah keluar.',
    emptyCloud: 'Belum ada riwayat. Mulai percakapan untuk menyimpan ide kreatif Anda.',
    emptySearch: 'Tidak ada percakapan yang cocok.',
    deleteConv: 'Hapus percakapan',
    settings: 'Pengaturan',
    defaultCreatorName: 'Kreator Sinar Warna',
    signOut: 'Keluar akun',
    checkingAccount: 'Memeriksa akun...',
    signInOrRegister: 'Masuk / Daftar Akun',
    connecting: 'Menghubungkan...',
  },
  composer: {
    placeholder: 'Tanyakan apa saja ke Sinar Warna...',
    ariaLabel: 'Tulis pesan untuk Sinar Warna',
    maxImagesError: 'Maksimal 3 gambar referensi per pesan.',
    unsupportedFormatError: 'Format gambar yang didukung: PNG, JPG, WEBP, atau GIF.',
    maxSizeError: 'Ukuran tiap gambar maksimal 4 MB.',
    fileReadError: 'Gagal membaca file',
    speechNotSupported: 'Dikte suara belum didukung di peramban ini. Ketuk tombol Live untuk berbicara langsung.',
    imageBtn: 'Gambar',
    imageTooltip: 'Unggah gambar referensi',
    cameraBtn: 'Kamera',
    cameraTooltip: 'Ambil foto dari kamera',
    micStopTooltip: 'Hentikan dikte suara',
    micStartTooltip: 'Dikte suara',
    micInfoTooltip: 'Dikte suara (ketuk untuk info)',
    liveBtn: 'Live',
    liveTooltip: 'Mulai Sinar Warna Live (Suara & Kamera)',
    stopTooltip: 'Hentikan respons',
    sendTooltip: 'Kirim pesan',
    disclaimer: 'Sinar Warna dapat membuat kekeliruan. Periksa kembali hasil kreatif penting Anda.',
    speechLang: 'id-ID',
  },
  messageBubble: {
    attachmentLabel: 'Lampiran gambar:',
    retryBtn: 'Coba Lagi',
    thinkingAria: 'Sinar Warna sedang menyusun jawaban',
    copy: 'Salin',
    copied: 'Tersalin',
    regenerate: 'Regenerasi',
    moreConcise: 'Lebih Ringkas',
    moreConcisePrompt: 'Ringkas jawaban di atas menjadi versi yang lebih padat dan siap pakai.',
    newVariations: 'Variasi Baru',
    newVariationsPrompt: 'Kembangkan ide di atas dengan 3 variasi kreatif baru yang lebih berani dan detail.',
    adminRawErrorBadge: 'Admin Debug: Error Asli',
    webSourcesLabel: 'Sumber Web Terverifikasi',
  },
  settings: {
    dialogAria: 'Pengaturan Sinar Warna',
    title: 'Pengaturan',
    closeAria: 'Tutup pengaturan',
    tabGeneral: 'Umum & Tampilan',
    tabAdmin: 'Administrator',
    themeTitle: 'Pengaturan Cahaya & Tema',
    themeDesc: 'Pilih tampilan terang atau gelap sesuai kenyamanan mata Anda.',
    themeLight: 'Tema Terang',
    themeDark: 'Tema Gelap',
    langTitle: 'Bahasa / Language / 语言',
    langDesc: 'Pilih bahasa untuk seluruh tampilan web & informasi pemeliharaan (Under Maintenance).',
    langId: '🇮🇩 Indonesia',
    langEn: '🇬🇧 English',
    langZh: '🇨🇳 中文 (Mandarin)',
    liveTranscriptTitle: 'Kotak Teks Bicara AI Live',
    liveTranscriptDesc: 'Tampilkan atau sembunyikan kotak teks percakapan langsung saat memakai AI Live.',
    liveTranscriptOn: 'Hidupkan Teks',
    liveTranscriptOff: 'Matikan Teks',
    installTitle: 'Download Aplikasi Sinar Warna',
    installDesc: 'Pasang aplikasi web ke layar utama agar lebih cepat dibuka di Android maupun iPhone (Safari).',
    alreadyInstalled: 'Aplikasi Sinar Warna sudah terpasang di perangkat ini.',
    processing: 'Memproses...',
    androidBtn: 'Download App untuk Android',
    androidHintInstallable: 'Ketuk untuk langsung memasang di HP Android',
    androidHintChrome: 'Pasang lewat Google Chrome Android',
    androidGuideTitle: 'Cara Pasang di Android (Chrome):',
    androidStep1: '1. Buka halaman ini menggunakan browser Google Chrome.',
    androidStep2: '2. Ketuk ikon menu titik tiga (⋮) di pojok kanan atas.',
    androidStep3: '3. Pilih Tambahkan ke Layar Utama atau Instal aplikasi.',
    safariBtn: 'Download App untuk Apple Safari',
    safariHint: 'Panduan pasang di iPhone, iPad, atau Mac Safari',
    safariGuideTitle: 'Cara Pasang di Safari Apple (iPhone / iPad):',
    safariStep1: '1. Pastikan situs dibuka lewat browser Safari.',
    safariStep2Prefix: '2. Ketuk tombol',
    safariStep2Share: 'Bagikan (Share)',
    safariStep2Suffix: 'di bagian bawah layar Safari.',
    safariStep3Prefix: '3. Gulir ke bawah, pilih',
    safariStep3AddHome: 'Tambah ke Layar Utama',
    safariStep3Middle: '(Add to Home Screen), lalu ketuk',
    safariStep3Add: 'Tambah',
  },
  auth: {
    dialogAria: 'Masuk atau daftar akun Sinar Warna',
    close: 'Tutup',
    welcomeTitlePrefix: 'Selamat datang di',
    welcomeSubtitle: 'Silakan masuk atau daftar akun untuk mulai konsultasi cat & warna.',
    modalTitlePrefix: 'Masuk ke',
    modalSubtitle: 'Simpan riwayat percakapan Anda di cloud (opsional).',
    tabLogin: 'Masuk',
    tabRegister: 'Daftar Akun',
    fullNameLabel: 'Nama Lengkap',
    fullNamePlaceholder: 'Contoh: Budi Santoso',
    emailLabel: 'Alamat Email',
    emailPlaceholder: 'nama@email.com',
    passwordLabel: 'Kata Sandi',
    forgotPassword: 'Lupa kata sandi?',
    passwordPlaceholder: 'Minimal 6 karakter',
    hidePassword: 'Sembunyikan kata sandi',
    showPassword: 'Lihat kata sandi',
    processingLogin: 'Memproses masuk...',
    processingRegister: 'Mendaftarkan akun...',
    loginWithEmail: 'Masuk dengan Email',
    registerAccount: 'Daftar Akun Baru',
    orContinueWith: 'atau gunakan email',
    connecting: 'Menghubungkan...',
    errEnterEmail: 'Masukkan alamat email Anda.',
    errPasswordLength: 'Kata sandi minimal 6 karakter.',
    errResetNeedEmail: 'Masukkan email Anda terlebih dahulu untuk mengatur ulang kata sandi.',
    infoResetSent: 'Tautan atur ulang kata sandi telah dikirim ke email Anda. Periksa kotak masuk atau folder spam.',
    infoRedirectGoogle: 'Mengalihkan ke halaman masuk Google...',
    infoRedirectApple: 'Mengalihkan ke halaman masuk Apple...',
  },
  camera: {
    dialogAria: 'Ambil foto dengan kamera',
    title: 'Kamera Sinar Warna',
    switchCamera: 'Ganti kamera depan/belakang',
    closeCamera: 'Tutup kamera',
    takePhoto: 'Ambil Foto',
    permissionError: 'Tidak dapat mengakses kamera. Pastikan izin kamera diaktifkan di peramban Anda.',
  },
  installPrompt: {
    dialogAria: 'Pasang aplikasi web Sinar Warna',
    title: 'Pasang Aplikasi Sinar Warna',
    desc: 'Instal web app di layar utama Android atau Safari iPhone agar lebih cepat dibuka.',
    closeAria: 'Tutup tawaran instal aplikasi',
    step1Prefix: '1. Ketuk ikon',
    step1Share: 'Bagikan (Share)',
    step1Suffix: 'di bar bawah Safari.',
    step2Prefix: '2. Pilih',
    step2AddHome: 'Tambah ke Layar Utama',
    step2Middle: ', lalu ketuk',
    step2Add: 'Tambah',
    installing: 'Memasang...',
    installWebApp: 'Instal Web App',
    installSafari: 'Pasang di Safari iPhone',
    later: 'Nanti Saja',
  },
  liveStudio: {
    dialogAria: 'Sinar Warna Live',
    title: 'Sinar Warna Live',
    selectVoiceAria: 'Pilih suara asisten',
    reconnect: 'Sambung Ulang',
    tapToUnblockAudio: 'Ketuk di sini untuk mengaktifkan mikrofon & suara',
    callingVoice: 'Memanggil',
    connectingVoice: 'Menghubungkan',
    listeningWith: 'Terhubung dengan {name} · Silakan berbicara...',
    owieBarkingWithText: 'Owie sedang menggonggong (baca teks di bawah)',
    owieBarking: 'Owie sedang menggonggong',
    speakingSuffix: 'sedang berbicara',
    paused: 'Sesi Live dijeda',
    disconnected: 'Koneksi terputus',
    micMutedHint: 'Mikrofon dibisukan · Ketuk ikon mikrofon untuk berbicara',
    connectingCamTo: 'Menghubungkan kamera ke',
    cameraFront: 'Depan',
    cameraBack: 'Belakang',
    camLabelPrefix: 'Kamera',
    speakPrompt: 'Silakan berbicara',
    closeBubble: 'Tutup bubble',
    distanceLabel: 'Jarak:',
    trafficLabel: 'Lalulintas:',
    owieBarkTranslationTag: '(Arti Gonggongan)',
    camOffTooltip: 'Matikan kamera langsung',
    camOnTooltip: 'Nyalakan kamera langsung',
    switchToFrontTooltip: 'Pindah ke kamera depan (selfie)',
    switchToBackTooltip: 'Pindah ke kamera belakang',
    frontShort: 'Depan',
    backShort: 'Belakang',
    unmuteMicTooltip: 'Aktifkan mikrofon',
    muteMicTooltip: 'Bisukan mikrofon',
    resumeLiveTooltip: 'Lanjutkan Live',
    pauseLiveTooltip: 'Jeda Live',
    endCallTooltip: 'Akhiri Sinar Warna Live',
    micDeniedError: 'Akses mikrofon ditolak atau tidak tersedia. Aktifkan izin mikrofon lalu coba lagi.',
    camDeniedError: 'Kamera tidak dapat diakses. Periksa izin kamera di peramban Anda.',
    wsConnectError: 'Gagal menyambung ke server Gemini Live.',
    wsDisconnectedPrefix: 'Koneksi AI Live terputus',
    wsDisconnectedSuffix: '. Tekan Sambung Ulang untuk melanjutkan.',
    gpsUnsupportedTitle: 'Lokasi & Peta Sinar Warna',
    gpsUnsupportedDesc: 'GPS tidak didukung perangkat ini. Menampilkan lokasi Sinar Warna.',
    gpsTrafficOk: 'Cek lalu lintas langsung di Google Maps',
    webSourcesTitle: 'Hasil Pencarian & Referensi',
    openGoogleMaps: 'Buka di Google Maps',
    endingLiveNotice: 'Mengakhiri sesi Live...',
    audioSpeakerLabel: 'Speaker',
    audioEarpieceLabel: 'Kuping',
    audioRouteToEarpieceTooltip: 'Pindah suara ke speaker kuping',
    audioRouteToSpeakerTooltip: 'Pindah suara ke speaker depan',
  },
  admin: {
    modalAria: 'Panel Administrator Sinar Warna',
    modalTitle: 'Administrator Sinar Warna',
    modalSubBasic: 'Kelola akun pengguna biasa & pengingat admin AI',
    modalSubFull: 'Kelola akun pengguna, level admin, & pengingat admin AI',
    closeModalAria: 'Tutup panel administrator',
    maintenanceTitle: 'SIARAN PEMELIHARAAN (UNDER MAINTENANCE)',
    maintenanceOn: 'SEDANG TAYANG',
    maintenanceOff: 'NONAKTIF',
    maintenanceDescOn:
      'Siaran berjalan aktif di layar depan chat. Semua pengguna melihat pesan Under Maintenance, sedangkan admin tetap melihat error teknis asli.',
    maintenanceDescOff:
      'Otomatis aktif saat server terkena limit kuota, atau dapat Anda uji coba manual untuk melihat tayangan siaran di layar chat depan.',
    maintenanceReasonPrefix: 'Penyebab limit:',
    maintenanceTurnOff: 'Matikan Siaran',
    maintenanceTurnOn: 'Uji / Aktifkan Siaran',
    maintenanceFeedbackOn: 'Siaran Pemeliharaan (Under Maintenance) sekarang tayang di layar chat depan.',
    maintenanceFeedbackOff: 'Siaran Pemeliharaan telah dimatikan.',
    maintenanceManualReason: 'Diaktifkan manual oleh Admin',
    maintenanceSimulatedError: 'Uji Coba Siaran Admin (Simulasi Limit)',
    defaultThemeTitle: 'TEMA DEFAULT AWAL WEB APP',
    defaultThemeDesc:
      'Menentukan tampilan awal (Gelap atau Terang) saat pengunjung baru pertama kali membuka Sinar Warna.',
    defaultThemeDark: 'Gelap (Default)',
    defaultThemeLight: 'Terang',
    defaultThemeSavedDark: 'Tema default awal web app diatur ke Tema Gelap.',
    defaultThemeSavedLight: 'Tema default awal web app diatur ke Tema Terang.',
  },
  errors: {
    emptyAiReply: 'Respons AI kosong atau terputus. Silakan coba kirim ulang.',
    connectAiError: 'Gagal terhubung ke asisten Sinar Warna.',
    requestFailedPrefix: 'Permintaan gagal',
    streamUnavailable: 'Aliran respons server tidak tersedia.',
    loadCloudHistoryFail: 'Gagal memuat riwayat cloud:',
    loadMessagesFail: 'Gagal memuat pesan percakapan:',
    deleteCloudFail: 'Gagal menghapus percakapan dari cloud.',
    boundaryTitle: 'Terjadi Gangguan Aplikasi',
    boundaryFallback: 'Terjadi kesalahan tak terduga.',
    boundaryDbPrefix: 'Akses database gagal',
    boundaryReload: 'Muat Ulang Halaman',
  },
};

const EN_TRANSLATIONS: AppTranslations = {
  common: {
    close: 'Close',
    cancel: 'Cancel',
    save: 'Save',
    delete: 'Delete',
    retry: 'Try Again',
    loading: 'Loading...',
    verifiedAccount: 'Verified Account',
    verifiedAdmin: 'Verified Admin',
    primaryAdmin: 'Verified Primary Admin',
    adminPlus: 'Verified Admin+',
    admin: 'Verified Admin',
    verifiedFallbackName: 'Verified',
  },
  header: {
    openSidebar: 'Open sidebar',
    openMenu: 'Open menu',
    newChat: 'New Chat',
    signIn: 'Sign In',
    switchToLight: 'Switch to light theme',
    switchToDark: 'Switch to dark theme',
    dismissNotice: 'Dismiss notice',
  },
  verificationBanner: {
    unverifiedNoticePrefix: 'Account',
    unverifiedNoticeMiddle: 'is not verified yet. Please verify your email to save chat history to the cloud (temporary chats are not saved).',
    unverifiedNoticeSuffix: '',
    resendEmail: 'Resend Email',
    sending: 'Sending...',
    checkAgain: 'Already Verified? Check Again',
    checking: 'Checking...',
    dismissAria: 'Dismiss verification banner',
    resentOk: 'Verification email has been resent. Please check your inbox or spam folder.',
    resentErr: 'Failed to resend verification email. Please try again in a moment.',
    verifiedOk: 'Email verified successfully! Cloud history is now active.',
    stillUnverified: 'Your email is not verified yet. Click the link in your email then press Check Again.',
    checkErr: 'Failed to check email verification status.',
  },
  welcome: {
    greetingPrefix: 'Hi, welcome to',
    subtitle: 'Have any questions about paint or anything else?',
  },
  sidebar: {
    closeSidebar: 'Close sidebar',
    closeMenu: 'Close menu',
    newChat: 'New Chat',
    historyCloud: 'Cloud History',
    historyUnverified: 'History (Unverified)',
    historyGuest: 'History (Guest Mode)',
    searchPlaceholder: 'Search history...',
    searchAria: 'Search conversation history',
    emptyGuest: 'Not signed in. These temporary chats are not saved to history and will disappear once you leave.',
    emptyCloud: 'No history yet. Start a conversation to save your creative ideas.',
    emptySearch: 'No matching conversations found.',
    deleteConv: 'Delete conversation',
    settings: 'Settings',
    defaultCreatorName: 'Sinar Warna Creator',
    signOut: 'Sign out',
    checkingAccount: 'Checking account...',
    signInOrRegister: 'Sign In / Register',
    connecting: 'Connecting...',
  },
  composer: {
    placeholder: 'Ask anything to Sinar Warna...',
    ariaLabel: 'Write a message to Sinar Warna',
    maxImagesError: 'Maximum 3 reference images per message.',
    unsupportedFormatError: 'Supported image formats: PNG, JPG, WEBP, or GIF.',
    maxSizeError: 'Maximum size per image is 4 MB.',
    fileReadError: 'Failed to read file',
    speechNotSupported: 'Voice dictation is not supported in this browser. Tap Live to talk directly.',
    imageBtn: 'Image',
    imageTooltip: 'Upload reference image',
    cameraBtn: 'Camera',
    cameraTooltip: 'Take photo with camera',
    micStopTooltip: 'Stop voice dictation',
    micStartTooltip: 'Voice dictation',
    micInfoTooltip: 'Voice dictation (tap for info)',
    liveBtn: 'Live',
    liveTooltip: 'Start Sinar Warna Live (Voice & Camera)',
    stopTooltip: 'Stop response',
    sendTooltip: 'Send message',
    disclaimer: 'Sinar Warna can make mistakes. Double-check important creative results.',
    speechLang: 'en-US',
  },
  messageBubble: {
    attachmentLabel: 'Image attachments:',
    retryBtn: 'Try Again',
    thinkingAria: 'Sinar Warna is composing a response',
    copy: 'Copy',
    copied: 'Copied',
    regenerate: 'Regenerate',
    moreConcise: 'More Concise',
    moreConcisePrompt: 'Summarize the answer above into a shorter, ready-to-use version.',
    newVariations: 'New Variations',
    newVariationsPrompt: 'Expand the idea above with 3 bold, detailed new creative variations.',
    adminRawErrorBadge: 'Admin Debug: Raw Error',
    webSourcesLabel: 'Verified Web Sources',
  },
  settings: {
    dialogAria: 'Sinar Warna Settings',
    title: 'Settings',
    closeAria: 'Close settings',
    tabGeneral: 'General & Display',
    tabAdmin: 'Administrator',
    themeTitle: 'Appearance & Theme',
    themeDesc: 'Choose light or dark display according to your comfort.',
    themeLight: 'Light Theme',
    themeDark: 'Dark Theme',
    langTitle: 'Language / Bahasa / 语言',
    langDesc: 'Select the language for the entire website & maintenance announcements.',
    langId: '🇮🇩 Indonesia',
    langEn: '🇬🇧 English',
    langZh: '🇨🇳 中文 (Mandarin)',
    liveTranscriptTitle: 'AI Live Speech Text Box',
    liveTranscriptDesc: 'Show or hide the live conversation transcript box when using AI Live.',
    liveTranscriptOn: 'Show Text',
    liveTranscriptOff: 'Hide Text',
    installTitle: 'Install Sinar Warna App',
    installDesc: 'Add this web app to your home screen for faster access on Android and iPhone (Safari).',
    alreadyInstalled: 'Sinar Warna App is already installed on this device.',
    processing: 'Processing...',
    androidBtn: 'Download App for Android',
    androidHintInstallable: 'Tap to install directly on Android phone',
    androidHintChrome: 'Install via Google Chrome on Android',
    androidGuideTitle: 'How to Install on Android (Chrome):',
    androidStep1: '1. Open this page in the Google Chrome browser.',
    androidStep2: '2. Tap the three dots menu icon (⋮) at the top right.',
    androidStep3: '3. Select Add to Home Screen or Install App.',
    safariBtn: 'Install Guide for Apple Safari',
    safariHint: 'How to install on iPhone, iPad, or Mac Safari',
    safariGuideTitle: 'How to Install on Apple Safari (iPhone / iPad):',
    safariStep1: '1. Make sure this site is opened in the Safari browser.',
    safariStep2Prefix: '2. Tap the',
    safariStep2Share: 'Share',
    safariStep2Suffix: 'button at the bottom bar of Safari.',
    safariStep3Prefix: '3. Scroll down, choose',
    safariStep3AddHome: 'Add to Home Screen',
    safariStep3Middle: ', then tap',
    safariStep3Add: 'Add',
  },
  auth: {
    dialogAria: 'Sign in or register Sinar Warna account',
    close: 'Close',
    welcomeTitlePrefix: 'Welcome to',
    welcomeSubtitle: 'Please sign in or create an account to start paint & color consulting.',
    modalTitlePrefix: 'Sign in to',
    modalSubtitle: 'Save your conversation history in the cloud (optional).',
    tabLogin: 'Sign In',
    tabRegister: 'Create Account',
    fullNameLabel: 'Full Name',
    fullNamePlaceholder: 'Example: John Doe',
    emailLabel: 'Email Address',
    emailPlaceholder: 'name@email.com',
    passwordLabel: 'Password',
    forgotPassword: 'Forgot password?',
    passwordPlaceholder: 'Minimum 6 characters',
    hidePassword: 'Hide password',
    showPassword: 'Show password',
    processingLogin: 'Signing in...',
    processingRegister: 'Creating account...',
    loginWithEmail: 'Sign In with Email',
    registerAccount: 'Register New Account',
    orContinueWith: 'or use email',
    connecting: 'Connecting...',
    errEnterEmail: 'Please enter your email address.',
    errPasswordLength: 'Password must be at least 6 characters.',
    errResetNeedEmail: 'Enter your email first to reset your password.',
    infoResetSent: 'A password reset link has been sent to your email. Check your inbox or spam folder.',
    infoRedirectGoogle: 'Redirecting to Google sign-in...',
    infoRedirectApple: 'Redirecting to Apple sign-in...',
  },
  camera: {
    dialogAria: 'Take photo with camera',
    title: 'Sinar Warna Camera',
    switchCamera: 'Switch front/back camera',
    closeCamera: 'Close camera',
    takePhoto: 'Take Photo',
    permissionError: 'Unable to access camera. Please allow camera permission in your browser.',
  },
  installPrompt: {
    dialogAria: 'Install Sinar Warna Web App',
    title: 'Install Sinar Warna App',
    desc: 'Install this web app on your Android or iPhone Safari home screen for faster access.',
    closeAria: 'Dismiss install app prompt',
    step1Prefix: '1. Tap the',
    step1Share: 'Share',
    step1Suffix: 'icon on the bottom Safari bar.',
    step2Prefix: '2. Choose',
    step2AddHome: 'Add to Home Screen',
    step2Middle: ', then tap',
    step2Add: 'Add',
    installing: 'Installing...',
    installWebApp: 'Install Web App',
    installSafari: 'Install on iPhone Safari',
    later: 'Maybe Later',
  },
  liveStudio: {
    dialogAria: 'Sinar Warna Live',
    title: 'Sinar Warna Live',
    selectVoiceAria: 'Select assistant voice',
    reconnect: 'Reconnect',
    tapToUnblockAudio: 'Tap here to enable microphone & audio',
    callingVoice: 'Calling',
    connectingVoice: 'Connecting to',
    listeningWith: 'Connected with {name} · Speak now...',
    owieBarkingWithText: 'Owie is barking (read text below)',
    owieBarking: 'Owie is barking',
    speakingSuffix: 'is speaking',
    paused: 'Live session paused',
    disconnected: 'Connection lost',
    micMutedHint: 'Microphone muted · Tap mic icon to speak',
    connectingCamTo: 'Connecting camera to',
    cameraFront: 'Front',
    cameraBack: 'Back',
    camLabelPrefix: 'Camera',
    speakPrompt: 'Speak now',
    closeBubble: 'Close bubble',
    distanceLabel: 'Distance:',
    trafficLabel: 'Traffic:',
    owieBarkTranslationTag: '(Bark Translation)',
    camOffTooltip: 'Turn off live camera',
    camOnTooltip: 'Turn on live camera',
    switchToFrontTooltip: 'Switch to front camera (selfie)',
    switchToBackTooltip: 'Switch to back camera',
    frontShort: 'Front',
    backShort: 'Back',
    unmuteMicTooltip: 'Unmute microphone',
    muteMicTooltip: 'Mute microphone',
    resumeLiveTooltip: 'Resume Live',
    pauseLiveTooltip: 'Pause Live',
    endCallTooltip: 'End Sinar Warna Live',
    micDeniedError: 'Microphone access denied or unavailable. Enable mic permissions and try again.',
    camDeniedError: 'Unable to access camera. Check camera permissions in your browser.',
    wsConnectError: 'Failed to connect to Gemini Live server.',
    wsDisconnectedPrefix: 'AI Live connection lost',
    wsDisconnectedSuffix: '. Press Reconnect to continue.',
    gpsUnsupportedTitle: 'Sinar Warna Location & Map',
    gpsUnsupportedDesc: 'GPS is unsupported on this device. Showing Sinar Warna location.',
    gpsTrafficOk: 'Check live traffic on Google Maps',
    webSourcesTitle: 'Live Search Results & References',
    openGoogleMaps: 'Open in Google Maps',
    endingLiveNotice: 'Ending Live session...',
    audioSpeakerLabel: 'Speaker',
    audioEarpieceLabel: 'Earpiece',
    audioRouteToEarpieceTooltip: 'Switch audio to earpiece',
    audioRouteToSpeakerTooltip: 'Switch audio to speakerphone',
  },
  admin: {
    modalAria: 'Sinar Warna Administrator Panel',
    modalTitle: 'Sinar Warna Administrator',
    modalSubBasic: 'Manage regular user accounts & AI admin memories',
    modalSubFull: 'Manage user accounts, admin levels, & AI admin memories',
    closeModalAria: 'Close administrator panel',
    maintenanceTitle: 'MAINTENANCE BROADCAST (UNDER MAINTENANCE)',
    maintenanceOn: 'LIVE NOW',
    maintenanceOff: 'INACTIVE',
    maintenanceDescOn:
      'Broadcast ticker is active on the front chat screen. Regular users see Under Maintenance, while admins still see the raw technical error.',
    maintenanceDescOff:
      'Activates automatically when server quota is reached, or toggle manually to test the broadcast ticker.',
    maintenanceReasonPrefix: 'Limit trigger:',
    maintenanceTurnOff: 'Turn Off Broadcast',
    maintenanceTurnOn: 'Test / Activate Broadcast',
    maintenanceFeedbackOn: 'Maintenance Broadcast (Under Maintenance) is now live on the front chat screen.',
    maintenanceFeedbackOff: 'Maintenance Broadcast has been turned off.',
    maintenanceManualReason: 'Manually activated by Admin',
    maintenanceSimulatedError: 'Admin Broadcast Test (Simulated Limit)',
    defaultThemeTitle: 'DEFAULT INITIAL WEB APP THEME',
    defaultThemeDesc:
      'Sets the initial appearance (Dark or Light) for new visitors opening Sinar Warna for the first time.',
    defaultThemeDark: 'Dark (Default)',
    defaultThemeLight: 'Light',
    defaultThemeSavedDark: 'Default initial web app theme set to Dark Mode.',
    defaultThemeSavedLight: 'Default initial web app theme set to Light Mode.',
  },
  errors: {
    emptyAiReply: 'Empty or interrupted AI response. Please try sending again.',
    connectAiError: 'Failed to connect to Sinar Warna assistant.',
    requestFailedPrefix: 'Request failed',
    streamUnavailable: 'Server response stream unavailable.',
    loadCloudHistoryFail: 'Failed to load cloud history:',
    loadMessagesFail: 'Failed to load conversation messages:',
    deleteCloudFail: 'Failed to delete conversation from cloud.',
    boundaryTitle: 'Application Error Occurred',
    boundaryFallback: 'An unexpected error occurred.',
    boundaryDbPrefix: 'Database access failed',
    boundaryReload: 'Reload Page',
  },
};

const ZH_TRANSLATIONS: AppTranslations = {
  common: {
    close: '关闭',
    cancel: '取消',
    save: '保存',
    delete: '删除',
    retry: '重试',
    loading: '加载中...',
    verifiedAccount: '已认证账号',
    verifiedAdmin: '已认证管理员',
    primaryAdmin: '已认证主管理员',
    adminPlus: '已认证高级管理员',
    admin: '已认证管理员',
    verifiedFallbackName: '已认证',
  },
  header: {
    openSidebar: '打开侧边栏',
    openMenu: '打开菜单',
    newChat: '新对话',
    signIn: '登录',
    switchToLight: '切换到浅色主题',
    switchToDark: '切换到深色主题',
    dismissNotice: '关闭通知',
  },
  verificationBanner: {
    unverifiedNoticePrefix: '账号',
    unverifiedNoticeMiddle: '尚未完成验证。请验证邮箱以保存云端聊天记录（临时对话不会保存到历史记录）。',
    unverifiedNoticeSuffix: '',
    resendEmail: '重新发送验证邮件',
    sending: '发送中...',
    checkAgain: '已完成验证？刷新检查',
    checking: '检查中...',
    dismissAria: '关闭验证提示条',
    resentOk: '验证邮件已重新发送，请检查您的收件箱或垃圾邮件文件夹。',
    resentErr: '重新发送验证邮件失败，请稍后重试。',
    verifiedOk: '邮箱验证成功！云端聊天记录已启用。',
    stillUnverified: '您的邮箱尚未验证。请点击邮件中的验证链接，然后再点击刷新检查。',
    checkErr: '检查邮箱验证状态失败。',
  },
  welcome: {
    greetingPrefix: '您好，欢迎来到',
    subtitle: '关于油漆或任何其他问题，随时向我咨询！',
  },
  sidebar: {
    closeSidebar: '收起侧边栏',
    closeMenu: '关闭菜单',
    newChat: '新对话',
    historyCloud: '云端记录',
    historyUnverified: '记录（未验证）',
    historyGuest: '记录（访客模式）',
    searchPlaceholder: '搜索记录...',
    searchAria: '搜索聊天记录',
    emptyGuest: '尚未登录账号。当前临时对话不会保存到记录中，离开后将会清空。',
    emptyCloud: '暂无聊天记录。开始新对话以保存您的创意灵感。',
    emptySearch: '没有找到匹配的对话。',
    deleteConv: '删除对话',
    settings: '设置',
    defaultCreatorName: 'Sinar Warna 创作者',
    signOut: '退出登录',
    checkingAccount: '正在检查账号...',
    signInOrRegister: '登录 / 注册账号',
    connecting: '连接中...',
  },
  composer: {
    placeholder: '向 Sinar Warna 询问任何问题...',
    ariaLabel: '输入发送给 Sinar Warna 的消息',
    maxImagesError: '每条消息最多只能上传 3 张参考图片。',
    unsupportedFormatError: '支持的图片格式：PNG、JPG、WEBP 或 GIF。',
    maxSizeError: '每张图片最大不能超过 4 MB。',
    fileReadError: '读取文件失败',
    speechNotSupported: '当前浏览器不支持语音听写。请点击 Live 按钮直接语音对话。',
    imageBtn: '图片',
    imageTooltip: '上传参考图片',
    cameraBtn: '相机',
    cameraTooltip: '使用相机拍照',
    micStopTooltip: '停止语音听写',
    micStartTooltip: '语音听写',
    micInfoTooltip: '语音听写（点击查看说明）',
    liveBtn: 'Live',
    liveTooltip: '开启 Sinar Warna 实时对话（语音与相机）',
    stopTooltip: '停止回答',
    sendTooltip: '发送消息',
    disclaimer: 'Sinar Warna 可能会出错，请核对重要的创意结果。',
    speechLang: 'zh-CN',
  },
  messageBubble: {
    attachmentLabel: '图片附件：',
    retryBtn: '重试',
    thinkingAria: 'Sinar Warna 正在组织回答',
    copy: '复制',
    copied: '已复制',
    regenerate: '重新生成',
    moreConcise: '更简洁',
    moreConcisePrompt: '请将上面的回答总结得更精简、直接可用。',
    newVariations: '更多创意',
    newVariationsPrompt: '基于上面的想法，提供 3 个更大胆、更详细的全新创意方案。',
    adminRawErrorBadge: '管理员调试：原始错误',
    webSourcesLabel: '实时网页参考来源',
  },
  settings: {
    dialogAria: 'Sinar Warna 设置',
    title: '设置',
    closeAria: '关闭设置',
    tabGeneral: '通用与显示',
    tabAdmin: '管理员',
    themeTitle: '外观与主题',
    themeDesc: '根据您的视觉习惯选择浅色或深色模式。',
    themeLight: '浅色主题',
    themeDark: '深色主题',
    langTitle: '语言 / Bahasa / Language',
    langDesc: '选择整个网站的显示语言及系统维护提示语言。',
    langId: '🇮🇩 Indonesia',
    langEn: '🇬🇧 English',
    langZh: '🇨🇳 中文 (Mandarin)',
    liveTranscriptTitle: 'AI 实时字幕框',
    liveTranscriptDesc: '在使用 AI Live 实时对话时显示或隐藏实时文字对话记录框。',
    liveTranscriptOn: '开启字幕',
    liveTranscriptOff: '关闭字幕',
    installTitle: '安装 Sinar Warna 应用',
    installDesc: '将网页应用添加到手机主屏幕，在 Android 或 iPhone (Safari) 上更快打开。',
    alreadyInstalled: 'Sinar Warna 应用已安装在此设备上。',
    processing: '处理中...',
    androidBtn: '下载 Android 版应用',
    androidHintInstallable: '点击直接安装到 Android 手机',
    androidHintChrome: '通过 Android 版 Google Chrome 安装',
    androidGuideTitle: 'Android 安装步骤 (Chrome)：',
    androidStep1: '1. 使用 Google Chrome 浏览器打开本页面。',
    androidStep2: '2. 点击右上角的三点菜单图标 (⋮)。',
    androidStep3: '3. 选择“添加到主屏幕”或“安装应用”。',
    safariBtn: 'Apple Safari 安装指南',
    safariHint: 'iPhone、iPad 或 Mac Safari 安装步骤',
    safariGuideTitle: 'Apple Safari 安装步骤 (iPhone / iPad)：',
    safariStep1: '1. 请确保通过 Safari 浏览器打开本网站。',
    safariStep2Prefix: '2. 点击 Safari 底部工具栏的',
    safariStep2Share: '分享 (Share)',
    safariStep2Suffix: '按钮。',
    safariStep3Prefix: '3. 向下滑动并选择',
    safariStep3AddHome: '添加到主屏幕',
    safariStep3Middle: '，然后点击',
    safariStep3Add: '添加',
  },
  auth: {
    dialogAria: '登录或注册 Sinar Warna 账号',
    close: '关闭',
    welcomeTitlePrefix: '欢迎来到',
    welcomeSubtitle: '请登录或注册账号，开始咨询油漆与色彩搭配。',
    modalTitlePrefix: '登录到',
    modalSubtitle: '将您的聊天记录保存到云端（可选）。',
    tabLogin: '登录',
    tabRegister: '注册账号',
    fullNameLabel: '全名',
    fullNamePlaceholder: '例如：张三',
    emailLabel: '邮箱地址',
    emailPlaceholder: 'name@email.com',
    passwordLabel: '密码',
    forgotPassword: '忘记密码？',
    passwordPlaceholder: '至少 6 位字符',
    hidePassword: '隐藏密码',
    showPassword: '显示密码',
    processingLogin: '正在登录...',
    processingRegister: '正在注册...',
    loginWithEmail: '使用邮箱登录',
    registerAccount: '注册新账号',
    orContinueWith: '或使用邮箱登录/注册',
    connecting: '连接中...',
    errEnterEmail: '请输入您的邮箱地址。',
    errPasswordLength: '密码至少需要 6 位字符。',
    errResetNeedEmail: '请先输入您的邮箱地址以重置密码。',
    infoResetSent: '重置密码链接已发送到您的邮箱，请查收收件箱或垃圾邮件。',
    infoRedirectGoogle: '正在跳转到 Google 登录页面...',
    infoRedirectApple: '正在跳转到 Apple 登录页面...',
  },
  camera: {
    dialogAria: '使用相机拍照',
    title: 'Sinar Warna 相机',
    switchCamera: '切换前置/后置摄像头',
    closeCamera: '关闭相机',
    takePhoto: '拍照',
    permissionError: '无法访问相机。请确认浏览器已授予相机权限。',
  },
  installPrompt: {
    dialogAria: '安装 Sinar Warna 网页应用',
    title: '安装 Sinar Warna 应用',
    desc: '将应用添加到 Android 或 iPhone Safari 主屏幕，访问更快捷。',
    closeAria: '关闭安装提示',
    step1Prefix: '1. 点击 Safari 底部栏的',
    step1Share: '分享 (Share)',
    step1Suffix: '图标。',
    step2Prefix: '2. 选择',
    step2AddHome: '添加到主屏幕',
    step2Middle: '，然后点击',
    step2Add: '添加',
    installing: '正在安装...',
    installWebApp: '安装网页应用',
    installSafari: '在 iPhone Safari 上安装',
    later: '以后再说',
  },
  liveStudio: {
    dialogAria: 'Sinar Warna 实时对话',
    title: 'Sinar Warna Live',
    selectVoiceAria: '选择助手声音',
    reconnect: '重新连接',
    tapToUnblockAudio: '点击此处开启麦克风与声音',
    callingVoice: '正在呼叫',
    connectingVoice: '正在连接',
    listeningWith: '已连接 {name} · 请开始说话...',
    owieBarkingWithText: 'Owie 正在叫（请看下方翻译文字）',
    owieBarking: 'Owie 正在叫',
    speakingSuffix: '正在说话',
    paused: '实时对话已暂停',
    disconnected: '连接已断开',
    micMutedHint: '麦克风已静音 · 点击麦克风图标继续说话',
    connectingCamTo: '正在将相机连接到',
    cameraFront: '前置',
    cameraBack: '后置',
    camLabelPrefix: '相机',
    speakPrompt: '请开始说话',
    closeBubble: '关闭浮窗',
    distanceLabel: '距离：',
    trafficLabel: '交通状况：',
    owieBarkTranslationTag: '(狗叫翻译)',
    camOffTooltip: '关闭实时相机',
    camOnTooltip: '开启实时相机',
    switchToFrontTooltip: '切换到前置摄像头（自拍）',
    switchToBackTooltip: '切换到后置摄像头',
    frontShort: '前置',
    backShort: '后置',
    unmuteMicTooltip: '开启麦克风',
    muteMicTooltip: '静音麦克风',
    resumeLiveTooltip: '继续实时对话',
    pauseLiveTooltip: '暂停实时对话',
    endCallTooltip: '结束 Sinar Warna 实时对话',
    micDeniedError: '麦克风权限被拒绝或不可用。请允许麦克风权限后重试。',
    camDeniedError: '无法访问相机。请检查浏览器相机权限。',
    wsConnectError: '无法连接到 Gemini Live 服务器。',
    wsDisconnectedPrefix: 'AI 实时连接已断开',
    wsDisconnectedSuffix: '。请点击重新连接继续。',
    gpsUnsupportedTitle: 'Sinar Warna 位置与地图',
    gpsUnsupportedDesc: '当前设备不支持 GPS。正在显示 Sinar Warna 位置。',
    gpsTrafficOk: '在 Google Maps 查看实时路况',
    webSourcesTitle: '实时搜索结果与参考资料',
    openGoogleMaps: '在 Google Maps 中打开',
    endingLiveNotice: '正在结束实时对话...',
    audioSpeakerLabel: '扬声器',
    audioEarpieceLabel: '听筒',
    audioRouteToEarpieceTooltip: '切换声音至听筒',
    audioRouteToSpeakerTooltip: '切换声音至扬声器',
  },
  admin: {
    modalAria: 'Sinar Warna 管理员面板',
    modalTitle: 'Sinar Warna 管理员',
    modalSubBasic: '管理普通用户账号与 AI 管理员记忆',
    modalSubFull: '管理用户账号、管理员等级与 AI 管理员记忆',
    closeModalAria: '关闭管理员面板',
    maintenanceTitle: '系统维护公告广播（UNDER MAINTENANCE）',
    maintenanceOn: '正在广播',
    maintenanceOff: '未启用',
    maintenanceDescOn:
      '主聊天界面正在滚动播放维护公告。所有普通用户将看到系统维护中提示，而管理员仍可查看原始技术错误详情。',
    maintenanceDescOff:
      '服务器触发限流配额时将自动开启，您也可以手动点击测试主屏滚动广播效果。',
    maintenanceReasonPrefix: '限流原因：',
    maintenanceTurnOff: '关闭广播',
    maintenanceTurnOn: '测试 / 开启广播',
    maintenanceFeedbackOn: '系统维护公告广播已开启，正在主聊天屏幕播放。',
    maintenanceFeedbackOff: '系统维护公告广播已关闭。',
    maintenanceManualReason: '由管理员手动开启',
    maintenanceSimulatedError: '管理员广播测试（模拟限流）',
    defaultThemeTitle: '网页默认初始主题',
    defaultThemeDesc: '设置新访客首次打开 Sinar Warna 时的默认外观（深色或浅色）。',
    defaultThemeDark: '深色（默认）',
    defaultThemeLight: '浅色',
    defaultThemeSavedDark: '网页默认初始主题已设置为深色模式。',
    defaultThemeSavedLight: '网页默认初始主题已设置为浅色模式。',
  },
  errors: {
    emptyAiReply: 'AI 回复为空或连接中断，请尝试重新发送。',
    connectAiError: '连接 Sinar Warna 助手失败。',
    requestFailedPrefix: '请求失败',
    streamUnavailable: '服务器响应流不可用。',
    loadCloudHistoryFail: '加载云端聊天记录失败：',
    loadMessagesFail: '加载对话消息失败：',
    deleteCloudFail: '从云端删除对话失败。',
    boundaryTitle: '应用程序发生异常',
    boundaryFallback: '发生了意外错误。',
    boundaryDbPrefix: '数据库访问失败',
    boundaryReload: '刷新页面',
  },
};

export function getTranslations(lang: AppLanguage = 'id'): AppTranslations {
  if (lang === 'en') return EN_TRANSLATIONS;
  if (lang === 'zh') return ZH_TRANSLATIONS;
  return ID_TRANSLATIONS;
}
