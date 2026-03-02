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
    const { t, i18n } = useTranslation();

    const handleSelect = (code) => {
        i18n.changeLanguage(code);
        onSelect(code);
    };

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 backdrop-blur-xl p-6">
            <div className="max-w-2xl w-full bg-[#161b22] border border-white/10 rounded-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300">
                <div className="p-8">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-black text-white">{t('setup.chooseLanguage')}</h1>
                    </div>

                    <p className="text-gray-400 leading-relaxed mb-8">{t('setup.chooseLanguageDesc')}</p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[40vh] overflow-y-auto custom-scrollbar pr-2">
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

                    <div className="flex flex-col gap-3 mt-8">
                        <button
                            onClick={() => handleSelect(i18n.language)}
                            className="w-full py-3 text-gray-500 font-bold hover:text-white transition-colors"
                        >
                            {t('setup.skipSelection')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}