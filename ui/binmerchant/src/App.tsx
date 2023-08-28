import './App.css';
import { Fragment } from 'react';
import { string, custom } from '@recoiljs/refine';
import {
  DefaultValue,
  atom,
  selector,
  useRecoilState,
  useRecoilValue,
} from 'recoil';
import { BinExport2 } from './BinExport2';
import Long from 'long';
import { urlSyncEffect } from 'recoil-sync';

const sha256State = atom({
  key: "sha256State",
  default: "0501d09a219131657c54dba71faf2b9d793e466f2c7fdf6b0b3c50ec5b866b2a",
  effects: [
    urlSyncEffect({ 
      history: "push",
      syncDefault: true,
      itemKey: "sha256",
      refine: string() 
    }),
  ]
});

const binExportValue = selector({
  key: 'binExportValue',
  get: async ({get}) => {
    const sha256 = get(sha256State);
    const raw_be = await (await fetch(`/data/${sha256}.BinExport`)).arrayBuffer();

    return BinExport2.decode(new Uint8Array(raw_be));
  },
});

function getFlowGraphAddress(be: BinExport2, fgIndex: number): Long | null {
  const fg = be.flowGraph[fgIndex];

  const bbIndex = fg.entryBasicBlockIndex;
  if (bbIndex == null) {
    return null;
  }
  const bb = be.basicBlock[bbIndex];
  if (bb.instructionIndex == null) {
    return null;
  }
  const ii = bb.instructionIndex[0];
  if (ii.beginIndex == null) {
    return null;
  }
  const insnIndex = ii.beginIndex;

  const insn = be.instruction[insnIndex];

  const insnAddress = getInstructionAddress(insn);
  if (insnAddress == null) {
    // this might be the case if the prior instruction has an address and size.
    return null;
  }

  return insnAddress
}

const defaultAddressValue = selector({
  key: 'defaultAddressValue',
  get: ({get}) => {
    const be = get(binExportValue);
    const address = getFlowGraphAddress(be, 0);
    if (address == null) {
      throw new Error("first function has no address");
    }
    return address;
  },
});

const currentAddressState = atom({
  key: "addressState",
  default: defaultAddressValue,
  effects: [
    urlSyncEffect({ 
      history: "push",
      syncDefault: true,
      itemKey: "address",
      refine: custom(x => Long.isLong(x) ? x : null),
      read: ({read}) => {
        const v = read("address");

        if (v instanceof DefaultValue) {
          return Long.fromNumber(0);
        }

        return Long.fromString(read("address") as any, true, 0x10);
      },
      write: ({write, read}, newValue) => {
        write("address", newValue.toString(0x10))
      },
    })
  ]
});

const binExportIndexValue = selector({
  key: "binExportIndexValue",
  get: ({get}) => {
    const be: BinExport2 = get(binExportValue)

    // from address (as hex) to insn index
    const insnByAddress: Record<string, number> = {};
    for (const [index, insn] of be.instruction.entries()) {
      const iaddr = getInstructionAddress(insn);
      if (iaddr == null) {
        continue;
      }

      insnByAddress[iaddr.toString(16)] = index;
    }

    // from insn index to bb index
    const bbByInsn: Record<number, number> = {};
    for (const [index, bb] of be.basicBlock.entries()) {
      if (bb.instructionIndex == null) {
        continue;
      }

      const ii = bb.instructionIndex[0];
      if (ii.beginIndex == null) {
        continue
      }

      bbByInsn[ii.beginIndex] = index;
    }

    const fgByBb: Record<number, number> = {};
    for (const [index, fg] of be.flowGraph.entries()) {
      if (fg.entryBasicBlockIndex == null) {
        continue
      }

      fgByBb[fg.entryBasicBlockIndex] = index;
    }

    function getFlowGraphByAddress(address: Long): number | null {
      const insnIndex = insnByAddress[address.toString(16)];
      if (insnIndex == null) {
        return null;
      }

      const bbIndex = bbByInsn[insnIndex];
      if (bbIndex == null) {
        return null;
      }

      const fgIndex = fgByBb[bbIndex];
      if (fgIndex == null) {
        return null;
      }

      return fgIndex;
    }

    return {
      getFlowGraphByAddress
    }
  }
})

const currentFlowGraphIndexValue = selector({
  key: 'currentFlowGraphIndexValue',
  get: ({get}) => {
    const currentAddress = get(currentAddressState);
    const beIndex = get(binExportIndexValue);

    return beIndex.getFlowGraphByAddress(currentAddress)
  },
});

function Meta({meta}: {meta: BinExport2.IMeta | null | undefined}) {
  const [currentAddress, setCurrentAddress] = useRecoilState(currentAddressState);

  if (meta) {
    return (
      <div>
        <dl>
          <dt>arch</dt>
          <dd>{meta.architectureName}</dd>

          <dt>executable id</dt>
          <dd>{meta.executableId}</dd>

          <dt>executeable name</dt>
          <dd>{meta.executableName}</dd>

          <dt>address</dt>
          <dd>{currentAddress.toString(0x10).toUpperCase()}</dd>
        </dl>
      </div>
    )
  } else {
    return (
      <dl></dl>
    )
  }
}

function FunctionList() {
  const be = useRecoilValue(binExportValue);
  const [currentAddress, setCurrentAddress] = useRecoilState(currentAddressState);

  const addresses = [];
  for (const fgIndex of be.flowGraph.keys()) {
    const fgAddress = getFlowGraphAddress(be, fgIndex);
    if (fgAddress == null) {
      continue;
    }

    addresses.push(fgAddress);
  }

  return (
    <ul>
      {addresses.map((address) => (
        <li key={address.toString(0x10)} style={{fontWeight: address.eq(currentAddress) ? "bold" : "normal"}}>
          <a onClick={() => setCurrentAddress(address)}>
            {address.toString(0x10).toUpperCase()}
          </a>
        </li>
      ))}
    </ul>
  );
}

function Expression({be, index, expr, childrenByIndex}: {be: BinExport2, index: number, expr: BinExport2.IExpression, childrenByIndex: Record<number, Array<number>>}) {
  if (expr.type == null) {
    return (<div>error: no expression type</div>)
  };

  const childrenIndices = childrenByIndex[index];

  const children = childrenIndices.map((childIndex, index) => (
    <Expression be={be} index={childIndex} expr={be.expression[childIndex]} childrenByIndex={childrenByIndex} key={index} />
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

function Operand({be, op}: {be: BinExport2, op: BinExport2.IOperand}) {
  if (op.expressionIndex == null) {
    return (<div>error: operand has no expression</div>);
  }

  const childrenByIndex: Record<number, Array<number>> = {0: []};
  op.expressionIndex.forEach((exprIndex) => {
    childrenByIndex[exprIndex] = []; 
    const expr = be.expression[exprIndex];
    if (expr.parentIndex != null && expr.parentIndex !== exprIndex) {
      childrenByIndex[expr.parentIndex].push(exprIndex);
    }
  });

  const childIndex0 = op.expressionIndex[0];

  return (
    <span className="operand">
      <Expression be={be} index={childIndex0} expr={be.expression[childIndex0]} childrenByIndex={childrenByIndex} />
    </span>
  )
}

function Instruction({be, address, insn}: {be: BinExport2, address: Long, insn: BinExport2.IInstruction}) {
  const beIndex = useRecoilValue(binExportIndexValue);
  const [currentAddress, setCurrentAddress] = useRecoilState(currentAddressState);

  if (insn.mnemonicIndex == null) {
    return (<div>error: instruction has no mnemonic</div>);
  }

  const mnem = be.mnemonic[insn.mnemonicIndex];

  const targets: Array<Long> = [];
  if (insn.callTarget != null) {
    for (const callTarget of insn.callTarget) {
      const callTargetAddress = beIndex.getFlowGraphByAddress(ensureLong(callTarget))
      if (callTargetAddress == null) {
        continue;
      }
      targets.push(ensureLong(callTarget));
    }
  }

  return (
    <span className="instruction">
      <span className="address" id={address.toString(0x10)}>
        {address.toString(16).toUpperCase()}
      </span>

      <span className="bytes"></span>

      <span className="mnemonic">{mnem.name}</span>

      <span className="operands">
        {insn.operandIndex?.map((opIndex, index) => (
          <Fragment key={index}>
            {!! index && ", "}
            <Operand be={be} op={be.operand[opIndex]} key={index} />
          </Fragment>
        ))}
      </span>

      <span className="comment">
        {targets.map((target) => (
          <Fragment key={target.toString(0x10)}>
            <a onClick={() => setCurrentAddress(target)}>
              →{target.toString(0x10).toUpperCase()}
            </a>
            {" "}
          </Fragment>
        ))}
      </span>
    </span>
  )
}

function* getBasicBlockInstructionIndices(bb: BinExport2.IBasicBlock) {
  if (!bb.instructionIndex) {
    return;
  }

  for (const insnRange of bb.instructionIndex) {
    if (insnRange.endIndex != null && insnRange.beginIndex != null) {
      for (let insnIndex = insnRange.beginIndex; insnIndex < insnRange.endIndex; insnIndex++) {
        yield insnIndex;
      }
    } else if (insnRange.beginIndex != null) {
      yield insnRange.beginIndex;
    } else {
    }
  }

  return;
}

function ensureLong(v: number | Long): Long  {
  if (Long.isLong(v)) {
    return v;
  } else if (Number.isInteger(v)) {
    return Long.fromString(v.toString(0x10), true, 0x10);
  } else {
    throw new Error("unexpected type");
  }
}

function getInstructionAddress(insn: BinExport2.IInstruction): Long | null {
  if (insn.address == null) {
    return null;
  } else if (Long.isLong(insn.address)) {
    return insn.address;
  } else if (Number.isInteger(insn.address) && insn.address !== 0x0) {
    // I'm quite sure how unsafe integers are being passed back here.
    // but translating them to strings and then back to longs seems to work.
    return Long.fromString(insn.address.toString(0x10), true, 0x10);
  } else if (Number.isInteger(insn.address) && insn.address === 0x0) {
    return null;
  } else {
    return null;
  }
}

function BasicBlock({be, bb}: {be: BinExport2, bb: BinExport2.IBasicBlock}) {
  if (bb.instructionIndex == null) {
    return (<div>error: basic block has no instruction index</div>);
  }

  let address: Long = new Long(0);
  const instructions = [];
  for (const insnIndex of getBasicBlockInstructionIndices(bb)) {
    const insn = be.instruction[insnIndex];

    const iaddr = getInstructionAddress(insn);
    if (iaddr != null) {
      address = iaddr;
    }

    instructions.push(<Instruction be={be} insn={be.instruction[insnIndex]} address={address} key={address.toString(16)} />)

    if (insn.rawBytes != null) {
      address = address.add(new Long(insn.rawBytes.length));
    }
  }

  return (
    <div className="basic-block">
      {instructions}
    </div>
  )
}

function FlowGraph({be, fg}: {be: BinExport2, fg: BinExport2.IFlowGraph}) {
  if (fg.basicBlockIndex == null) {
    return (<div>error: flow graph has no basic block index</div>);
  }

  return (
    <div className="flow-graph">
      {fg.basicBlockIndex.map((bbIndex, index) => (
        <BasicBlock be={be} bb={be.basicBlock[bbIndex]} key={index} />
      ))}
    </div>
  )
}


function App() {
  const [sha256, setSha256] = useRecoilState(sha256State);
  const be: BinExport2 = useRecoilValue(binExportValue)
  const [currentAddress, setCurrentAddress] = useRecoilState(currentAddressState);
  const currentFlowGraphIndex = useRecoilValue(currentFlowGraphIndexValue);

  document.title = `BinMerchant: ${sha256}: ${currentAddress}`;

  for (const section of be.section) {
    //console.log(section.address?.toString(0x10), section.size?.toString(0x10));
  }

  for (const library of be.library) {
    //console.log(library.name, library.loadAddress?.toString(0x10));
  }

  return (
    <div className="App">
      <Meta meta={be.metaInformation} />
      <div style={{position: "relative"}}>
        {currentFlowGraphIndex == null ? "" : <FlowGraph be={be} fg={be.flowGraph[currentFlowGraphIndex]} />}
        <div style={{position: "absolute", right: "0px", top:  "0px", height: "calc(100vh - 200px)", overflow: "scroll"}}>
          <FunctionList />
        </div>
      </div>
    </div>
  );
}

export default App;
