// TODO:
//   - missing BB content in 7FFB612C10B0
import { useCallback, useEffect } from 'react';
import {
  useRecoilState,
  useRecoilValue,
} from 'recoil';
import { FixedSizeList as List } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";
import { BinExport2 } from './BinExport2';
import { model } from './Model';
import { Address } from './Linear';
import * as Linear from './Linear';
import * as Graph from './Graph';
import './App.css';

function Meta({meta}: {meta: BinExport2.IMeta | null | undefined}) {
  const currentAddress = useRecoilValue(model.currentAddress);

  if (meta == null) {
    return (<div style={{borderBottom: "1px solid #CCCCCC"}}>
      <dl>
        <dt>meta</dt>
        <dd>(none)</dd>
      </dl>
    </div>)
  }

  return (
    <div style={{borderBottom: "1px solid #CCCCCC"}}>
      <dl>
        <dt>arch</dt>
        <dd>{meta.architectureName}</dd>

        <dt>executable id</dt>
        <dd>{meta.executableId}</dd>

        <dt>executeable name</dt>
        <dd>{meta.executableName}</dd>

        <dt>address</dt>
        <dd><Address address={currentAddress} /></dd>
      </dl>
    </div>
  )
}

function FunctionList() {
  const [currentAddress, setCurrentAddress] = useRecoilState(model.currentAddress);
  const addresses = useRecoilValue(model.functionList);

  const Row = ({ index, style }: {index: number, style: any}) => {
    const address = addresses[index];
    const isCurrentAddress = address.eq(currentAddress);

    return (<div style={{fontWeight: isCurrentAddress ? "bold" : "normal", ...style}}>
      <a onClick={() => setCurrentAddress(address)}>
        <Address address={address} />
      </a>
    </div>)
  };

  return (
    <AutoSizer>
      {({ height, width }: {height: number, width: number}) => (
          <List
            className="function-list"
            height={height}
            width={width}
            itemCount={addresses.length}
            itemSize={16}
          >
            {Row}
          </List>
      )}
    </AutoSizer>
  );
}

function App() {
  const sha256 = useRecoilValue(model.sha256);
  const be: BinExport2 = useRecoilValue(model.be)
  const currentAddress = useRecoilValue(model.currentAddress);
  const currentFlowGraph = useRecoilValue(model.currentFlowGraph);

  document.title = `BinMerchant: ${sha256}: ${currentAddress}`;

  const handleEscPress = useCallback((event: any) => {
    if (event.key === "Escape") {
      event.preventDefault();
      window.history.back();
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keyup', handleEscPress);

    return () => {
      document.removeEventListener('keyup', handleEscPress);
    };
  }, [handleEscPress]);

  return (
    <div className="App">
      <Meta meta={be.metaInformation} />
      <div style={{position: "relative"}}>
        {currentFlowGraph == null ? "" : <Graph.FlowGraph fg={currentFlowGraph} />}
        <div style={{
            position: "absolute",
            right: "0px",
            top:  "0px", 
            // 113px: height of metadata. determined empirically, sorry.
            height: "calc(100vh - 113px - 2px)", 
            width: "9em", 
            overflow: "scroll", 
            fontFamily: "IntelOneMono",
            borderLeft: "1px solid #CCCCCC",
            paddingLeft: "1em",
          }}>
          <FunctionList />
        </div>
      </div>
    </div>
  );
}

export default App;
