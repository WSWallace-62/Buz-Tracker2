# BuzTracker - Time & Expense Tracker

A local-first Progressive Web App (PWA) for tracking time and managing projects. Built with modern web technologies and designed to work offline.

## Features

- ⏱️ **Real-time Stopwatch** - Start/stop time tracking with persistent state
- 📊 **Project Management** - Create, edit, archive, and delete projects with color coding
- 📅 **Session Management** - View, edit, and delete time sessions
- 📈 **Analytics & Charts** - Visual reports with customizable date ranges and grouping
- 📱 **Progressive Web App** - Installable, works offline, responsive design
- 💾 **Local Storage** - All data stored locally using IndexedDB
- 📤 **Import/Export** - Backup and restore your data
- ⌨️ **Keyboard Shortcuts** - Efficient navigation and control
- ♿ **Accessibility** - Screen reader friendly with proper ARIA labels

## Technology Stack

- **Frontend**: React 18 + TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Database**: IndexedDB via Dexie
- **Charts**: Chart.js with react-chartjs-2
- **Build Tool**: Vite
- **PWA**: Vite PWA plugin with Workbox
- **Testing**: Vitest
- **Date/Time**: Day.js with timezone support

## Getting Started

### Prerequisites

- Node.js 16+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd buztracker
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:5173`

### Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

### Running Tests

```bash
npm run test
```

## Usage

### Basic Time Tracking

1. Select or create a project using the dropdown
2. Click "Start" to begin tracking time
3. Click "Stop" to end the session
4. View your sessions in the table below

### Keyboard Shortcuts

- `Ctrl+1` - Switch to Time Tracker tab
- `Ctrl+2` - Switch to History tab  
- `Ctrl+3` - Switch to Settings tab
- `Ctrl+N` - Add new time entry
- `Space` - Start/stop timer (when stopwatch is focused)
- `Enter` - Submit forms
- `Escape` - Close modals

### Project Management

- Use the "Manage Projects" option in the project dropdown
- Create new projects with custom names and colors
- Archive projects to hide them from the main list
- Delete projects (this will also delete all associated time sessions)

### Data Management

- **Export**: Download a JSON backup of all your data
- **Import**: Restore data from a backup file
- All data is stored locally in your browser
- No data is sent to external servers

### PWA Installation

- Look for the "Install App" button in the header
- Or use your browser's install prompt
- The app works fully offline once installed

## Development

### Project Structure

```
src/
├── components/          # React components
├── store/              # Zustand stores
├── db/                 # Dexie database setup
├── utils/              # Utility functions
├── pwa/                # PWA-related components
├── __tests__/          # Test files
├── App.tsx             # Main app component
├── main.tsx            # Entry point
└── styles.css          # Global styles
```

### Key Components

- `Stopwatch` - Main timer component with start/stop functionality
- `ProjectSelect` - Project selection dropdown
- `SessionsTable` - Display and manage time sessions
- `HistoryPanel` - Analytics and filtering
- `ProjectManagerModal` - Project CRUD operations

### Data Models

```typescript
Project {
  id: number
  name: string
  color: string
  createdAt: number
  archived: boolean
}

Session {
  id: number
  projectId: number
  start: number (epoch ms)
  stop: number | null
  durationMs: number
  note?: string
  createdAt: number
}
```

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Run the test suite
6. Submit a pull request

## License

MIT License - see LICENSE file for details

## Browser Support

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

IndexedDB and PWA features require modern browsers.