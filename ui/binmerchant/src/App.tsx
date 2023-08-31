import './App.css';
import { Fragment, useCallback, useEffect } from 'react';
import {
  useRecoilState,
  useRecoilValue,
} from 'recoil';
import { FixedSizeList as List } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";
import { BinExport2 } from './BinExport2';
import Long from 'long';
import { model, IFlowGraph, IBasicBlock, IInstruction, IOperand, IExpression } from './Model';

function addressId(address: Long): string {
  return `address-${address.toString(0x10).toUpperCase()}`;
}

function addressKey(address: Long): string {
  return address.toString(0x10);
}

function Address({address}: {address: Long}) {
  return (<span className="address">{address.toString(0x10).toUpperCase()}</span>);
}

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

function Expression({expr}: {expr: IExpression}) {
  const children = expr.children.map((child, index) => (
    <Expression expr={child} key={index} />
  ));

  switch (expr.type) {
    case BinExport2.Expression.Type.SIZE_PREFIX:
      return (<span className="expression size-prefix">{children}</span>);
    case BinExport2.Expression.Type.IMMEDIATE_FLOAT:
      console.assert(children.length === 0, "error: unexpected children");
      return (<span className="expression immediate-float">{expr.immediate?.toString()}</span>)
    case BinExport2.Expression.Type.IMMEDIATE_INT:
      console.assert(children.length === 0, "error: unexpected children");
      return (<span className="expression immediate-int">{expr.immediate?.toString(16).toUpperCase()}h</span>)
    case BinExport2.Expression.Type.REGISTER:
      console.assert(children.length === 0, "error: unexpected children");
      return (<span className="expression register">{expr.symbol}</span>)
    case BinExport2.Expression.Type.SYMBOL:
      console.assert(children.length === 0, "error: unexpected children");
      return (<span className="expression symbol">{expr.symbol}</span>)
    case BinExport2.Expression.Type.OPERATOR:
      if (children.length === 1) {
        return (<span className="expression operator">{expr.symbol}{children[0]}</span>)
      } else {
        // like reg+number
        // like reg+reg+number
        return (<span className="expression operator">
          {children.map((child, index) => (
            <Fragment key={index}>
              {!! index && expr.symbol}
              {child}
            </Fragment>
          ))}
          </span>)
      }
    case BinExport2.Expression.Type.DEREFERENCE:
      console.assert(children.length === 1, "error: unexpected children");
      return (<span className="expression dereference">[{children[0]}]</span>)
    default:
      return (<div>error: unexpected expression type</div>)
  }
}

function Operand({op}: {op: IOperand}) {
  return (
    <span className="operand">
      <Expression expr={op.expression} />
    </span>
  )
}

function Instruction({insn}: {insn: IInstruction}) {
  const [_, setCurrentAddress] = useRecoilState(model.currentAddress);

  return (
    <span className="instruction">
      <span className="address" id={addressId(insn.address)}>
        <Address address={insn.address} />
      </span>

      <span className="bytes"></span>

      <span className="mnemonic">{insn.mnemonic}</span>

      <span className="operands">
        {insn.operands.map((operand, index) => (
          <Fragment key={index}>
            {!! index && ", "}
            <Operand op={operand} key={index} />
          </Fragment>
        ))}
      </span>

      <span className="comment">
        {insn.callTargets.map((target) => (
          <Fragment key={addressKey(target)}>
            <a onClick={() => setCurrentAddress(target)}>
              →<Address address={target} />
            </a>
            {" "}
          </Fragment>
        ))}
      </span>
    </span>
  )
}

function BasicBlock({bb}: {bb: IBasicBlock}) {
  return (
    <div className="basic-block">
      {bb.instructions.map((insn) => (
        <Instruction insn={insn} key={insn.index} />
      ))}
    </div>
  )
}

function FlowGraph({fg}: {fg: IFlowGraph}) {
  return (
    <div className="flow-graph">
      {fg.basicBlocks.map((bb) => (
        <BasicBlock bb={bb} key={bb.index} />
      ))}
    </div>
  )
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
        {currentFlowGraph == null ? "" : <FlowGraph fg={currentFlowGraph} />}
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
