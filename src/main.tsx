import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'

// We no longer need to await a promise here.
// The app can now render immediately.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);