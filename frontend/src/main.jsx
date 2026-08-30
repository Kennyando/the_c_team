import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

// No StrictMode: its deliberate double-invocation would speak every narration line twice.
createRoot(document.getElementById('root')).render(<App />);
