import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { NotificationProvider } from './context/NotificationContext'
import './index.css'

// Expose React to window for extensions
window.React = React
window.ReactDOM = ReactDOM


ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <NotificationProvider>
            <App />
        </NotificationProvider>
    </React.StrictMode>,
)