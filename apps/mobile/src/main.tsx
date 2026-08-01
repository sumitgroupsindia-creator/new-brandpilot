import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@brandpilot/web/index.css';

function MobileShell() {
  const steps = [
    'Choose a category and subcategory',
    'Pick the image you want to brand',
    'Select a frame and fill its values',
    'Download or queue the final result',
  ];

  return (
    <div className="min-h-screen bg-brand-surface px-4 py-6 text-slate-900 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-5xl flex-col justify-between rounded-[36px] border border-white/70 bg-white/80 p-6 shadow-[0_30px_80px_rgba(15,23,42,0.12)] backdrop-blur-2xl sm:p-8">
        <div>
          <div className="pill">Mobile studio</div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            The same premium flow, now on mobile.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
            Pick a category, navigate a subcategory, choose an image, select a frame, and finish with a branded download or generation job.
          </p>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {steps.map((step, index) => (
            <div key={step} className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 transition-all duration-300 hover:-translate-y-1">
              <p className="text-[11px] uppercase tracking-[0.24em] text-teal-700">Step {index + 1}</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{step}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <MobileShell />
    </BrowserRouter>
  </React.StrictMode>,
);
