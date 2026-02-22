import { io } from "socket.io-client";
import packageJson from '../../package.json';

class AnalyticsService {
    constructor() {
        this.socket = null;
        this.serverUrl = 'https://mclc.pluginhub.de';
        this.clientVersion = packageJson.version;
        this.os = 'win32';
        this.userProfile = null;
    }
    init(serverUrl = 'https://mclc.pluginhub.de') {
        if (this.socket) return;

        console.log('[Analytics] Initializing connection to', serverUrl);
        this.serverUrl = serverUrl;

        this.socket = io(this.serverUrl, {
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            transports: ['websocket', 'polling']
        });

        this.socket.on("connect", () => {
            console.log("[Analytics] Connected to", this.serverUrl);
            this.register();
        });

        this.socket.on("connect_error", (err) => {
            console.error("[Analytics] Connection error:", err.message);
            if (this.socket.io.opts.transports.indexOf('polling') === -1) {
                console.log("[Analytics] Falling back to polling");
                this.socket.io.opts.transports = ['polling'];
            }
        });

        this.socket.io.on("reconnect_attempt", () => {
            if (this.socket.io.opts.transports.indexOf('polling') !== -1) {
                this.socket.io.opts.transports = ['polling'];
            } else {
                this.socket.io.opts.transports = ['websocket'];
            }
        });

        this.socket.on("disconnect", (reason) => {
            console.log("[Analytics] Disconnected:", reason);
            if (reason === "io server disconnect") {
                this.socket.connect();
            }
        });
    }

    setProfile(profile) {
        this.userProfile = profile;
        this.register();
    }

    register() {
        if (!this.socket) return;
        const data = {
            version: this.clientVersion,
            os: this.os
        };
        if (this.userProfile) {
            data.username = this.userProfile.name;
            data.uuid = this.userProfile.id;
        }
        this.socket.emit('register', data);
    }

    updateStatus(isPlaying, instanceName = null, metadata = {}) {
        if (!this.socket) {
            console.warn('[Analytics] Update status skipped: No socket');
            return;
        }
        console.log('[Analytics] Update Status:', isPlaying, instanceName, metadata);
        this.socket.emit('update-status', {
            isPlaying,
            instance: instanceName,
            software: metadata.loader,
            gameVersion: metadata.version,
            mode: metadata.mode
        });
    }

    trackLaunch(instanceName, metadata = {}) {
        this.updateStatus(true, instanceName, metadata);
    }

    trackServerCreation(software, version) {
        if (!this.socket) {
            console.warn('[Analytics] Track server creation skipped: No socket');
            return;
        }
        console.log('[Analytics] Track Server Creation:', software, version);
        this.socket.emit('track-creation', {
            software,
            version,
            mode: 'server'
        });
    }

    trackInstanceCreation(software, version) {
        if (!this.socket) {
            console.warn('[Analytics] Track instance creation skipped: No socket');
            return;
        }
        console.log('[Analytics] Track Instance Creation:', software, version);
        this.socket.emit('track-creation', {
            software,
            version,
            mode: 'client'
        });
    }

    trackDownload(type, name, id) {
        if (!this.socket) return;

        this.socket.emit('track-download', {
            type,
            name,
            id,
            username: this.userProfile ? this.userProfile.name : null
        });
    }
}

export const Analytics = new AnalyticsService();