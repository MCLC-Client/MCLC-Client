import React, { useState, useEffect, useRef } from 'react';
import { useNotification } from '../context/NotificationContext';
import LoadingOverlay from '../components/LoadingOverlay';

function ServerDetails({ server, onBack, runningInstances, onServerUpdate }) {
    const { addNotification } = useNotification();
    const [consoleLog, setConsoleLog] = useState([]);
    const [command, setCommand] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showEulaDialog, setShowEulaDialog] = useState(false);
    const [serverStats, setServerStats] = useState({
        cpu: 0,
        memory: 0,
        players: [],
        uptime: 0,

        history: {
            cpu: [],
            memory: [],
            playerCount: [],
            timestamps: []
        }
    });
    const [currentStatus, setCurrentStatus] = useState(server.status || 'stopped');
    const [activeTab, setActiveTab] = useState('console');
    const [playitCode, setPlayitCode] = useState(null);
    const [playitChecked, setPlayitChecked] = useState(false);
    const [playitAvailable, setPlayitAvailable] = useState(false);
    const [playitChecking, setPlayitChecking] = useState(false);
    const [offlinePlayers, setOfflinePlayers] = useState([]);
    const [playerStats, setPlayerStats] = useState({});
    const [selectedPlayer, setSelectedPlayer] = useState(null);
    const [selectedPlayers, setSelectedPlayers] = useState([]);
    const [playerSearch, setPlayerSearch] = useState('');
    const [showBanDialog, setShowBanDialog] = useState(false);
    const [banReason, setBanReason] = useState('');
    const [banDuration, setBanDuration] = useState('permanent');
    const [teleportCoordinates, setTeleportCoordinates] = useState({ x: 0, y: 64, z: 0 });
    const [showTeleportDialog, setShowTeleportDialog] = useState(false);
    const [showWhitelistDialog, setShowWhitelistDialog] = useState(false);
    const [whitelistPlayer, setWhitelistPlayer] = useState('');
    const [showGiveDialog, setShowGiveDialog] = useState(false);
    const [giveItem, setGiveItem] = useState({ item: '', amount: 1 });
    const [showGamemodeMenu, setShowGamemodeMenu] = useState(false);
    const [showXpMenu, setShowXpMenu] = useState(false);
    const [xpAmount, setXpAmount] = useState(100);
    const [xpType, setXpType] = useState('add');
    const [serverProperties, setServerProperties] = useState({});
    const [isSavingProperties, setIsSavingProperties] = useState(false);

    // Mods/Plugins state
    const [modSearch, setModSearch] = useState('');
    const [modSearchResults, setModSearchResults] = useState([]);
    const [isSearchingMods, setIsSearchingMods] = useState(false);
    const [installedMods, setInstalledMods] = useState([]);
    const [selectedModVersion, setSelectedModVersion] = useState({});
    const [isInstallingMod, setIsInstallingMod] = useState(false);
    const [modVersions, setModVersions] = useState({});
    const [loadingVersions, setLoadingVersions] = useState(new Set());

    const consoleRef = useRef(null);
    const commandInputRef = useRef(null);
    const statsInterval = useRef(null);
    const chartsCanvasRef = useRef(null);
    const extractPlayitCode = (line) => {
        const match = line.match(/https:\/\/playit\.gg\/claim\/([a-zA-Z0-9]+)/);
        if (match && match[1]) {
            return match[1];
        }
        return null;
    };
    const extractPlayerEvents = (line) => {

        const joinMatch = line.match(/\[([^\]]+)\]: (.+) joined the game/);
        if (joinMatch) {
            const playerName = joinMatch[2];
            handlePlayerJoin(playerName);
            return;
        }
        const leaveMatch = line.match(/\[([^\]]+)\]: (.+) left the game/);
        if (leaveMatch) {
            const playerName = leaveMatch[2];
            handlePlayerLeave(playerName);
            return;
        }
        const listMatch = line.match(/There are (\d+) of a max of (\d+) players online: (.+)/);
        if (listMatch) {
            const onlinePlayers = listMatch[3].split(', ').filter(p => p.trim());
            updateOnlinePlayers(onlinePlayers);
            return;
        }
    };
    const handlePlayerJoin = (playerName) => {
        setOfflinePlayers(prev => prev.filter(p => p.name !== playerName));

        setPlayerStats(prev => {
            const now = Date.now();
            const stats = prev[playerName] || {
                firstSeen: now,
                lastSeen: now,
                playtime: 0,
                joins: 0
            };
            return {
                ...prev,
                [playerName]: {
                    ...stats,
                    lastSeen: now,
                    joins: (stats.joins || 0) + 1
                }
            };
        });
    };
    const handlePlayerLeave = (playerName) => {
        setOfflinePlayers(prev => {
            if (!prev.find(p => p.name === playerName)) {
                return [...prev, {
                    name: playerName,
                    lastSeen: new Date().toISOString(),
                    playtime: calculatePlaytime(playerName)
                }];
            }
            return prev;
        });
    };
    const updateOnlinePlayers = (players) => {
        setServerStats(prev => ({
            ...prev,
            players: players
        }));
    };
    const calculatePlaytime = (playerName) => {
        return 0;
    };
    const loadOfflinePlayers = async () => {
        try {
            if (window.electronAPI.getOfflinePlayers) {
                const players = await window.electronAPI.getOfflinePlayers(server.name);
                setOfflinePlayers(players || []);
            }
        } catch (error) {
            console.error('Failed to load offline players:', error);
        }
    };
    const loadPlayerStats = async () => {
        try {
            if (window.electronAPI.getPlayerStats) {
                const stats = await window.electronAPI.getPlayerStats(server.name);
                setPlayerStats(stats || {});
            }
        } catch (error) {
            console.error('Failed to load player stats:', error);
        }
    };

    const loadServerProperties = async () => {
        try {
            if (window.electronAPI.getServerProperties) {
                const properties = await window.electronAPI.getServerProperties(server.name);
                if (properties) {
                    setServerProperties(properties);
                }
            }
        } catch (error) {
            console.error('Failed to load server properties:', error);
        }
    };

    const saveServerProperties = async () => {
        setIsSavingProperties(true);
        try {
            if (window.electronAPI.saveServerProperties) {
                await window.electronAPI.saveServerProperties(server.name, serverProperties);
                addNotification('Server properties saved successfully', 'success');
            }
        } catch (error) {
            console.error('Failed to save server properties:', error);
            addNotification(`Failed to save properties: ${error.message}`, 'error');
        } finally {
            setIsSavingProperties(false);
        }
    };

    const updateProperty = (key, value) => {
        setServerProperties(prev => ({
            ...prev,
            [key]: value
        }));
    };

    const togglePlayerSelection = (player) => {
        setSelectedPlayers(prev =>
            prev.includes(player)
                ? prev.filter(p => p !== player)
                : [...prev, player]
        );
    };

    const selectAllOnline = () => {
        setSelectedPlayers(serverStats.players);
    };

    const clearSelection = () => {
        setSelectedPlayers([]);
    };
    const sendPlayerCommand = async (player, commandType, ...args) => {
        let cmd = '';

        switch (commandType) {
            case 'kick':
                cmd = `kick ${player} ${args[0] || 'You were kicked'}`;
                break;
            case 'ban':
                if (args[0] === 'permanent') {
                    cmd = `ban ${player} ${args[1] || 'Banned'}`;
                } else {
                    const duration = parseDuration(args[0]);
                    cmd = `tempban ${player} ${duration} ${args[1] || 'Banned'}`;
                }
                break;
            case 'pardon':
                cmd = `pardon ${player}`;
                break;
            case 'op':
                cmd = `op ${player}`;
                break;
            case 'deop':
                cmd = `deop ${player}`;
                break;
            case 'whitelist_add':
                cmd = `whitelist add ${player}`;
                break;
            case 'whitelist_remove':
                cmd = `whitelist remove ${player}`;
                break;
            case 'gamemode':
                cmd = `gamemode ${args[0]} ${player}`;
                break;
            case 'teleport':
                cmd = `tp ${player} ${args[0]} ${args[1]} ${args[2]}`;
                break;
            case 'teleport_to':
                cmd = `tp ${player} ${args[0]}`;
                break;
            case 'teleport_here':
                cmd = `tp ${args[0]} ${player}`;
                break;
            case 'kill':
                cmd = `kill ${player}`;
                break;
            case 'heal':
                cmd = `heal ${player}`;
                break;
            case 'feed':
                cmd = `feed ${player}`;
                break;
            case 'give':
                cmd = `give ${player} ${args[0]} ${args[1] || 1}`;
                break;
            case 'clear':
                cmd = `clear ${player}`;
                break;
            case 'experience':
                if (args[1] === 'add') cmd = `xp add ${player} ${args[0]}`;
                else if (args[1] === 'set') cmd = `xp set ${player} ${args[0]}`;
                else if (args[1] === 'levels') cmd = `xp add ${player} ${args[0]} levels`;
                else if (args[1] === 'setLevels') cmd = `xp set ${player} ${args[0]} levels`;
                break;
            default:
                return;
        }

        try {
            await window.electronAPI.sendServerCommand(server.name, cmd);
            addNotification(`Command sent to ${player}`, 'success');

            if (showBanDialog) setShowBanDialog(false);
            if (showTeleportDialog) setShowTeleportDialog(false);
            if (showGiveDialog) setShowGiveDialog(false);
            if (showWhitelistDialog) setShowWhitelistDialog(false);
        } catch (error) {
            console.error('Failed to send player command:', error);
            addNotification(`Failed: ${error.message}`, 'error');
        }
    };
    const handleBulkAction = (action, value) => {
        if (selectedPlayers.length === 0) {
            addNotification('No players selected', 'warning');
            return;
        }

        selectedPlayers.forEach(player => {
            if (action === 'gamemode') sendPlayerCommand(player, 'gamemode', value);
            else if (action === 'kill') sendPlayerCommand(player, 'kill');
            else if (action === 'heal') sendPlayerCommand(player, 'heal');
            else if (action === 'feed') sendPlayerCommand(player, 'feed');
            else if (action === 'clear') sendPlayerCommand(player, 'clear');
            else if (action === 'experience') sendPlayerCommand(player, 'experience', xpAmount, xpType);
        });

        addNotification(`${action} applied to ${selectedPlayers.length} players`, 'success');
        clearSelection();
        setShowXpMenu(false);
        setShowGamemodeMenu(false);
    };
    const parseDuration = (duration) => {
        const value = parseInt(duration);
        if (duration.includes('d')) return `${value}d`;
        if (duration.includes('h')) return `${value}h`;
        if (duration.includes('m')) return `${value}m`;
        return `${value}m`;
    };
    const checkPlayitAvailability = async () => {
        if (!server || playitChecked) return;

        setPlayitChecking(true);
        try {
            if (window.electronAPI.checkPlayitAvailable) {
                const result = await window.electronAPI.checkPlayitAvailable(server.software, server.version);
                setPlayitAvailable(result.available || false);
            } else {
                setPlayitAvailable(server.software !== 'vanilla');
            }
        } catch (error) {
            console.error('Failed to check Playit availability:', error);
            setPlayitAvailable(false);
        } finally {
            setPlayitChecking(false);
            setPlayitChecked(true);
        }
    };
    const installPlayitPlugin = async () => {
        setIsLoading(true);
        try {
            if (window.electronAPI.installPlayitPlugin) {
                const result = await window.electronAPI.installPlayitPlugin(server.name);
                if (result.success) {
                    addNotification('Playit plugin installed successfully', 'success');
                    setPlayitAvailable(true);
                } else {
                    addNotification(`Failed to install Playit plugin: ${result.message || result.error}`, 'error');
                }
            } else {
                addNotification('Playit plugin installation not available', 'error');
            }
        } catch (error) {
            console.error('Failed to install Playit plugin:', error);
            addNotification(`Failed to install Playit plugin: ${error.message}`, 'error');
        } finally {
            setIsLoading(false);
        }
    };
    const openPlayitClaim = () => {
        if (playitCode) {
            const url = `https://playit.gg/claim/${playitCode}`;
            if (window.electronAPI.openExternal) {
                window.electronAPI.openExternal(url)
                    .then(result => {
                        if (!result?.success) {
                            window.open(url, '_blank');
                        }
                    })
                    .catch(() => window.open(url, '_blank'));
            } else {
                window.open(url, '_blank');
            }
        } else {
            const url = 'https://playit.gg';
            if (window.electronAPI.openExternal) {
                window.electronAPI.openExternal(url)
                    .catch(() => window.open(url, '_blank'));
            } else {
                window.open(url, '_blank');
            }
        }
    };

    useEffect(() => {
        checkPlayitAvailability();
        loadConsoleLog();
        loadOfflinePlayers();
        loadPlayerStats();
        loadServerProperties();

        const removeStatusListener = window.electronAPI.onServerStatus?.(({ serverName, status, server: updatedServer }) => {
            if (serverName === server.name) {
                console.log(`[ServerDetails] Status update for ${serverName}: ${status}`);
                setCurrentStatus(status);

                if (updatedServer && onServerUpdate) {
                    onServerUpdate(updatedServer);
                }
            }
        });

        const removeLogListener = window.electronAPI.onServerLog?.(({ serverName, log }) => {
            if (serverName === server.name) {
                setConsoleLog(prev => {
                    const newLog = [...prev, log];
                    const code = extractPlayitCode(log);
                    if (code) {
                        setPlayitCode(code);
                    }
                    extractPlayerEvents(log);

                    if (newLog.length > 500) {
                        return newLog.slice(-500);
                    }
                    return newLog;
                });
            }
        });

        const removeStatsListener = window.electronAPI.onServerStats?.(({ serverName, cpu, memory, uptime, players }) => {
            if (serverName === server.name) {
                setServerStats(prev => {
                    const now = Date.now();
                    const timestamp = new Date().toLocaleTimeString();
                    const newHistory = {
                        cpu: [...prev.history.cpu, cpu || 0].slice(-60),
                        memory: [...prev.history.memory, memory || 0].slice(-60),
                        playerCount: [...prev.history.playerCount, (players?.length || 0)].slice(-60),
                        timestamps: [...prev.history.timestamps, timestamp].slice(-60)
                    };

                    return {
                        cpu: cpu || 0,
                        memory: memory || 0,
                        uptime: uptime || 0,
                        players: players || [],
                        history: newHistory
                    };
                });
            }
        });

        const removeEulaListener = window.electronAPI.onServerEulaRequired?.(({ serverName }) => {
            if (serverName === server.name) {
                setShowEulaDialog(true);
            }
        });

        const removeConsoleClearedListener = window.electronAPI.onServerConsoleCleared?.(({ serverName }) => {
            if (serverName === server.name) {
                setConsoleLog([]);
                setPlayitCode(null);
            }
        });

        const checkStatusInterval = setInterval(() => {
            checkServerStatus();
        }, 2000);

        checkServerStatus();
        loadServerStats();

        statsInterval.current = setInterval(() => {
            loadServerStats();
        }, 2000);

        if (commandInputRef.current) {
            commandInputRef.current.focus();
        }

        return () => {
            if (removeStatusListener) removeStatusListener();
            if (removeLogListener) removeLogListener();
            if (removeStatsListener) removeStatsListener();
            if (removeEulaListener) removeEulaListener();
            if (removeConsoleClearedListener) removeConsoleClearedListener();

            clearInterval(checkStatusInterval);
            if (statsInterval.current) {
                clearInterval(statsInterval.current);
            }
        };
    }, [server.name]);
    useEffect(() => {
        if (consoleRef.current && activeTab === 'console') {
            consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
        }
    }, [consoleLog, activeTab]);
    useEffect(() => {
        if (activeTab === 'charts' && chartsCanvasRef.current) {
            drawCharts();
        }
    }, [activeTab, serverStats.history]);
    useEffect(() => {
        if (consoleLog.length > 0 && !playitCode) {
            for (const line of consoleLog) {
                const code = extractPlayitCode(line);
                if (code) {
                    setPlayitCode(code);
                    break;
                }
            }
        }
    }, [consoleLog]);

    // Check if mods tab is still valid when server changes
    useEffect(() => {
        if (activeTab === 'mods' && !shouldShowModTab()) {
            setActiveTab('console');
        }
    }, [server.software, server.version]);

    const checkServerStatus = async () => {
        try {
            if (!window.electronAPI.getServerStatus) return;

            const status = await window.electronAPI.getServerStatus(server.name);
            if (status && status !== currentStatus) {
                setCurrentStatus(status);
            }
        } catch (error) {
            console.error('Failed to check server status:', error);
        }
    };

    const loadConsoleLog = async () => {
        try {
            if (!window.electronAPI.getServerLogs) return;

            const log = await window.electronAPI.getServerLogs(server.name);
            if (Array.isArray(log)) {
                setConsoleLog(log.slice(-500));
                for (const line of log) {
                    const code = extractPlayitCode(line);
                    if (code) {
                        setPlayitCode(code);
                    }
                    extractPlayerEvents(line);
                }
            }
        } catch (error) {
            console.error('Failed to load console log:', error);
        }
    };

    const loadServerStats = async () => {
        try {
            if (!window.electronAPI.getServerStats) return;

            const stats = await window.electronAPI.getServerStats(server.name);
            setServerStats(prev => ({
                ...prev,
                ...stats,
                cpu: stats?.cpu || 0,
                memory: stats?.memory || 0,
                players: stats?.players || []
            }));
        } catch (error) {
            console.error('Failed to load server stats:', error);
        }
    };

    const drawCharts = () => {
        const canvas = chartsCanvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        ctx.clearRect(0, 0, width, height);

        const { cpu, memory, playerCount, timestamps } = serverStats.history;

        if (cpu.length < 2) return;
        const drawChart = (data, color, yOffset, chartHeight, maxValue) => {
            const points = data.map((value, index) => ({
                x: (index / (data.length - 1)) * width,
                y: yOffset + chartHeight - (value / maxValue) * chartHeight
            }));
            ctx.beginPath();
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.moveTo(points[0].x, points[0].y);

            for (let i = 1; i < points.length; i++) {
                ctx.lineTo(points[i].x, points[i].y);
            }

            ctx.stroke();
            ctx.lineTo(points[points.length - 1].x, yOffset + chartHeight);
            ctx.lineTo(points[0].x, yOffset + chartHeight);
            ctx.closePath();

            ctx.fillStyle = color.replace('rgb', 'rgba').replace(')', ', 0.1)');
            ctx.fill();
            points.forEach(point => {
                ctx.beginPath();
                ctx.arc(point.x, point.y, 3, 0, 2 * Math.PI);
                ctx.fillStyle = color;
                ctx.fill();
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 1;
                ctx.stroke();
            });
            ctx.fillStyle = '#9CA3AF';
            ctx.font = '10px Inter, sans-serif';
            ctx.textAlign = 'center';

            points.forEach((point, i) => {
                if (i % 10 === 0 || i === points.length - 1) {
                    ctx.fillText(timestamps[i] || '', point.x, yOffset + chartHeight + 15);
                }
            });
        };
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '12px Inter, sans-serif';
        ctx.fillText('CPU Usage (%)', 10, 25);
        drawChart(cpu, 'rgb(59, 130, 246)', 30, 120, 100);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '12px Inter, sans-serif';
        ctx.fillText('Memory Usage (MB)', 10, 185);
        drawChart(memory, 'rgb(16, 185, 129)', 170, 120, Math.max(...memory, 1024));
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '12px Inter, sans-serif';
        ctx.fillText('Active Players', 10, 340);
        drawChart(playerCount, 'rgb(245, 158, 11)', 310, 120, server.maxPlayers || 20);
    };

    const handleSendCommand = async (e) => {
        e.preventDefault();
        if (!command.trim()) return;

        try {
            await window.electronAPI.sendServerCommand(server.name, command);
            setCommand('');

            if (commandInputRef.current) {
                commandInputRef.current.focus();
            }
        } catch (error) {
            console.error('Failed to send command:', error);
            addNotification(`Failed to send command: ${error.message}`, 'error');
        }
    };

    const checkEulaStatus = async () => {
        if (!window.electronAPI.checkServerEula) {
            console.warn('EULA check not available, proceeding without check');
            return true;
        }

        try {
            return await window.electronAPI.checkServerEula(server.name);
        } catch (error) {
            console.error('Failed to check EULA:', error);
            return true;
        }
    };

    const handleStart = async () => {
        const eulaAccepted = await checkEulaStatus();

        if (!eulaAccepted) {
            setShowEulaDialog(true);
            return;
        }

        proceedWithStart();
    };

    const proceedWithStart = async () => {
        setIsLoading(true);
        try {
            const result = await window.electronAPI.startServer(server.name);
            if (result?.success) {
                addNotification(`Starting server ${server.name}...`, 'info');
                setCurrentStatus('starting');
            } else {
                addNotification(`Failed to start server: ${result?.error || 'Unknown error'}`, 'error');
            }
        } catch (error) {
            console.error('Failed to start server:', error);
            addNotification(`Failed to start server: ${error.message}`, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleEulaAccept = async () => {
        setShowEulaDialog(false);

        if (window.electronAPI.acceptServerEula) {
            try {
                await window.electronAPI.acceptServerEula(server.name);
            } catch (error) {
                console.error('Failed to accept EULA:', error);
            }
        }

        proceedWithStart();
    };

    const handleEulaCancel = () => {
        setShowEulaDialog(false);
        addNotification('Server start cancelled - EULA not accepted', 'warning');
    };

    const handleStop = async () => {
        setIsLoading(true);
        try {
            const result = await window.electronAPI.stopServer(server.name);
            if (result?.success) {
                addNotification(`Stopping server ${server.name}...`, 'info');
                setCurrentStatus('stopping');
            } else {
                addNotification(`Failed to stop server: ${result?.error || 'Unknown error'}`, 'error');
            }
        } catch (error) {
            console.error('Failed to stop server:', error);
            addNotification(`Failed to stop server: ${error.message}`, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRestart = async () => {
        setIsLoading(true);
        try {
            const result = await window.electronAPI.restartServer(server.name);
            if (result?.success) {
                addNotification(`Restarting server ${server.name}...`, 'info');
                setCurrentStatus('restarting');
            } else {
                addNotification(`Failed to restart server: ${result?.error || 'Unknown error'}`, 'error');
            }
        } catch (error) {
            console.error('Failed to restart server:', error);
            addNotification(`Failed to restart server: ${error.message}`, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleClearConsole = async () => {
        try {
            if (window.electronAPI.clearServerConsole) {
                await window.electronAPI.clearServerConsole(server.name);
            } else {
                setConsoleLog([]);
                setPlayitCode(null);
            }
            addNotification('Console cleared', 'success');
        } catch (error) {
            console.error('Failed to clear console:', error);
            addNotification('Failed to clear console', 'error');
        }
    };

    const copyConsoleToClipboard = () => {
        const consoleText = consoleLog.join('\n');
        navigator.clipboard.writeText(consoleText).then(() => {
            addNotification('Console content copied to clipboard', 'success');
        }).catch(() => {
            addNotification('Failed to copy console content', 'error');
        });
    };

    const formatUptime = (seconds) => {
        if (!seconds) return '0s';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) return `${hours}h ${minutes}m`;
        if (minutes > 0) return `${minutes}m ${secs}s`;
        return `${secs}s`;
    };

    const formatPlaytime = (seconds) => {
        if (!seconds) return 'Never';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        if (hours > 0) return `${hours}h ${minutes}m`;
        if (minutes > 0) return `${minutes}m`;
        return 'Just now';
    };

    // Helper function to determine loader type
    const getLoaderType = () => {
        const software = server.software || 'vanilla';
        const lowerSoftware = software.toLowerCase();

        if (lowerSoftware === 'vanilla') return 'vanilla';
        if (['forge', 'neoforge', 'quilt', 'fabric'].includes(lowerSoftware)) return 'fabric-like';
        if (['bukkit', 'spigot', 'paper', 'purpur', 'folia'].includes(lowerSoftware)) return 'paper-like';
        return 'vanilla';
    };

    const getModTabName = () => {
        const loaderType = getLoaderType();
        if (loaderType === 'fabric-like') return 'Mods';
        if (loaderType === 'paper-like') return 'Plugins';
        return null;
    };

    const getProjectType = () => {
        const loaderType = getLoaderType();
        if (loaderType === 'fabric-like') return 'mod';
        // Modrinth doesn't have plugin type, we'll search for spigot mods
        if (loaderType === 'paper-like') return 'mod';
        return null;
    };

    const shouldShowModTab = () => {
        return getLoaderType() !== 'vanilla';
    };

    const getLoaderForModrinth = () => {
        const software = server.software || 'vanilla';
        const lowerSoftware = software.toLowerCase();

        if (lowerSoftware === 'forge') return 'forge';
        if (lowerSoftware === 'neoforge') return 'neoforge';
        if (lowerSoftware === 'quilt') return 'quilt';
        if (lowerSoftware === 'fabric') return 'fabric';

        return lowerSoftware;
    };

    const searchMods = async (query) => {
        if (!query.trim()) {
            setModSearchResults([]);
            return;
        }

        setIsSearchingMods(true);
        try {
            const projectType = getProjectType();
            const result = await window.electronAPI.modrinthSearch(query, [], {
                projectType,
                limit: 10
            });

            if (result.success) {
                setModSearchResults(result.results || []);
                setModVersions({});
            } else {
                addNotification(result.error || 'Failed to search mods', 'error');
            }
        } catch (err) {
            console.error('Mod search error:', err);
            addNotification(err.message || 'Failed to search mods', 'error');
        } finally {
            setIsSearchingMods(false);
        }
    };

    const loadModVersions = async (projectId) => {
        if (modVersions[projectId]) {
            return;
        }

        setLoadingVersions(prev => new Set(prev).add(projectId));
        try {
            const loaders = [getLoaderForModrinth()];
            const result = await window.electronAPI.modrinthGetVersions(projectId, loaders, [server.version]);

            if (result.success) {
                setModVersions(prev => ({
                    ...prev,
                    [projectId]: result.versions || []
                }));
                
                if (result.versions && result.versions.length > 0) {
                    setSelectedModVersion(prev => ({
                        ...prev,
                        [projectId]: result.versions[0].id
                    }));
                }
            } else {
                addNotification('Failed to load available versions', 'error');
            }
        } catch (err) {
            console.error('Version fetch error:', err);
        } finally {
            setLoadingVersions(prev => {
                const updated = new Set(prev);
                updated.delete(projectId);
                return updated;
            });
        }
    };

    const installMod = async (projectId, versionId, projectTitle) => {
        if (!versionId) {
            addNotification('No compatible version found for your server', 'error');
            return;
        }

        setIsInstallingMod(true);
        try {
            const versions = modVersions[projectId] || [];
            const version = versions.find(v => v.id === versionId);

            if (!version) {
                addNotification('Version not found', 'error');
                return;
            }

            const file = version.files.find(f => f.primary) || version.files[0];

            const result = await window.electronAPI.modrinthInstall({
                instanceName: server.name,
                projectId: projectId,
                versionId: versionId,
                filename: file.filename,
                url: file.url,
                projectType: getProjectType()
            });

            if (result.success) {
                addNotification(`${projectTitle} installed successfully`, 'success');
                setModSearch('');
                setModSearchResults([]);
                setSelectedModVersion({});
                setModVersions({});
            } else {
                addNotification(result.error || 'Failed to install mod', 'error');
            }
        } catch (err) {
            console.error('Installation error:', err);
            addNotification(err.message || 'Failed to install mod', 'error');
        } finally {
            setIsInstallingMod(false);
        }
    };

    const isRunning = currentStatus === 'running';
    const isStarting = currentStatus === 'starting';
    const isStopping = currentStatus === 'stopping';
    const isRestarting = currentStatus === 'restarting';
    const filteredOnlinePlayers = serverStats.players.filter(p =>
        p.toLowerCase().includes(playerSearch.toLowerCase())
    );

    const filteredOfflinePlayers = offlinePlayers.filter(p =>
        p.name.toLowerCase().includes(playerSearch.toLowerCase())
    );

    return (
        <div className="h-full flex flex-col bg-background">
            {isLoading && <LoadingOverlay message="Processing..." />}

            { }
            {showEulaDialog && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-surface rounded-xl p-6 max-w-md w-full mx-4">
                        <h3 className="text-xl font-bold text-white mb-4">Minecraft EULA</h3>
                        <p className="text-gray-300 mb-6">
                            By pressing Start, you are indicating your agreement to the Minecraft EULA
                            (<a
                                href="https://aka.ms/MinecraftEULA"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                                onClick={(e) => {
                                    e.preventDefault();
                                    if (window.electronAPI.openExternal) {
                                        window.electronAPI.openExternal('https://aka.ms/MinecraftEULA');
                                    } else {
                                        window.open('https://aka.ms/MinecraftEULA', '_blank');
                                    }
                                }}
                            >
                                https:
                            </a>).
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={handleEulaCancel}
                                className="px-4 py-2 bg-white/5 text-gray-300 rounded-lg hover:bg-white/10 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleEulaAccept}
                                className="px-4 py-2 bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition-colors font-bold"
                            >
                                Start
                            </button>
                        </div>
                    </div>
                </div>
            )}

            { }
            {showBanDialog && selectedPlayer && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-surface rounded-xl p-6 max-w-md w-full mx-4">
                        <h3 className="text-xl font-bold text-white mb-4">Ban {selectedPlayer}</h3>

                        <div className="mb-4">
                            <label className="block text-gray-400 text-sm mb-2">Duration</label>
                            <select
                                value={banDuration}
                                onChange={(e) => setBanDuration(e.target.value)}
                                className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                            >
                                <option value="permanent">Permanent</option>
                                <option value="1h">1 Hour</option>
                                <option value="6h">6 Hours</option>
                                <option value="12h">12 Hours</option>
                                <option value="1d">1 Day</option>
                                <option value="3d">3 Days</option>
                                <option value="7d">7 Days</option>
                                <option value="30d">30 Days</option>
                            </select>
                        </div>

                        <div className="mb-6">
                            <label className="block text-gray-400 text-sm mb-2">Reason (optional)</label>
                            <input
                                type="text"
                                value={banReason}
                                onChange={(e) => setBanReason(e.target.value)}
                                placeholder="Enter ban reason..."
                                className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                            />
                        </div>

                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowBanDialog(false)}
                                className="px-4 py-2 bg-white/5 text-gray-300 rounded-lg hover:bg-white/10 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    sendPlayerCommand(selectedPlayer, 'ban', banDuration, banReason);
                                    setShowBanDialog(false);
                                }}
                                className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors font-bold"
                            >
                                Ban Player
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showTeleportDialog && selectedPlayer && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-surface rounded-xl p-6 max-w-md w-full mx-4">
                        <h3 className="text-xl font-bold text-white mb-4">Teleport {selectedPlayer}</h3>

                        <div className="grid grid-cols-3 gap-3 mb-4">
                            <div>
                                <label className="block text-gray-400 text-sm mb-2">X</label>
                                <input
                                    type="number"
                                    value={teleportCoordinates.x}
                                    onChange={(e) => setTeleportCoordinates(prev => ({ ...prev, x: parseInt(e.target.value) || 0 }))}
                                    className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-gray-400 text-sm mb-2">Y</label>
                                <input
                                    type="number"
                                    value={teleportCoordinates.y}
                                    onChange={(e) => setTeleportCoordinates(prev => ({ ...prev, y: parseInt(e.target.value) || 64 }))}
                                    className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-gray-400 text-sm mb-2">Z</label>
                                <input
                                    type="number"
                                    value={teleportCoordinates.z}
                                    onChange={(e) => setTeleportCoordinates(prev => ({ ...prev, z: parseInt(e.target.value) || 0 }))}
                                    className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                />
                            </div>
                        </div>

                        <div className="flex gap-2 mb-6">
                            <button
                                onClick={() => {
                                    sendPlayerCommand(selectedPlayer, 'teleport_to', '@p');
                                    setShowTeleportDialog(false);
                                }}
                                className="flex-1 px-3 py-2 bg-white/5 text-gray-300 rounded-lg hover:bg-white/10 transition-colors text-sm"
                            >
                                TP to You
                            </button>
                            <button
                                onClick={() => {
                                    sendPlayerCommand('@p', 'teleport_here', selectedPlayer);
                                    setShowTeleportDialog(false);
                                }}
                                className="flex-1 px-3 py-2 bg-white/5 text-gray-300 rounded-lg hover:bg-white/10 transition-colors text-sm"
                            >
                                TP You to Them
                            </button>
                        </div>

                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowTeleportDialog(false)}
                                className="px-4 py-2 bg-white/5 text-gray-300 rounded-lg hover:bg-white/10 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    sendPlayerCommand(selectedPlayer, 'teleport', teleportCoordinates.x, teleportCoordinates.y, teleportCoordinates.z);
                                    setShowTeleportDialog(false);
                                }}
                                className="px-4 py-2 bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition-colors font-bold"
                            >
                                Teleport
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showGiveDialog && selectedPlayer && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-surface rounded-xl p-6 max-w-md w-full mx-4">
                        <h3 className="text-xl font-bold text-white mb-4">Give Items to {selectedPlayer}</h3>

                        <div className="mb-4">
                            <label className="block text-gray-400 text-sm mb-2">Item ID/Name</label>
                            <input
                                type="text"
                                value={giveItem.item}
                                onChange={(e) => setGiveItem(prev => ({ ...prev, item: e.target.value }))}
                                placeholder="e.g., minecraft:diamond, diamond_sword"
                                className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                            />
                        </div>

                        <div className="mb-6">
                            <label className="block text-gray-400 text-sm mb-2">Amount</label>
                            <input
                                type="number"
                                min="1"
                                max="64"
                                value={giveItem.amount}
                                onChange={(e) => setGiveItem(prev => ({ ...prev, amount: parseInt(e.target.value) || 1 }))}
                                className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                            />
                        </div>

                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowGiveDialog(false)}
                                className="px-4 py-2 bg-white/5 text-gray-300 rounded-lg hover:bg-white/10 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    sendPlayerCommand(selectedPlayer, 'give', giveItem.item, giveItem.amount);
                                    setShowGiveDialog(false);
                                }}
                                className="px-4 py-2 bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition-colors font-bold"
                            >
                                Give Items
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showWhitelistDialog && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-surface rounded-xl p-6 max-w-md w-full mx-4">
                        <h3 className="text-xl font-bold text-white mb-4">Add to Whitelist</h3>

                        <div className="mb-6">
                            <label className="block text-gray-400 text-sm mb-2">Player Name</label>
                            <input
                                type="text"
                                value={whitelistPlayer}
                                onChange={(e) => setWhitelistPlayer(e.target.value)}
                                placeholder="Enter player name..."
                                className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                            />
                        </div>

                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowWhitelistDialog(false)}
                                className="px-4 py-2 bg-white/5 text-gray-300 rounded-lg hover:bg-white/10 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    sendPlayerCommand(whitelistPlayer, 'whitelist_add');
                                    setShowWhitelistDialog(false);
                                    setWhitelistPlayer('');
                                }}
                                className="px-4 py-2 bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition-colors font-bold"
                            >
                                Add to Whitelist
                            </button>
                        </div>
                    </div>
                </div>
            )}

            { }
            <div className="flex items-center justify-between p-6 border-b border-white/5">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-background rounded-lg overflow-hidden">
                            {server.icon && server.icon.startsWith('data:') ? (
                                <img src={server.icon} alt="" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-2xl">
                                    🖥️
                                </div>
                            )}
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white">{server.name}</h1>
                            <div className="flex items-center gap-2 text-sm text-gray-400">
                                <span className="bg-white/5 px-2 py-0.5 rounded">{server.software}</span>
                                <span>{server.version}</span>
                                <span>Port: {server.port}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className={`px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 ${isRunning ? 'bg-green-500/20 text-green-400' :
                        isStarting || isRestarting ? 'bg-yellow-500/20 text-yellow-400' :
                            isStopping ? 'bg-orange-500/20 text-orange-400' :
                                'bg-gray-500/20 text-gray-400'
                        }`}>
                        <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-green-500 animate-pulse' :
                            isStarting || isRestarting ? 'bg-yellow-500 animate-pulse' :
                                isStopping ? 'bg-orange-500 animate-pulse' :
                                    'bg-gray-500'
                            }`}></div>
                        {isRunning ? 'Running' :
                            isStarting ? 'Starting...' :
                                isStopping ? 'Stopping...' :
                                    isRestarting ? 'Restarting...' :
                                        'Stopped'}
                    </div>

                    {!isRunning && !isStarting && !isStopping && !isRestarting && (
                        <button
                            onClick={handleStart}
                            className="px-4 py-1.5 bg-primary/20 text-primary rounded-lg text-sm font-bold hover:bg-primary/30 transition-colors"
                        >
                            Start
                        </button>
                    )}
                    {isRunning && (
                        <>
                            <button
                                onClick={handleStop}
                                className="px-4 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-sm font-bold hover:bg-red-500/30 transition-colors"
                            >
                                Stop
                            </button>
                            <button
                                onClick={handleRestart}
                                className="px-4 py-1.5 bg-yellow-500/20 text-yellow-400 rounded-lg text-sm font-bold hover:bg-yellow-500/30 transition-colors"
                            >
                                Restart
                            </button>
                        </>
                    )}
                </div>
            </div>

            { }
            <div className="grid grid-cols-4 gap-4 p-6 border-b border-white/5">
                <div className="bg-surface/40 rounded-xl p-4">
                    <div className="text-gray-400 text-sm mb-1">Players</div>
                    <div className="text-2xl font-bold text-white">
                        {serverStats.players?.length || 0}/{server.maxPlayers || 20}
                    </div>
                    {serverStats.players?.length > 0 && (
                        <div className="mt-2 text-xs text-gray-400 truncate">
                            {serverStats.players.join(', ')}
                        </div>
                    )}
                </div>
                <div className="bg-surface/40 rounded-xl p-4">
                    <div className="text-gray-400 text-sm mb-1">CPU Usage</div>
                    <div className="text-2xl font-bold text-white">{Math.round(serverStats.cpu)}%</div>
                </div>
                <div className="bg-surface/40 rounded-xl p-4">
                    <div className="text-gray-400 text-sm mb-1">Memory Usage</div>
                    <div className="text-2xl font-bold text-white">
                        {Math.round(serverStats.memory || 0)} MB
                    </div>
                </div>
                <div className="bg-surface/40 rounded-xl p-4">
                    <div className="text-gray-400 text-sm mb-1">Uptime</div>
                    <div className="text-2xl font-bold text-white">
                        {formatUptime(serverStats.uptime)}
                    </div>
                </div>
            </div>

            { }
            <div className="flex gap-1 px-6 pt-4 border-b border-white/5">
                <button
                    onClick={() => setActiveTab('console')}
                    className={`px-4 py-2 rounded-t-lg font-bold text-sm transition-colors ${activeTab === 'console'
                        ? 'bg-primary/20 text-primary border-b-2 border-primary'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                >
                    Console
                </button>
                <button
                    onClick={() => setActiveTab('publicity')}
                    className={`px-4 py-2 rounded-t-lg font-bold text-sm transition-colors ${activeTab === 'publicity'
                        ? 'bg-primary/20 text-primary border-b-2 border-primary'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                >
                    Publicity
                </button>
                <button
                    onClick={() => setActiveTab('charts')}
                    className={`px-4 py-2 rounded-t-lg font-bold text-sm transition-colors ${activeTab === 'charts'
                        ? 'bg-primary/20 text-primary border-b-2 border-primary'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                >
                    Charts
                </button>
                <button
                    onClick={() => setActiveTab('players')}
                    className={`px-4 py-2 rounded-t-lg font-bold text-sm transition-colors ${activeTab === 'players'
                        ? 'bg-primary/20 text-primary border-b-2 border-primary'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                >
                    Players ({serverStats.players?.length || 0} online)
                </button>
                {shouldShowModTab() && (
                    <button
                        onClick={() => setActiveTab('mods')}
                        className={`px-4 py-2 rounded-t-lg font-bold text-sm transition-colors ${activeTab === 'mods'
                            ? 'bg-primary/20 text-primary border-b-2 border-primary'
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        {getModTabName()}
                    </button>
                )}
                <button
                    onClick={() => setActiveTab('properties')}
                    className={`px-4 py-2 rounded-t-lg font-bold text-sm transition-colors ${activeTab === 'properties'
                        ? 'bg-primary/20 text-primary border-b-2 border-primary'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                >
                    Properties
                </button>
            </div>

            { }
            <div className="flex-1 p-6 overflow-auto">
                {activeTab === 'console' && (

                    <>
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-lg font-bold text-white">Console</h2>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleClearConsole}
                                    className="p-2 hover:bg-white/5 rounded-lg transition-colors text-gray-400 hover:text-white"
                                    title="Clear console"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                                <button
                                    onClick={copyConsoleToClipboard}
                                    className="p-2 hover:bg-white/5 rounded-lg transition-colors text-gray-400 hover:text-white"
                                    title="Copy console content"
                                    disabled={consoleLog.length === 0}
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <div
                            ref={consoleRef}
                            className="h-96 bg-black/40 rounded-xl p-4 font-mono text-sm overflow-y-auto custom-scrollbar mb-4 select-text"
                        >
                            {consoleLog.map((line, i) => (
                                <div key={i} className="text-gray-300 whitespace-pre-wrap mb-1 hover:bg-white/5 cursor-text">
                                    {line}
                                </div>
                            ))}
                            {consoleLog.length === 0 && (
                                <div className="text-gray-500 italic">No console output yet</div>
                            )}
                        </div>

                        <form onSubmit={handleSendCommand} className="flex gap-2">
                            <input
                                ref={commandInputRef}
                                type="text"
                                value={command}
                                onChange={(e) => setCommand(e.target.value)}
                                placeholder="Enter command... (with or without /)"
                                className="flex-1 bg-background border border-white/10 rounded-xl px-4 py-2 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                                disabled={!isRunning}
                                autoFocus
                            />
                            <button
                                type="submit"
                                disabled={!isRunning || !command.trim()}
                                className="px-6 py-2 bg-primary/20 text-primary rounded-xl font-bold hover:bg-primary/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Send
                            </button>
                        </form>
                        {!isRunning && (
                            <p className="text-xs text-gray-500 mt-2">
                                Server must be running to send commands
                            </p>
                        )}
                    </>
                )}

                {activeTab === 'publicity' && (

                    <div className="flex flex-col items-center justify-center h-full">
                        <div className="max-w-md w-full text-center">
                            { }
                            <div className="mb-6">
                                <svg className="w-20 h-20 mx-auto text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 4.034a2.5 2.5 0 0 1 3.62 0l3.156 3.156a2.5 2.5 0 0 1 0 3.62l-8.96 8.96a2.5 2.5 0 0 1-3.62 0L3.37 12.81a2.5 2.5 0 0 1 0-3.62l3.156-3.156a2.5 2.5 0 0 1 3.62 0L12 5.439l1.19-1.405z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m-3-3h6" />
                                </svg>
                            </div>

                            <h2 className="text-2xl font-bold text-white mb-4">Playit.gg Tunnel</h2>

                            {playitChecking ? (
                                <div className="flex items-center justify-center gap-2 text-gray-400 mb-6">
                                    <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                                    <span>Checking availability...</span>
                                </div>
                            ) : playitCode ? (
                                <>
                                    <p className="text-gray-300 mb-4">
                                        Your Playit tunnel code is ready! Click the button below to claim your tunnel.
                                    </p>
                                    <div className="bg-background/50 rounded-lg p-4 mb-6 font-mono text-sm">
                                        <span className="text-primary">Code: </span>
                                        <span className="text-white">{playitCode}</span>
                                    </div>
                                    <button
                                        onClick={openPlayitClaim}
                                        className="w-full bg-primary hover:bg-primary-hover text-black font-bold py-4 px-6 rounded-xl shadow-lg transition-all transform hover:scale-105 flex items-center justify-center gap-3 text-lg"
                                    >
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.19 4.034a2.5 2.5 0 0 1 3.62 0l3.156 3.156a2.5 2.5 0 0 1 0 3.62l-8.96 8.96a2.5 2.5 0 0 1-3.62 0L3.37 12.81a2.5 2.5 0 0 1 0-3.62l3.156-3.156a2.5 2.5 0 0 1 3.62 0L12 5.439l1.19-1.405z" />
                                        </svg>
                                        Go Public
                                    </button>
                                </>
                            ) : (
                                <>
                                    <p className="text-gray-400 mb-2">
                                        {isRunning ? (
                                            playitAvailable ? (
                                                "Waiting for Playit code... Start the server and check the console for the claim code."
                                            ) : (
                                                <>
                                                    Currently not available for this version.
                                                    <br />
                                                    Please use playit.gg manually.
                                                </>
                                            )
                                        ) : (
                                            playitAvailable ? (
                                                "Start the server to generate a Playit tunnel code."
                                            ) : (
                                                <>
                                                    Currently not available for this version.
                                                    <br />
                                                    Please use playit.gg manually.
                                                </>
                                            )
                                        )}
                                    </p>

                                    {!playitAvailable && !playitChecking && (
                                        <button
                                            onClick={installPlayitPlugin}
                                            disabled={isLoading}
                                            className="mt-4 px-6 py-3 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-4"
                                        >
                                            Install Playit Plugin
                                        </button>
                                    )}

                                    <button
                                        onClick={openPlayitClaim}
                                        className="w-full bg-primary/20 hover:bg-primary/30 text-primary font-bold py-4 px-6 rounded-xl transition-all transform hover:scale-105 flex items-center justify-center gap-3 text-lg mt-2"
                                    >
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                        </svg>
                                        PLAYIT.GG
                                    </button>
                                </>
                            )}

                            <p className="text-xs text-gray-600 mt-6">
                                Playit.gg creates a secure tunnel to make your server accessible online without port forwarding.
                            </p>
                        </div>
                    </div>
                )}

                {activeTab === 'charts' && (

                    <div className="flex flex-col h-full">
                        <h2 className="text-lg font-bold text-white mb-4">Server Performance</h2>

                        <div className="bg-surface/40 rounded-xl p-4">
                            <canvas
                                ref={chartsCanvasRef}
                                width={800}
                                height={500}
                                className="w-full h-auto"
                            />
                        </div>

                        <div className="grid grid-cols-3 gap-4 mt-4">
                            <div className="bg-surface/40 rounded-xl p-3 text-center">
                                <div className="text-sm text-gray-400">Avg CPU</div>
                                <div className="text-xl font-bold text-white">
                                    {Math.round(serverStats.history.cpu.reduce((a, b) => a + b, 0) / serverStats.history.cpu.length || 0)}%
                                </div>
                            </div>
                            <div className="bg-surface/40 rounded-xl p-3 text-center">
                                <div className="text-sm text-gray-400">Avg Memory</div>
                                <div className="text-xl font-bold text-white">
                                    {Math.round(serverStats.history.memory.reduce((a, b) => a + b, 0) / serverStats.history.memory.length || 0)} MB
                                </div>
                            </div>
                            <div className="bg-surface/40 rounded-xl p-3 text-center">
                                <div className="text-sm text-gray-400">Peak Players</div>
                                <div className="text-xl font-bold text-white">
                                    {Math.max(...serverStats.history.playerCount, 0)}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'players' && (

                    <div className="flex flex-col h-full">
                        { }
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-white">Player Management</h2>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowWhitelistDialog(true)}
                                    className="px-3 py-1.5 bg-white/5 text-white rounded-lg hover:bg-white/10 transition-colors text-sm flex items-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                    </svg>
                                    Whitelist
                                </button>

                                <input
                                    type="text"
                                    placeholder="Search players..."
                                    onChange={(e) => setPlayerSearch(e.target.value)}
                                    className="bg-background border border-white/10 rounded-lg px-4 py-1.5 text-white text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                />
                            </div>
                        </div>

                        { }
                        {selectedPlayers.length > 0 && (
                            <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 mb-4 flex items-center justify-between">
                                <span className="text-primary text-sm">
                                    {selectedPlayers.length} player(s) selected
                                </span>
                                <div className="flex gap-2 flex-wrap">
                                    <button
                                        onClick={selectAllOnline}
                                        className="px-2 py-1 bg-white/5 text-white rounded text-xs hover:bg-white/10"
                                    >
                                        All Online
                                    </button>
                                    <button
                                        onClick={clearSelection}
                                        className="px-2 py-1 bg-white/5 text-white rounded text-xs hover:bg-white/10"
                                    >
                                        Clear
                                    </button>

                                    { }
                                    <div className="relative">
                                        <button
                                            onClick={() => setShowGamemodeMenu(!showGamemodeMenu)}
                                            className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-xs hover:bg-purple-500/30"
                                        >
                                            Gamemode
                                        </button>
                                        {showGamemodeMenu && (
                                            <div className="absolute right-0 mt-1 bg-surface border border-white/10 rounded-lg shadow-xl z-10">
                                                {['survival', 'creative', 'adventure', 'spectator'].map(mode => (
                                                    <button
                                                        key={mode}
                                                        onClick={() => {
                                                            handleBulkAction('gamemode', mode);
                                                            setShowGamemodeMenu(false);
                                                        }}
                                                        className="block w-full text-left px-4 py-2 text-white hover:bg-white/5 text-sm capitalize"
                                                    >
                                                        {mode}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    { }
                                    <div className="relative">
                                        <button
                                            onClick={() => setShowXpMenu(!showXpMenu)}
                                            className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs hover:bg-yellow-500/30"
                                        >
                                            XP
                                        </button>
                                        {showXpMenu && (
                                            <div className="absolute right-0 mt-1 bg-surface border border-white/10 rounded-lg shadow-xl z-10 p-3 w-48">
                                                <input
                                                    type="number"
                                                    value={xpAmount}
                                                    onChange={(e) => setXpAmount(parseInt(e.target.value) || 0)}
                                                    className="w-full bg-background border border-white/10 rounded px-2 py-1 text-white text-sm mb-2"
                                                    min="0"
                                                />
                                                <select
                                                    value={xpType}
                                                    onChange={(e) => setXpType(e.target.value)}
                                                    className="w-full bg-background border border-white/10 rounded px-2 py-1 text-white text-sm mb-2"
                                                >
                                                    <option value="add">Add XP</option>
                                                    <option value="set">Set XP</option>
                                                    <option value="levels">Add Levels</option>
                                                    <option value="setLevels">Set Levels</option>
                                                </select>
                                                <button
                                                    onClick={() => {
                                                        handleBulkAction('experience');
                                                        setShowXpMenu(false);
                                                    }}
                                                    className="w-full bg-primary/20 text-primary rounded px-2 py-1 text-sm hover:bg-primary/30"
                                                >
                                                    Apply
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        onClick={() => handleBulkAction('kill')}
                                        className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs hover:bg-red-500/30"
                                    >
                                        Kill
                                    </button>
                                    <button
                                        onClick={() => handleBulkAction('heal')}
                                        className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs hover:bg-green-500/30"
                                    >
                                        Heal
                                    </button>
                                    <button
                                        onClick={() => handleBulkAction('feed')}
                                        className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs hover:bg-blue-500/30"
                                    >
                                        Feed
                                    </button>
                                    <button
                                        onClick={() => handleBulkAction('clear')}
                                        className="px-2 py-1 bg-gray-500/20 text-gray-400 rounded text-xs hover:bg-gray-500/30"
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>
                        )}

                        { }
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            { }
                            <div className="mb-6">
                                <h3 className="text-md font-semibold text-white mb-3">
                                    Online ({filteredOnlinePlayers.length})
                                </h3>
                                <div className="grid grid-cols-2 gap-3">
                                    {filteredOnlinePlayers.map(player => (
                                        <div
                                            key={player}
                                            className={`bg-surface/40 rounded-lg p-4 hover:bg-surface/60 transition-colors cursor-pointer ${selectedPlayers.includes(player) ? 'ring-2 ring-primary' : ''
                                                }`}
                                            onClick={() => togglePlayerSelection(player)}
                                        >
                                            <div className="flex items-start justify-between mb-2">
                                                <div>
                                                    <div className="font-bold text-white flex items-center gap-2">
                                                        {player}
                                                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                                                    </div>
                                                    {playerStats[player] && (
                                                        <div className="text-xs text-gray-400">
                                                            Joined: {new Date(playerStats[player].firstSeen).toLocaleDateString()}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex gap-1">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedPlayer(player);
                                                            setShowTeleportDialog(true);
                                                        }}
                                                        className="p-1 hover:bg-blue-500/20 text-blue-400 rounded"
                                                        title="Teleport"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.19 4.034a2.5 2.5 0 0 1 3.62 0l3.156 3.156a2.5 2.5 0 0 1 0 3.62l-8.96 8.96a2.5 2.5 0 0 1-3.62 0L3.37 12.81a2.5 2.5 0 0 1 0-3.62l3.156-3.156a2.5 2.5 0 0 1 3.62 0L12 5.439l1.19-1.405z" />
                                                        </svg>
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedPlayer(player);
                                                            setShowBanDialog(true);
                                                        }}
                                                        className="p-1 hover:bg-red-500/20 text-red-400 rounded"
                                                        title="Ban"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="flex gap-2 flex-wrap mt-2">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        sendPlayerCommand(player, 'kick');
                                                    }}
                                                    className="px-2 py-1 bg-orange-500/20 text-orange-400 rounded text-xs hover:bg-orange-500/30"
                                                >
                                                    Kick
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        sendPlayerCommand(player, 'op');
                                                    }}
                                                    className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-xs hover:bg-purple-500/30"
                                                >
                                                    OP
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        sendPlayerCommand(player, 'heal');
                                                    }}
                                                    className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs hover:bg-green-500/30"
                                                >
                                                    Heal
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        sendPlayerCommand(player, 'feed');
                                                    }}
                                                    className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs hover:bg-blue-500/30"
                                                >
                                                    Feed
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedPlayer(player);
                                                        setShowGiveDialog(true);
                                                    }}
                                                    className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs hover:bg-yellow-500/30"
                                                >
                                                    Give
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        sendPlayerCommand(player, 'gamemode', 'creative');
                                                    }}
                                                    className="px-2 py-1 bg-indigo-500/20 text-indigo-400 rounded text-xs hover:bg-indigo-500/30"
                                                >
                                                    Creative
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        sendPlayerCommand(player, 'gamemode', 'survival');
                                                    }}
                                                    className="px-2 py-1 bg-gray-500/20 text-gray-400 rounded text-xs hover:bg-gray-500/30"
                                                >
                                                    Survival
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {filteredOnlinePlayers.length === 0 && (
                                        <div className="col-span-2 text-center py-8 text-gray-500">
                                            No players online
                                        </div>
                                    )}
                                </div>
                            </div>

                            { }
                            <div>
                                <h3 className="text-md font-semibold text-white mb-3">
                                    Recently Online ({filteredOfflinePlayers.length})
                                </h3>
                                <div className="grid grid-cols-2 gap-3">
                                    {filteredOfflinePlayers.map(({ name, lastSeen }) => (
                                        <div
                                            key={name}
                                            className={`bg-surface/40 rounded-lg p-4 hover:bg-surface/60 transition-colors cursor-pointer ${selectedPlayers.includes(name) ? 'ring-2 ring-primary' : ''
                                                }`}
                                            onClick={() => togglePlayerSelection(name)}
                                        >
                                            <div className="flex items-start justify-between mb-2">
                                                <div>
                                                    <div className="font-bold text-white">
                                                        {name}
                                                    </div>
                                                    {lastSeen && (
                                                        <div className="text-xs text-gray-400">
                                                            Last seen: {new Date(lastSeen).toLocaleString()}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex gap-1">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedPlayer(name);
                                                            setShowWhitelistDialog(true);
                                                        }}
                                                        className="p-1 hover:bg-green-500/20 text-green-400 rounded"
                                                        title="Add to whitelist"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                                        </svg>
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedPlayer(name);
                                                            setShowBanDialog(true);
                                                        }}
                                                        className="p-1 hover:bg-red-500/20 text-red-400 rounded"
                                                        title="Ban"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="flex gap-2 flex-wrap mt-2">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        sendPlayerCommand(name, 'pardon');
                                                    }}
                                                    className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs hover:bg-green-500/30"
                                                >
                                                    Unban
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        sendPlayerCommand(name, 'whitelist_add');
                                                    }}
                                                    className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs hover:bg-blue-500/30"
                                                >
                                                    Whitelist
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {filteredOfflinePlayers.length === 0 && (
                                        <div className="col-span-2 text-center py-8 text-gray-500">
                                            No players have joined yet
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'mods' && (
                    <div className="flex flex-col h-full">
                        <div className="mb-4">
                            <h2 className="text-lg font-bold text-white mb-3">{getModTabName()} Management</h2>

                            <div className="flex gap-2 mb-4">
                                <input
                                    type="text"
                                    value={modSearch}
                                    onChange={(e) => setModSearch(e.target.value)}
                                    placeholder={`Search ${getModTabName().toLowerCase()}...`}
                                    className="flex-1 bg-background border border-white/10 rounded-lg px-4 py-2 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                    onKeyUp={(e) => {
                                        if (e.key === 'Enter') {
                                            searchMods(modSearch);
                                        }
                                    }}
                                />
                                <button
                                    onClick={() => searchMods(modSearch)}
                                    disabled={isSearchingMods || !modSearch.trim()}
                                    className="px-6 py-2 bg-primary/20 text-primary rounded-lg font-bold hover:bg-primary/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isSearchingMods ? 'Searching...' : 'Search'}
                                </button>
                            </div>

                            {modSearchResults.length > 0 && (
                                <div className="flex-1 overflow-y-auto custom-scrollbar">
                                    <div className="grid grid-cols-1 gap-3">
                                        {modSearchResults.map(result => (
                                            <div key={result.project_id} className="bg-surface/40 rounded-lg p-4 hover:bg-surface/60 transition-colors">
                                                <div className="flex items-start justify-between mb-2">
                                                    <div className="flex-1">
                                                        <h3 className="font-bold text-white text-lg">{result.title}</h3>
                                                        <p className="text-gray-400 text-sm line-clamp-2">{result.description}</p>
                                                        <div className="flex gap-2 mt-2 flex-wrap">
                                                            <span className="text-xs bg-white/10 px-2 py-1 rounded text-gray-300">
                                                                Downloads: {Math.floor(result.downloads / 1000)}K
                                                            </span>
                                                            <span className="text-xs bg-white/10 px-2 py-1 rounded text-gray-300">
                                                                ⭐ {result.follows > 0 ? Math.floor(result.follows / 100) : '0'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    {result.icon_url && (
                                                        <img
                                                            src={result.icon_url}
                                                            alt={result.title}
                                                            className="w-16 h-16 rounded-lg object-cover ml-4"
                                                        />
                                                    )}
                                                </div>

                                                <div className="mt-3 flex gap-2">
                                                    <select
                                                        value={selectedModVersion[result.project_id] || ''}
                                                        onChange={(e) => {
                                                            setSelectedModVersion(prev => ({
                                                                ...prev,
                                                                [result.project_id]: e.target.value
                                                            }));
                                                        }}
                                                        onClick={() => {
                                                            if (!modVersions[result.project_id]) {
                                                                loadModVersions(result.project_id);
                                                            }
                                                        }}
                                                        className="flex-1 bg-background border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                                    >
                                                        <option value="">
                                                            {loadingVersions.has(result.project_id) ? 'Loading versions...' : 'Select version...'}
                                                        </option>
                                                        {modVersions[result.project_id] && modVersions[result.project_id].map(version => (
                                                            <option key={version.id} value={version.id}>
                                                                {version.version_number}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <button
                                                        onClick={() => installMod(result.project_id, selectedModVersion[result.project_id], result.title)}
                                                        disabled={isInstallingMod || !selectedModVersion[result.project_id]}
                                                        className="px-6 py-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-bold text-sm"
                                                    >
                                                        {isInstallingMod ? 'Installing...' : 'Install'}
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {modSearch && !isSearchingMods && modSearchResults.length === 0 && (
                                <div className="flex items-center justify-center h-48 text-gray-400">
                                    No {getModTabName().toLowerCase()} found matching your search
                                </div>
                            )}

                            {!modSearch && modSearchResults.length === 0 && (
                                <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                                    <p>Search for {getModTabName().toLowerCase()} to install</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'properties' && (
                    <div className="flex flex-col h-full">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-white">Server Properties</h2>
                            <button
                                onClick={saveServerProperties}
                                disabled={isSavingProperties}
                                className="px-4 py-2 bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition-colors font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {isSavingProperties ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                                        Saving...
                                    </>
                                ) : (
                                    'Save Properties'
                                )}
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-6">
                                {/* Server Settings */}
                                <div className="bg-surface/40 rounded-xl p-4 md:col-span-2">
                                    <h3 className="font-bold text-white mb-4">Server Settings</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className="text-sm text-gray-400 block mb-2">Max Players</label>
                                            <input
                                                type="number"
                                                value={serverProperties['max-players'] || '20'}
                                                onChange={(e) => updateProperty('max-players', e.target.value)}
                                                className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm text-gray-400 block mb-2">MOTD</label>
                                            <input
                                                type="text"
                                                value={serverProperties['motd'] || 'A Minecraft Server'}
                                                onChange={(e) => updateProperty('motd', e.target.value)}
                                                className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm text-gray-400 block mb-2">Server Port</label>
                                            <input
                                                type="number"
                                                value={serverProperties['server-port'] || '25565'}
                                                onChange={(e) => updateProperty('server-port', e.target.value)}
                                                className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm text-gray-400 block mb-2">View Distance</label>
                                            <input
                                                type="number"
                                                value={serverProperties['view-distance'] || '10'}
                                                onChange={(e) => updateProperty('view-distance', e.target.value)}
                                                className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm text-gray-400 block mb-2">Simulation Distance</label>
                                            <input
                                                type="number"
                                                value={serverProperties['simulation-distance'] || '10'}
                                                onChange={(e) => updateProperty('simulation-distance', e.target.value)}
                                                className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm text-gray-400 block mb-2">Spawn Protection</label>
                                            <input
                                                type="number"
                                                value={serverProperties['spawn-protection'] || '16'}
                                                onChange={(e) => updateProperty('spawn-protection', e.target.value)}
                                                className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Gameplay Settings */}
                                <div className="bg-surface/40 rounded-xl p-4">
                                    <h3 className="font-bold text-white mb-4">Gameplay</h3>
                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-sm text-gray-400 block mb-2">Difficulty</label>
                                            <select
                                                value={serverProperties['difficulty'] || 'easy'}
                                                onChange={(e) => updateProperty('difficulty', e.target.value)}
                                                className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                            >
                                                <option value="peaceful">Peaceful</option>
                                                <option value="easy">Easy</option>
                                                <option value="normal">Normal</option>
                                                <option value="hard">Hard</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-sm text-gray-400 block mb-2">Gamemode</label>
                                            <select
                                                value={serverProperties['gamemode'] || 'survival'}
                                                onChange={(e) => updateProperty('gamemode', e.target.value)}
                                                className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                            >
                                                <option value="survival">Survival</option>
                                                <option value="creative">Creative</option>
                                                <option value="adventure">Adventure</option>
                                                <option value="spectator">Spectator</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-sm text-gray-400 block mb-2">Level Name</label>
                                            <input
                                                type="text"
                                                value={serverProperties['level-name'] || 'world'}
                                                onChange={(e) => updateProperty('level-name', e.target.value)}
                                                className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm text-gray-400 block mb-2">Level Seed</label>
                                            <input
                                                type="text"
                                                value={serverProperties['level-seed'] || ''}
                                                onChange={(e) => updateProperty('level-seed', e.target.value)}
                                                className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                                placeholder="Leave empty for random"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm text-gray-400 block mb-2">Op Permission Level</label>
                                            <select
                                                value={serverProperties['op-permission-level'] || '4'}
                                                onChange={(e) => updateProperty('op-permission-level', e.target.value)}
                                                className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                            >
                                                <option value="1">1 - Bypass user protection</option>
                                                <option value="2">2 - Use /clear, /difficulty, /effect, /gamemode, /gamerule, /give, /setblock, /tellraw</option>
                                                <option value="3">3 - Use /ban, /deop, /kick, /op</option>
                                                <option value="4">4 - Use /stop</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* World Settings */}
                                <div className="bg-surface/40 rounded-xl p-4">
                                    <h3 className="font-bold text-white mb-4">World</h3>
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <label className="text-sm text-gray-400">Generate Structures</label>
                                            <input
                                                type="checkbox"
                                                checked={serverProperties['generate-structures'] === 'true' || serverProperties['generate-structures'] === true}
                                                onChange={(e) => updateProperty('generate-structures', e.target.checked ? 'true' : 'false')}
                                                className="w-4 h-4 rounded"
                                            />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <label className="text-sm text-gray-400">Hardcore</label>
                                            <input
                                                type="checkbox"
                                                checked={serverProperties['hardcore'] === 'true' || serverProperties['hardcore'] === true}
                                                onChange={(e) => updateProperty('hardcore', e.target.checked ? 'true' : 'false')}
                                                className="w-4 h-4 rounded"
                                            />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <label className="text-sm text-gray-400">PVP</label>
                                            <input
                                                type="checkbox"
                                                checked={serverProperties['pvp'] === 'true' || serverProperties['pvp'] === true}
                                                onChange={(e) => updateProperty('pvp', e.target.checked ? 'true' : 'false')}
                                                className="w-4 h-4 rounded"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Network Settings */}
                                <div className="bg-surface/40 rounded-xl p-4">
                                    <h3 className="font-bold text-white mb-4">Network</h3>
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <label className="text-sm text-gray-400">Online Mode</label>
                                            <input
                                                type="checkbox"
                                                checked={serverProperties['online-mode'] === 'true' || serverProperties['online-mode'] === true}
                                                onChange={(e) => updateProperty('online-mode', e.target.checked ? 'true' : 'false')}
                                                className="w-4 h-4 rounded"
                                            />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <label className="text-sm text-gray-400">Enforce Secure Profile</label>
                                            <input
                                                type="checkbox"
                                                checked={serverProperties['enforce-secure-profile'] === 'true' || serverProperties['enforce-secure-profile'] === true}
                                                onChange={(e) => updateProperty('enforce-secure-profile', e.target.checked ? 'true' : 'false')}
                                                className="w-4 h-4 rounded"
                                            />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <label className="text-sm text-gray-400">Prevent Proxy Connections</label>
                                            <input
                                                type="checkbox"
                                                checked={serverProperties['prevent-proxy-connections'] === 'true' || serverProperties['prevent-proxy-connections'] === true}
                                                onChange={(e) => updateProperty('prevent-proxy-connections', e.target.checked ? 'true' : 'false')}
                                                className="w-4 h-4 rounded"
                                            />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <label className="text-sm text-gray-400">Use Native Transport</label>
                                            <input
                                                type="checkbox"
                                                checked={serverProperties['use-native-transport'] === 'true' || serverProperties['use-native-transport'] === true}
                                                onChange={(e) => updateProperty('use-native-transport', e.target.checked ? 'true' : 'false')}
                                                className="w-4 h-4 rounded"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm text-gray-400 block mb-2">Network Compression Threshold</label>
                                            <input
                                                type="number"
                                                value={serverProperties['network-compression-threshold'] || '256'}
                                                onChange={(e) => updateProperty('network-compression-threshold', e.target.value)}
                                                className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Player Settings */}
                                <div className="bg-surface/40 rounded-xl p-4">
                                    <h3 className="font-bold text-white mb-4">Players</h3>
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <label className="text-sm text-gray-400">Whitelist</label>
                                            <input
                                                type="checkbox"
                                                checked={serverProperties['white-list'] === 'true' || serverProperties['white-list'] === true}
                                                onChange={(e) => updateProperty('white-list', e.target.checked ? 'true' : 'false')}
                                                className="w-4 h-4 rounded"
                                            />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <label className="text-sm text-gray-400">Enforce Whitelist</label>
                                            <input
                                                type="checkbox"
                                                checked={serverProperties['enforce-whitelist'] === 'true' || serverProperties['enforce-whitelist'] === true}
                                                onChange={(e) => updateProperty('enforce-whitelist', e.target.checked ? 'true' : 'false')}
                                                className="w-4 h-4 rounded"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm text-gray-400 block mb-2">Player Idle Timeout (minutes, 0=disabled)</label>
                                            <input
                                                type="number"
                                                value={serverProperties['player-idle-timeout'] || '0'}
                                                onChange={(e) => updateProperty('player-idle-timeout', e.target.value)}
                                                className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Advanced Settings */}
                                <div className="bg-surface/40 rounded-xl p-4 md:col-span-2">
                                    <h3 className="font-bold text-white mb-4">Advanced Settings</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="flex items-center justify-between col-span-1">
                                            <label className="text-sm text-gray-400">Enable RCON</label>
                                            <input
                                                type="checkbox"
                                                checked={serverProperties['enable-rcon'] === 'true' || serverProperties['enable-rcon'] === true}
                                                onChange={(e) => updateProperty('enable-rcon', e.target.checked ? 'true' : 'false')}
                                                className="w-4 h-4 rounded"
                                            />
                                        </div>
                                        <div className="flex items-center justify-between col-span-1">
                                            <label className="text-sm text-gray-400">Enable Query</label>
                                            <input
                                                type="checkbox"
                                                checked={serverProperties['enable-query'] === 'true' || serverProperties['enable-query'] === true}
                                                onChange={(e) => updateProperty('enable-query', e.target.checked ? 'true' : 'false')}
                                                className="w-4 h-4 rounded"
                                            />
                                        </div>
                                        <div className="flex items-center justify-between col-span-1">
                                            <label className="text-sm text-gray-400">Broadcast Console to Ops</label>
                                            <input
                                                type="checkbox"
                                                checked={serverProperties['broadcast-console-to-ops'] === 'true' || serverProperties['broadcast-console-to-ops'] === true}
                                                onChange={(e) => updateProperty('broadcast-console-to-ops', e.target.checked ? 'true' : 'false')}
                                                className="w-4 h-4 rounded"
                                            />
                                        </div>
                                        <div className="flex items-center justify-between col-span-1">
                                            <label className="text-sm text-gray-400">Broadcast RCON to Ops</label>
                                            <input
                                                type="checkbox"
                                                checked={serverProperties['broadcast-rcon-to-ops'] === 'true' || serverProperties['broadcast-rcon-to-ops'] === true}
                                                onChange={(e) => updateProperty('broadcast-rcon-to-ops', e.target.checked ? 'true' : 'false')}
                                                className="w-4 h-4 rounded"
                                            />
                                        </div>
                                        <div className="flex items-center justify-between col-span-1">
                                            <label className="text-sm text-gray-400">Allow Flight</label>
                                            <input
                                                type="checkbox"
                                                checked={serverProperties['allow-flight'] === 'true' || serverProperties['allow-flight'] === true}
                                                onChange={(e) => updateProperty('allow-flight', e.target.checked ? 'true' : 'false')}
                                                className="w-4 h-4 rounded"
                                            />
                                        </div>
                                        <div className="flex items-center justify-between col-span-1">
                                            <label className="text-sm text-gray-400">Enable Status</label>
                                            <input
                                                type="checkbox"
                                                checked={serverProperties['enable-status'] === 'true' || serverProperties['enable-status'] === true}
                                                onChange={(e) => updateProperty('enable-status', e.target.checked ? 'true' : 'false')}
                                                className="w-4 h-4 rounded"
                                            />
                                        </div>
                                        <div className="flex items-center justify-between col-span-1">
                                            <label className="text-sm text-gray-400">Force Gamemode</label>
                                            <input
                                                type="checkbox"
                                                checked={serverProperties['force-gamemode'] === 'true' || serverProperties['force-gamemode'] === true}
                                                onChange={(e) => updateProperty('force-gamemode', e.target.checked ? 'true' : 'false')}
                                                className="w-4 h-4 rounded"
                                            />
                                        </div>
                                        <div className="flex items-center justify-between col-span-1">
                                            <label className="text-sm text-gray-400">Log IPs</label>
                                            <input
                                                type="checkbox"
                                                checked={serverProperties['log-ips'] === 'true' || serverProperties['log-ips'] === true}
                                                onChange={(e) => updateProperty('log-ips', e.target.checked ? 'true' : 'false')}
                                                className="w-4 h-4 rounded"
                                            />
                                        </div>
                                        <div className="flex items-center justify-between col-span-1">
                                            <label className="text-sm text-gray-400">Require Resource Pack</label>
                                            <input
                                                type="checkbox"
                                                checked={serverProperties['require-resource-pack'] === 'true' || serverProperties['require-resource-pack'] === true}
                                                onChange={(e) => updateProperty('require-resource-pack', e.target.checked ? 'true' : 'false')}
                                                className="w-4 h-4 rounded"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm text-gray-400 block mb-2">Max Tick Time (ms)</label>
                                            <input
                                                type="number"
                                                value={serverProperties['max-tick-time'] || '60000'}
                                                onChange={(e) => updateProperty('max-tick-time', e.target.value)}
                                                className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm text-gray-400 block mb-2">RCON Port</label>
                                            <input
                                                type="number"
                                                value={serverProperties['rcon.port'] || '25575'}
                                                onChange={(e) => updateProperty('rcon.port', e.target.value)}
                                                className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm text-gray-400 block mb-2">Query Port</label>
                                            <input
                                                type="number"
                                                value={serverProperties['query.port'] || '25565'}
                                                onChange={(e) => updateProperty('query.port', e.target.value)}
                                                className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default ServerDetails;