# Changelog

All notable changes to this project are documented in this file.

This project follows the guidelines of [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and adheres to [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Added
- Instance configuration sharing
- Focus mode
- Server-side mod validation
- Mod compatibility overview
- Minimal mode (system tray integration, configurable in settings)
- Quick server join (partially implemented)
- Client-side quick join mod
- Script support
- Log analysis utility
- Cloud synchronization for worlds and configurations (e.g., Google Drive, Dropbox, OneDrive)
- Mod dependency validation
- Mobile application for the administration panel

### To Do
#### Features in Progress
- [ ] System for sharing instance configurations
- [ ] Focus mode
- [ ] Server-side mod validation
- [ ] Mod compatibility overview
- [ ] Minimal mode (system tray integration, configurable in settings)
- [ ] Quick server join (partially implemented)
- [ ] Client-side quick join mod

#### Possible Future Features
- [ ] Script support
- [ ] Log analysis utility
- [ ] Cloud synchronization for worlds and configurations (e.g., Google Drive, Dropbox, OneDrive)
- [ ] Mod dependency validation
- [ ] Mobile application for the administration panel

#### Optional (Planned for Future)
- [ ] Command line support


---

## [1.4.0] - 2026-02-15

### Added
- **Global Extension System**: Full support for `.mcextension` packages with UI injection (Slots) in Sidebar and other areas.
- **Extension Marketplace**: Integrated browser for discovering and installing third-party extensions.
- **Performance Overhaul**:
  - Asynchronous Java presence checks and backend file operations (FS-extra async).
  - Page-level code-splitting using `React.lazy` and `Suspense` for faster initial loads.
  - Concurrent UI rendering with `useTransition` for smooth view switching.
  - List and Grid virtualization (`react-window`) for 60fps scrolling in large libraries and news feeds.
  - High-performance image lazy loading using the **Intersection Observer API**.
  - GPU-accelerated CSS transitions using `will-change` properties.
- **UI Refinement**:
  - New `ToggleBox` component for high-performance, consistent switches project-wide.
  - Integrated "Show Snapshots" toggle in Instance Settings.
- **Splash Screen**: Implemented `ready-to-show` window transition in Electron to eliminate initial white flashes.

### Fixed
- Synchronous I/O bottlenecks in the backend causing UI freezes during launch.
- Duplicate imports and build-time SyntaxErrors.
- Visual alignment of toggles and scrolling performance in the dashboard.

---

## [1.3.3 and earlier] - 2026-02-15

### Added
- Skin and Cape editor (Skin- und Cape-Editor)
- Group instances (Gruppeninstanzen)
- News system (Nachrichtensystem)
- Instance management system (Instanzsystem)
- Multi-version and multi-software support (Unterstützung mehrerer Versionen und Softwarearten)
- Custom themes and backgrounds (Benutzerdefiniertes Design und eigene Hintergründe)
- Automatic updater (Automatischer Aktualisierer)
- Modrinth integration (Modrinth-Unterstützung)
- Custom launch arguments (Benutzerdefinierte Startparameter)
- Built-in Java installer (Eigener Java-Installer)
- Discord Rich Presence integration (Discord-Statusanzeige)
- MCLogs integration (MCLOGS-Unterstützung)
- Transfer keybindings between instances (Tasteneinstellungen auf andere Instanzen übertragen)
- Multi-account management (Mehrere Benutzerkonten verwalten)
- Modrinth instance support (Unterstützung für Modrinth-Instanzen)
- Development build support (Unterstützung für Entwicklerversionen)
- Shader section with Modrinth integration — automatic installation of Iris and Sodium (Shader-Bereich mit Modrinth-Anbindung)
- Automatic Fabric API installation when creating a Fabric instance (Automatische Installation der Fabric-API bei Erstellung einer Fabric-Instanz)
- Support for Modrinth modpacks (Unterstützung für Modpakete von Modrinth)
- Software version and usage analytics in the admin panel (Analysefunktionen für Software-Versionen und Nutzungsdaten im Administrationsbereich)
- Automatic Java download (Automatischer Java-Download)
- Shader preview (Shader-Vorschau)
- Added home section (Startseiten-Bereich hinzugefügt)
- Server system — create and manage servers (Serversystem (Server erstellen und verwalten))

