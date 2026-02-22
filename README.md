<div align="center">

  <img src="resources/icon.png" alt="MCLC Logo" width="128" />

  <h1><strong>MCLC</strong></h1>
  
  <p>
    <em>
      A modern Minecraft launcher, built with <b>Electron</b>, <b>React</b>, and <b>Tailwind CSS</b>.<br />
      Manage instances, skins, and modpacks with style.
    </em>
  </p>
  
  <div>
    <a href="https://github.com/MCLC-Client/MCLC-Client/actions/workflows/build-appimage.yml">
      <img src="https://img.shields.io/github/actions/workflow/status/MCLC-Client/MCLC-Client/build-appimage.yml?branch=main&label=AppImage&logo=linux&logoColor=white&style=for-the-badge" alt="AppImage Linux Build" />
    </a>
    <a href="https://github.com/MCLC-Client/MCLC-Client/actions/workflows/build-deb.yml">
      <img src="https://img.shields.io/github/actions/workflow/status/MCLC-Client/MCLC-Client/build-deb.yml?branch=main&label=DEB&logo=debian&logoColor=white&style=for-the-badge" alt="DEB Debian Build" />
    </a>
    <a href="https://github.com/MCLC-Client/MCLC-Client/actions/workflows/build-rpm.yml">
      <img src="https://img.shields.io/github/actions/workflow/status/MCLC-Client/MCLC-Client/build-rpm.yml?branch=main&label=RPM&logo=redhat&logoColor=white&style=for-the-badge" alt="RPM RedHat Build" />
    </a>
    <a href="https://github.com/MCLC-Client/MCLC-Client/actions/workflows/build-win.yml">
      <img src="https://img.shields.io/github/actions/workflow/status/MCLC-Client/MCLC-Client/build-win.yml?branch=main&label=Windows&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTAgMGgxMS40djExLjRIMHptMTIuNiAwaDExLjR2MTEuNEgxMi42ek0wIDEyLjZoMTEuNFYyNEgwem0xMi42IDBoMTEuNFYyNEgxMi42eiIgZmlsbD0id2hpdGUiLz48L3N2Zz4=&logoColor=white&style=for-the-badge" alt="Windows Build" />
    </a>
    <a href="https://github.com/MCLC-Client/MCLC-Client/actions/workflows/scan.yml">
      <img src="https://img.shields.io/github/actions/workflow/status/MCLC-Client/MCLC-Client/scan.yml?branch=main&label=VirusTotal&logo=virustotal&logoColor=white&style=for-the-badge" alt="VirusTotal Scan" />
    </a>
    <a href="https://github.com/MCLC-Client/MCLC-Client/releases">
      <img src="https://img.shields.io/github/v/release/MCLC-Client/MCLC-Client?include_prereleases&label=Release&style=for-the-badge" alt="Release" />
    </a>
  </div>

</div>

## Features

### Instance Management

- **Advanced Sorting & Grouping**: Organize your library by name, version, or playtime. Group instances by game version or loader for a cleaner look.
- **Modrinth Integration**: Import modpacks and instances directly from Modrinth.
- **One-Click Launch**: Launch Vanilla, Fabric, Forge, NeoForge, and Quilt instances.

### Skin & Cape Viewer

- **3D Previewing**: Real-time 3D rendering of your Minecraft skin and cape.
- **2D Previews**: Head and body previews with depth shading.
- **Direct Integration**: Equip default skins (Steve/Alex) or custom textures directly within the launcher.
- **Slim Support**: Full support for slim (Alex) arm models.

### Reliability & Performance

- **Connection Handling**: IPv4 priority and extended timeouts (30s) to fix common `ETIMEDOUT` errors with Mojang APIs.
- **Session Management**: Frequent session verification with profile caching to prevent "429 Too Many Requests" errors.
- **Auto-Logout**: Secure session handling that automatically returns you to the login screen on authentication failure.

---

## Getting Started

### For Users

1. Download the latest `.exe` installer from the [Releases](https://github.com/MCLC-Client/MCLC-Client/releases) page.
2. Run the installer and follow the on-screen instructions.
3. Launch **MCLC** from your desktop or start menu.

### For Developers

#### Prerequisites

- [Node.js](https://nodejs.org/) (Latest LTS recommended)
- npm or yarn

#### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/MCLC-Client/MCLC-Client.git
   cd MCLC-Client
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Run in development mode**

   ```bash
   npm run dev
   ```

4. **Build for production**

   ```bash
   npm run dist
   ```

---

## Tech Stack

- **Core**: [Electron](https://www.electronjs.org/)
- **Frontend**: [React](https://reactjs.org/) + [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Minecraft Core**: [minecraft-launcher-core](https://github.com/Pierce01/Minecraft-Launcher-Core)
- **3D Rendering**: [skinview3d](https://github.com/bs-community/skinview3d)
- **State Management**: React Hooks & Context API

---

## Screenshots

> Coming soon!

---

## License & Credits

- Developed by **Fernsehheft, Mobilestars, ItzzMateo**
- Icons by [Heroicons](https://heroicons.com/)
