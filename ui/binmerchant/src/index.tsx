import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

import { BinExport2 } from './BinExport2';


async function main() {
  // render "loading"
  // get sha256 from URL
  // fetch BinExport by sha256
  // fetch bytes by sha256
  // parse BinExport
  // render

  const sha256 = "0501d09a219131657c54dba71faf2b9d793e466f2c7fdf6b0b3c50ec5b866b2a";

  const raw_be = await (await fetch(`/data/${sha256}.BinExport`)).arrayBuffer();
  const sample = await (await fetch(`/data/${sha256}`)).arrayBuffer();

  document.title = `BinMerchant: ${sha256}`;

  console.log("hi");

  const be = BinExport2.decode(new Uint8Array(raw_be));
  console.log(be);

  console.log("ok");

  const root = ReactDOM.createRoot(
    document.getElementById('root') as HTMLElement
  );

  if (be) {
    root.render(
      <React.StrictMode>
        <App be={be} />
      </React.StrictMode>
    );
  } else {
    console.log("no BinExport found.")
  }
}

main();