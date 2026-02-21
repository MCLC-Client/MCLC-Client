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
- Script support (extensions in work, are similar)
- Log analysis utility
- Cloud synchronization for worlds and configurations (e.g., Google Drive, Dropbox, OneDrive)
- Mod dependency validation (partially implemented)
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

- [ ] Script support (Partially implemented through Extensions)
- [ ] Logging analysis utility
- [ ] Cloud synchronization for worlds and configurations (e.g., Google Drive, Dropbox, OneDrive)
- [ ] Mod dependency validation
- [ ] Mobile application for the administration panel
- [ ] Cross-Platform UI Polishing: Mac-specific window controls + Linux system tray integration
- [ ] Automated Backups: Scheduled backups for worlds/instances
- [ ] Localization (i18n): Full multi-language support system

#### Optional (Planned for Future)

- [ ] Command line support

> Everything below is now correct and reflects actual released versions.

---

## [1.5.0] - 2026-02-21

### Added
- **Unified Backup Manager**: A powerful new interface for managing world backups and restorations.
  - Choose between Local Storage and Cloud Storage (Google Drive, Dropbox).
  - Multi-world selection for batch backup operations.
  - Search and filter functionality for worlds and existing backups.
  - Automatic download and restoration flow for cloud backups.
- **UI/UX Enhancement**: Integrated `@heroicons/react` for a more professional and modern look across the Backup Manager.
- **Cloud Stability**:
  - Automatic token refresh/retry logic for all cloud operations (Upload, Download, List, Folder Management).
  - **Automatic Re-authentication**: Seamlessly triggers the login flow if a session expires and cannot be refreshed.
- **Standardized Storage**: Local backups are now stored in a centralized directory at `AppData/Roaming/MCLC/backups/<instanceName>`.

### Fixed
- **World Restoration Structure**: World backups now properly preserve their folder names, ensuring they extract correctly into the `saves` directory.
- **ReferenceError fix**: Removed legacy cloud code from `InstanceDetails.jsx` that caused component crashes.
- **Cloud Cleanup Race Condition**: Moved file cleanup to the backend to ensure local zips are only deleted *after* successful cloud uploads.
- **Dropbox Authentication**: Fixed "Invalid redirect_uri" error by correctly encoding the authentication URL.
- **401 Unauthorized errors**: Implemented missing token refresh retry logic in cloud folder management.

---

## [1.4.0] - 2026-02-16

### Added

- Instance configuration sharing
- Focus mode
- Server-side mod validation
- Mod compatibility overview
- Minimal mode (system tray integration, configurable in settings)
- Quick server join (partially implemented)
- Client-side quick join mod
- Script support (extensions in work, are similar)
- Log analysis utility
- Cloud synchronization for worlds and configurations (e.g., Google Drive, Dropbox, OneDrive)
- Mod dependency validation (partially implemented)
- Mobile application for the administration panel

- **Styling Page Redesign**: Complete visual overhaul with premium bento grid layout
  - Live mini-preview component showing real-time theme changes
  - Visual theme cards with color thumbnails instead of text lists
  - Custom `ColorPicker` component with glow effects
  - Enhanced `SliderControl` component with gradient tracks and value badges
  - Improved organization with distinct sections for Colors, Effects, and Atmosphere
  - Glassmorphism effects and smooth transitions matching launcher aesthetic
- **UI Components**:
  - `ThemeCard.jsx` - Visual theme preview cards with hover animations
  - `MiniPreview.jsx` - Live miniature launcher preview
  - `ColorPicker.jsx` - Enhanced color input with glow effect
  - `SliderControl.jsx` - Gradient slider with real-time value display
- **CSS Enhancements**:
  - Custom slider thumb styling with glow effects
  - Color picker styling for better visual consistency
  - Custom scrollbar styling for theme lists
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
  - Added "Show Disabled Features" setting to toggle visibility of disabled sidebar items (grayed out vs hidden).
- **Splash Screen**: Implemented `ready-to-show` window transition in Electron to eliminate initial white flashes.

### Fixed

- The runtime wasn't working and displaying "object Object" when closing the window when selecting runtime ("javaw.exe")
- Background overlay intensity now correctly applies to the actual app (was only updating preview)
- Settings button in sidebar now uses glow effect instead of white outline
- Dropdown arrow in Settings page properly positioned with adequate spacing
- Synchronous I/O bottlenecks in the backend causing UI freezes during launch.
- Duplicate imports and build-time SyntaxErrors.
- Visual alignment of toggles and scrolling performance in the dashboard.

---

## [1.3.3 and earlier] - 2026-02-14

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
