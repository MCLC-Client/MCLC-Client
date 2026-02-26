# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Server-side mod validation
- Mod compatibility overview
- Quick server join (partially implemented)
- Client-side quick join mod
- Script support (partially implemented via extensions)
- Log analysis utility
- Mod dependency validation (partially implemented)
- Mobile application for the administration panel
- Linux installer (Windows installer is the default)
- Server creation support for BungeeCord/Velocity

### In Progress
- Server-side mod validation
- Mod compatibility overview
- Quick server join (partially implemented)
- Client-side quick join mod

### Planned
- Script support (partially implemented via extensions)
- Log analysis utility
- Mobile application for the administration panel
- Cross-platform UI polishing: Mac-specific window controls and Linux system tray integration
- Command-line support

---

## [1.6.4] - 2026-02-22

### Added
- Focus mode
- Minimal mode

---

## [1.6.2] - 2026-02-21

### Added
- Localization (i18n): Full multi-language support system

---

## [1.5.2] - 2026-02-21

### Added
- Mod dependency validation
- Automated backups: Scheduled backups for worlds/instances

---

## [1.5.0] - 2026-02-21

### Added
- Unified Backup Manager: Manage world backups and restorations.
  - Choose between Local Storage and Cloud Storage (Google Drive, Dropbox).
  - Multi-world selection for batch backup operations.
  - Search and filter for worlds and backups.
  - Automatic download and restoration for cloud backups.
- UI/UX Enhancement: Integrated `@heroicons/react` for modernized UI in Backup Manager.
- Cloud stability improvements:
  - Automatic token refresh/retry logic for all cloud operations (upload, download, list, folder management).
  - Automatic re-authentication if a session expires and cannot be refreshed.
- Standardized storage: Local backups stored in `AppData/Roaming/MCLC/backups/<instanceName>`.

### Fixed
- World Restoration Structure: World backups now preserve folder names and restore correctly to the `saves` directory.
- Removed legacy cloud code from `InstanceDetails.jsx` causing ReferenceErrors.
- Cloud cleanup moved to backend for safe deletion of local zips after successful cloud uploads.
- Dropbox authentication: Fixed "Invalid redirect_uri" error by encoding the authentication URL.
- Cloud folder management: Fixed missing token refresh retry logic to resolve "401 Unauthorized" errors.

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
- Script support (partially implemented via extensions)
- Log analysis utility
- Cloud synchronization for worlds and configurations (Google Drive, Dropbox, OneDrive)
- Mod dependency validation (partially implemented)
- Mobile application for the administration panel
- Styling page redesign:
  - Grid layout
  - Live mini-preview for theme changes
  - Theme cards with color thumbnails
  - Custom `ColorPicker` and enhanced `SliderControl`
  - Glassmorphism effects and smooth transitions
- UI components:
  - `ThemeCard.jsx` (theme preview with hover animation)
  - `MiniPreview.jsx` (live launcher preview)
  - `ColorPicker.jsx` (enhanced color input)
  - `SliderControl.jsx` (value display, gradients)
- CSS enhancements for sliders, color pickers, and scrollbars
- Global extension system: `.mcextension` package support with Sidebar UI injection
- Extension Marketplace: Integrated extension browser/installer
- Performance overhaul:
  - Async Java/file operations
  - Page-level code-splitting via `React.lazy`/`Suspense`
  - Concurrent rendering with `useTransition`
  - List/grid virtualization with `react-window`
  - Lazy image loading via Intersection Observer API
  - GPU-accelerated CSS transitions
- UI refinements:
  - New `ToggleBox` component for consistent switches
  - "Show Snapshots" toggle in instance settings
  - "Show Disabled Features" setting in sidebar
- Splash screen: Electron `ready-to-show` window transition

### Fixed
- Runtime selection: Resolved "object Object" display on window close for runtime ("javaw.exe")
- Background overlay intensity now correctly applies to entire app
- Settings button in sidebar now uses glow effect instead of white outline
- Dropdown arrow position corrected in Settings page
- Fixed synchronous backend I/O bottlenecks causing UI freezes during launch
- Removed duplicate imports and SyntaxErrors at build time
- Improved toggle alignment and scrolling performance in dashboard

---

## [1.3.3] - 2026-02-14

### Added
- Skin and cape editor
- Instance grouping
- News system
- Instance management system
- Multi-version/multi-software support
- Custom themes/backgrounds
- Automatic updater
- Modrinth integration
- Custom launch arguments
- Built-in Java installer
- Discord Rich Presence integration
- MCLogs integration
- Keybinding transfers between instances
- Multi-account management
- Modrinth instance support
- Development build support
- Shader section with Modrinth integration (auto-install Iris/Sodium)
- Automatic Fabric API installation for Fabric instances
- Support for Modrinth modpacks
- Software version and usage analytics in admin panel
- Automatic Java download
- Shader preview
- Home section
- Server system to create/manage servers

