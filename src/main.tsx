import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {RecoilRoot} from 'recoil';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {navigator.usb != null ? (
      <RecoilRoot>
        <App />
      </RecoilRoot>
    ) : (
      <div className="p-10">
        This application is only supported by Chromium browsers (Chrome, Edge,
        etc)
      </div>
    )}
  </StrictMode>,
);
