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
        players: []
    });

    const consoleRef = useRef(null);

    useEffect(() => {
        // Load console history
        loadConsoleLog();

        // Subscribe to console output
        const removeListener = window.electronAPI.onServerLog?.(({ serverName, line }) => {
            if (serverName === server.name) {
                setConsoleLog(prev => [...prev, line].slice(-100));
            }
        });

        // Subscribe to server stats
        const removeStatsListener = window.electronAPI.onServerStats?.(({ serverName, stats }) => {
            if (serverName === server.name) {
                setServerStats(stats || { cpu: 0, memory: 0, players: [] });
            }
        });

        // Subscribe to EULA required event (if available)
        const removeEulaListener = window.electronAPI.onServerEulaRequired?.(({ serverName }) => {
            if (serverName === server.name) {
                setShowEulaDialog(true);
            }
        });

        // Get initial stats
        loadServerStats();

        return () => {
            if (removeListener) removeListener();
            if (removeStatsListener) removeStatsListener();
            if (removeEulaListener) removeEulaListener();
        };
    }, [server.name]);

    // Auto-scroll console to bottom when new lines arrive
    useEffect(() => {
        if (consoleRef.current) {
            consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
        }
    }, [consoleLog]);

    const loadConsoleLog = async () => {
        try {
            const log = await window.electronAPI.getServerLogs?.(server.name) || [];
            setConsoleLog(log);
        } catch (error) {
            console.error('Failed to load console log:', error);
        }
    };

    const loadServerStats = async () => {
        try {
            const stats = await window.electronAPI.getServerStats?.(server.name);
            setServerStats(stats || { cpu: 0, memory: 0, players: [] });
        } catch (error) {
            console.error('Failed to load server stats:', error);
        }
    };

    const handleSendCommand = async (e) => {
        e.preventDefault();
        if (!command.trim()) return;

        try {
            await window.electronAPI.sendServerCommand?.(server.name, command);
            setCommand('');
        } catch (error) {
            console.error('Failed to send command:', error);
            addNotification('Failed to send command', 'error');
        }
    };

    const checkEulaStatus = async () => {
        // Prüfe ob die EULA-Funktionen verfügbar sind
        if (!window.electronAPI.checkServerEula) {
            console.warn('EULA check not available, proceeding without check');
            return true; // Proceed without EULA check
        }

        try {
            return await window.electronAPI.checkServerEula(server.name);
        } catch (error) {
            console.error('Failed to check EULA:', error);
            return true; // Bei Fehler trotzdem fortfahren
        }
    };

    const handleStart = async () => {
        // Prüfe EULA-Status
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
            await window.electronAPI.startServer?.(server.name);
            addNotification(`Starting server ${server.name}...`, 'info');
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
            await window.electronAPI.stopServer?.(server.name);
            addNotification(`Stopping server ${server.name}...`, 'info');
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
            await window.electronAPI.restartServer?.(server.name);
            addNotification(`Restarting server ${server.name}...`, 'info');
        } catch (error) {
            console.error('Failed to restart server:', error);
            addNotification(`Failed to restart server: ${error.message}`, 'error');
        } finally {
            setIsLoading(false);
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

    const status = runningInstances[server.name] || 'stopped';
    const isRunning = status === 'running';
    const isStarting = status === 'starting';
    const isStopping = status === 'stopping';

    // Safe access to serverStats with fallback
    const players = serverStats?.players || [];
    const cpu = serverStats?.cpu || 0;
    const memory = serverStats?.memory || 0;

    return (
        <div className="h-full flex flex-col">
            {isLoading && <LoadingOverlay message="Processing..." />}

            {/* EULA Dialog */}
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
                                https://aka.ms/MinecraftEULA
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

            {/* Header */}
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
                        isStarting ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-gray-500/20 text-gray-400'
                        }`}>
                        <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-green-500 animate-pulse' :
                            isStarting ? 'bg-yellow-500 animate-pulse' :
                                'bg-gray-500'
                            }`}></div>
                        {isRunning ? 'Running' : isStarting ? 'Starting...' : isStopping ? 'Stopping...' : 'Stopped'}
                    </div>

                    {!isRunning && !isStarting && !isStopping && (
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

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-4 p-6 border-b border-white/5">
                <div className="bg-surface/40 rounded-xl p-4">
                    <div className="text-gray-400 text-sm mb-1">Players</div>
                    <div className="text-2xl font-bold text-white">
                        {players.length || 0}/{server.maxPlayers || 20}
                    </div>
                    {players.length > 0 && (
                        <div className="mt-2 text-xs text-gray-400">
                            {players.join(', ')}
                        </div>
                    )}
                </div>
                <div className="bg-surface/40 rounded-xl p-4">
                    <div className="text-gray-400 text-sm mb-1">CPU Usage</div>
                    <div className="text-2xl font-bold text-white">{cpu}%</div>
                </div>
                <div className="bg-surface/40 rounded-xl p-4">
                    <div className="text-gray-400 text-sm mb-1">Memory Usage</div>
                    <div className="text-2xl font-bold text-white">
                        {Math.round((memory || 0) / 1024 / 1024)} MB
                    </div>
                </div>
            </div>

            {/* Console */}
            <div className="flex-1 p-6 flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-bold text-white">Console</h2>
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
                <div
                    ref={consoleRef}
                    className="flex-1 bg-black/40 rounded-xl p-4 font-mono text-sm overflow-y-auto custom-scrollbar mb-4 select-text"
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
                        type="text"
                        value={command}
                        onChange={(e) => setCommand(e.target.value)}
                        placeholder="Enter command..."
                        className="flex-1 bg-background border border-white/10 rounded-xl px-4 py-2 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                        disabled={!isRunning}
                    />
                    <button
                        type="submit"
                        disabled={!isRunning || !command.trim()}
                        className="px-6 py-2 bg-primary/20 text-primary rounded-xl font-bold hover:bg-primary/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Send
                    </button>
                </form>
            </div>
        </div>
    );
}

export default ServerDetails;