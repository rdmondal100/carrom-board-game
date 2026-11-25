import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import { Provider } from 'react-redux';
import { App } from './App';
import { store } from './store/store';
import './index.css';

const el = document.getElementById('root');
if (!el) throw new Error('Missing #root element');

createRoot(el).render(
  <StrictMode>
    <Provider store={store}>
      {/* MOT-5 follow the OS "reduce motion" setting. */}
      <MotionConfig reducedMotion="user">
        <App />
      </MotionConfig>
    </Provider>
  </StrictMode>,
);
