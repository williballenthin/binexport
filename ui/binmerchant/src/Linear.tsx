import './App.css';
import { Fragment } from 'react';
import {
  useRecoilState,
} from 'recoil';
import { BinExport2 } from './BinExport2';
import Long from 'long';
import { model, IFlowGraph, IBasicBlock, IInstruction, IOperand, IExpression } from './Model';

export function addressId(address: Long): string {
  return `address-${address.toString(0x10).toUpperCase()}`;
}

export function addressKey(address: Long): string {
  return address.toString(0x10);
}

export function Address({address}: {address: Long}) {
  return (<span className="address">{address.toString(0x10).toUpperCase()}</span>);
}

export function Expression({expr}: {expr: IExpression}) {
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

export function Operand({op}: {op: IOperand}) {
  return (
    <span className="operand">
      <Expression expr={op.expression} />
    </span>
  )
}

export function Instruction({insn}: {insn: IInstruction}) {
  const [_, setCurrentAddress] = useRecoilState(model.currentAddress);

  return (
    <span className="instruction">
      <span className="address" id={addressId(insn.address)}>
        <Address address={insn.address} />
      </span>

      <span className="bytes">
        {[...insn.rawBytes].map((b: number, index: number) => (
          <span className="byte" key={index}>{b.toString(16).padStart(2, '0')}</span>
        ))}
      </span>

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

export function BasicBlock({bb}: {bb: IBasicBlock}) {
  return (
    <div className="basic-block" data-bb-index={bb.index}>
      {bb.instructions.map((insn) => (
        <Fragment key={insn.index}>
            <Instruction insn={insn} />
            <br />
        </Fragment>
      ))}
    </div>
  )
}

export function FlowGraph({fg}: {fg: IFlowGraph}) {
  return (
    <div className="linear-flow-graph flow-graph">
      {fg.basicBlocks.map((bb) => (
        <BasicBlock bb={bb} key={bb.index} />
      ))}
    </div>
  )
}