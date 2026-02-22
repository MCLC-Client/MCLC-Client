export const activate = (api) => {

    const assetUrl = (relativePath) => {
        const base = api.meta.localPath.replace(/\\/g, '/');
        return `app-media:///${base}/${relativePath}`;
    };

    const DEFAULT_ICONS = [
        { name: 'Sword', file: 'assets/icons/sword.png' },
        { name: 'Pickaxe', file: 'assets/icons/pickaxe.png' },
        { name: 'Axe', file: 'assets/icons/axe.png' },
        { name: 'Creeper', file: 'assets/icons/creeper.png' },
        { name: 'Diamond', file: 'assets/icons/diamond.png' },
        { name: 'Heart', file: 'assets/icons/heart.png' },
        { name: 'Compass', file: 'assets/icons/compass.png' },
        { name: 'Redstone', file: 'assets/icons/redstone.png' },
    ];

    const setIconInModal = (iconData) => {
        const h2Elements = Array.from(document.querySelectorAll('h2'));
        const modal = h2Elements.find(el => el.textContent === 'Create New Instance');
        if (!modal) return;

        // Find the input element near the modal
        const container = modal.nextElementSibling;
        const fileInput = container.querySelector('input[type="file"]');
        if (!fileInput) return;

        if (!iconData) {
            return;
        }

        fetch(iconData)
            .then(res => res.blob())
            .then(blob => {
                const file = new window.File([blob], "icon.png", { type: blob.type });
                const dataTransfer = new window.DataTransfer();
                dataTransfer.items.add(file);
                fileInput.files = dataTransfer.files;

                // Dispatch change event to trigger the React onChange
                const event = new window.Event('change', { bubbles: true });
                fileInput.dispatchEvent(event);

                api.ui.toast(`Sample icon applied to new template`, 'success');
            })
            .catch(console.error);
    };

    const CreateModalIconPicker = () => {
        const [isOpen, setIsOpen] = React.useState(false);

        const handleSelectIcon = (icon) => {
            setIconInModal(icon);
            setIsOpen(false);
        };

        const handleUpload = () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new window.FileReader();
                    reader.onloadend = () => {
                        handleSelectIcon(reader.result);
                    };
                    reader.readAsDataURL(file);
                }
            };
            input.click();
        };

        return (
            <div style={{ position: 'relative', zIndex: 50 }}>
                <style>{`
                    .ip-dropdown {
                        position: absolute;
                        top: 100%;
                        left: 50%;
                        transform: translateX(-50%);
                        margin-top: 0.5rem;
                        padding: 1.25rem;
                        background-color: var(--surface-color, #1c1c1c);
                        border: 1px solid rgba(255, 255, 255, 0.1);
                        border-radius: 1rem;
                        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                        z-index: 50;
                        width: 18rem;
                        cursor: default;
                        border-bottom: 1px solid rgba(var(--primary-color-rgb, 27, 217, 106), 0.3);
                        animation: fade-in 0.2s ease-out;
                    }
                    @keyframes fade-in {
                        from { opacity: 0; transform: translate(-50%, -10px); }
                        to { opacity: 1; transform: translate(-50%, 0); }
                    }
                    .ip-grid {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 0.5rem;
                        margin-bottom: 1.25rem;
                    }
                    .ip-item {
                        width: 3rem;
                        height: 3rem;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        background-color: rgba(255, 255, 255, 0.05);
                        border-radius: 0.75rem;
                        border: 1px solid rgba(255, 255, 255, 0.05);
                        transition: all 0.2s;
                        cursor: pointer;
                    }
                    .ip-item:hover {
                        background-color: rgba(var(--primary-color-rgb, 27, 217, 106), 0.2);
                        transform: scale(1.1);
                    }
                    .ip-item img {
                        width: 2rem;
                        height: 2rem;
                        opacity: 0.8;
                        transition: opacity 0.2s;
                    }
                    .ip-item:hover img {
                        opacity: 1;
                    }
                    .ip-btn {
                        width: 100%;
                        padding: 0.625rem 0;
                        background-color: rgba(255, 255, 255, 0.05);
                        color: #d1d5db;
                        font-weight: bold;
                        border-radius: 0.75rem;
                        border: 1px solid rgba(255, 255, 255, 0.05);
                        transition: all 0.2s;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 0.5rem;
                        font-size: 0.875rem;
                        cursor: pointer;
                    }
                    .ip-btn:hover {
                        background-color: rgba(255, 255, 255, 0.1);
                        color: #ffffff;
                    }
                    .ip-trigger {
                        padding: 0.5rem;
                        background-color: var(--primary-color, #1bd96a);
                        color: black;
                        border-radius: 0.75rem;
                        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
                        transition: transform 0.2s;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        border: none;
                        cursor: pointer;
                    }
                    .ip-trigger:hover {
                        transform: scale(1.1);
                    }
                `}</style>
                <button
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsOpen(!isOpen);
                    }}
                    type="button"
                    className="ip-trigger"
                    title="Pick Icon"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" style={{ width: '1rem', height: '1rem' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                </button>
                {isOpen && (
                    <>
                        <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsOpen(false);
                        }}></div>
                        <div
                            className="ip-dropdown"
                            onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                            }}
                        >
                            <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem', padding: '0 0.25rem' }}>Default Icons</div>
                            <div className="ip-grid">
                                {DEFAULT_ICONS.map(icon => (
                                    <button
                                        key={icon.name}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleSelectIcon(assetUrl(icon.file));
                                        }}
                                        type="button"
                                        className="ip-item"
                                        title={icon.name}
                                    >
                                        <img src={assetUrl(icon.file)} alt={icon.name} />
                                    </button>
                                ))}
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleUpload();
                                    }}
                                    type="button"
                                    className="ip-btn"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" style={{ width: '1rem', height: '1rem' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                    </svg>
                                    <span>Upload Custom</span>
                                </button>
                            </div>

                            <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '9px', color: '#4b5563', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '-0.05em' }}>
                                Changes apply immediately
                            </div>
                        </div>
                    </>
                )}
            </div>
        );
    };

    const GlobalOverlay = () => {
        React.useEffect(() => {
            let currentRoot = null;
            let currentTarget = null;

            const observer = new window.MutationObserver(() => {
                const h2Elements = Array.from(document.querySelectorAll('h2'));
                const modal = h2Elements.find(el => el.textContent === 'Create New Instance');

                if (modal) {
                    const formContainer = modal.nextElementSibling;
                    if (formContainer && formContainer.tagName === 'FORM') {
                        const iconContainer = formContainer.querySelector('div.flex.flex-col.items-center.gap-4');
                        if (iconContainer) {
                            const imageBox = iconContainer.querySelector('div.group.relative.flex.h-24.w-24');
                            if (imageBox && !iconContainer.querySelector('#icon-picker-injected')) {
                                iconContainer.style.position = 'relative';

                                const injectTarget = document.createElement('div');
                                injectTarget.id = 'icon-picker-injected';
                                injectTarget.className = 'absolute z-[60]';
                                injectTarget.style.left = 'calc(50% + 60px)';
                                injectTarget.style.top = '30px';

                                iconContainer.appendChild(injectTarget);

                                currentTarget = injectTarget;
                                currentRoot = window.ReactDOM.createRoot(injectTarget);
                                currentRoot.render(window.React.createElement(CreateModalIconPicker));
                            }
                        }
                    }
                } else {
                    if (currentTarget) {
                        try {
                            if (currentRoot) currentRoot.unmount();
                        } catch (e) { }
                        currentTarget = null;
                        currentRoot = null;
                    }
                }
            });

            observer.observe(document.body, { childList: true, subtree: true });
            return () => {
                observer.disconnect();
                if (currentRoot) {
                    try {
                        currentRoot.unmount();
                    } catch (e) { }
                }
            };
        }, []);

        return null;
    };

    api.ui.registerView('app.overlay', GlobalOverlay);
};

