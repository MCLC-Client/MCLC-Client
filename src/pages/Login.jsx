import React, { useState } from 'react';

function Login({ onLoginSuccess }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleLogin = async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await window.electronAPI.login();
            if (result.success) {
                onLoginSuccess(result.profile);
            } else {
                setError(result.error || 'Login failed');
            }
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex h-full items-center justify-center bg-background">
            <div className="w-full max-w-md p-8 bg-surface rounded-lg shadow-xl border border-gray-800 text-center">
                <h1 className="text-3xl font-bold mb-2 text-primary">Minecraft Launcher</h1>
                <p className="text-gray-400 mb-8">Sign in with your Microsoft Account</p>

                {error && (
                    <div className="mb-4 p-3 bg-red-900/20 border border-red-500/50 rounded text-red-200 text-sm">
                        {error}
                    </div>
                )}

                <button
                    onClick={handleLogin}
                    disabled={loading}
                    className={`w-full py-3 px-4 rounded font-bold text-white transition-all transform hover:scale-[1.02] ${loading ? 'bg-gray-600 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500 shadow-lg shadow-green-900/20'
                        }`}
                >
                    {loading ? 'Logging in...' : 'Sign in with Microsoft'}
                </button>
            </div>
        </div>
    );
}

export default Login;
