# Process Monitor Extension

Welcome to the **Process Monitor** extension for MCLC! 🚀

## Overview

The Process Monitor is a lightweight, built-in extension for the MCLC Launcher that allows you to keep an eye on your system resources while playing Minecraft. It seamlessly integrates into your launcher and provides real-time statistics for your active game instances.

## Features

- **Real-time CPU Usage:** Track how much processing power your active Minecraft instance is consuming.
- **Real-time RAM Usage:** Monitor the memory allocation and usage of your game in megabytes (MB).
- **Seamless Integration:** Displays stats directly on the instance card while the game is running.
- **Lightweight:** Negligible impact on system performance.

## How it works

Once enabled, the extension communicates securely with the MCLC Backend using inter-process communication (IPC) to fetch the latest process statistics (PID). These stats are dynamically updated on the frontend UI without any stuttering or lag.

## Installation

If you are a developer looking to use this as a template, simply:
1. Ensure this folder (`sample-extension`) is present in your MCLC extensions directory.
2. Go to the **Extensions** tab in the MCLC Launcher.
3. Enable the **Process Monitor** extension.
4. Launch any Minecraft instance to see the stats in action!
