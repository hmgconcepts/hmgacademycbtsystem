# Anti-Cheat Configuration Guide

## Overview
Teachers can selectively enable/disable individual anti-cheat features per exam.

## Features

| Feature | Toggle Label | What It Detects | Student Impact When ON |
|---------|-------------|-----------------|----------------------|
| Tab Switch Detection | 🔄 Tab Switch | Student switches to another tab/app | Warning overlay appears, logged to teacher |
| Window Blur | 🪟 Window Focus | Student clicks outside the exam window | Warning logged |
| Copy/Paste Block | 📋 Copy/Paste | Ctrl+C/V/X/A, right-click copy | Blocked entirely |
| Right-Click Block | 🖱 Right-Click | Context menu attempt | Menu prevented |
| Fullscreen Enforce | 🖥 Fullscreen | Student exits fullscreen | Warning + re-enter prompt |
| DevTools Detection | 🔧 DevTools | F12, Ctrl+Shift+I, window gap detection | Auto-submit after 10s countdown |
| Face Proctoring | 📸 Camera | Multiple faces, no face, periodic snapshots | Photo capture before exam starts |
| Audio Monitoring | 🎤 Microphone | Loud/vocal audio spikes | Warning overlay |
| Watermark Overlay | 💧 Watermark | — | Student identity shown on screen |

## Violation Limit
- Default: 3 violations before auto-submit
- Range: 1-10 (set to 0 to disable auto-submit)

## Use Cases

### Low-Stakes Quiz (Relaxed)
Disable: Face Proctoring, Audio Monitoring, DevTools Detection
Enable: Tab Switch, Copy/Paste Block, Fullscreen
Violation Limit: 5

### High-Stakes Terminal Exam (Strict)
Enable: ALL features
Violation Limit: 3

### Practice/Revision Mode (Minimal)
Disable: ALL features
No violation limit
