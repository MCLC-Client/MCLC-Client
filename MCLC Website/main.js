// Navbar Scroll Effect
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});

// Reveal Animations on Scroll
const revealElements = document.querySelectorAll('.reveal');
const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('active');
        }
    });
}, {
    threshold: 0.1
});

revealElements.forEach(el => {
    revealObserver.observe(el);
});

// Parallax/Hover Effect for Hero (Subtle)
const hero = document.getElementById('home');
if (hero) {
    hero.addEventListener('mousemove', (e) => {
        const moveX = (e.clientX - window.innerWidth / 2) * 0.01;
        const moveY = (e.clientY - window.innerHeight / 2) * 0.01;
        const reveal = hero.querySelector('.reveal');
        if (reveal) reveal.style.transform = `translate(${moveX}px, ${moveY}px)`;
    });
}

// Auth Check & Dynamic Nav
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
});

async function checkAuth() {
    console.log('[MCLC] Checking auth status...');
    try {
        const res = await fetch('/api/user');
        if (!res.ok) throw new Error(`Auth API returned ${res.status}`);

        const data = await res.json();
        console.log('[MCLC] Auth status received:', data);

        const navContainer = document.querySelector('#navbar .max-w-7xl');
        if (!navContainer) {
            console.error('[MCLC] Navbar container not found! Check your HTML structure.');
            return;
        }

        // Remove existing auth section if any
        const existingAuth = document.getElementById('auth-section');
        if (existingAuth) existingAuth.remove();

        // Create a right-aligned container for Download + Auth
        let rightContainer = document.getElementById('nav-right-container');
        if (!rightContainer) {
            rightContainer = document.createElement('div');
            rightContainer.id = 'nav-right-container';
            rightContainer.className = 'flex items-center gap-4 md:gap-6 ml-auto';
            navContainer.appendChild(rightContainer);
        }

        // Handle Download Button (Move it into the right container if it's not there)
        const downloadBtn = document.getElementById('downloadNavBtn');
        if (downloadBtn && downloadBtn.parentElement !== rightContainer) {
            rightContainer.appendChild(downloadBtn);
        }

        const authDiv = document.createElement('div');
        authDiv.id = 'auth-section';
        authDiv.className = 'flex items-center gap-4 md:gap-6';

        if (data && data.loggedIn) {
            console.log('[MCLC] User is logged in as:', data.user.username);

            authDiv.innerHTML = `
                <div class="flex items-center gap-3 pl-4 border-l border-white/10">
                    <a href="dashboard.html" class="flex items-center gap-3 hover:opacity-80 transition-opacity">
                        <img src="${data.user.avatar}" alt="${data.user.username}" class="w-8 h-8 rounded-full border border-white/10">
                        <div class="hidden sm:block text-right leading-tight">
                            <div class="text-[10px] text-gray-400 uppercase font-black tracking-widest">Signed in</div>
                            <div class="text-sm font-bold text-white">${data.user.username}</div>
                        </div>
                    </a>
                    <a href="/auth/logout" class="text-gray-500 hover:text-white transition-colors" title="Logout">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
                    </a>
                </div>
            `;
        } else {
            console.log('[MCLC] User is not logged in. Showing Sign In button.');
            authDiv.innerHTML = `
                <a href="/auth/google" class="flex items-center gap-2 bg-white text-black px-4 py-2 rounded-xl font-bold hover:bg-gray-200 transition-all text-sm shrink-0">
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.11c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.6z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                    Sign In
                </a>
            `;
        }

        rightContainer.appendChild(authDiv);

    } catch (err) {
        console.error('[MCLC] Auth check failed:', err);
        // Fallback: show login button if we can't determine status
        const navContainer = document.querySelector('#navbar .max-w-7xl');
        if (navContainer && !document.getElementById('auth-section')) {
            const authDiv = document.createElement('div');
            authDiv.id = 'auth-section';
            authDiv.className = 'ml-auto';
            authDiv.innerHTML = `<a href="/auth/google" class="flex items-center gap-2 bg-white text-black px-4 py-2 rounded-xl font-bold hover:bg-gray-200 transition-all text-sm">Sign In</a>`;
            const downloadBtn = document.getElementById('downloadNavBtn');
            if (downloadBtn) navContainer.insertBefore(authDiv, downloadBtn);
            else navContainer.appendChild(authDiv);
        }
    }
}
