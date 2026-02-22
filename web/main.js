const navbar = document.getElementById('navbar');
function handleScroll() {
    if (window.scrollY > 20) {
        navbar?.classList.add('scrolled');
    } else {
        navbar?.classList.remove('scrolled');
    }
}
window.addEventListener('scroll', handleScroll);
handleScroll(); // Initial check
window.fixPath = (p) => p ? (p.startsWith('http') ? p : `/uploads/${p.replace(/^\/?uploads\//, '')}`) : 'resources/icon.png';
const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('active');
        }
    });
}, {
    threshold: 0.1
});

const revealElements = document.querySelectorAll('.reveal');
revealElements.forEach(el => {
    revealObserver.observe(el);
});
const hero = document.getElementById('home');
if (hero) {
    hero.addEventListener('mousemove', (e) => {
        const moveX = (e.clientX - window.innerWidth / 2) * 0.01;
        const moveY = (e.clientY - window.innerHeight / 2) * 0.01;
        const reveal = hero.querySelector('.reveal');
        if (reveal) reveal.style.transform = `translate(${moveX}px, ${moveY}px)`;
    });
}
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
});

async function checkAuth() {
    console.log('[MCLC] Checking auth status...');
    const currentPath = encodeURIComponent(window.location.pathname + window.location.search);
    const loginUrl = `/auth/google?returnTo=${currentPath}`;
    const logoutUrl = `/auth/logout?returnTo=${currentPath}`;

    let data = { loggedIn: false };
    try {
        const res = await fetch('/api/user');
        if (res.ok) {
            data = await res.json();
        }
    } catch (err) {
        console.error('[MCLC] Auth check failed:', err);

    }

    try {
        const rightGroup = document.getElementById('nav-right-group');
        const downloadBtn = document.getElementById('downloadNavBtn');
        const mobileMenu = document.getElementById('mobile-menu');

        if (!rightGroup) return;
        let authSection = document.getElementById('nav-auth-section');
        if (authSection) authSection.remove();

        authSection = document.createElement('div');
        authSection.id = 'nav-auth-section';
        authSection.className = 'hidden md:flex items-center gap-4';

        if (data.loggedIn) {
            authSection.innerHTML = `
                <div class="flex items-center gap-3 pl-4 border-l border-white/10">
                    <a href="dashboard.html" class="flex items-center gap-3 hover:opacity-80 transition-opacity">
                        <img src="${fixPath(data.user.avatar)}" alt="${data.user.username}" class="w-8 h-8 rounded-full border border-white/10 overflow-hidden object-cover">
                        <div class="hidden lg:block text-right leading-tight">
                            <div class="text-[10px] text-gray-400 uppercase font-black tracking-widest">Signed in</div>
                            <div class="text-sm font-bold text-white">${data.user.username}</div>
                        </div>
                    </a>
                    <a href="${logoutUrl}" class="text-gray-500 hover:text-white transition-colors" title="Logout">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
                    </a>
                </div>
            `;
        } else {
            authSection.innerHTML = `
                <a href="${loginUrl}" class="text-white hover:text-primary transition-all font-bold text-sm tracking-wide">
                    Sign In
                </a>
            `;
        }
        if (downloadBtn) {

            const wrapper = downloadBtn.closest('.hidden.md\\:block') || downloadBtn;
            rightGroup.appendChild(wrapper);
            rightGroup.appendChild(authSection);
        } else {
            rightGroup.appendChild(authSection);
        }
        if (mobileMenu) {
            const mobileAuthDiv = mobileMenu.querySelector('.px-6') || mobileMenu;
            let mobileAuthSection = document.getElementById('mobile-auth-section');
            if (mobileAuthSection) mobileAuthSection.remove();

            mobileAuthSection = document.createElement('div');
            mobileAuthSection.id = 'mobile-auth-section';
            mobileAuthSection.className = 'w-full pt-4 mt-2 border-t border-white/10';

            if (data.loggedIn) {
                mobileAuthSection.innerHTML = `
                    <div class="flex items-center justify-center gap-4 mb-4">
                        <img src="${fixPath(data.user.avatar)}" class="w-14 h-14 rounded-full border-2 border-primary/20 object-cover">
                        <div class="text-left">
                            <div class="text-white font-bold">${data.user.username}</div>
                            <div class="text-gray-500 text-xs font-mono">${data.user.role.toUpperCase()}</div>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                        <a href="dashboard.html" class="bg-white/5 text-white py-3 rounded-lg text-xs font-bold text-center">Dashboard</a>
                        <a href="${logoutUrl}" class="bg-red-500/10 text-red-500 py-3 rounded-lg text-xs font-bold text-center">Logout</a>
                    </div>
                `;
            } else {
                mobileAuthSection.innerHTML = `
                    <a href="${loginUrl}" class="flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10 text-white py-4 rounded-xl font-bold transition-all border border-white/10">
                        Sign In with Google
                    </a>
                `;
            }

            const mobileDownload = document.getElementById('downloadNavBtnMobile');
            if (mobileDownload) mobileDownload.after(mobileAuthSection);
            else mobileAuthDiv.appendChild(mobileAuthSection);
        }

    } catch (e) {
        console.error('[MCLC] Failed to render auth UI:', e);
    }
}
function toggleMenu() {
    const menu = document.getElementById('mobile-menu');
    const btn = document.getElementById('mobile-menu-btn');
    if (menu) {
        menu.classList.toggle('open');
    }
}
document.addEventListener('DOMContentLoaded', () => {
    const mobileBtn = document.getElementById('mobile-menu-btn');
    if (mobileBtn) {
        mobileBtn.addEventListener('click', toggleMenu);
    }
});