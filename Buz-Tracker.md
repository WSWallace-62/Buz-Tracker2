# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BuzTracker is a time tracking and project management Progressive Web App (PWA) built with React + TypeScript. It is evolving from a strictly local-first application using IndexedDB for storage to integrating Firebase Firestore to allow for saving and accessing session data across multiple devices. The aim is to maintain strong offline capabilities where possible, with data synchronization handled in the background.

## Development Setup

1. Install dependencies: `npm install`2. Configure Firebase: Set up a Firebase project and update the configuration in `src/firebase.ts`.
2. Start dev server: `npm run dev`
3. Build for production: `npm run build`
4. Run tests: `npm run test`
5. Lint code: `npm run lint`

## Architecture

- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **State Management**: Zustand stores (projects, sessions, ui)
- **Database**: IndexedDB via Dexie with offline-first design
- **Database**: Integrating Firebase Firestore for cloud storage alongside IndexedDB for offline access.
- **Charts**: Chart.js with react-chartjs-2
- **Testing**: Vitest with jsdom environment

### Key Components

- `Stopwatch` - Main timer with persistent running state
- `ProjectSelect` - Project dropdown with management
- `SessionsTable` - Time sessions display and editing
- `HistoryPanel` - Analytics with filtering and charts
- `ImportExport` - Data backup and restore

### Data Models

- `Project`: id, name, color, createdAt, archived
- `Session`: id, projectId, start, stop, durationMs, note, createdAt
- `RunningSession`: running, projectId, startTs (persists across refreshes)

## Common Commands

- `npm run dev` - Start development server with PWA enabled
- `npm run build` - Build for production with PWA manifest
- `npm run test` - Run unit tests for utils and database
- `npm run lint` - ESLint with TypeScript and React rules
- `npm run preview` - Preview production build locally

## Key Features Implementation

- **Timer Persistence**: Running sessions survive browser refresh/close
- **Offline First**: All data stored in IndexedDB, no server required  
- **PWA Install**: Service worker caches app for offline use
- **Keyboard Shortcuts**: Ctrl+1/2/3 for tabs, Space for timer, Ctrl+N for add entry
- **Import/Export**: JSON backup system for data portability
- **Accessibility**: ARIA labels, keyboard navigation, screen reader support

## Development Notes

- Time calculations use timestamps, not intervals, for accuracy
- Database migrations handled by Dexie version management
- Charts responsive with mobile breakpoints
- Service worker auto-updates via Vite PWA plugin
- All modals use proper focus management and escape handling