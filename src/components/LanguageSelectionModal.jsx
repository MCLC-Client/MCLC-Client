import React from 'react';
import { useTranslation } from 'react-i18next';

const languages = [
    { code: 'en_us', name: 'English (US)', flag: '🇺🇸' },
    { code: 'en_uk', name: 'English (UK)', flag: '🇬🇧' },
    { code: 'de_de', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'de_ch', name: 'Deutsch (CH)', flag: '🇨🇭' },
    { code: 'fr_fr', name: 'Français', flag: '🇫🇷' },
    { code: 'es_es', name: 'Español', flag: '🇪🇸' },
    { code: 'it_it', name: 'Italiano', flag: '🇮🇹' },
    { code: 'pl_pl', name: 'Polski', flag: '🇵🇱' },
    { code: 'pt_br', name: 'Português (BR)', flag: '🇧🇷' },
    { code: 'pt_pt', name: 'Português (PT)', flag: '🇵🇹' },
    { code: 'ru_ru', name: 'Русский', flag: '🇷🇺' },
    { code: 'sv_se', name: 'Svenska', flag: '🇸🇪' },
    { code: 'sk_sk', name: 'Slovenčina', flag: '🇸🇰' },
    { code: 'sl_si', name: 'Slovenščina', flag: '🇸🇮' },
    { code: 'ro_ro', name: 'Română', flag: '🇷🇴' }
];

export default function LanguageSelectionModal({ onSelect }) {
    const { i18n } = useTranslation();

    const handleSelect = (code) => {
        i18n.changeLanguage(code);
        onSelect(code);
    };

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-xl animate-in fade-in duration-500">
            <div className="w-full max-w-2xl bg-surface/40 p-8 rounded-[2.5rem] border border-white/10 shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-500">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-black mb-3 bg-gradient-to-br from-white to-white/40 bg-clip-text text-transparent tracking-tight">
                        Choose Your Language
                    </h1>
                    <p className="text-gray-400 font-medium">Select your preferred language to continue setup.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto px-2 custom-scrollbar pr-4">
                    {languages.map((lang) => (
                        <button
                            key={lang.code}
                            onClick={() => handleSelect(lang.code)}
                            className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-primary/20 hover:border-primary/40 hover:scale-[1.02] transition-all duration-300 group text-left"
                        >
                            <span className="text-3xl grayscale group-hover:grayscale-0 transition-all duration-500">{lang.flag}</span>
                            <span className="text-lg font-bold text-gray-200 group-hover:text-white group-hover:translate-x-1 transition-all">
                                {lang.name}
                            </span>
                        </button>
                    ))}
                </div>

                <div className="mt-8 flex flex-col items-center gap-4">
                    <div className="text-xs text-gray-500 font-medium uppercase tracking-widest">
                        MCLC Launcher • Setup Phase 1/2
                    </div>
                    <button
                        onClick={() => handleSelect(i18n.language)}
                        className="text-gray-400 hover:text-white transition-colors text-sm font-semibold hover:underline decoration-primary underline-offset-4"
                    >
                        Skip Selection (Default: English)
                    </button>
                </div>
            </div>
        </div>
    );
}
