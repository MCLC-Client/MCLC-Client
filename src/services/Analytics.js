import { io } from "socket.io-client";

// MCLC Client Analytics Service
class AnalyticsService {
    constructor() {
        this.socket = null;
        this.socket = null;
        this.serverUrl = 'https://mclc.pluginhub.de'; // Production URL
        this.clientVersion = '1.3.3';
        this.os = 'win32';
        this.userProfile = null;
    }

    init(serverUrl = 'https://mclc.pluginhub.de') {
        if (this.socket) return;

        console.log('[Analytics] Initializing connection to', serverUrl);
        this.serverUrl = serverUrl;



        this.socket = io(this.serverUrl, {
            reconnectionDelayMax: 10000,
        });

        this.socket.on("connect", () => {
            console.log("[Analytics] Connected");
            this.register();
        });

        this.socket.on("disconnect", () => {
            console.log("[Analytics] Disconnected");
        });
    }

    setProfile(profile) {
        this.userProfile = profile;
        this.register(); // Re-register with new profile data
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

    updateStatus(isPlaying, instanceName = null) {
        if (!this.socket) return;
        // console.log('[Analytics] Update Status:', isPlaying, instanceName);
        this.socket.emit('update-status', {
            isPlaying,
            instance: instanceName
        });
    }

    trackDownload(type, name, id) {
        if (!this.socket) return;
        // console.log('[Analytics] Track Download:', type, name);
        this.socket.emit('track-download', {
            type,
            name,
            id,
            username: this.userProfile ? this.userProfile.name : null
        });
    }
}

export const Analytics = new AnalyticsService();
