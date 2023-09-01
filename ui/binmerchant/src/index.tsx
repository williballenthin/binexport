import React from 'react';
import { RecoilRoot } from 'recoil'
import { RecoilURLSyncJSON } from 'recoil-sync';
import ReactDOM from 'react-dom/client';
import './index.css';

import App from './App';
import Loading from "./Loading";

async function main() {
  const root = ReactDOM.createRoot(
    document.getElementById('root') as HTMLElement
  );

  root.render(
    <React.StrictMode>
      <RecoilRoot>
        <RecoilURLSyncJSON location={{part: 'queryParams'}}>
          <React.Suspense fallback={<Loading />}>
            <App />
          </React.Suspense>
        </RecoilURLSyncJSON>
      </RecoilRoot>
    </React.StrictMode>
  );
}

main();