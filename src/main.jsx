import React from 'react';import {createRoot} from 'react-dom/client';import {AuthProvider} from './auth/AuthContext';import {ThemeProvider} from './lib/theme';import App from './App';import './styles.css';
createRoot(document.getElementById('root')).render(<ThemeProvider><AuthProvider><App/></AuthProvider></ThemeProvider>);
