import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

const AgreementModal = ({ onAccept, onDecline }) => {
    const { t } = useTranslation();
    const [isChecked, setIsChecked] = useState(false);

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-xl p-6">
            <div className="max-w-xl w-full bg-[#161b22] border border-white/10 rounded-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300">
                <div className="p-8">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-black text-white">{t('agreement.title')}</h1>
                    </div>

                    <p className="text-gray-400 leading-relaxed mb-8">
                        {t('agreement.desc')}
                    </p>

                    <div className="space-y-4 mb-8">
                        <div className="flex items-start gap-3 p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
                            <input
                                id="agree-checkbox"
                                type="checkbox"
                                className="mt-1 w-5 h-5 rounded border-white/10 bg-surface text-primary focus:ring-primary/50 cursor-pointer"
                                checked={isChecked}
                                onChange={(e) => setIsChecked(e.target.checked)}
                            />
                            <label htmlFor="agree-checkbox" className="text-sm text-gray-300 cursor-pointer leading-snug">
                                {t('agreement.checkbox')}
                            </label>
                        </div>

                        <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs font-bold uppercase tracking-widest text-primary">
                            <a href={t('agreement.tos_url')} target="_blank" rel="noreferrer" className="hover:underline">
                                {t('agreement.tos')}
                            </a>
                            <span className="text-gray-600">{t('agreement.and')}</span>
                            <a href={t('agreement.privacy_url')} target="_blank" rel="noreferrer" className="hover:underline">
                                {t('agreement.privacy')}
                            </a>
                            <span className="text-gray-600">•</span>
                            <a href={t('agreement.opt_out_url')} target="_blank" rel="noreferrer" className="hover:underline">
                                {t('agreement.opt_out')}
                            </a>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3">
                        <button
                            disabled={!isChecked}
                            onClick={onAccept}
                            className={`w-full py-4 rounded-2xl font-black text-lg transition-all transform active:scale-95 shadow-lg ${isChecked
                                ? 'bg-primary text-black hover:scale-[1.02] shadow-primary/20'
                                : 'bg-gray-800 text-gray-500 cursor-not-allowed grayscale'
                                }`}
                        >
                            {t('agreement.start')}
                        </button>
                        <button
                            onClick={onDecline}
                            className="w-full py-3 text-gray-500 font-bold hover:text-red-500 transition-colors"
                        >
                            {t('agreement.decline')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AgreementModal;
