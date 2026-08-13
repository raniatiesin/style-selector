# Gross Gauntlet Components

This directory contains all components for the Gross Gauntlet streaming overlay and control panel system.

## Structure

### Core Components
- **GrossGauntletApp.jsx** - Main OBS overlay component with real-time timer display
- **GrossGauntletControl.jsx** - Control panel for managing stream state, OBS scenes, and tasks
- **GrossGauntletRouter.jsx** - React Router configuration for log viewing pages

### Page Components
- **LogIndex.jsx** - Index page showing all historical logs
- **LogView.jsx** - Single log view with session list
- **SessionView.jsx** - Individual session view with tasks and metrics
- **TasksEditor.jsx** - Task management interface
- **ReplayScrubber.jsx** - Phase 2 placeholder for event timeline replay

### Overlay Components
- **TasksOverlay.jsx** - Isolated OBS overlay for task display (no drag-and-drop dependencies)

### Shared Resources
- **utils.js** - Shared utility functions (date formatting, time formatting, localStorage helpers)
- **constants.js** - Centralized constants (storage keys, OBS config, polling intervals, task statuses)
- **variables.css** - Shared CSS variables and color palette
- **GrossGauntletApp.css** - Main overlay styles
- **GrossGauntletPages.css** - Page component styles
- **TasksOverlay.css** - Task overlay styles

## Key Features

### Timer System
- Real-time work session tracking with requestAnimationFrame for smooth updates
- Support for work, break, explain, standby, and minecraft modes
- Pause/resume functionality with proper timestamp handling
- Daily work target (10 hours) with progress visualization
- Accumulated hours tracking across multiple days

### OBS Integration
- WebSocket connection to OBS for scene switching
- Automatic scene synchronization based on mode changes
- Recording filename formatting for explain sessions
- Manual scene override controls

### Task Management
- Real-time task display in overlay
- Task status tracking (in_progress, up_next, in_review, waiting, done)
- Drag-and-drop task editing (control panel only)
- Exponential backoff polling for reliable data fetching

### Data Persistence
- Supabase backend for state persistence
- LocalStorage for UI preferences and temporary data
- YouTube chapter marker support
- State validation to prevent sync issues

## Development Notes

### Timezone Handling
- Uses 'Europe/Paris' timezone for consistent day boundaries
- Date formatting uses CA format (YYYY-MM-DD) for API consistency
- All timestamps are stored as Unix milliseconds

### CSS Architecture
- Centralized color palette in `variables.css`
- Status colors defined as CSS variables for easy theming
- Shared styles between overlay and page components
- OBS transparency overrides for browser source compatibility

### Performance Optimizations
- requestAnimationFrame for timer updates instead of setInterval
- Exponential backoff for API polling on errors
- Staleness detection for overlay data
- Manual chunk optimization in Vite build

### Constants
- All magic numbers and strings centralized in `constants.js`
- Storage keys defined once and reused
- Polling intervals configurable
- Task statuses as constants for type safety

## Known Issues & Fixes

### Timer Reset at Day Boundary
- **Issue**: Timer could reset incorrectly at day boundaries
- **Fix**: Uses consistent timezone handling and session_start_timestamp for better tracking

### Scene Sync Issues
- **Issue**: OBS scenes not syncing with mode changes
- **Fix**: Added proper scene mapping and connection state tracking

### State Validation
- **Issue**: Inconsistent state could cause UI errors
- **Fix**: Added validateState function to catch inconsistencies early

## Import Usage

```javascript
// Import specific components
import { GrossGauntletApp, GrossGauntletControl } from './components/GrossGauntlet';

// Import utilities
import { formatHMS, formatDate, relativeTime } from './components/GrossGauntlet/utils';

// Import constants
import { STORAGE_KEYS, OBS_CONFIG, TASK_STATUSES } from './components/GrossGauntlet/constants';

// Import everything (not recommended for production)
import * as GrossGauntlet from './components/GrossGauntlet';
```

## Future Improvements

- [ ] Break down GrossGauntletApp.jsx into smaller sub-components
- [ ] Add proper TypeScript types
- [ ] Implement error boundary components
- [ ] Add unit tests for utility functions
- [ ] Implement proper state management (Zustand store)
- [ ] Add WebSocket reconnection logic
- [ ] Implement proper logging system
